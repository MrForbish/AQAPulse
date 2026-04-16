/**
 * Назначение: подготовка reporter report к backend upload из CI. Здесь собираются локальные Playwright screenshots/markdown, а также preview-артефакты из artifact zip, чтобы ingestion получил самодостаточный payload.
 */
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
    ReporterAttachment,
    ReporterAttempt,
    ReporterRoot,
    ReporterTest,
} from '../dashboard-utils'

const INLINE_ATTACHMENT_MAX_SIZE_BYTES = 5 * 1024 * 1024
const DEFAULT_INLINE_ATTACHMENTS_TOTAL_MAX_SIZE_BYTES = 12 * 1024 * 1024

type SanitizeForFilePath = (value: string) => string
type TrimLongString = (value: string, length?: number) => string

interface AttachmentDebugStats {
    testsTotal: number
    attemptsTotal: number
    attemptsWithResolvedOutputDirectories: number
    attemptsWithDiscoveredAttachments: number
    discoveredAttachments: number
    attachmentsKept: number
    attachmentsDroppedAfterNormalization: number
    outputDirectoryNameBuildFailures: number
    outputDirectoryExactMatches: number
    outputDirectoryFallbackMatches: number
    outputDirectoryMisses: number
    inlineSkippedTooLargeCount: number
    inlineSkippedTooLargeBytes: number
    inlineSkippedBudgetCount: number
    inlineSkippedBudgetBytes: number
}

interface InlineAttachmentBudget {
    remainingBytes: number
}

interface ZipEntryLike {
    isDirectory: boolean
    entryName: string
    getData(): Buffer
}

interface ZipArchiveLike {
    getEntries(): ZipEntryLike[]
}

type AdmZipLikeConstructor = new (zipPath: string) => ZipArchiveLike

interface PreparedReportContext {
    reportPath: string
    extractionRoot: string
    extractionCache: Map<string, ReporterAttachment[]>
    inlineAttachmentBudget: InlineAttachmentBudget
    debugStats: AttachmentDebugStats
}

interface PreparedAttemptContext extends PreparedReportContext {
    test: ReporterTest
    baseDirectories: string[]
    artifactSearchRoots: string[]
    preferExactArtifactMatch: boolean
}

interface ReportPreparationOptions {
    reportPath: string
    preparedReportPath?: string | null
    debugAttachmentsSummary?: boolean
    inlineAttachmentsTotalMaxSizeBytes?: number | null
}

let playwrightSanitizeForFilePath: SanitizeForFilePath = fallbackSanitizeForFilePath
let playwrightTrimLongString: TrimLongString = fallbackTrimLongString
let playwrightWindowsFilesystemFriendlyLength = 60

initializePlaywrightFileNameUtilities()

export function prepareReporterReportForUpload(report: ReporterRoot, options: ReportPreparationOptions): ReporterRoot {
    if (!report || typeof report !== 'object' || !Array.isArray(report.tests)) {
        persistPreparedReportIfRequested(report, options.preparedReportPath ?? null)
        return report
    }

    const reportPath = path.resolve(options.reportPath)
    const debugStats = createAttachmentDebugStats()
    const context: PreparedReportContext = {
        reportPath,
        extractionRoot: path.join(path.dirname(reportPath), '.aqa-pulse-upload-artifacts'),
        extractionCache: new Map(),
        inlineAttachmentBudget: {
            remainingBytes: resolveInlineAttachmentsTotalLimit(options.inlineAttachmentsTotalMaxSizeBytes),
        },
        debugStats,
    }

    const preparedReport: ReporterRoot = {
        ...report,
        tests: report.tests.map((test) => prepareTestForUpload(test, context)),
    }

    persistPreparedReportIfRequested(preparedReport, options.preparedReportPath ?? null)

    if (options.debugAttachmentsSummary === true) {
        printPreparedReportSnapshot(preparedReport)
        printAttachmentDebugSummary(debugStats)
    }

    return preparedReport
}

