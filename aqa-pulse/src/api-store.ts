import {
    buildAdvancedMetricsFromArchivedRuns,
    buildDashboardSummary,
    collectCurrentRunTests,
    type DashboardAvailableFilters,
    type DashboardFilters,
    normalizeDashboardSummary,
    readDashboardSummary,
    type ReporterAttachment,
    getReporterErrorMessage,
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
    depth: number
    offsetMs: number | null
    durationMs: number
    status: string | null
    errorMessage: string | null
    isFailurePoint: boolean
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

export type TestHistoryIncidentCategory = 'network' | 'timeout' | 'selector' | 'assertion' | 'auth' | 'infrastructure' | 'unknown'

export type TestHistoryIncidentSeverity = 'active' | 'monitoring' | 'resolved'

export type TestHistoryIncidentConfidence = 'high' | 'medium' | 'low'

export type TestHistoryIncidentEvidenceTone = 'primary' | 'supporting' | 'context'

export interface TestHistoryIncidentEvidenceItem {
    label: string
    value: string
    tone: TestHistoryIncidentEvidenceTone
}

export interface TestHistoryIncidentSummary {
    severity: TestHistoryIncidentSeverity
    category: TestHistoryIncidentCategory
    confidence: TestHistoryIncidentConfidence
    summary: string
    evidence: TestHistoryIncidentEvidenceItem[]
    unstableRuns: number
    matchingRuns: number
    affectedAttempts: number
    firstSeenAt: string | null
    latestSeenAt: string | null
    latestRecoveryAt: string | null
    latestErrorMessage: string | null
    failureStepRunId: string | null
    failureStepAttempt: number | null
    failureStepOffsetMs: number | null
    failureStepTitle: string | null
    failureStepCategory: string | null
    failureStepErrorMessage: string | null
}

interface PrimaryFailureStepMatch {
    runId: string
    attemptNumber: number
    step: TestHistoryStep
}

interface IncidentSignalBundle {
    corpus: string
    normalizedErrorMessages: string[]
    stepCategories: string[]
    stepTitles: string[]
    failureStepCategories: string[]
    failureStepTitles: string[]
    failureStepErrorMessages: string[]
    attachmentHints: string[]
    hasContextAttachment: boolean
    hasTraceAttachment: boolean
    hasHarAttachment: boolean
    hasExactFailureStep: boolean
    signalSources: number
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
    incidentSummary: TestHistoryIncidentSummary | null
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
        const history = this.getHistory()
        const latestRun = summary.comparison.currentRun ?? history.runs[history.runs.length - 1] ?? null

        if (latestRun && shouldRebuildSummaryFromArchives(summary, history)) {
            const rebuiltSummary = this.rebuildSummaryFromArchives(history, latestRun)

            if (rebuiltSummary) {
                return rebuiltSummary
            }
        }

        if (summary.currentRunTests.all.length > 0) {
            return summary
        }

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

    private rebuildSummaryFromArchives(history: DashboardHistory, latestRun: DashboardHistoryEntry): DashboardSummary | null {
        const archivedRuns = history.runs
            .map((run) => {
                const archivedDirectory = this.storage.findArchivedRunDirectory(run.id)

                if (!archivedDirectory) {
                    return null
                }

                return {
                    run,
                    archivedRun: this.storage.readArchivedRunRecord(archivedDirectory),
                }
            })
            .filter((value): value is { run: DashboardHistoryEntry; archivedRun: ReturnType<DashboardReadStorage['readArchivedRunRecord']> } => value !== null)

        const latestArchivedRun = archivedRuns.find((item) => item.run.id === latestRun.id) ?? archivedRuns[archivedRuns.length - 1] ?? null

        if (!latestArchivedRun) {
            return null
        }

        const advancedMetrics = buildAdvancedMetricsFromArchivedRuns(
            latestArchivedRun.archivedRun.data,
            history.runs,
            archivedRuns.map((item) => ({ run: item.run, report: item.archivedRun.data })),
        )

        return buildDashboardSummary(
            latestArchivedRun.archivedRun.data,
            latestRun.sourceFile,
            history.runs,
            {
                branch: latestRun.branch,
                commit: latestRun.commit,
                author: latestRun.author,
            },
            advancedMetrics,
        )
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
            incidentSummary: buildIncidentSummary(historyItems),
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

function shouldRebuildSummaryFromArchives(summary: DashboardSummary, history: DashboardHistory): boolean {
    if (history.runs.length === 0) {
        return false
    }

    if (summary.currentRunTests.all.length === 0) {
        return true
    }

    return summary.flakyAnalytics.topFlakyTests.length === 0 && history.runs.length > 1
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
            .map((test) => test.errors?.map(getReporterErrorMessage).find((message): message is string => Boolean(message))
                ?? getReporterErrorMessage(test.attempts?.find((attempt) => Boolean(getReporterErrorMessage(attempt.error)))?.error)
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
        errorMessage: test.errors?.map(getReporterErrorMessage).find((message): message is string => Boolean(message))
            ?? getReporterErrorMessage(failedAttempt?.error)
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
            errorMessage: test.errors?.map(getReporterErrorMessage).find((message): message is string => Boolean(message)) ?? null,
            attachments: [],
            steps: [],
        }]
    }

    return attempts.map((attempt, index) => ({
        attempt: typeof attempt.attempt === 'number' ? attempt.attempt : (index + 1),
        status: normalizeStatus(attempt.status),
        durationMs: typeof attempt.durationMs === 'number' ? attempt.durationMs : 0,
        startTime: typeof attempt.startTime === 'string' ? attempt.startTime : null,
        errorMessage: getReporterErrorMessage(attempt.error),
        attachments: normalizeAttemptAttachments(attempt.attachments),
        steps: normalizeAttemptSteps(attempt.steps, attempt.failedStepIndex, attempt.failedStepTitle),
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

function normalizeAttemptSteps(
    steps: ReporterStep[] | undefined,
    failedStepIndex?: number,
    failedStepTitle?: string,
): TestHistoryStep[] {
    if (!Array.isArray(steps)) {
        return []
    }

    const normalizedFailedTitle = typeof failedStepTitle === 'string' && failedStepTitle.trim().length > 0
        ? failedStepTitle.trim().toLowerCase()
        : null

    return steps
        .map((step, index) => {
            const title = typeof step.title === 'string' && step.title.trim().length > 0 ? step.title.trim() : 'step'
            const errorMessage = getReporterErrorMessage(step.error)
            const depth = typeof step.depth === 'number' && Number.isFinite(step.depth)
                ? Math.max(0, Math.trunc(step.depth))
                : 0
            const normalizedStatus = typeof step.status === 'string' && step.status.trim().length > 0
                ? normalizeStatus(step.status)
                : null
            const isFailurePoint = step.failed === true
                || Boolean(errorMessage)
                || (typeof failedStepIndex === 'number' && failedStepIndex >= 0 && failedStepIndex === index)
                || (normalizedFailedTitle !== null && title.toLowerCase() === normalizedFailedTitle)

            return {
                title,
                category: typeof step.category === 'string' && step.category.trim().length > 0 ? step.category.trim() : null,
                depth,
                offsetMs: typeof step.offsetMs === 'number' && Number.isFinite(step.offsetMs) ? Math.max(0, step.offsetMs) : null,
                durationMs: typeof step.durationMs === 'number' ? step.durationMs : 0,
                status: normalizedStatus,
                errorMessage,
                isFailurePoint,
            }
        })
}

function buildCandidateIdentity(test: ReporterTest): { title: string; file: string; project: string } | null {
    const title = test.title ?? ''
    const file = test.location?.file ?? 'неизвестно'
    const project = test.project ?? 'unknown'

    if (!title) {
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

function buildIncidentSummary(historyItems: TestHistoryItem[]): TestHistoryIncidentSummary | null {
    const unstableItems = historyItems.filter(isUnstableHistoryItem)

    if (unstableItems.length === 0) {
        return null
    }

    const latestRun = historyItems[0] ?? null
    const latestUnstable = unstableItems[0]
    const latestRelevantAttempt = [...latestUnstable.attemptDetails]
        .reverse()
        .find((attempt) => isUnstableStatus(attempt.status) || Boolean(attempt.errorMessage))
        ?? latestUnstable.attemptDetails[latestUnstable.attemptDetails.length - 1]
        ?? null

    const latestSignals = collectIncidentSignals(latestUnstable)
    const primaryFailureStep = selectPrimaryFailureStep(latestUnstable, latestRelevantAttempt)
    const latestErrorMessage = latestRelevantAttempt?.errorMessage ?? latestUnstable.errorMessage ?? null
    const category = classifyIncidentCategory(latestSignals)
    const matchingRuns = unstableItems.filter((item) => classifyIncidentCategory(collectIncidentSignals(item)) === category)
    const latestRecovery = historyItems.find((item) => getHistoryItemTime(item) < getHistoryItemTime(latestUnstable) && !isUnstableHistoryItem(item)) ?? null
    const severity: TestHistoryIncidentSeverity = !latestRun
        ? 'monitoring'
        : isUnstableHistoryItem(latestRun)
            ? (latestRun.flaky ? 'monitoring' : 'active')
            : 'resolved'
    const affectedAttempts = latestUnstable.attemptDetails.filter((attempt) => isUnstableStatus(attempt.status) || Boolean(attempt.errorMessage)).length
    const confidence = getIncidentConfidence(category, matchingRuns.length, affectedAttempts, latestSignals)

    return {
        severity,
        category,
        confidence,
        summary: buildIncidentNarrative(category, severity, latestSignals, matchingRuns.length, primaryFailureStep?.step ?? null),
        evidence: buildIncidentEvidence({
            latestUnstable,
            matchingRuns,
            latestRecovery,
            latestSignals,
            affectedAttempts,
            primaryFailureStep: primaryFailureStep?.step ?? null,
        }),
        unstableRuns: unstableItems.length,
        matchingRuns: matchingRuns.length,
        affectedAttempts,
        firstSeenAt: matchingRuns.length > 0 ? getItemTimestamp(matchingRuns[matchingRuns.length - 1]) : getItemTimestamp(latestUnstable),
        latestSeenAt: getItemTimestamp(latestUnstable),
        latestRecoveryAt: latestRecovery ? getItemTimestamp(latestRecovery) : null,
        latestErrorMessage,
        failureStepRunId: primaryFailureStep?.runId ?? null,
        failureStepAttempt: primaryFailureStep?.attemptNumber ?? null,
        failureStepOffsetMs: primaryFailureStep?.step.offsetMs ?? null,
        failureStepTitle: primaryFailureStep?.step.title ?? latestSignals.failureStepTitles[0] ?? null,
        failureStepCategory: primaryFailureStep?.step.category ?? latestSignals.failureStepCategories[0] ?? null,
        failureStepErrorMessage: primaryFailureStep?.step.errorMessage ?? latestSignals.failureStepErrorMessages[0] ?? null,
    }
}

function buildIncidentNarrative(
    category: TestHistoryIncidentCategory,
    severity: TestHistoryIncidentSeverity,
    latestSignals: IncidentSignalBundle,
    matchingRunsCount: number,
    primaryFailureStep: TestHistoryStep | null,
): string {
    const categoryLabel = getIncidentCategoryLabel(category)
    const statePrefix = severity === 'active'
        ? 'Сбой активен.'
        : severity === 'monitoring'
            ? 'Нужно наблюдать.'
            : 'Сбой не повторяется.'
    const recurrence = matchingRunsCount > 1
        ? ` Повторялся ${matchingRunsCount} раза.`
        : ' Пока это выглядит как единичный эпизод.'
    const primaryFailureStepTitle = primaryFailureStep?.title ?? latestSignals.failureStepTitles[0] ?? null
    const failingStepPart = primaryFailureStepTitle
        ? ` Точка падения: ${primaryFailureStepTitle}.`
        : ''
    const evidenceHint = latestSignals.hasContextAttachment
        ? ' Есть `error-context.md` с дополнительным контекстом.'
        : latestSignals.hasTraceAttachment
            ? ' Есть trace или визуальные артефакты для детального разбора.'
            : ''
    const messagePart = latestSignals.normalizedErrorMessages[0]
        ? ` Основной сигнал: ${latestSignals.normalizedErrorMessages[0]}.`
        : ''

    return `${statePrefix} Вероятная причина: ${categoryLabel}.${recurrence}${failingStepPart}${messagePart}${evidenceHint}`
}

function buildIncidentEvidence(input: {
    latestUnstable: TestHistoryItem
    matchingRuns: TestHistoryItem[]
    latestRecovery: TestHistoryItem | null
    latestSignals: IncidentSignalBundle
    affectedAttempts: number
    primaryFailureStep: TestHistoryStep | null
}): TestHistoryIncidentEvidenceItem[] {
    const evidence: TestHistoryIncidentEvidenceItem[] = []

    const pushEvidence = (
        label: string,
        value: string | null,
        tone: TestHistoryIncidentEvidenceTone,
    ): void => {
        if (!(value?.trim())) {
            return
        }

        evidence.push({ label, value: value.trim(), tone })
    }

    pushEvidence(
        'Проблемные попытки',
        `${input.affectedAttempts} из ${input.latestUnstable.attempts} в последнем нестабильном запуске`,
        'supporting',
    )

    if (input.latestSignals.attachmentHints.length > 0) {
        pushEvidence('Артефакты', input.latestSignals.attachmentHints.slice(0, 3).join(', '), 'supporting')
    }

    if (input.matchingRuns.length > 1) {
        pushEvidence('Повторяемость', `Похожий сбой был в ${input.matchingRuns.length} нестабильных прогонах`, 'supporting')
    }

    if (input.latestRecovery) {
        pushEvidence(
            'Последнее восстановление',
            input.latestRecovery.reportTimestamp ?? input.latestRecovery.generatedAt,
            'context',
        )
    }

    return evidence
}

function getIncidentConfidence(
    category: TestHistoryIncidentCategory,
    matchingRunsCount: number,
    affectedAttempts: number,
    latestSignals: IncidentSignalBundle,
): TestHistoryIncidentConfidence {
    if (latestSignals.hasExactFailureStep && category !== 'unknown' && latestSignals.signalSources >= 2) {
        return 'high'
    }

    if (category !== 'unknown' && ((matchingRunsCount >= 2 || affectedAttempts >= 2) && latestSignals.signalSources >= 2)) {
        return 'high'
    }

    if (category !== 'unknown' || latestSignals.normalizedErrorMessages.length > 0 || latestSignals.attachmentHints.length > 0 || latestSignals.hasExactFailureStep) {
        return 'medium'
    }

    return 'low'
}

function classifyIncidentCategory(signals: IncidentSignalBundle): TestHistoryIncidentCategory {
    const message = signals.corpus
    const targetedMessage = [
        ...signals.failureStepErrorMessages,
        ...signals.failureStepCategories,
        ...signals.failureStepTitles,
    ].join(' ').toLowerCase()
    const categoryCorpus = targetedMessage || message
    const errorCorpus = [...signals.normalizedErrorMessages, ...signals.failureStepErrorMessages].join(' ').toLowerCase()
    const attachmentCorpus = signals.attachmentHints.join(' ').toLowerCase()

    if (!message) {
        return 'unknown'
    }

    if (/strict mode violation|locator|selector|resolved to \d+ elements|not attached/i.test(categoryCorpus)) {
        return 'selector'
    }

    if (/err_connection|econn|socket|gateway|network|fetch|dns|enotfound|eai_again|reset|har|response status/i.test(categoryCorpus)) {
        return 'network'
    }

    if (/timeout|timed out|waiting for|exceeded|slow/i.test(categoryCorpus)) {
        return 'timeout'
    }

    if (/expect\(|tobe|tohave|assert|mismatch|received:/i.test(categoryCorpus)) {
        return 'assertion'
    }

    if (/browser has been closed|target page, context or browser has been closed|worker process|sigterm|enomem|epipe|crash|detached/i.test(categoryCorpus)) {
        return 'infrastructure'
    }

    if (
        /unauthorized|forbidden|access denied|invalid token|token expired|session expired|login required|not authenticated|auth failed|authentication failed|refresh token/i.test(errorCorpus)
        || ((signals.hasContextAttachment || attachmentCorpus.includes('storage-state')) && /token|session|login|auth/i.test(errorCorpus))
    ) {
        return 'auth'
    }

    return 'unknown'
}

function selectPrimaryFailureStep(
    item: TestHistoryItem,
    preferredAttempt: TestHistoryAttemptDetail | null,
): PrimaryFailureStepMatch | null {
    const attempts = preferredAttempt
        ? [preferredAttempt, ...item.attemptDetails.filter((attempt) => attempt !== preferredAttempt)]
        : item.attemptDetails

    for (const attempt of attempts) {
        const primaryStep = selectPrimaryFailureStepFromSteps(attempt.steps)

        if (primaryStep) {
            return {
                runId: item.runId,
                attemptNumber: attempt.attempt,
                step: primaryStep,
            }
        }
    }

    return null
}

function selectPrimaryFailureStepFromSteps(steps: TestHistoryStep[]): TestHistoryStep | null {
    if (steps.length === 0) {
        return null
    }

    const stepCandidates = steps
        .map((step, stepIndex) => ({ step, stepIndex }))
    const exactFailureCandidates = stepCandidates
        .filter((candidate) => candidate.step.isFailurePoint)
    const explicitErrorCandidate = pickBestExplicitErrorCandidate(
        stepCandidates.filter((candidate) => hasActionableDiagnosticStepError(candidate.step)),
    )
    const bestExactFailure = pickBestDiagnosticStepCandidate(exactFailureCandidates)

    if (explicitErrorCandidate && bestExactFailure && shouldPreferExplicitErrorCandidate(explicitErrorCandidate, bestExactFailure)) {
        return explicitErrorCandidate.step
    }

    if (bestExactFailure && !isGenericTeardownFailureStep(bestExactFailure.step)) {
        return bestExactFailure.step
    }

    if (bestExactFailure) {
        const contextualCandidates = stepCandidates
            .slice(0, bestExactFailure.stepIndex)
            .filter((candidate) => isMeaningfulFailureContextStep(candidate.step))
        const contextualStep = pickBestDiagnosticStepCandidate(contextualCandidates)

        return explicitErrorCandidate?.step ?? contextualStep?.step ?? bestExactFailure.step
    }

    if (explicitErrorCandidate) {
        return explicitErrorCandidate.step
    }

    const fallbackCandidate = pickBestDiagnosticStepCandidate(
        stepCandidates.filter((candidate) => isMeaningfulFailureContextStep(candidate.step)),
    )

    return fallbackCandidate?.step ?? null
}

export function selectPrimaryFailureStepForDiagnostics(steps: TestHistoryStep[]): TestHistoryStep | null {
    return selectPrimaryFailureStepFromSteps(steps)
}

function shouldPreferExplicitErrorCandidate(
    explicitErrorCandidate: { step: TestHistoryStep; stepIndex: number },
    exactFailureCandidate: { step: TestHistoryStep; stepIndex: number },
): boolean {
    if (isGenericTeardownFailureStep(exactFailureCandidate.step)) {
        return true
    }

    if (!exactFailureCandidate.step.errorMessage && explicitErrorCandidate.step.errorMessage) {
        return true
    }

    if (isGenericLifecycleStep(exactFailureCandidate.step) && !isGenericLifecycleStep(explicitErrorCandidate.step)) {
        return true
    }

    if (
        exactFailureCandidate.step.category === 'test.step'
        && explicitErrorCandidate.step.category !== 'test.step'
        && explicitErrorCandidate.step.depth >= exactFailureCandidate.step.depth
    ) {
        return true
    }

    return getDiagnosticStepPriority(explicitErrorCandidate.step, explicitErrorCandidate.stepIndex)
        >= getDiagnosticStepPriority(exactFailureCandidate.step, exactFailureCandidate.stepIndex)
}

function pickBestDiagnosticStepCandidate(
    candidates: Array<{ step: TestHistoryStep; stepIndex: number }>,
): { step: TestHistoryStep; stepIndex: number } | null {
    if (candidates.length === 0) {
        return null
    }

    return [...candidates].sort((left, right) => {
        const scoreDelta = getDiagnosticStepPriority(right.step, right.stepIndex) - getDiagnosticStepPriority(left.step, left.stepIndex)

        if (scoreDelta !== 0) {
            return scoreDelta
        }

        return right.stepIndex - left.stepIndex
    })[0] ?? null
}

function pickBestExplicitErrorCandidate(
    candidates: Array<{ step: TestHistoryStep; stepIndex: number }>,
): { step: TestHistoryStep; stepIndex: number } | null {
    if (candidates.length === 0) {
        return null
    }

    return [...candidates].sort((left, right) => {
        const scoreDelta = getExplicitErrorStepPriority(right.step, right.stepIndex) - getExplicitErrorStepPriority(left.step, left.stepIndex)

        if (scoreDelta !== 0) {
            return scoreDelta
        }

        return right.stepIndex - left.stepIndex
    })[0] ?? null
}

function getDiagnosticStepPriority(step: TestHistoryStep, stepIndex: number): number {
    let score = stepIndex

    if (step.errorMessage) {
        score += 120
    }

    if (step.isFailurePoint) {
        score += 80
    }

    if (isUnstableStatus(step.status ?? '')) {
        score += 50
    }

    score += step.depth * 14

    switch (step.category) {
        case 'expect':
            score += 28
            break
        case 'pw:api':
            score += 22
            break
        case 'test.step':
            score += 18
            break
        case 'hook':
            score += 6
            break
        default:
            break
    }

    if (isGenericLifecycleStep(step)) {
        score -= 48
    }

    if (isGenericTeardownFailureStep(step)) {
        score -= 200
    }

    if (isCascadingTeardownInfrastructureStep(step)) {
        score -= 180
    }

    if (isActionableAutomationErrorStep(step)) {
        score += 36
    }

    return score
}

function getExplicitErrorStepPriority(step: TestHistoryStep, stepIndex: number): number {
    let score = getDiagnosticStepPriority(step, stepIndex)

    if (step.category === 'test.step') {
        score -= 70
    } else {
        score += 30
    }

    if (step.depth > 0) {
        score += 24
    }

    return score
}

function hasActionableDiagnosticStepError(step: TestHistoryStep): boolean {
    if (!(step.errorMessage?.trim())) {
        return false
    }

    return !isGenericTeardownFailureStep(step)
        && !isCascadingTeardownInfrastructureStep(step)
}

function isActionableAutomationErrorStep(step: TestHistoryStep): boolean {
    const titleCorpus = step.title.trim().toLowerCase()
    const categoryCorpus = (step.category ?? '').trim().toLowerCase()
    const errorCorpus = (step.errorMessage ?? '').trim().toLowerCase()
    const combinedCorpus = `${titleCorpus} ${categoryCorpus} ${errorCorpus}`

    return step.category === 'pw:api'
        && /(timeouterror|timeout \d+ms exceeded|timed out|waitfor|wait for|locator\.|selector)/.test(combinedCorpus)
}

function isCascadingTeardownInfrastructureStep(step: TestHistoryStep): boolean {
    const titleCorpus = step.title.trim().toLowerCase()
    const categoryCorpus = (step.category ?? '').trim().toLowerCase()
    const errorCorpus = (step.errorMessage ?? '').trim().toLowerCase()

    if (!errorCorpus) {
        return false
    }

    const hasClosedResourceSignal = /target page, context or browser has been closed|browser has been closed|context has been closed|page has been closed|browser\.close:|context\.close:|page\.close:/.test(errorCorpus)
    const isCloseOperation = /(close browser|close context|close page|browser close|context close|page close)/.test(titleCorpus)
    const isLifecycleCleanup = isGenericLifecycleStep(step)
        || isGenericTeardownFailureStep(step)
        || categoryCorpus === 'hook'

    return hasClosedResourceSignal && (isCloseOperation || isLifecycleCleanup)
}

function isMeaningfulFailureContextStep(step: TestHistoryStep): boolean {
    if (isGenericTeardownFailureStep(step)) {
        return false
    }

    return Boolean(step.errorMessage)
        || isUnstableStatus(step.status ?? '')
        || step.category !== 'hook'
        || step.depth > 0
}

function isGenericLifecycleStep(step: TestHistoryStep): boolean {
    const category = (step.category ?? '').trim().toLowerCase()
    const title = step.title.trim().toLowerCase()

    return /(^|\W)(before hooks|after hooks|setup|teardown|cleanup|worker cleanup|fixture|hook)($|\W)/.test(title)
        || /(hook:before|hook:after|fixture:setup|fixture:teardown|beforeall|beforeeach|afterall|aftereach)/.test(category)
}

function isGenericTeardownFailureStep(step: TestHistoryStep): boolean {
    const category = (step.category ?? '').trim().toLowerCase()
    const title = step.title.trim().toLowerCase()

    return /(^|\W)(after hooks|worker cleanup|cleanup|clean up|teardown|tear down)($|\W)/.test(title)
        || /(hook:after|fixture:teardown|afterall|aftereach|cleanup|clean up|teardown)/.test(category)
}

function collectIncidentSignals(item: TestHistoryItem): IncidentSignalBundle {
    const normalizedErrorMessages = unique(
        [item.errorMessage, ...item.attemptDetails.map((attempt) => attempt.errorMessage)]
            .filter((message): message is string => typeof message === 'string' && message.trim().length > 0)
            .map(normalizeIncidentMessage),
    )
    const failureSteps = item.attemptDetails.flatMap((attempt) => attempt.steps.filter((step) => step.isFailurePoint))
    const stepCategories = unique(
        item.attemptDetails
            .flatMap((attempt) => attempt.steps)
            .map((step) => step.category ?? step.title)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim()),
    )
    const stepTitles = unique(
        item.attemptDetails
            .flatMap((attempt) => attempt.steps)
            .map((step) => step.title)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim()),
    )
    const failureStepCategories = unique(
        failureSteps
            .map((step) => step.category ?? step.title)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim()),
    )
    const failureStepTitles = unique(
        failureSteps
            .map((step) => step.title)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim()),
    )
    const failureStepErrorMessages = unique(
        failureSteps
            .map((step) => step.errorMessage)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map(normalizeIncidentMessage),
    )
    const attachmentHints = unique(
        item.attemptDetails
            .flatMap((attempt) => attempt.attachments)
            .map((attachment) => attachment.name ?? attachment.path ?? attachment.url ?? null)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim()),
    )
    const lowerAttachmentHints = attachmentHints.map((hint) => hint.toLowerCase())
    const hasContextAttachment = lowerAttachmentHints.some((hint) => hint.includes('error-context.md'))
    const hasTraceAttachment = lowerAttachmentHints.some((hint) => hint.includes('trace') || hint.includes('screenshot') || hint.includes('video'))
    const hasHarAttachment = lowerAttachmentHints.some((hint) => hint.includes('.har') || hint.includes('har'))
    const hasExactFailureStep = failureStepTitles.length > 0 || failureStepErrorMessages.length > 0
    const sourceCount = Number(normalizedErrorMessages.length > 0) + Number(hasExactFailureStep) + Number(stepCategories.length > 0 || stepTitles.length > 0) + Number(attachmentHints.length > 0)

    return {
        corpus: [
            ...failureStepErrorMessages,
            ...failureStepCategories,
            ...failureStepTitles,
            ...normalizedErrorMessages,
            ...stepCategories,
            ...stepTitles,
            ...attachmentHints,
        ].join(' ').toLowerCase(),
        normalizedErrorMessages,
        stepCategories,
        stepTitles,
        failureStepCategories,
        failureStepTitles,
        failureStepErrorMessages,
        attachmentHints,
        hasContextAttachment,
        hasTraceAttachment,
        hasHarAttachment,
        hasExactFailureStep,
        signalSources: sourceCount,
    }
}

function unique(values: string[]): string[] {
    return [...new Set(values)]
}

function getIncidentCategoryLabel(category: TestHistoryIncidentCategory): string {
    switch (category) {
        case 'network':
            return 'сетевой сбой или нестабильность внешнего ответа'
        case 'timeout':
            return 'таймаут или слишком медленный ответ'
        case 'selector':
            return 'нестабильный селектор или конфликт locator-логики'
        case 'assertion':
            return 'ошибка ожидания или assert-проверки'
        case 'auth':
            return 'авторизация или сессия'
        case 'infrastructure':
            return 'инфраструктура раннера или окружения'
        default:
            return 'неоднозначный сигнал'
    }
}

function normalizeIncidentMessage(message: string): string {
    return message.replace(/\s+/g, ' ').trim().slice(0, 220)
}

function getItemTimestamp(item: TestHistoryItem): string | null {
    return item.reportTimestamp ?? item.generatedAt ?? null
}

function isUnstableHistoryItem(item: TestHistoryItem): boolean {
    return item.flaky || isUnstableStatus(item.status) || Boolean(item.errorMessage)
}

function isUnstableStatus(status: string): boolean {
    return status === 'failed' || status === 'timedout' || status === 'interrupted'
}

function roundToOneDigit(value: number): number {
    return Math.round(value * 10) / 10
}

function roundToTwoDigits(value: number): number {
    return Math.round(value * 100) / 100
}

