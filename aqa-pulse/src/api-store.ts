import {
    buildAdvancedMetricsFromArchivedRuns,
    buildDashboardSummary,
    collectCurrentRunTests,
    type DashboardAvailableFilters,
    type DashboardFilters,
    normalizeDashboardSummary,
    readDashboardSummary,
    type ReporterAttachment,
    type DashboardSummary,
    type ReporterRoot,
    type ReporterStep,
    type ReporterTest,
} from './dashboard-utils'
import {
    type DashboardHistory,
    type DashboardHistoryEntry,
} from './history-utils'
import { type DashboardReadStorage, FileSystemDashboardReadStorage } from './backend/storage'

export interface ApiStoreOptions {
    summaryPath?: string
    historyPath?: string
    archiveRootPath?: string
    storage?: DashboardReadStorage
}

export interface ApiFilters {
    branch?: string
    project?: string
    file?: string
}

export interface DashboardRunResponse {
    run: DashboardHistoryEntry
    fullSummary: DashboardSummary | null
}

export interface TestHistoryFilters {
    project?: string
    file?: string
}

export interface TestHistoryItem {
    runId: string
    reportTimestamp: string | null
    generatedAt: string
    branch: string | null
    commit: string | null
    author: string | null
    status: string
    flaky: boolean
    durationMs: number
    retries: number
    attempts: number
    errorMessage: string | null
    attemptDetails: TestHistoryAttemptDetail[]
}

export interface TestHistoryAttachment {
    name: string
    contentType: string | null
    path: string | null
    url: string | null
}

export interface TestHistoryStep {
    title: string
    category: string | null
    durationMs: number
}

export interface TestHistoryAttemptDetail {
    attempt: number
    status: string
    durationMs: number
    startTime: string | null
    errorMessage: string | null
    attachments: TestHistoryAttachment[]
    steps: TestHistoryStep[]
}

export interface TestHistoryResponse {
    test: {
        title: string
        file: string
        project: string
    }
    summary: {
        totalRuns: number
        failedRuns: number
        flakyRuns: number
        passRate: number
        latestStatus: string | null
        failRate: number
        flakyScore: number
        mtbfDays: number | null
    }
    latestRun: TestHistoryItem | null
    history: TestHistoryItem[]
    missingRuns: string[]
}

export interface TestHistoryConflict {
    message: string
    candidates: Array<{
        title: string
        file: string
        project: string
    }>
}

export class ApiStore {
    private readonly storage: DashboardReadStorage

    constructor(options: ApiStoreOptions = {}) {
        this.storage = options.storage ?? new FileSystemDashboardReadStorage({
            summaryPath: options.summaryPath,
            historyPath: options.historyPath,
            archiveRootPath: options.archiveRootPath,
        })
    }

    getSummary(): DashboardSummary {
        const summary = normalizeDashboardSummary(this.storage.readSummary())

        if (summary.currentRunTests.all.length > 0) {
            return summary
        }

        const history = this.getHistory()
        const latestRun = summary.comparison.currentRun ?? history.runs[history.runs.length - 1] ?? null

        if (!latestRun) {
            return summary
        }

        const runDirectory = this.storage.findArchivedRunDirectory(latestRun.id)

        if (!runDirectory) {
            return summary
        }

        const archivedRun = this.storage.readArchivedRunRecord(runDirectory)

        return {
            ...summary,
            currentRunTests: collectCurrentRunTests(archivedRun.data.tests ?? []),
        }
    }