function prepareTestForUpload(test: ReporterTest, context: PreparedReportContext): ReporterTest {
    const normalizedTest = { ...test } as ReporterTest & { aqaPulseSourceReportPath?: string }
    const sourceReportPath = pickOptionalText(normalizedTest.aqaPulseSourceReportPath)
    delete normalizedTest.aqaPulseSourceReportPath

    context.debugStats.testsTotal += 1

    const baseDirectories = [
        sourceReportPath ? path.dirname(path.resolve(sourceReportPath)) : null,
        path.dirname(context.reportPath),
        process.cwd(),
    ].filter((value): value is string => Boolean(value))
    const preferredArtifactSearchRoots = resolvePreferredArtifactSearchRoots(sourceReportPath ?? context.reportPath)
    const artifactSearchRoots = preferredArtifactSearchRoots.length > 0
        ? preferredArtifactSearchRoots
        : collectArtifactSearchRoots(baseDirectories)

    return {
        ...normalizedTest,
        attempts: Array.isArray(normalizedTest.attempts)
            ? normalizedTest.attempts.map((attempt) => prepareAttemptForUpload(attempt, {
                ...context,
                test: normalizedTest,
                baseDirectories,
                artifactSearchRoots,
                preferExactArtifactMatch: preferredArtifactSearchRoots.length > 0,
            }))
            : normalizedTest.attempts,
    }
}

function prepareAttemptForUpload(attempt: ReporterAttempt, context: PreparedAttemptContext): ReporterAttempt {
    context.debugStats.attemptsTotal += 1

    const discoveredAttachments = discoverAttemptAttachments(context.test, attempt, context)
    const existingAttachments = Array.isArray(attempt.attachments) ? attempt.attachments : []

    if (existingAttachments.length === 0 && discoveredAttachments.length === 0) {
        return attempt
    }

    const preparedAttachments: ReporterAttachment[] = []
    const seenAttachments = new Set<string>()

    for (const attachment of [...existingAttachments, ...discoveredAttachments]) {
        const normalizedAttachment = normalizeAttachmentForUpload(attachment, context)

        if (shouldKeepAttachmentForUpload(normalizedAttachment)) {
            pushUniqueAttachment(preparedAttachments, normalizedAttachment, seenAttachments)
            context.debugStats.attachmentsKept += 1
        } else {
            context.debugStats.attachmentsDroppedAfterNormalization += 1
        }

        for (const extractedAttachment of extractPreviewArtifactsFromAttachment(normalizedAttachment, context)) {
            const normalizedExtractedAttachment = normalizeAttachmentForUpload(extractedAttachment, context)

            if (shouldKeepAttachmentForUpload(normalizedExtractedAttachment)) {
                pushUniqueAttachment(preparedAttachments, normalizedExtractedAttachment, seenAttachments)
                context.debugStats.attachmentsKept += 1
            } else {
                context.debugStats.attachmentsDroppedAfterNormalization += 1
            }
        }
    }

    return {
        ...attempt,
        attachments: preparedAttachments,
    }
}

function normalizeAttachmentForUpload(attachment: ReporterAttachment, context: PreparedAttemptContext): ReporterAttachment {
    if (!attachment || typeof attachment !== 'object') {
        return attachment
    }

    const attachmentPath = pickOptionalText(attachment.path)

    if (!attachmentPath || isExternalAttachmentPath(attachmentPath)) {
        return attachment
    }

    const resolvedPath = resolveExistingArtifactPath(attachmentPath, context.baseDirectories)

    if (!resolvedPath) {
        return attachment
    }

    return enrichAttachmentWithInlineContent({
        ...attachment,
        path: resolvedPath,
    }, context)
}

function extractPreviewArtifactsFromAttachment(attachment: ReporterAttachment, context: PreparedAttemptContext): ReporterAttachment[] {
    const attachmentPath = pickOptionalText(attachment.path)

    if (!attachmentPath || !isArtifactZipAttachment(attachmentPath, attachment.name, attachment.contentType)) {
        return []
    }

    if (!fs.existsSync(attachmentPath) || !fs.statSync(attachmentPath).isFile()) {
        return []
    }

    const cached = context.extractionCache.get(attachmentPath)

    if (cached) {
        return cached
    }

    const extractedAttachments = extractPreviewArtifactsFromZip(attachmentPath, context.extractionRoot)
    context.extractionCache.set(attachmentPath, extractedAttachments)
    return extractedAttachments
}

