/**
 * Назначение файла: координирует приём отчёта, обновление истории и сводки,
 * а также сохранение связанных артефактов.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
    applyBusinessAssumptionsToSummary,
    buildAdvancedMetrics,
    buildDashboardSummary,
    type DashboardBusinessAssumptions,
    deriveDashboardRunComparisonIdentity,
    enrichReporterReport,
    type DashboardRunMetadata,
    type ReporterAttachment,
    type ReporterRoot,
} from '../dashboard-utils'
import {
    appendHistoryEntry,
    buildHistoryEntryId,
} from '../history-utils'
import type { IngestionResult, WorkspaceDescriptor } from './contracts'
import type { WorkspaceRunStorage } from './infrastructure/persistence'

export function ingestReporterRun(options: {
    workspace: WorkspaceDescriptor
    storage: WorkspaceRunStorage
    report: ReporterRoot
    metadata?: Partial<DashboardRunMetadata>
    sourceFile?: string
    artifactsPath?: string
    businessAssumptions?: Partial<DashboardBusinessAssumptions> | null
}): IngestionResult {
    const enrichedReport = enrichReporterReport(options.report)
    const runMetadata: DashboardRunMetadata = {
        branch: normalizeOptionalText(options.metadata?.branch),
        commit: normalizeOptionalText(options.metadata?.commit),
        author: normalizeOptionalText(options.metadata?.author),
    }
    const sourceFile = options.sourceFile
        ? options.sourceFile
        : buildDefaultSourceFile(options.workspace.slug, enrichedReport)

    const summaryWithoutHistory = applyBusinessAssumptionsToSummary(
        buildDashboardSummary(enrichedReport, sourceFile, [], runMetadata),
        options.businessAssumptions,
    )
    const comparisonIdentity = deriveDashboardRunComparisonIdentity(enrichedReport, sourceFile)
    const nextHistoryEntry = {
        id: buildHistoryEntryId(summaryWithoutHistory.reportTimestamp, sourceFile),
        reportTimestamp: summaryWithoutHistory.reportTimestamp,
        generatedAt: summaryWithoutHistory.generatedAt,
        sourceFile,
        comparisonKey: comparisonIdentity.key,
        comparisonLabel: comparisonIdentity.label,
        branch: runMetadata.branch,
        commit: runMetadata.commit,
        author: runMetadata.author,
        totalTests: summaryWithoutHistory.kpis.totalTests,
        passedTests: summaryWithoutHistory.kpis.passedTests,
        failedTests: summaryWithoutHistory.kpis.failedTests,
        flakyTests: summaryWithoutHistory.kpis.flakyTests,
        skippedTests: summaryWithoutHistory.kpis.skippedTests,
        timedOutTests: summaryWithoutHistory.kpis.timedOutTests,
        interruptedTests: summaryWithoutHistory.kpis.interruptedTests,
        passRate: summaryWithoutHistory.kpis.passRate,
        flakyRatio: summaryWithoutHistory.kpis.flakyRatio,
        totalDurationMs: summaryWithoutHistory.kpis.totalDurationMs,
        medianDurationMs: summaryWithoutHistory.kpis.medianDurationMs,
        errorClusterCount: summaryWithoutHistory.kpis.errorClusterCount,
    }

    const reportWithArtifacts = materializeReportArtifacts({
        report: enrichedReport,
        runId: nextHistoryEntry.id,
        sourceFile,
        artifactsPath: options.artifactsPath ?? options.storage.paths.artifactsPath,
    })

    options.storage.persistRawReport(nextHistoryEntry.id, reportWithArtifacts)

    const history = appendHistoryEntry(options.storage.readHistory(), nextHistoryEntry)
    const archivedRun = options.storage.archiveRun(reportWithArtifacts, nextHistoryEntry)
    const advancedMetrics = buildAdvancedMetrics(reportWithArtifacts, history.runs, options.storage.paths.archiveRootPath, sourceFile)
    const dashboardSummary = applyBusinessAssumptionsToSummary(
        buildDashboardSummary(reportWithArtifacts, sourceFile, history.runs, runMetadata, advancedMetrics),
        options.businessAssumptions,
    )

    options.storage.writeSummary(dashboardSummary)
    options.storage.writeHistory(history)

    return {
        workspace: options.workspace,
        summaryPath: options.storage.paths.summaryPath,
        historyPath: options.storage.paths.historyPath,
        archivedRunDirectory: path.join(options.storage.paths.archiveRootPath, archivedRun.runDirectory),
        runId: nextHistoryEntry.id,
        sourceFile,
        summaryGeneratedAt: dashboardSummary.generatedAt,
    }
}

/**
 * Копирует локальные и встроенные вложения в централизованное хранилище артефактов
 * и переписывает ссылки внутри отчёта на новые пути.
 */