    getFilteredSummary(filters: ApiFilters = {}): DashboardSummary {
        const normalizedFilters = normalizeFilters(filters)

        if (!normalizedFilters.branch && !normalizedFilters.project && !normalizedFilters.file) {
            const summary = this.getSummary()
            const context = this.buildFilteredContext(normalizedFilters)

            return {
                ...summary,
                filters: {
                    branch: null,
                    project: null,
                    file: null,
                },
                availableFilters: context.availableFilters,
            }
        }

        const context = this.buildFilteredContext(normalizedFilters)
        const baseSummary = this.getSummary()
        const latest = context.filteredRuns[context.filteredRuns.length - 1] ?? null

        if (!latest) {
            return buildDashboardSummary(
                {
                    schemaVersion: baseSummary.schemaVersion ?? undefined,
                    timestamp: undefined,
                    durationMs: 0,
                    environment: {
                        playwrightVersion: baseSummary.environment.playwrightVersion,
                        nodeVersion: baseSummary.environment.nodeVersion,
                        os: baseSummary.environment.os,
                        workers: baseSummary.environment.workers,
                        retries: baseSummary.environment.retries,
                        projects: baseSummary.environment.projects,
                    },
                    tests: [],
                },
                baseSummary.sourceFile,
                [],
                { branch: normalizedFilters.branch, commit: null, author: null },
                null,
                normalizedFilters,
                context.availableFilters,
            )
        }

        const historyEntries = context.filteredRuns.map((run) => run.filteredEntry)
        const advancedMetrics = buildAdvancedMetricsFromArchivedRuns(
            latest.filteredReport,
            historyEntries,
            context.filteredRuns.map((run) => ({ run: run.filteredEntry, report: run.filteredReport })),
        )

        return buildDashboardSummary(
            latest.filteredReport,
            latest.run.sourceFile,
            historyEntries,
            {
                branch: latest.run.branch,
                commit: latest.run.commit,
                author: latest.run.author,
            },
            advancedMetrics,
            normalizedFilters,
            context.availableFilters,
        )
    }

    getHistory(): DashboardHistory {
        return this.storage.readHistory()
    }

    getRuns(filters: ApiFilters = {}): DashboardHistoryEntry[] {
        const normalizedFilters = normalizeFilters(filters)

        if (!normalizedFilters.branch && !normalizedFilters.project && !normalizedFilters.file) {
            return [...this.getHistory().runs].reverse()
        }

        return [...this.buildFilteredContext(normalizedFilters).filteredRuns]
            .map((run) => run.filteredEntry)
            .reverse()
    }

    getRunById(id: string): DashboardRunResponse | null {
        const summary = this.getSummary()
        const run = this.getHistory().runs.find((historyRun) => historyRun.id === id)

        if (!run) {
            return null
        }

        const currentRunId = summary.comparison.currentRun?.id ?? null

        return {
            run,
            fullSummary: currentRunId === id ? summary : null,
        }
    }

    getFlakyPayload(filters: ApiFilters = {}) {
        const summary = this.getFilteredSummary(filters)

        return {
            totalFlakyTests: summary.kpis.flakyTests,
            flakyRatio: summary.kpis.flakyRatio,
            averageFlakyScore: summary.flakyAnalytics.averageFlakyScore,
            averageMtbfDays: summary.flakyAnalytics.averageMtbfDays,
            firstFlakeToFix: summary.flakyAnalytics.firstFlakeToFix,
            trend: summary.flakyAnalytics.flakyTrend,
            tests: summary.flakyAnalytics.topFlakyTests,
        }
    }

    getErrorClustersPayload(filters: ApiFilters = {}) {
        const summary = this.getFilteredSummary(filters)

        return {
            totalClusters: summary.kpis.errorClusterCount,
            clusters: summary.errorClusters,
        }
    }

    getCostMetricsPayload(filters: ApiFilters = {}) {
        const summary = this.getFilteredSummary(filters)

        return {
            filters: summary.filters,
            totalCostRub: summary.businessMetrics.costOfFlakiness.totalRub,
            ciCostRub: summary.businessMetrics.costOfFlakiness.ciCostRub,
            developerCostRub: summary.businessMetrics.costOfFlakiness.developerCostRub,
            extraRetryMinutes: summary.businessMetrics.costOfFlakiness.extraRetryMinutes,
            extraRetries: summary.businessMetrics.costOfFlakiness.extraRetries,
            unstableRuns: summary.businessMetrics.costOfFlakiness.unstableRuns,
            activeDays: summary.businessMetrics.costOfFlakiness.activeDays,
            costPerActiveDayRub: summary.businessMetrics.costOfFlakiness.costPerActiveDayRub,
            assumptions: summary.businessMetrics.costOfFlakiness.assumptions,
        }
    }