function extractPreviewArtifactsFromZip(zipPath: string, extractionRoot: string): ReporterAttachment[] {
    const AdmZip = loadAdmZip()

    if (!AdmZip) {
        return []
    }

    const archiveHash = crypto.createHash('sha1').update(zipPath).digest('hex').slice(0, 12)
    const targetRoot = path.join(extractionRoot, archiveHash)
    const archive = new AdmZip(zipPath)
    const extractedAttachments: ReporterAttachment[] = []

    for (const entry of archive.getEntries()) {
        if (entry.isDirectory) {
            continue
        }

        const normalizedEntryPath = normalizeZipEntryPath(entry.entryName)

        if (!normalizedEntryPath || !shouldExposeExtractedArtifact(normalizedEntryPath)) {
            continue
        }

        const resolvedTargetRoot = path.resolve(targetRoot)
        const targetPath = path.resolve(targetRoot, normalizedEntryPath)

        if (!targetPath.startsWith(`${resolvedTargetRoot}${path.sep}`) && targetPath !== resolvedTargetRoot) {
            continue
        }

        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
        fs.writeFileSync(targetPath, entry.getData())
        extractedAttachments.push({
            name: normalizedEntryPath,
            contentType: detectContentType(normalizedEntryPath),
            path: targetPath,
        })
    }

    return extractedAttachments.sort(compareExtractedArtifacts)
}

function normalizeZipEntryPath(entryName: string): string | null {
    if (typeof entryName !== 'string') {
        return null
    }

    const normalized = entryName
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .split('/')
        .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
        .join('/')

    return normalized || null
}

function shouldExposeExtractedArtifact(filePath: string): boolean {
    return isImagePath(filePath)
        || isMarkdownPath(filePath)
        || /(^|\/)error-context\.md$/i.test(filePath)
}

function compareExtractedArtifacts(left: ReporterAttachment, right: ReporterAttachment): number {
    return getAttachmentPriority(left.name) - getAttachmentPriority(right.name)
        || String(left.name ?? '').localeCompare(String(right.name ?? ''))
}

function getAttachmentPriority(name: string | undefined): number {
    const normalizedName = String(name ?? '').toLowerCase()

    if (normalizedName.endsWith('error-context.md')) {
        return 0
    }

    if (isImagePath(normalizedName)) {
        return 1
    }

    if (isMarkdownPath(normalizedName)) {
        return 2
    }

    return 3
}

function detectContentType(filePath: string): string | undefined {
    const normalizedPath = String(filePath).toLowerCase()

    if (normalizedPath.endsWith('.zip')) {
        return 'application/zip'
    }

    if (normalizedPath.endsWith('.png')) {
        return 'image/png'
    }

    if (normalizedPath.endsWith('.jpg') || normalizedPath.endsWith('.jpeg')) {
        return 'image/jpeg'
    }

    if (normalizedPath.endsWith('.webp')) {
        return 'image/webp'
    }

    if (normalizedPath.endsWith('.gif')) {
        return 'image/gif'
    }

    if (normalizedPath.endsWith('.svg')) {
        return 'image/svg+xml'
    }

    if (normalizedPath.endsWith('.bmp')) {
        return 'image/bmp'
    }

    if (normalizedPath.endsWith('.md') || normalizedPath.endsWith('.markdown') || normalizedPath.endsWith('.mdx')) {
        return 'text/markdown'
    }

    return undefined
}

function enrichAttachmentWithInlineContent(attachment: ReporterAttachment, context: PreparedAttemptContext): ReporterAttachment {
    const attachmentPath = pickOptionalText(attachment.path)

    if (!attachmentPath || isExternalAttachmentPath(attachmentPath)) {
        return attachment
    }

    if (!shouldInlineAttachmentContent(attachment)) {
        return attachment
    }

    if (!fs.existsSync(attachmentPath) || !fs.statSync(attachmentPath).isFile()) {
        return attachment
    }

    const attachmentStat = fs.statSync(attachmentPath)

    if (attachmentStat.size > INLINE_ATTACHMENT_MAX_SIZE_BYTES) {
        context.debugStats.inlineSkippedTooLargeCount += 1
        context.debugStats.inlineSkippedTooLargeBytes += attachmentStat.size
        return attachment
    }

    if (context.inlineAttachmentBudget.remainingBytes < attachmentStat.size) {
        context.debugStats.inlineSkippedBudgetCount += 1
        context.debugStats.inlineSkippedBudgetBytes += attachmentStat.size
        return attachment
    }

    context.inlineAttachmentBudget.remainingBytes -= attachmentStat.size

    return {
        ...attachment,
        inlineContentBase64: fs.readFileSync(attachmentPath).toString('base64'),
        inlineContentEncoding: 'base64',
        inlineContentSizeBytes: attachmentStat.size,
    }
}

function shouldKeepAttachmentForUpload(attachment: ReporterAttachment): boolean {
    if (!attachment || typeof attachment !== 'object') {
        return false
    }

    const attachmentPath = pickOptionalText(attachment.path)

    if (pickOptionalText(attachment.url)) {
        return true
    }

    if (pickOptionalText(attachment.inlineContentBase64)) {
        return true
    }

    if (!attachmentPath) {
        return false
    }

    if (isExternalAttachmentPath(attachmentPath)) {
        return true
    }

    return isArtifactZipAttachment(attachmentPath, attachment.name, attachment.contentType)
        && isExternalAttachmentPath(attachmentPath)
}