function materializeReportArtifacts(options: {
    report: ReporterRoot
    runId: string
    sourceFile: string
    artifactsPath: string
}): ReporterRoot {
    const reportDirectory = resolveReportDirectory(options.sourceFile)
    const runDirectoryName = buildArtifactRunDirectoryName(options.runId)
    const runArtifactsDirectory = path.join(options.artifactsPath, runDirectoryName)

    let hasCopiedArtifacts = false

    const tests = (options.report.tests ?? []).map((test, testIndex) => ({
        ...test,
        attempts: (test.attempts ?? []).map((attempt, attemptIndex) => ({
            ...attempt,
            attachments: (attempt.attachments ?? []).map((attachment, attachmentIndex) => {
                const copiedAttachment = copyAttachmentToArtifactStore({
                    attachment,
                    reportDirectory,
                    runArtifactsDirectory,
                    testIndex,
                    attemptIndex,
                    attachmentIndex,
                })

                if (copiedAttachment !== attachment) {
                    hasCopiedArtifacts = true
                }

                return copiedAttachment
            }),
        })),
    }))

    if (!hasCopiedArtifacts) {
        return options.report
    }

    return {
        ...options.report,
        tests,
    }
}

function copyAttachmentToArtifactStore(options: {
    attachment: ReporterAttachment
    reportDirectory: string | null
    runArtifactsDirectory: string
    testIndex: number
    attemptIndex: number
    attachmentIndex: number
}) {
    const attachmentPath = typeof options.attachment.path === 'string' ? options.attachment.path.trim() : ''
    const inlineContentBase64 = typeof options.attachment.inlineContentBase64 === 'string'
        ? options.attachment.inlineContentBase64.trim()
        : ''
    const inlineContentEncoding = typeof options.attachment.inlineContentEncoding === 'string'
        ? options.attachment.inlineContentEncoding.trim().toLowerCase()
        : ''

    if ((!attachmentPath || /^https?:\/\//i.test(attachmentPath)) && !inlineContentBase64) {
        return options.attachment
    }

    fs.mkdirSync(options.runArtifactsDirectory, { recursive: true })

    const attachmentName = typeof options.attachment.name === 'string' && options.attachment.name.trim().length > 0
        ? options.attachment.name.trim()
        : path.basename(attachmentPath || `attachment-${options.attachmentIndex + 1}`)
    const sourcePath = resolveAttachmentSourcePath(attachmentPath, options.reportDirectory)
    const fileExtension = sourcePath
        ? path.extname(sourcePath)
        : path.extname(attachmentName) || inferExtensionFromContentType(options.attachment.contentType)
    const fileBaseName = sanitizeArtifactSegment(path.basename(attachmentName, path.extname(attachmentName)) || `attachment-${options.attachmentIndex + 1}`)
    const targetFileName = `${String(options.testIndex + 1).padStart(4, '0')}-${String(options.attemptIndex + 1).padStart(2, '0')}-${String(options.attachmentIndex + 1).padStart(2, '0')}-${fileBaseName}${fileExtension || path.extname(attachmentName)}`
    const targetPath = path.join(options.runArtifactsDirectory, targetFileName)

    if (inlineContentBase64) {
        if (inlineContentEncoding !== '' && inlineContentEncoding !== 'base64') {
            return options.attachment
        }

        fs.writeFileSync(targetPath, Buffer.from(inlineContentBase64, 'base64'))
    } else {
        if (!sourcePath || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
            return options.attachment
        }

        fs.copyFileSync(sourcePath, targetPath)
    }

    const {
        inlineContentBase64: _inlineContentBase64,
        inlineContentEncoding: _inlineContentEncoding,
        inlineContentSizeBytes: _inlineContentSizeBytes,
        ...attachmentWithoutInlineContent
    } = options.attachment

    return {
        ...attachmentWithoutInlineContent,
        path: toPosixPath(path.relative(path.dirname(options.runArtifactsDirectory), targetPath)),
    }
}

function inferExtensionFromContentType(contentType: string | undefined): string {
    const normalizedType = typeof contentType === 'string' ? contentType.trim().toLowerCase() : ''

    if (normalizedType === 'image/png') {
        return '.png'
    }

    if (normalizedType === 'image/jpeg') {
        return '.jpg'
    }

    if (normalizedType === 'image/webp') {
        return '.webp'
    }

    if (normalizedType === 'image/gif') {
        return '.gif'
    }

    if (normalizedType === 'image/svg+xml') {
        return '.svg'
    }

    if (normalizedType === 'image/bmp') {
        return '.bmp'
    }

    if (normalizedType.includes('markdown')) {
        return '.md'
    }

    return ''
}

function resolveReportDirectory(sourceFile: string): string | null {
    if (!sourceFile || sourceFile.startsWith('saas://')) {
        return null
    }

    const resolvedPath = path.isAbsolute(sourceFile)
        ? sourceFile
        : path.resolve(process.cwd(), sourceFile)

    if (!fs.existsSync(resolvedPath)) {
        return null
    }

    const stats = fs.statSync(resolvedPath)
    return stats.isDirectory() ? resolvedPath : path.dirname(resolvedPath)
}

function resolveAttachmentSourcePath(attachmentPath: string, reportDirectory: string | null): string | null {
    if (path.isAbsolute(attachmentPath)) {
        return attachmentPath
    }

    if (!reportDirectory) {
        return null
    }

    return path.resolve(reportDirectory, attachmentPath)
}

function buildArtifactRunDirectoryName(runId: string): string {
    return runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'run'
}

function sanitizeArtifactSegment(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'artifact'
}

function toPosixPath(value: string): string {
    return value.replace(/\\/g, '/')
}


function buildDefaultSourceFile(workspaceSlug: string, report: ReporterRoot): string {
    const timestamp = normalizeOptionalText(report.timestamp) ?? new Date().toISOString()
    return `saas://${workspaceSlug}/ingestions/${timestamp}`
}

function normalizeOptionalText(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