    getTestHistory(name: string, filters: TestHistoryFilters & ApiFilters = {}): TestHistoryResponse | TestHistoryConflict | null {
        const normalizedFilters = normalizeFilters(filters)
        const history = this.getHistory()
        const matchedRuns: Array<{ run: DashboardHistoryEntry; test: ReporterTest }> = []
        const missingRuns: string[] = []
        const candidateMap = new Map<string, { title: string; file: string; project: string }>()

        for (const run of history.runs) {
            if (normalizedFilters.branch && run.branch !== normalizedFilters.branch) {
                continue
            }

            const archivedDirectory = this.storage.findArchivedRunDirectory(run.id)

            if (!archivedDirectory) {
                missingRuns.push(run.id)
                continue
            }

            const archivedRun = this.storage.readArchivedRunRecord(archivedDirectory)
            const tests = archivedRun.data.tests ?? []

            for (const test of tests) {
                if ((test.title ?? '') !== name) {
                    continue
                }

                const candidate = buildCandidateIdentity(test)

                if (!candidate) {
                    continue
                }

                if (normalizedFilters.project && candidate.project !== normalizedFilters.project) {
                    continue
                }

                if (normalizedFilters.file && candidate.file !== normalizedFilters.file) {
                    continue
                }

                candidateMap.set(buildCandidateKey(candidate.project, candidate.file, candidate.title), candidate)
                matchedRuns.push({ run, test })
            }
        }

        if (matchedRuns.length === 0) {
            return null
        }

        const candidates = [...candidateMap.values()]

        if (candidates.length > 1) {
            return {
                message: 'Найдено несколько тестов с одинаковым title. Уточни file и/или project через query params.',
                candidates,
            }
        }

        const [selectedCandidate] = candidates
        const historyItems = matchedRuns
            .map(({ run, test }) => normalizeTestHistoryItem(run, test))
            .sort((left, right) => getHistoryItemTime(right) - getHistoryItemTime(left))

        const failedRuns = historyItems.filter((item) => item.status === 'failed' || item.status === 'timedout' || item.status === 'interrupted').length
        const flakyRuns = historyItems.filter((item) => item.flaky).length
        const passedRuns = historyItems.filter((item) => item.status === 'passed').length
        const failRate = historyItems.length === 0 ? 0 : roundToOneDigit((failedRuns / historyItems.length) * 100)
        const mtbfDays = calculateApiMtbfDays(historyItems)
        const patternFactor = historyItems.length > 0 && (failedRuns + flakyRuns) >= historyItems.length ? 1.0 : 0.4
        const mtbfFactor = mtbfDays === null ? 0.2 : (mtbfDays < 1 ? 1.0 : (mtbfDays <= 3 ? 0.5 : 0.2))
        const flakyScore = roundToOneDigit((((failRate / 100) * 0.4) + (patternFactor * 0.3) + (mtbfFactor * 0.3)) * 100)

        return {
            test: selectedCandidate,
            summary: {
                totalRuns: historyItems.length,
                failedRuns,
                flakyRuns,
                passRate: historyItems.length === 0 ? 0 : (passedRuns / historyItems.length) * 100,
                latestStatus: historyItems[0]?.status ?? null,
                failRate,
                flakyScore,
                mtbfDays,
            },
            latestRun: historyItems[0] ?? null,
            history: historyItems,
            missingRuns,
        }
    }

    private buildFilteredContext(filters: DashboardFilters): {
        filteredRuns: FilteredArchivedRun[]
        availableFilters: DashboardAvailableFilters
    } {
        const history = this.getHistory()
        const archivedRuns = history.runs
            .map((run) => {
                const archivedDirectory = this.storage.findArchivedRunDirectory(run.id)

                if (!archivedDirectory) {
                    return null
                }

                const archivedRun = this.storage.readArchivedRunRecord(archivedDirectory)

                return {
                    run,
                    rawReport: archivedRun.data,
                }
            })
            .filter((value): value is { run: DashboardHistoryEntry; rawReport: ReporterRoot } => value !== null)

        const branchScopedRuns = archivedRuns.filter((item) => !filters.branch || item.run.branch === filters.branch)
        const availableFilters = buildAvailableFiltersForContext(history.runs, branchScopedRuns)
        const filteredRuns = branchScopedRuns
            .map((item) => {
                const filteredReport = filterReport(item.rawReport, filters)

                if ((filteredReport.tests ?? []).length === 0) {
                    return null
                }

                return {
                    run: item.run,
                    rawReport: item.rawReport,
                    filteredReport,
                    filteredEntry: buildFilteredHistoryEntry(item.run, filteredReport),
                }
            })
            .filter((value): value is FilteredArchivedRun => value !== null)

        return {
            filteredRuns,
            availableFilters,
        }
    }
}