function shouldInlineAttachmentContent(attachment: ReporterAttachment): boolean {
    const contentType = String(attachment.contentType ?? '').toLowerCase()
    const reference = pickOptionalText(attachment.name)
        ?? pickOptionalText(attachment.path)
        ?? ''

    return contentType.startsWith('image/')
        || contentType.includes('markdown')
        || isImagePath(reference)
        || isMarkdownPath(reference)
}

function isArtifactZipAttachment(attachmentPath: string, attachmentName: string | undefined, contentType: string | undefined): boolean {
    const normalizedPath = String(attachmentPath).toLowerCase()
    const normalizedName = String(attachmentName ?? '').toLowerCase()
    const normalizedType = String(contentType ?? '').toLowerCase()
    const looksLikeArtifactArchive = /(^|[\\/])artifacts?\.zip$/i.test(normalizedPath)
        || /^artifacts?\.zip$/i.test(normalizedName)

    return looksLikeArtifactArchive && (normalizedType === 'application/zip' || normalizedType === '' || normalizedType === 'binary/octet-stream')
}

function resolveExistingArtifactPath(artifactPath: string, baseDirectories: string[]): string | null {
    const candidatePaths: string[] = []

    if (path.isAbsolute(artifactPath)) {
        candidatePaths.push(path.resolve(artifactPath))
    }

    for (const baseDirectory of baseDirectories) {
        candidatePaths.push(path.resolve(baseDirectory, artifactPath))
    }

    for (const candidatePath of candidatePaths) {
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
            return candidatePath
        }
    }

    return null
}

function pushUniqueAttachment(attachments: ReporterAttachment[], attachment: ReporterAttachment, seenAttachments: Set<string>): void {
    const uniqueKey = [
        pickOptionalText(attachment.path) ?? '',
        pickOptionalText(attachment.url) ?? '',
        pickOptionalText(attachment.name) ?? '',
    ].join('::')

    if (seenAttachments.has(uniqueKey)) {
        return
    }

    seenAttachments.add(uniqueKey)
    attachments.push(attachment)
}

function isExternalAttachmentPath(value: string): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)
}

function isImagePath(value: string): boolean {
    return /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(value)
}

function isMarkdownPath(value: string): boolean {
    return /\.(md|markdown|mdx)$/i.test(value)
}

function discoverAttemptAttachments(test: ReporterTest, attempt: ReporterAttempt, context: PreparedAttemptContext): ReporterAttachment[] {
    const discoveredAttachments: ReporterAttachment[] = []
    const seenAttachments = new Set<string>()
    const candidateOutputDirectories = resolveAttemptOutputDirectories(test, attempt, context)

    if (candidateOutputDirectories.length > 0) {
        context.debugStats.attemptsWithResolvedOutputDirectories += 1
    }

    for (const outputDirectory of candidateOutputDirectories) {
        for (const artifactFile of readAttemptArtifactFiles(outputDirectory)) {
            pushUniqueAttachment(discoveredAttachments, {
                name: path.basename(artifactFile),
                contentType: detectContentType(artifactFile),
                path: artifactFile,
            }, seenAttachments)
        }
    }

    context.debugStats.discoveredAttachments += discoveredAttachments.length

    if (discoveredAttachments.length > 0) {
        context.debugStats.attemptsWithDiscoveredAttachments += 1
    }

    return discoveredAttachments.sort(compareExtractedArtifacts)
}

function resolveAttemptOutputDirectories(test: ReporterTest, attempt: ReporterAttempt, context: PreparedAttemptContext): string[] {
    const outputDirectoryName = buildPlaywrightOutputDirectoryName(test, attempt)

    if (!outputDirectoryName) {
        context.debugStats.outputDirectoryNameBuildFailures += 1
        return []
    }

    const exactMatches = context.artifactSearchRoots
        .map((rootDirectory) => path.join(rootDirectory, outputDirectoryName))
        .filter((candidatePath) => fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory())

    if (exactMatches.length > 0) {
        context.debugStats.outputDirectoryExactMatches += exactMatches.length
        return uniquePaths(exactMatches)
    }

    if (context.artifactSearchRoots.length > 0 && context.preferExactArtifactMatch) {
        context.debugStats.outputDirectoryMisses += 1
        return []
    }

    const fallbackMatches: string[] = []

    for (const rootDirectory of context.artifactSearchRoots) {
        fallbackMatches.push(...findFallbackOutputDirectories(rootDirectory, test, outputDirectoryName))
    }

    if (fallbackMatches.length > 0) {
        context.debugStats.outputDirectoryFallbackMatches += fallbackMatches.length
    } else {
        context.debugStats.outputDirectoryMisses += 1
    }

    return uniquePaths(fallbackMatches)
}

function createAttachmentDebugStats(): AttachmentDebugStats {
    return {
        testsTotal: 0,
        attemptsTotal: 0,
        attemptsWithResolvedOutputDirectories: 0,
        attemptsWithDiscoveredAttachments: 0,
        discoveredAttachments: 0,
        attachmentsKept: 0,
        attachmentsDroppedAfterNormalization: 0,
        outputDirectoryNameBuildFailures: 0,
        outputDirectoryExactMatches: 0,
        outputDirectoryFallbackMatches: 0,
        outputDirectoryMisses: 0,
        inlineSkippedTooLargeCount: 0,
        inlineSkippedTooLargeBytes: 0,
        inlineSkippedBudgetCount: 0,
        inlineSkippedBudgetBytes: 0,
    }
}

function printAttachmentDebugSummary(debugStats: AttachmentDebugStats): void {
    console.log('[aqa-pulse][debug] upload attachment summary')
    console.log(`[aqa-pulse][debug] tests=${debugStats.testsTotal} attempts=${debugStats.attemptsTotal}`)
    console.log(`[aqa-pulse][debug] outputDirs resolvedAttempts=${debugStats.attemptsWithResolvedOutputDirectories} exactMatches=${debugStats.outputDirectoryExactMatches} fallbackMatches=${debugStats.outputDirectoryFallbackMatches} misses=${debugStats.outputDirectoryMisses} buildFailures=${debugStats.outputDirectoryNameBuildFailures}`)
    console.log(`[aqa-pulse][debug] attachments discovered=${debugStats.discoveredAttachments} attemptsWithAttachments=${debugStats.attemptsWithDiscoveredAttachments} kept=${debugStats.attachmentsKept} droppedAfterNormalization=${debugStats.attachmentsDroppedAfterNormalization}`)
    console.log(`[aqa-pulse][debug] inline skippedTooLarge=${debugStats.inlineSkippedTooLargeCount} skippedTooLargeMb=${formatBytesAsMegabytes(debugStats.inlineSkippedTooLargeBytes)} skippedBudget=${debugStats.inlineSkippedBudgetCount} skippedBudgetMb=${formatBytesAsMegabytes(debugStats.inlineSkippedBudgetBytes)}`)
}

function printPreparedReportSnapshot(report: ReporterRoot): void {
    const snapshot = buildPreparedReportSnapshot(report)
    console.log(`[aqa-pulse][debug] prepared report snapshot tests=${snapshot.tests} attempts=${snapshot.attempts} attachments=${snapshot.attachments} attemptsWithAttachments=${snapshot.attemptsWithAttachments}`)
    console.log(`[aqa-pulse][debug] prepared report failedTests=${snapshot.failedTests} failedTestsWithAttachments=${snapshot.failedTestsWithAttachments} failedTestsWithoutAttachments=${snapshot.failedTestsWithoutAttachments} failedAttempts=${snapshot.failedAttempts} failedAttemptsWithAttachments=${snapshot.failedAttemptsWithAttachments}`)

    for (const sampleTitle of snapshot.failedTestsWithoutAttachmentsSamples) {
        console.log(`[aqa-pulse][debug] failed without attachments :: ${sampleTitle}`)
    }
}