interface FilteredArchivedRun {
    run: DashboardHistoryEntry
    rawReport: ReporterRoot
    filteredReport: ReporterRoot
    filteredEntry: DashboardHistoryEntry
}

function normalizeFilters(filters: ApiFilters): DashboardFilters {
    return {
        branch: normalizeString(filters.branch),
        project: normalizeString(filters.project),
        file: normalizeString(filters.file),
    }
}

function normalizeString(value: string | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function filterReport(report: ReporterRoot, filters: DashboardFilters): ReporterRoot {
    const filteredTests = (report.tests ?? []).filter((test) => {
        if (filters.project && test.project !== filters.project) {
            return false
        }

        if (filters.file && test.location?.file !== filters.file) {
            return false
        }

        return true
    })

    return {
        ...report,
        tests: filteredTests,
        durationMs: sumDurations(filteredTests),
        summary: {
            total: filteredTests.length,
            passed: filteredTests.filter((test) => getNormalizedStatus(test) === 'passed').length,
            failed: filteredTests.filter((test) => getNormalizedStatus(test) === 'failed').length,
            flaky: filteredTests.filter((test) => Boolean(test.flaky)).length,
            skipped: filteredTests.filter((test) => getNormalizedStatus(test) === 'skipped').length,
            timedOut: filteredTests.filter((test) => getNormalizedStatus(test) === 'timedout').length,
            interrupted: filteredTests.filter((test) => getNormalizedStatus(test) === 'interrupted').length,
        },
    }
}

function buildFilteredHistoryEntry(run: DashboardHistoryEntry, report: ReporterRoot): DashboardHistoryEntry {
    const tests = report.tests ?? []
    const passedTests = tests.filter((test) => getNormalizedStatus(test) === 'passed').length
    const failedTests = tests.filter((test) => getNormalizedStatus(test) === 'failed').length
    const skippedTests = tests.filter((test) => getNormalizedStatus(test) === 'skipped').length
    const timedOutTests = tests.filter((test) => getNormalizedStatus(test) === 'timedout').length
    const interruptedTests = tests.filter((test) => getNormalizedStatus(test) === 'interrupted').length
    const flakyTests = tests.filter((test) => Boolean(test.flaky)).length
    const totalTests = tests.length
    const totalDurationMs = sumDurations(tests)
    const medianDurationMs = getMedianDuration(tests)

    return {
        ...run,
        totalTests,
        passedTests,
        failedTests,
        flakyTests,
        skippedTests,
        timedOutTests,
        interruptedTests,
        passRate: totalTests === 0 ? 0 : (passedTests / totalTests) * 100,
        flakyRatio: totalTests === 0 ? 0 : (flakyTests / totalTests) * 100,
        totalDurationMs,
        medianDurationMs,
        errorClusterCount: countErrorClusters(tests),
    }
}

function buildAvailableFiltersForContext(
    allRuns: DashboardHistoryEntry[],
    branchScopedRuns: Array<{ run: DashboardHistoryEntry; rawReport: ReporterRoot }>,
): DashboardAvailableFilters {
    const branches = [...new Set(allRuns.map((run) => run.branch).filter((branch): branch is string => Boolean(branch)))].sort()
    const tests = branchScopedRuns.flatMap((item) => item.rawReport.tests ?? [])
    const projects = [...new Set(tests.map((test) => test.project).filter((project): project is string => Boolean(project)))].sort()
    const files = [...new Set(tests.map((test) => test.location?.file).filter((file): file is string => Boolean(file)))].sort()
    const projectsByBranch: Record<string, string[]> = {}
    const filesByBranch: Record<string, string[]> = {}
    const filesByProject: Record<string, string[]> = {}
    const filesByBranchProject: Record<string, Record<string, string[]>> = {}

    for (const branch of branches) {
        const branchTests = allRuns
            .filter((run) => run.branch === branch)
            .flatMap((run) => {
                const matchedScopedRun = branchScopedRuns.find((item) => item.run.id === run.id)
                return matchedScopedRun?.rawReport.tests ?? []
            })
        const branchProjects = [...new Set(branchTests.map((test) => test.project).filter((project): project is string => Boolean(project)))].sort()
        const branchFiles = [...new Set(branchTests.map((test) => test.location?.file).filter((file): file is string => Boolean(file)))].sort()

        projectsByBranch[branch] = branchProjects
        filesByBranch[branch] = branchFiles
        filesByBranchProject[branch] = {}

        for (const project of branchProjects) {
            filesByBranchProject[branch][project] = [...new Set(
                branchTests
                    .filter((test) => test.project === project)
                    .map((test) => test.location?.file)
                    .filter((file): file is string => Boolean(file)),
            )].sort()
        }
    }

    for (const project of projects) {
        filesByProject[project] = [...new Set(
            tests
                .filter((test) => test.project === project)
                .map((test) => test.location?.file)
                .filter((file): file is string => Boolean(file)),
        )].sort()
    }

    return {
        branches,
        projects,
        files,
        projectsByBranch,
        filesByBranch,
        filesByProject,
        filesByBranchProject,
    }
}

function sumDurations(tests: ReporterTest[]): number {
    return tests.reduce((total, test) => total + (typeof test.durationMs === 'number' ? test.durationMs : 0), 0)
}

function getMedianDuration(tests: ReporterTest[]): number {
    const values = tests
        .map((test) => (typeof test.durationMs === 'number' ? test.durationMs : 0))
        .filter((value) => value > 0)
        .sort((left, right) => left - right)

    if (values.length === 0) {
        return 0
    }

    const middleIndex = Math.floor(values.length / 2)

    if (values.length % 2 === 0) {
        return Math.round((values[middleIndex - 1] + values[middleIndex]) / 2)
    }

    return values[middleIndex]
}

function countErrorClusters(tests: ReporterTest[]): number {
    return new Set(
        tests
            .map((test) => test.errors?.find((error) => typeof error.message === 'string' && error.message.trim().length > 0)?.message
                ?? test.attempts?.find((attempt) => attempt.error?.message)?.error?.message
                ?? null)
            .filter((message): message is string => Boolean(message)),
    ).size
}

function getNormalizedStatus(test: ReporterTest): string {
    const normalizedStatus = (test.status ?? '').trim().toLowerCase()

    if (normalizedStatus === 'timed out') {
        return 'timedout'
    }

    if (normalizedStatus) {
        return normalizedStatus
    }

    const attempts = test.attempts ?? []
    const lastAttemptStatus = attempts.length > 0 ? attempts[attempts.length - 1]?.status : undefined
    const normalizedAttemptStatus = (lastAttemptStatus ?? '').trim().toLowerCase()

    return normalizedAttemptStatus === 'timed out' ? 'timedout' : (normalizedAttemptStatus || 'unknown')
}

function normalizeTestHistoryItem(run: DashboardHistoryEntry, test: ReporterTest): TestHistoryItem {
    const attempts = test.attempts ?? []
    const failedAttempt = attempts.find((attempt) => ['failed', 'timedout', 'interrupted'].includes(normalizeStatus(attempt.status)))

    return {
        runId: run.id,
        reportTimestamp: run.reportTimestamp,
        generatedAt: run.generatedAt,
        branch: run.branch,
        commit: run.commit,
        author: run.author,
        status: normalizeStatus(test.status ?? attempts[attempts.length - 1]?.status),
        flaky: Boolean(test.flaky),
        durationMs: typeof test.durationMs === 'number' ? test.durationMs : 0,
        retries: typeof test.retries === 'number' ? test.retries : 0,
        attempts: attempts.length > 0 ? attempts.length : ((typeof test.retries === 'number' ? test.retries : 0) + 1),
        errorMessage: test.errors?.find((error) => typeof error.message === 'string' && error.message.trim().length > 0)?.message
            ?? failedAttempt?.error?.message
            ?? null,
        attemptDetails: normalizeAttemptDetails(test),
    }
}

function normalizeAttemptDetails(test: ReporterTest): TestHistoryAttemptDetail[] {
    const attempts = test.attempts ?? []

    if (attempts.length === 0) {
        return [{
            attempt: 1,
            status: normalizeStatus(test.status),
            durationMs: typeof test.durationMs === 'number' ? test.durationMs : 0,
            startTime: null,
            errorMessage: test.errors?.find((error) => typeof error.message === 'string' && error.message.trim().length > 0)?.message ?? null,
            attachments: [],
            steps: [],
        }]
    }

    return attempts.map((attempt, index) => ({
        attempt: typeof attempt.attempt === 'number' ? attempt.attempt : (index + 1),
        status: normalizeStatus(attempt.status),
        durationMs: typeof attempt.durationMs === 'number' ? attempt.durationMs : 0,
        startTime: typeof attempt.startTime === 'string' ? attempt.startTime : null,
        errorMessage: typeof attempt.error?.message === 'string' && attempt.error.message.trim().length > 0
            ? attempt.error.message.trim()
            : null,
        attachments: normalizeAttemptAttachments(attempt.attachments),
        steps: normalizeAttemptSteps(attempt.steps),
    }))
}

function normalizeAttemptAttachments(attachments: ReporterAttachment[] | undefined): TestHistoryAttachment[] {
    if (!Array.isArray(attachments)) {
        return []
    }

    return attachments
        .map((attachment) => ({
            name: typeof attachment.name === 'string' && attachment.name.trim().length > 0 ? attachment.name.trim() : 'attachment',
            contentType: typeof attachment.contentType === 'string' && attachment.contentType.trim().length > 0 ? attachment.contentType.trim() : null,
            path: typeof attachment.path === 'string' && attachment.path.trim().length > 0 ? attachment.path.trim() : null,
            url: typeof attachment.url === 'string' && attachment.url.trim().length > 0 ? attachment.url.trim() : null,
        }))
        .filter((attachment) => attachment.path !== null || attachment.url !== null)
}

function normalizeAttemptSteps(steps: ReporterStep[] | undefined): TestHistoryStep[] {
    if (!Array.isArray(steps)) {
        return []
    }

    return steps
        .map((step) => ({
            title: typeof step.title === 'string' && step.title.trim().length > 0 ? step.title.trim() : 'step',
            category: typeof step.category === 'string' && step.category.trim().length > 0 ? step.category.trim() : null,
            durationMs: typeof step.durationMs === 'number' ? step.durationMs : 0,
        }))
}

function buildCandidateIdentity(test: ReporterTest): { title: string; file: string; project: string } | null {
    const title = test.title ?? ''
    const file = test.location?.file ?? ''
    const project = test.project ?? 'unknown'

    if (!title || !file) {
        return null
    }

    return { title, file, project }
}

function buildCandidateKey(project: string, file: string, title: string): string {
    return `${project}::${file}::${title}`
}

function getHistoryItemTime(item: TestHistoryItem): number {
    const reportTime = item.reportTimestamp ? new Date(item.reportTimestamp).getTime() : Number.NaN

    if (Number.isFinite(reportTime)) {
        return reportTime
    }

    const generatedTime = new Date(item.generatedAt).getTime()

    if (Number.isFinite(generatedTime)) {
        return generatedTime
    }

    return 0
}

function normalizeStatus(status: string | undefined): string {
    const normalizedStatus = (status ?? '').trim().toLowerCase()

    if (normalizedStatus === 'timed out') {
        return 'timedout'
    }

    return normalizedStatus || 'unknown'
}

function calculateApiMtbfDays(historyItems: TestHistoryItem[]): number | null {
    const unstableTimes = historyItems
        .filter((item) => item.flaky || item.status === 'failed' || item.status === 'timedout' || item.status === 'interrupted')
        .map((item) => item.reportTimestamp ?? item.generatedAt)
        .map((timestamp) => new Date(timestamp).getTime())
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right)

    if (unstableTimes.length < 2) {
        return null
    }

    const intervals: number[] = []

    for (let index = 1; index < unstableTimes.length; index += 1) {
        intervals.push((unstableTimes[index] - unstableTimes[index - 1]) / (1000 * 60 * 60 * 24))
    }

    return roundToTwoDigits(intervals.reduce((accumulator, value) => accumulator + value, 0) / intervals.length)
}

function roundToOneDigit(value: number): number {
    return Math.round(value * 10) / 10
}

function roundToTwoDigits(value: number): number {
    return Math.round(value * 100) / 100
}