function buildPreparedReportSnapshot(report: ReporterRoot) {
    if (!report || typeof report !== 'object' || !Array.isArray(report.tests)) {
        return {
            tests: 0,
            attempts: 0,
            attachments: 0,
            attemptsWithAttachments: 0,
            failedTests: 0,
            failedTestsWithAttachments: 0,
            failedTestsWithoutAttachments: 0,
            failedAttempts: 0,
            failedAttemptsWithAttachments: 0,
            failedTestsWithoutAttachmentsSamples: [] as string[],
        }
    }

    let attempts = 0
    let attachments = 0
    let attemptsWithAttachments = 0
    let failedTests = 0
    let failedTestsWithAttachments = 0
    let failedAttempts = 0
    let failedAttemptsWithAttachments = 0
    const failedTestsWithoutAttachmentsSamples: string[] = []

    for (const test of report.tests) {
        const testAttempts = Array.isArray(test.attempts) ? test.attempts : []
        let testHasAttachments = false
        let testHasFailedAttempt = false

        for (const attempt of testAttempts) {
            attempts += 1
            const attemptAttachments = Array.isArray(attempt.attachments) ? attempt.attachments.length : 0
            attachments += attemptAttachments

            if (attemptAttachments > 0) {
                attemptsWithAttachments += 1
                testHasAttachments = true
            }

            if (normalizeAttemptStatus(attempt.status) === 'failed') {
                failedAttempts += 1
                testHasFailedAttempt = true

                if (attemptAttachments > 0) {
                    failedAttemptsWithAttachments += 1
                }
            }
        }

        if (normalizeAttemptStatus(test.status) === 'failed' || testHasFailedAttempt) {
            failedTests += 1

            if (testHasAttachments) {
                failedTestsWithAttachments += 1
            } else if (failedTestsWithoutAttachmentsSamples.length < 10) {
                failedTestsWithoutAttachmentsSamples.push(describeTestForDebug(test))
            }
        }
    }

    return {
        tests: report.tests.length,
        attempts,
        attachments,
        attemptsWithAttachments,
        failedTests,
        failedTestsWithAttachments,
        failedTestsWithoutAttachments: failedTests - failedTestsWithAttachments,
        failedAttempts,
        failedAttemptsWithAttachments,
        failedTestsWithoutAttachmentsSamples,
    }
}

function normalizeAttemptStatus(value: string | undefined): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function describeTestForDebug(test: ReporterTest): string {
    const title = pickOptionalText(test.title) ?? '<unknown-title>'
    const file = pickOptionalText(test.location?.file) ?? '<unknown-file>'
    const project = pickOptionalText(test.project) ?? '<unknown-project>'
    return `${project} :: ${file} :: ${title}`
}

function formatBytesAsMegabytes(value: number): string {
    return (Math.round((Number(value) / (1024 * 1024)) * 100) / 100).toFixed(2)
}

function buildPlaywrightOutputDirectoryName(test: ReporterTest, attempt: ReporterAttempt): string | null {
    const locationFile = pickOptionalText(test.location?.file)
    const projectName = pickOptionalText(test.project)
    const fullTitle = pickOptionalText(test.title)

    if (!locationFile || !projectName || !fullTitle) {
        return null
    }

    const normalizedFile = locationFile.replace(/\\/g, '/')
    const relativeTestFilePath = normalizedFile
        .replace(buildProjectTestDirPrefixPattern(projectName), '')
        .replace(/\.(spec|test)\.(js|ts|jsx|tsx|mjs|mts|cjs|cts)$/i, '')

    if (!relativeTestFilePath) {
        return null
    }

    const sanitizedRelativePath = relativeTestFilePath.replace(/\//g, '-')
    const fullTitleWithoutSpec = fullTitle.replace(/\s*>\s*/g, ' ')
    let outputDirectoryName = playwrightTrimLongString(
        `${sanitizedRelativePath}-${playwrightSanitizeForFilePath(fullTitleWithoutSpec)}`,
        playwrightWindowsFilesystemFriendlyLength,
    )

    outputDirectoryName += `-${playwrightSanitizeForFilePath(projectName)}`

    const attemptNumber = typeof attempt.attempt === 'number' && Number.isFinite(attempt.attempt)
        ? attempt.attempt
        : 1

    if (attemptNumber > 1) {
        outputDirectoryName += `-retry${attemptNumber - 1}`
    }

    return outputDirectoryName
}

function buildProjectTestDirPrefixPattern(projectName: string): RegExp {
    const normalizedProjectName = projectName.trim().toLowerCase()

    if (normalizedProjectName === 'ui') {
        return /^.*?tests\/ui\//i
    }

    if (normalizedProjectName === 'api' || normalizedProjectName === 'smoke') {
        return /^.*?tests\/api\//i
    }

    return /^.*?tests\//i
}

function resolvePreferredArtifactSearchRoots(reportPathLike: string): string[] {
    const reportPath = pickOptionalText(reportPathLike)

    if (!reportPath) {
        return []
    }

    const resolvedReportPath = path.resolve(reportPath)
    const reportDirectory = path.dirname(resolvedReportPath)
    const workspaceRoot = path.resolve(reportDirectory, '..', '..')
    const reportBaseName = path.basename(resolvedReportPath, path.extname(resolvedReportPath)).toLowerCase()
    const explicitOutputDirectoryName = mapReportBaseNameToOutputDirectory(reportBaseName)

    if (!explicitOutputDirectoryName) {
        return []
    }

    const explicitOutputDirectoryPath = path.join(workspaceRoot, explicitOutputDirectoryName)

    return fs.existsSync(explicitOutputDirectoryPath) && fs.statSync(explicitOutputDirectoryPath).isDirectory()
        ? [explicitOutputDirectoryPath]
        : []
}

function mapReportBaseNameToOutputDirectory(reportBaseName: string): string | null {
    const normalizedReportBaseName = String(reportBaseName).trim().toLowerCase()

    if (normalizedReportBaseName === 'ui-purchase' || normalizedReportBaseName === 'ui-purchase-merged') {
        return 'test-results-ui-purchase'
    }

    if (normalizedReportBaseName === 'ui-cpu' || normalizedReportBaseName === 'ui-cpu-merged') {
        return 'test-results-ui-cpu'
    }

    if (normalizedReportBaseName === 'ui-first' || normalizedReportBaseName === 'ui-first-merged') {
        return 'test-results-ui-first'
    }

    if (normalizedReportBaseName === 'ui-second' || normalizedReportBaseName === 'ui-second-merged') {
        return 'test-results-ui-second'
    }

    if (normalizedReportBaseName === 'ui-dev' || normalizedReportBaseName === 'ui-development') {
        return 'test-results-ui-dev'
    }

    if (normalizedReportBaseName === 'api' || normalizedReportBaseName === 'api-merged') {
        return 'test-results-api'
    }

    return null
}

function findFallbackOutputDirectories(rootDirectory: string, test: ReporterTest, expectedOutputDirectoryName: string): string[] {
    if (!fs.existsSync(rootDirectory) || !fs.statSync(rootDirectory).isDirectory()) {
        return []
    }

    const projectSuffix = `-${playwrightSanitizeForFilePath(pickOptionalText(test.project) ?? 'unknown')}`
    const fileStem = pickOptionalText(test.location?.file)
        ?.replace(/\\/g, '/')
        .split('/')
        .pop()
        ?.replace(/\.(spec|test)\.(js|ts|jsx|tsx|mjs|mts|cjs|cts)$/i, '')
    const fileStemToken = fileStem ? playwrightSanitizeForFilePath(fileStem).slice(0, 12) : ''
    const expectedPrefix = expectedOutputDirectoryName.slice(0, 24)

    return fs.readdirSync(rootDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(rootDirectory, entry.name))
        .filter((candidatePath) => {
            const candidateName = path.basename(candidatePath)

            if (candidateName === expectedOutputDirectoryName) {
                return true
            }

            if (!candidateName.endsWith(projectSuffix)) {
                return false
            }

            if (expectedPrefix && candidateName.startsWith(expectedPrefix)) {
                return true
            }

            return fileStemToken.length > 0 && candidateName.includes(fileStemToken)
        })
}

function readAttemptArtifactFiles(outputDirectory: string): string[] {
    if (!fs.existsSync(outputDirectory) || !fs.statSync(outputDirectory).isDirectory()) {
        return []
    }

    return fs.readdirSync(outputDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(outputDirectory, entry.name))
        .filter((artifactPath) => shouldAttachArtifactFile(path.basename(artifactPath)))
}

function shouldAttachArtifactFile(fileName: string): boolean {
    const normalizedName = String(fileName).toLowerCase()

    return normalizedName === 'error-context.md'
        || /^test-failed-\d+\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(normalizedName)
        || normalizedName === 'trace.zip'
}

function collectArtifactSearchRoots(baseDirectories: string[]): string[] {
    const searchRoots: string[] = []
    const seenRoots = new Set<string>()

    for (const anchorDirectory of collectSearchAnchorDirectories(baseDirectories)) {
        pushUniqueDirectory(searchRoots, anchorDirectory, seenRoots)

        for (const childDirectory of listMatchingDirectories(anchorDirectory, isArtifactRootName)) {
            pushUniqueDirectory(searchRoots, childDirectory, seenRoots)

            if (/^test-results($|-)/i.test(path.basename(childDirectory))) {
                for (const nestedDirectory of listMatchingDirectories(childDirectory, isArtifactRootName)) {
                    pushUniqueDirectory(searchRoots, nestedDirectory, seenRoots)
                }
            }
        }
    }

    return searchRoots
}

function collectSearchAnchorDirectories(baseDirectories: string[]): string[] {
    const anchors: string[] = []
    const seenAnchors = new Set<string>()

    for (const baseDirectory of baseDirectories) {
        let currentDirectory = path.resolve(baseDirectory)

        for (let depth = 0; depth < 3; depth += 1) {
            if (seenAnchors.has(currentDirectory)) {
                break
            }

            seenAnchors.add(currentDirectory)
            anchors.push(currentDirectory)

            const parentDirectory = path.dirname(currentDirectory)

            if (parentDirectory === currentDirectory) {
                break
            }

            currentDirectory = parentDirectory
        }
    }

    return anchors
}

function listMatchingDirectories(rootDirectory: string, predicate: (directoryName: string) => boolean): string[] {
    if (!fs.existsSync(rootDirectory) || !fs.statSync(rootDirectory).isDirectory()) {
        return []
    }

    return fs.readdirSync(rootDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && predicate(entry.name))
        .map((entry) => path.join(rootDirectory, entry.name))
}

function isArtifactRootName(directoryName: string): boolean {
    return /^artifacts($|-)/i.test(directoryName) || /^test-results($|-)/i.test(directoryName)
}

function pushUniqueDirectory(directories: string[], directoryPath: string, seenDirectories: Set<string>): void {
    const resolvedDirectoryPath = path.resolve(directoryPath)

    if (seenDirectories.has(resolvedDirectoryPath)) {
        return
    }

    if (!fs.existsSync(resolvedDirectoryPath) || !fs.statSync(resolvedDirectoryPath).isDirectory()) {
        return
    }

    seenDirectories.add(resolvedDirectoryPath)
    directories.push(resolvedDirectoryPath)
}

function uniquePaths(paths: string[]): string[] {
    return Array.from(new Set(paths.map((value) => path.resolve(value))))
}

function fallbackSanitizeForFilePath(value: string): string {
    return String(value)
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'artifact'
}

function fallbackTrimLongString(value: string, length = 60): string {
    const normalizedValue = String(value)

    if (normalizedValue.length <= length) {
        return normalizedValue
    }

    const hash = crypto.createHash('sha1').update(normalizedValue).digest('hex').slice(0, 5)
    const middle = `-${hash}-`
    const startLength = Math.floor((length - middle.length) / 2)
    const endLength = length - middle.length - startLength

    return normalizedValue.slice(0, startLength) + middle + normalizedValue.slice(-endLength)
}

function initializePlaywrightFileNameUtilities(): void {
    try {
        const playwrightCoreUtils = require('playwright-core/lib/utils') as { sanitizeForFilePath?: SanitizeForFilePath }
        const playwrightUtils = require('playwright/lib/util') as {
            trimLongString?: TrimLongString
            windowsFilesystemFriendlyLength?: number
        }

        if (typeof playwrightCoreUtils.sanitizeForFilePath === 'function') {
            playwrightSanitizeForFilePath = playwrightCoreUtils.sanitizeForFilePath
        }

        if (typeof playwrightUtils.trimLongString === 'function') {
            playwrightTrimLongString = playwrightUtils.trimLongString
        }

        if (typeof playwrightUtils.windowsFilesystemFriendlyLength === 'number' && Number.isFinite(playwrightUtils.windowsFilesystemFriendlyLength)) {
            playwrightWindowsFilesystemFriendlyLength = playwrightUtils.windowsFilesystemFriendlyLength
        }
    } catch {
        // Используем fallback-реализации, если внутренние util Playwright недоступны в runtime.
    }
}

function loadAdmZip(): AdmZipLikeConstructor | null {
    try {
        return require('adm-zip') as AdmZipLikeConstructor
    } catch {
        return null
    }
}

function persistPreparedReportIfRequested(report: ReporterRoot, preparedReportPath: string | null): void {
    if (!preparedReportPath) {
        return
    }

    const resolvedPreparedReportPath = path.resolve(process.cwd(), preparedReportPath)
    fs.mkdirSync(path.dirname(resolvedPreparedReportPath), { recursive: true })
    fs.writeFileSync(resolvedPreparedReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`[aqa-pulse][debug] Prepared upload report saved: ${resolvedPreparedReportPath}`)
}

function resolveInlineAttachmentsTotalLimit(configuredValue: number | null | undefined): number {
    return typeof configuredValue === 'number' && Number.isInteger(configuredValue) && configuredValue > 0
        ? configuredValue
        : DEFAULT_INLINE_ATTACHMENTS_TOTAL_MAX_SIZE_BYTES
}

function pickOptionalText(value: string | undefined | null): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}