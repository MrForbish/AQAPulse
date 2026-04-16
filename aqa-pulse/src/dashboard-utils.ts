import * as fs from 'node:fs'
import * as path from 'node:path'
import { formatDate, formatDuration, formatPercent } from './shared/formatting'
import {
    findArchivedRunDirectory,
    readArchivedRunRecord,
    type DashboardHistoryEntry,
} from './history-utils'

export { formatDate, formatDuration, formatPercent } from './shared/formatting'

export interface DashboardRunMetadata {
    branch: string | null
    commit: string | null
    author: string | null
}

export interface DashboardFilters {
    branch: string | null
    project: string | null
    file: string | null
}

export interface DashboardAvailableFilters {
    branches: string[]
    projects: string[]
    files: string[]
    projectsByBranch: Record<string, string[]>
    filesByBranch: Record<string, string[]>
    filesByProject: Record<string, string[]>
    filesByBranchProject: Record<string, Record<string, string[]>>
}

export interface ReporterSummary {
    total?: number
    passed?: number
    failed?: number
    flaky?: number
    skipped?: number
    timedOut?: number
    interrupted?: number
}

export interface ReporterLocation {
    file?: string
    line?: number
    column?: number
}

export interface ReporterError {
    message?: string
    stack?: string
}

export interface ReporterAttachment {
    name?: string
    contentType?: string
    path?: string
    url?: string
    inlineContentBase64?: string
    inlineContentEncoding?: 'base64' | string
    inlineContentSizeBytes?: number
}

export interface ReporterStep {
    title?: string
    category?: string
    depth?: number
    durationMs?: number
    status?: string
    failed?: boolean
    error?: ReporterError
}

export interface ReporterAttempt {
    attempt?: number
    status?: string
    durationMs?: number
    startTime?: string
    error?: ReporterError
    attachments?: ReporterAttachment[]
    steps?: ReporterStep[]
    failedStepIndex?: number
    failedStepTitle?: string
}

export interface ReporterTest {
    id?: string
    title?: string
    status?: string
    flaky?: boolean
    durationMs?: number
    location?: ReporterLocation
    project?: string
    browser?: string
    retries?: number
    errors?: ReporterError[]
    attempts?: ReporterAttempt[]
}

export interface ReporterEnvironment {
    playwrightVersion?: string
    nodeVersion?: string
    os?: string
    workers?: number
    retries?: number
    projects?: string[]
}

export interface ReporterRoot {
    schemaVersion?: number
    timestamp?: string
    durationMs?: number
    summary?: ReporterSummary
    environment?: ReporterEnvironment
    tests?: ReporterTest[]
}

export interface DashboardKpis {
    totalTests: number
    passedTests: number
    failedTests: number
    flakyTests: number
    skippedTests: number
    timedOutTests: number
    interruptedTests: number
    passRate: number
    flakyRatio: number
    totalDurationMs: number
    medianDurationMs: number
    errorClusterCount: number
}

export interface DashboardChartDataset {
    labels: string[]
    values: number[]
}

export interface DashboardCurrentRunTest {
    title: string
    file: string
    project: string
    status: string
    flaky: boolean
    durationMs: number
    errorMessage: string | null
    errorDetails?: string | null
}

export interface DashboardCurrentRunTests {
    all: DashboardCurrentRunTest[]
    passed: DashboardCurrentRunTest[]
    failed: DashboardCurrentRunTest[]
    flaky: DashboardCurrentRunTest[]
    skipped: DashboardCurrentRunTest[]
    timedOut: DashboardCurrentRunTest[]
    interrupted: DashboardCurrentRunTest[]
}

export interface DashboardProblematicTest {
    title: string
    file: string
    project: string
    status: string
    flaky: boolean
    durationMs: number
    retries: number
    attempts: number
    failureRate: number
    errorMessage: string
    errorDetails?: string | null
}

export interface DashboardErrorCluster {
    message: string
    sampleMessage?: string
    count: number
    tests: string[]
}

export interface DashboardSlowTest {
    title: string
    file: string
    project: string
    status: string
    flaky: boolean
    durationMs: number
    errorMessage: string | null
    errorDetails?: string | null
}

export interface DashboardFlakyTestMetric {
    title: string
    file: string
    project: string
    flakyScore: number
    failRate: number
    mtbfDays: number | null
    unstableRuns: number
    totalRuns: number
    latestStatus: string
    latestErrorMessage: string | null
}

export interface DashboardFlakyResolutionMetric {
    days: number
    title: string
    file: string
    project: string
    detectedAt: string | null
    fixedAt: string | null
}

export interface DashboardBusinessTimeToDetectMetric {
    minutes: number | null
    source: 'pendingIntegration'
}

export interface DashboardBusinessTimeToFixMetric {
    averageDays: number | null
    resolvedIncidents: number
}

export interface DashboardBusinessAutomationRoiMetric {
    percent: number | null
    source: 'pendingAssumptions'
}

export interface DashboardPhaseBreakdownItem {
    label: string
    durationMs: number
    sharePercent: number
}

export interface DashboardDurationBreakdownItem {
    label: string
    durationMs: number
    sharePercent: number
    tests: number
}

export interface DashboardAdvancedMetrics {
    performance: {
        p95DurationMs: number
        p99DurationMs: number
        slowestTests: DashboardSlowTest[]
        phaseBreakdown: DashboardPhaseBreakdownItem[]
        suiteDuration: DashboardDurationBreakdownItem[]
        durationPerBrowser: DashboardDurationBreakdownItem[]
        durationTrend: {
            currentDurationMs: number
            previousDurationMs: number | null
            deltaPercent: number | null
        }
    }
    flakyAnalytics: {
        averageFlakyScore: number | null
        averageMtbfDays: number | null
        topFlakyTests: DashboardFlakyTestMetric[]
        firstFlakeToFix: DashboardFlakyResolutionMetric | null
        flakyTrend: {
            currentFlakyTests: number
            previousFlakyTests: number | null
            delta: number | null
        }
    }
    charts: {
        durationTrend: DashboardChartDataset
        flakyTrend: DashboardChartDataset
    }
    businessMetrics: {
        timeToDetect: DashboardBusinessTimeToDetectMetric
        timeToFixFlaky: DashboardBusinessTimeToFixMetric
        costOfFlakiness: {
            totalRub: number | null
            ciCostRub: number | null
            developerCostRub: number | null
            extraRetryMinutes: number
            extraRetries: number
            unstableRuns: number
            activeDays: number
            costPerActiveDayRub: number | null
            assumptions: {
                ciMinuteCostRub: number | null
                developerHourlyCostRub: number | null
                analysisMinutesPerUnstable: number | null
            }
        }
        developerFriction: {
            rerunProxyPerActiveDay: number
            extraRetries: number
            unstableRuns: number
            activeDays: number
        }
        releaseConfidenceScore: number
        automationRoi: DashboardBusinessAutomationRoiMetric
    }
}

export interface DashboardManagerSignal {
    score: number
    level: 'healthy' | 'warning' | 'critical'
}

export interface DashboardManagerBlocker {
    kind: 'release-confidence' | 'problematic-test' | 'flaky' | 'duration' | 'error-cluster' | 'history-coverage'
    severity: 'critical' | 'warning' | 'info'
    title: string
    value: string
    details: string
    testTitle: string | null
    project: string | null
    file: string | null
}

export interface DashboardManagerChange {
    label: string
    value: string
    details: string
    direction: 'improving' | 'regressing' | 'stable'
}

export interface DashboardManagerSummary {
    releaseReadiness: DashboardManagerSignal
    qualityRisk: DashboardManagerSignal
    deliveryRisk: DashboardManagerSignal
    blockers: DashboardManagerBlocker[]
    changes: DashboardManagerChange[]
}

export interface DashboardSummary {
    generatedAt: string
    sourceFile: string
    schemaVersion: number | null
    reportTimestamp: string | null
    notes: string[]
    runMetadata: DashboardRunMetadata
    filters: DashboardFilters
    availableFilters: DashboardAvailableFilters
    environment: {
        playwrightVersion: string
        nodeVersion: string
        os: string
        workers: number
        retries: number
        projects: string[]
    }
    kpis: DashboardKpis
    charts: {
        passRateTrend: DashboardChartDataset
        durationTrend: DashboardChartDataset
        flakyTrend: DashboardChartDataset
        statusDistribution: DashboardChartDataset
        errorClusters: DashboardChartDataset
        slowestTests: DashboardChartDataset
    }
    trend: {
        previousRun: DashboardHistoryEntry | null
        passRateDelta: number | null
        failedTestsDelta: number | null
        flakyTestsDelta: number | null
        durationMsDelta: number | null
    }
    comparison: {
        currentRun: DashboardHistoryEntry | null
        previousRun: DashboardHistoryEntry | null
    }
    history: {
        totalRuns: number
        recentRuns: DashboardHistoryEntry[]
    }
    performance: DashboardAdvancedMetrics['performance']
    flakyAnalytics: DashboardAdvancedMetrics['flakyAnalytics']
    businessMetrics: DashboardAdvancedMetrics['businessMetrics']
    managerSummary: DashboardManagerSummary
    currentRunTests: DashboardCurrentRunTests
    topProblematicTests: DashboardProblematicTest[]
    errorClusters: DashboardErrorCluster[]
}

const ANSI_PATTERN = /\u001B\[[0-9;]*m/g

export function loadReporterReport(reportPath: string): ReporterRoot {
    const report = readJsonFile<ReporterRoot>(reportPath, 'JSON-репорт Playwright')

    if (!Array.isArray(report.tests)) {
        throw new Error(`В файле \"${reportPath}\" отсутствует массив tests. Ожидался JSON в формате playwright-reporter-llm.`)
    }

    return enrichReporterReport(report)
}

export function enrichReporterReport(report: ReporterRoot): ReporterRoot {
    if (!Array.isArray(report.tests)) {
        return report
    }

    return {
        ...report,
        tests: report.tests.map((test) => ({
            ...test,
            attempts: Array.isArray(test.attempts)
                ? test.attempts.map((attempt) => enrichReporterAttempt(attempt))
                : test.attempts,
        })),
    }
}

function enrichReporterAttempt(attempt: ReporterAttempt): ReporterAttempt {
    const steps = Array.isArray(attempt.steps) ? attempt.steps : []

    if (steps.length === 0) {
        return attempt
    }

    const failureIndex = resolveReporterFailedStepIndex(attempt, steps)

    if (failureIndex === null) {
        return attempt
    }

    const inferredAttemptStatus = normalizeReporterStatus(attempt.status)
    const enrichedSteps = steps.map((step, index) => {
        if (index !== failureIndex) {
            return step
        }

        return {
            ...step,
            failed: true,
            status: typeof step.status === 'string' && step.status.trim().length > 0
                ? step.status
                : (isReporterUnstableStatus(inferredAttemptStatus) ? inferredAttemptStatus : step.status),
            error: hasReporterErrorMessage(step.error)
                ? step.error
                : (hasReporterErrorMessage(attempt.error) ? attempt.error : step.error),
        }
    })

    const inferredTitle = typeof steps[failureIndex]?.title === 'string' && steps[failureIndex].title?.trim().length
        ? steps[failureIndex].title?.trim()
        : undefined

    return {
        ...attempt,
        failedStepIndex: typeof attempt.failedStepIndex === 'number' && attempt.failedStepIndex >= 0 && attempt.failedStepIndex < steps.length
            ? attempt.failedStepIndex
            : failureIndex,
        failedStepTitle: typeof attempt.failedStepTitle === 'string' && attempt.failedStepTitle.trim().length > 0
            ? attempt.failedStepTitle.trim()
            : inferredTitle,
        steps: enrichedSteps,
    }
}

function resolveReporterFailedStepIndex(attempt: ReporterAttempt, steps: ReporterStep[]): number | null {
    if (typeof attempt.failedStepIndex === 'number' && attempt.failedStepIndex >= 0 && attempt.failedStepIndex < steps.length) {
        return attempt.failedStepIndex
    }

    const normalizedFailedTitle = typeof attempt.failedStepTitle === 'string' && attempt.failedStepTitle.trim().length > 0
        ? attempt.failedStepTitle.trim().toLowerCase()
        : null

    if (normalizedFailedTitle) {
        const titledIndex = steps.findIndex((step) => typeof step.title === 'string' && step.title.trim().toLowerCase() === normalizedFailedTitle)

        if (titledIndex >= 0) {
            return titledIndex
        }
    }

    const explicitIndex = steps.findIndex((step) => step.failed === true || hasReporterErrorMessage(step.error) || isReporterUnstableStatus(normalizeReporterStatus(step.status)))

    if (explicitIndex >= 0) {
        return explicitIndex
    }

    if (isReporterUnstableStatus(normalizeReporterStatus(attempt.status)) && steps.length > 0) {
        return steps.length - 1
    }

    return null
}

function hasReporterErrorMessage(error: ReporterError | undefined): boolean {
    return typeof error?.message === 'string' && error.message.trim().length > 0
}

function normalizeReporterStatus(status: string | undefined): string {
    const normalized = (status ?? '').trim().toLowerCase()
    return normalized === 'timed out' ? 'timedout' : normalized
}

function isReporterUnstableStatus(status: string): boolean {
    return status === 'failed' || status === 'timedout' || status === 'interrupted'
}

export function readDashboardSummary(summaryPath: string): DashboardSummary {
    const summary = readJsonFile<DashboardSummary>(summaryPath, 'сводка AQA Pulse')

    if (!summary.kpis || !summary.charts) {
        throw new Error(`В файле \"${summaryPath}\" отсутствуют обязательные поля kpis/charts. Сначала сгенерируй dashboard-data.json.`)
    }

    return normalizeDashboardSummary(summary)
}

export function normalizeDashboardSummary(summary: DashboardSummary): DashboardSummary {
    const fallbackBusinessMetrics = buildEmptyBusinessMetrics()
    const businessMetrics = summary.businessMetrics
    const normalizedBusinessMetrics = {
        ...fallbackBusinessMetrics,
        ...businessMetrics,
        timeToDetect: {
            ...fallbackBusinessMetrics.timeToDetect,
            ...(businessMetrics?.timeToDetect ?? {}),
        },
        timeToFixFlaky: {
            ...fallbackBusinessMetrics.timeToFixFlaky,
            ...(businessMetrics?.timeToFixFlaky ?? {}),
        },
        costOfFlakiness: {
            ...fallbackBusinessMetrics.costOfFlakiness,
            ...(businessMetrics?.costOfFlakiness ?? {}),
            assumptions: {
                ...fallbackBusinessMetrics.costOfFlakiness.assumptions,
                ...(businessMetrics?.costOfFlakiness?.assumptions ?? {}),
            },
        },
        developerFriction: {
            ...fallbackBusinessMetrics.developerFriction,
            ...(businessMetrics?.developerFriction ?? {}),
        },
        automationRoi: {
            ...fallbackBusinessMetrics.automationRoi,
            ...(businessMetrics?.automationRoi ?? {}),
        },
    }
    const currentRunTests = summary.currentRunTests ?? recoverCurrentRunTestsFromSource(summary.sourceFile)
    const topProblematicTests = summary.topProblematicTests ?? []
    const errorClusters = summary.errorClusters ?? []

    return {
        ...summary,
        businessMetrics: normalizedBusinessMetrics,
        currentRunTests,
        topProblematicTests,
        errorClusters,
        managerSummary: summary.managerSummary ?? buildManagerSummary({
            kpis: summary.kpis,
            trend: summary.trend,
            historyTotalRuns: summary.history.totalRuns,
            performance: summary.performance,
            flakyAnalytics: summary.flakyAnalytics,
            businessMetrics: normalizedBusinessMetrics,
            topProblematicTests,
            errorClusters,
        }),
    }
}

export function ensureDirectoryForFile(filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

export function writeJsonFile(filePath: string, payload: unknown): void {
    ensureDirectoryForFile(filePath)
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

export function writeTextFile(filePath: string, payload: string): void {
    ensureDirectoryForFile(filePath)
    fs.writeFileSync(filePath, payload, 'utf8')
}

export function buildDashboardSummary(
    report: ReporterRoot,
    sourceFile: string,
    historyRuns: DashboardHistoryEntry[] = [],
    runMetadata: DashboardRunMetadata = { branch: null, commit: null, author: null },
    advancedMetrics: DashboardAdvancedMetrics | null = null,
    filters: DashboardFilters = { branch: null, project: null, file: null },
    availableFilters: DashboardAvailableFilters | null = null,
): DashboardSummary {
    const tests = report.tests ?? []
    const passedTests = tests.filter((test) => getFinalStatus(test) === 'passed').length
    const failedTests = tests.filter((test) => getFinalStatus(test) === 'failed').length
    const skippedTests = tests.filter((test) => getFinalStatus(test) === 'skipped').length
    const timedOutTests = tests.filter((test) => getFinalStatus(test) === 'timedout').length
    const interruptedTests = tests.filter((test) => getFinalStatus(test) === 'interrupted').length
    const flakyTests = tests.filter((test) => Boolean(test.flaky)).length
    const totalTests = tests.length
    const totalDurationMs = report.durationMs ?? sum(tests.map((test) => safeNumber(test.durationMs)))
    const passRate = totalTests === 0 ? 0 : (passedTests / totalTests) * 100
    const flakyRatio = totalTests === 0 ? 0 : (flakyTests / totalTests) * 100
    const medianDurationMs = getMedian(
        tests
            .map((test) => safeNumber(test.durationMs))
            .filter((value) => value > 0),
    )

    const errorClusters = collectErrorClusters(tests)
    const slowestTests = [...tests]
        .sort((left, right) => safeNumber(right.durationMs) - safeNumber(left.durationMs))
        .slice(0, 5)
    const recentRuns = historyRuns.slice(-10)
    const currentRun = recentRuns.length > 0 ? recentRuns[recentRuns.length - 1] : null
    const previousRun = recentRuns.length > 1 ? recentRuns[recentRuns.length - 2] : null
    const resolvedAdvancedMetrics = advancedMetrics ?? buildFallbackAdvancedMetrics(tests, historyRuns, passRate, flakyTests, totalDurationMs)
    const topProblematicTests = collectTopProblematicTests(tests)
    const managerSummary = buildManagerSummary({
        kpis: {
            totalTests,
            passedTests,
            failedTests,
            flakyTests,
            skippedTests,
            timedOutTests,
            interruptedTests,
            passRate,
            flakyRatio,
            totalDurationMs,
            medianDurationMs,
            errorClusterCount: errorClusters.length,
        },
        trend: {
            previousRun,
            passRateDelta: previousRun ? roundToOneDigit(passRate - previousRun.passRate) : null,
            failedTestsDelta: previousRun ? failedTests - previousRun.failedTests : null,
            flakyTestsDelta: previousRun ? flakyTests - previousRun.flakyTests : null,
            durationMsDelta: previousRun ? totalDurationMs - previousRun.totalDurationMs : null,
        },
        historyTotalRuns: historyRuns.length,
        performance: resolvedAdvancedMetrics.performance,
        flakyAnalytics: resolvedAdvancedMetrics.flakyAnalytics,
        businessMetrics: resolvedAdvancedMetrics.businessMetrics,
        topProblematicTests,
        errorClusters,
    })

    return {
        generatedAt: new Date().toISOString(),
        sourceFile,
        schemaVersion: report.schemaVersion ?? null,
        reportTimestamp: report.timestamp ?? null,
        notes: [
            'AQA Pulse вынесен в отдельную директорию в корне репозитория и не влияет на Playwright-конфиг.',
            'Текущая версия покрывает первый этап: парсинг JSON-репорта и базовые метрики по одному прогону.',
            'История прогонов и API-слой остаются следующим этапом из плана.',
        ],
        runMetadata,
        filters,
        availableFilters: availableFilters ?? buildAvailableFilters(historyRuns, tests),
        environment: {
            playwrightVersion: report.environment?.playwrightVersion ?? 'неизвестно',
            nodeVersion: report.environment?.nodeVersion ?? process.version,
            os: report.environment?.os ?? process.platform,
            workers: safeNumber(report.environment?.workers),
            retries: safeNumber(report.environment?.retries),
            projects: report.environment?.projects ?? [],
        },
        kpis: {
            totalTests,
            passedTests,
            failedTests,
            flakyTests,
            skippedTests,
            timedOutTests,
            interruptedTests,
            passRate,
            flakyRatio,
            totalDurationMs,
            medianDurationMs,
            errorClusterCount: errorClusters.length,
        },
        charts: {
            passRateTrend: {
                labels: recentRuns.length > 0
                    ? recentRuns.map((run, index) => formatHistoryRunLabel(run, index))
                    : ['Текущий прогон'],
                values: recentRuns.length > 0
                    ? recentRuns.map((run) => roundToOneDigit(run.passRate))
                    : [roundToOneDigit(passRate)],
            },
            durationTrend: resolvedAdvancedMetrics.charts.durationTrend,
            flakyTrend: resolvedAdvancedMetrics.charts.flakyTrend,
            statusDistribution: {
                labels: ['Passed', 'Failed', 'Flaky', 'Skipped', 'Timed out', 'Interrupted'],
                values: [passedTests, failedTests, flakyTests, skippedTests, timedOutTests, interruptedTests],
            },
            errorClusters: {
                labels: errorClusters.length > 0
                    ? errorClusters.map((cluster) => shorten(cluster.message, 42))
                    : ['Без падений'],
                values: errorClusters.length > 0 ? errorClusters.map((cluster) => cluster.count) : [1],
            },
            slowestTests: {
                labels: slowestTests.length > 0
                    ? slowestTests.map((test) => shorten(test.title ?? 'Тест без названия', 34))
                    : ['Нет данных'],
                values: slowestTests.length > 0
                    ? slowestTests.map((test) => roundToOneDigit(safeNumber(test.durationMs) / 1000))
                    : [0],
            },
        },
        trend: {
            previousRun,
            passRateDelta: previousRun ? roundToOneDigit(passRate - previousRun.passRate) : null,
            failedTestsDelta: previousRun ? failedTests - previousRun.failedTests : null,
            flakyTestsDelta: previousRun ? flakyTests - previousRun.flakyTests : null,
            durationMsDelta: previousRun ? totalDurationMs - previousRun.totalDurationMs : null,
        },
        comparison: {
            currentRun,
            previousRun,
        },
        history: {
            totalRuns: historyRuns.length,
            recentRuns: [...recentRuns].reverse(),
        },
        performance: resolvedAdvancedMetrics.performance,
        flakyAnalytics: resolvedAdvancedMetrics.flakyAnalytics,
        businessMetrics: resolvedAdvancedMetrics.businessMetrics,
        managerSummary,
        currentRunTests: collectCurrentRunTests(tests),
        topProblematicTests,
        errorClusters,
    }
}

export function buildAdvancedMetrics(
    report: ReporterRoot,
    historyRuns: DashboardHistoryEntry[],
    archiveRootPath: string,
): DashboardAdvancedMetrics {
    const archivedRuns = historyRuns
        .map((run) => {
            const runDirectory = findArchivedRunDirectory(archiveRootPath, run.id)

            if (!runDirectory) {
                return null
            }

            const archivedRun = readArchivedRunRecord(archiveRootPath, runDirectory)

            return {
                run,
                report: archivedRun.data,
            }
        })
        .filter((value): value is { run: DashboardHistoryEntry; report: ReporterRoot } => value !== null)

    return buildAdvancedMetricsFromArchivedRuns(report, historyRuns, archivedRuns)
}

export function buildAdvancedMetricsFromArchivedRuns(
    report: ReporterRoot,
    historyRuns: DashboardHistoryEntry[],
    archivedRuns: Array<{ run: DashboardHistoryEntry; report: ReporterRoot }>,
): DashboardAdvancedMetrics {
    const tests = report.tests ?? []
    const durationValues = tests
        .map((test) => safeNumber(test.durationMs))
        .filter((durationMs) => durationMs > 0)
    const performanceMetrics = buildPerformanceMetrics(report, historyRuns)

    const previousRun = historyRuns.length > 1 ? historyRuns[historyRuns.length - 2] : null

    const flakyTrend = {
        currentFlakyTests: historyRuns[historyRuns.length - 1]?.flakyTests ?? tests.filter((test) => Boolean(test.flaky)).length,
        previousFlakyTests: previousRun?.flakyTests ?? null,
        delta: previousRun ? (historyRuns[historyRuns.length - 1]?.flakyTests ?? 0) - previousRun.flakyTests : null,
    }

    const flakyCandidates = collectFlakyCandidates(archivedRuns)
    const topFlakyTests = [...flakyCandidates]
        .sort((left, right) => right.flakyScore - left.flakyScore)
        .slice(0, 10)
    const firstFlakeToFix = collectFirstFlakeToFixMetric(archivedRuns)

    return {
        performance: performanceMetrics,
        flakyAnalytics: {
            averageFlakyScore: topFlakyTests.length > 0 ? roundToOneDigit(average(topFlakyTests.map((test) => test.flakyScore))) : null,
            averageMtbfDays: (() => {
                const mtbfValues = topFlakyTests
                    .map((test) => test.mtbfDays)
                    .filter((value): value is number => value !== null)

                return mtbfValues.length > 0 ? roundToTwoDigits(average(mtbfValues)) : null
            })(),
            topFlakyTests,
            firstFlakeToFix,
            flakyTrend,
        },
        charts: {
            durationTrend: {
                labels: historyRuns.length > 0
                    ? historyRuns.map((run, index) => formatHistoryRunLabel(run, index))
                    : ['Текущий прогон'],
                values: historyRuns.length > 0
                    ? historyRuns.map((run) => roundToOneDigit(run.totalDurationMs / 60000))
                    : [roundToOneDigit((report.durationMs ?? sum(durationValues)) / 60000)],
            },
            flakyTrend: {
                labels: historyRuns.length > 0
                    ? historyRuns.map((run, index) => formatHistoryRunLabel(run, index))
                    : ['Текущий прогон'],
                values: historyRuns.length > 0
                    ? historyRuns.map((run) => run.flakyTests)
                    : [tests.filter((test) => Boolean(test.flaky)).length],
            },
        },
        businessMetrics: buildBusinessMetrics(report, historyRuns, archivedRuns),
    }
}

function collectTopProblematicTests(tests: ReporterTest[]): DashboardProblematicTest[] {
    return tests
        .map((test) => {
            const attempts = test.attempts ?? []
            const failedAttempts = attempts.filter((attempt) => getAttemptStatus(attempt.status) === 'failed').length
            const attemptsCount = attempts.length > 0 ? attempts.length : safeNumber(test.retries) + 1
            const failureRate = attemptsCount === 0 ? 0 : (failedAttempts / attemptsCount) * 100
            const errorDetails = extractErrorMessage(test)

            return {
                title: test.title ?? 'Тест без названия',
                file: test.location?.file ?? 'неизвестно',
                project: test.project ?? 'неизвестно',
                status: getFinalStatus(test),
                flaky: Boolean(test.flaky),
                durationMs: safeNumber(test.durationMs),
                retries: safeNumber(test.retries),
                attempts: attemptsCount,
                failureRate,
                errorMessage: normalizeErrorMessage(errorDetails ?? '—'),
                errorDetails,
                severity: getSeverityScore(test, failureRate),
            }
        })
        .filter((test) => test.flaky || test.status === 'failed' || test.status === 'timedout' || test.status === 'interrupted' || test.errorMessage !== '—')
        .sort((left, right) => right.severity - left.severity)
        .slice(0, 5)
        .map(({ severity: _severity, ...test }) => test)
}

function collectErrorClusters(tests: ReporterTest[]): DashboardErrorCluster[] {
    const clusters = new Map<string, { count: number; tests: Set<string>; sampleMessage: string }>()

    for (const test of tests) {
        const errorMessage = extractErrorMessage(test)

        if (!errorMessage) {
            continue
        }

        const normalizedMessage = normalizeErrorMessage(errorMessage)
        const existingCluster = clusters.get(normalizedMessage)

        if (existingCluster) {
            existingCluster.count += 1
            existingCluster.tests.add(test.title ?? 'Тест без названия')
            continue
        }

        clusters.set(normalizedMessage, {
            count: 1,
            tests: new Set([test.title ?? 'Тест без названия']),
            sampleMessage: errorMessage,
        })
    }

    return [...clusters.entries()]
        .map(([message, cluster]) => ({
            message,
            sampleMessage: cluster.sampleMessage,
            count: cluster.count,
            tests: [...cluster.tests].slice(0, 3),
        }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 5)
}

function getSeverityScore(test: ReporterTest, failureRate: number): number {
    const statusWeights: Record<string, number> = {
        failed: 100,
        timedout: 90,
        interrupted: 75,
        skipped: 20,
        passed: 0,
        unknown: 0,
    }

    const statusWeight = statusWeights[getFinalStatus(test)] ?? 0
    const flakyWeight = test.flaky ? 35 : 0
    const retryWeight = safeNumber(test.retries) * 15
    const durationWeight = Math.min(safeNumber(test.durationMs) / 1000, 30)

    return statusWeight + flakyWeight + retryWeight + durationWeight + failureRate
}

function extractErrorMessage(test: ReporterTest): string | null {
    const directError = firstNonEmpty((test.errors ?? []).map((error) => error.message))

    if (directError) {
        return directError
    }

    return firstNonEmpty(
        (test.attempts ?? [])
            .filter((attempt) => ['failed', 'timedout', 'interrupted'].includes(getAttemptStatus(attempt.status)))
            .map((attempt) => attempt.error?.message),
    )
}

function getFinalStatus(test: ReporterTest): string {
    const status = getAttemptStatus(test.status)

    if (status !== 'unknown') {
        return status
    }

    const attempts = test.attempts ?? []

    if (attempts.length === 0) {
        return 'unknown'
    }

    return getAttemptStatus(attempts[attempts.length - 1]?.status)
}

function getAttemptStatus(status: string | undefined): string {
    const normalizedStatus = (status ?? '').trim().toLowerCase()

    if (normalizedStatus === 'timed out') {
        return 'timedout'
    }

    return normalizedStatus || 'unknown'
}

function normalizeErrorMessage(message: string): string {
    return shorten(
        message
            .replace(ANSI_PATTERN, '')
            .replace(/\s+/g, ' ')
            .trim(),
        180,
    )
}

function firstNonEmpty(values: Array<string | undefined>): string | null {
    for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim()
        }
    }

    return null
}

function getMedian(values: number[]): number {
    if (values.length === 0) {
        return 0
    }

    const sortedValues = [...values].sort((left, right) => left - right)
    const middleIndex = Math.floor(sortedValues.length / 2)

    if (sortedValues.length % 2 === 0) {
        return Math.round((sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2)
    }

    return sortedValues[middleIndex]
}

function shorten(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value
    }

    return `${value.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`
}

function safeNumber(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function roundToOneDigit(value: number): number {
    return Math.round(value * 10) / 10
}

function sum(values: number[]): number {
    return values.reduce((accumulator, value) => accumulator + value, 0)
}

function average(values: number[]): number {
    return values.length === 0 ? 0 : sum(values) / values.length
}

function getPercentile(values: number[], percentile: number): number {
    if (values.length === 0) {
        return 0
    }

    const sortedValues = [...values].sort((left, right) => left - right)
    const rank = Math.ceil((percentile / 100) * sortedValues.length) - 1
    const boundedRank = Math.min(Math.max(rank, 0), sortedValues.length - 1)
    return sortedValues[boundedRank]
}

function roundToTwoDigits(value: number): number {
    return Math.round(value * 100) / 100
}

function buildPerformanceMetrics(
    report: Pick<ReporterRoot, 'tests' | 'durationMs'>,
    historyRuns: DashboardHistoryEntry[],
): DashboardAdvancedMetrics['performance'] {
    const tests = report.tests ?? []
    const durationValues = tests
        .map((test) => safeNumber(test.durationMs))
        .filter((durationMs) => durationMs > 0)
    const totalDurationMs = report.durationMs ?? sum(tests.map((test) => safeNumber(test.durationMs)))
    const previousRun = historyRuns.length > 1 ? historyRuns[historyRuns.length - 2] : null

    return {
        p95DurationMs: getPercentile(durationValues, 95),
        p99DurationMs: getPercentile(durationValues, 99),
        slowestTests: [...tests]
            .sort((left, right) => safeNumber(right.durationMs) - safeNumber(left.durationMs))
            .slice(0, 10)
            .map((test) => {
                const errorDetails = extractErrorMessage(test)

                return {
                    title: test.title ?? 'Тест без названия',
                    file: test.location?.file ?? 'неизвестно',
                    project: test.project ?? 'неизвестно',
                    status: getFinalStatus(test),
                    flaky: Boolean(test.flaky),
                    durationMs: safeNumber(test.durationMs),
                    errorMessage: errorDetails ? normalizeErrorMessage(errorDetails) : null,
                    errorDetails,
                }
            }),
        phaseBreakdown: buildPhaseBreakdown(tests, totalDurationMs),
        suiteDuration: buildSuiteDuration(tests, totalDurationMs),
        durationPerBrowser: buildDurationPerBrowser(tests, totalDurationMs),
        durationTrend: {
            currentDurationMs: totalDurationMs,
            previousDurationMs: previousRun?.totalDurationMs ?? null,
            deltaPercent: previousRun && previousRun.totalDurationMs > 0
                ? roundToOneDigit(((totalDurationMs - previousRun.totalDurationMs) / previousRun.totalDurationMs) * 100)
                : null,
        },
    }
}

function buildPhaseBreakdown(tests: ReporterTest[], totalDurationMs: number): DashboardPhaseBreakdownItem[] {
    let setupMs = 0
    let testsMs = 0
    let teardownMs = 0

    for (const test of tests) {
        const observedDurationMs = getObservedTestDurationMs(test)
        const steps = (test.attempts ?? []).flatMap((attempt) => attempt.steps ?? [])

        if (steps.length === 0) {
            testsMs += observedDurationMs
            continue
        }

        let stepsDurationMs = 0

        for (const step of steps) {
            const stepDurationMs = safeNumber(step.durationMs)

            if (stepDurationMs <= 0) {
                continue
            }

            stepsDurationMs += stepDurationMs

            switch (classifyPerformanceStepPhase(step)) {
                case 'setup':
                    setupMs += stepDurationMs
                    break
                case 'teardown':
                    teardownMs += stepDurationMs
                    break
                default:
                    testsMs += stepDurationMs
                    break
            }
        }

        testsMs += Math.max(observedDurationMs - stepsDurationMs, 0)
    }

    const normalizationBase = totalDurationMs > 0 ? totalDurationMs : (setupMs + testsMs + teardownMs)

    return [
        buildPhaseBreakdownItem('Setup', setupMs, normalizationBase),
        buildPhaseBreakdownItem('Tests', testsMs, normalizationBase),
        buildPhaseBreakdownItem('Teardown', teardownMs, normalizationBase),
    ]
}

function buildPhaseBreakdownItem(label: string, durationMs: number, totalDurationMs: number): DashboardPhaseBreakdownItem {
    return {
        label,
        durationMs: roundToOneDigit(durationMs),
        sharePercent: totalDurationMs <= 0 ? 0 : roundToOneDigit((durationMs / totalDurationMs) * 100),
    }
}

function buildSuiteDuration(tests: ReporterTest[], totalDurationMs: number): DashboardDurationBreakdownItem[] {
    const durationsBySuite = new Map<string, { durationMs: number; tests: number }>()

    for (const test of tests) {
        const label = resolveSuiteLabel(test)
        const currentEntry = durationsBySuite.get(label) ?? { durationMs: 0, tests: 0 }

        currentEntry.durationMs += getObservedTestDurationMs(test)
        currentEntry.tests += 1
        durationsBySuite.set(label, currentEntry)
    }

    return buildDurationBreakdownItems(durationsBySuite, totalDurationMs)
}

function buildDurationPerBrowser(tests: ReporterTest[], totalDurationMs: number): DashboardDurationBreakdownItem[] {
    const durationsByBrowser = new Map<string, { durationMs: number; tests: number }>()

    for (const test of tests) {
        const label = resolveBrowserDimensionLabel(test.browser)
        const currentEntry = durationsByBrowser.get(label) ?? { durationMs: 0, tests: 0 }

        currentEntry.durationMs += getObservedTestDurationMs(test)
        currentEntry.tests += 1
        durationsByBrowser.set(label, currentEntry)
    }

    return buildDurationBreakdownItems(durationsByBrowser, totalDurationMs)
}

function buildDurationBreakdownItems(
    source: Map<string, { durationMs: number; tests: number }>,
    totalDurationMs: number,
): DashboardDurationBreakdownItem[] {
    return [...source.entries()]
        .map(([label, entry]) => ({
            label,
            durationMs: roundToOneDigit(entry.durationMs),
            sharePercent: totalDurationMs <= 0 ? 0 : roundToOneDigit((entry.durationMs / totalDurationMs) * 100),
            tests: entry.tests,
        }))
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 10)
}

function classifyPerformanceStepPhase(step: ReporterStep): 'setup' | 'tests' | 'teardown' {
    const category = (step.category ?? '').trim().toLowerCase()
    const title = (step.title ?? '').trim().toLowerCase()

    if (/(beforeall|beforeeach|hook:before|fixture:setup|(^|\W)setup($|\W)|bootstrap|initialize|initialise)/.test(category)) {
        return 'setup'
    }

    if (/(afterall|aftereach|hook:after|fixture:teardown|(^|\W)teardown($|\W)|cleanup|clean up)/.test(category)) {
        return 'teardown'
    }

    if (/^(open|load|launch|bootstrap|prepare|initialize|initialise|init|login|log in|authorize|authorise|navigate|warm up|connect|seed|restore|create session|open checkout|open filter)/.test(title)) {
        return 'setup'
    }

    if (/^(cleanup|clean up|close|dispose|logout|log out|sign out|reset|remove|delete|drop|stop|clear|release|disconnect)/.test(title)) {
        return 'teardown'
    }

    return 'tests'
}

function getObservedTestDurationMs(test: ReporterTest): number {
    const attempts = test.attempts ?? []

    if (attempts.length > 0) {
        return sum(attempts.map((attempt) => safeNumber(attempt.durationMs)))
    }

    return safeNumber(test.durationMs)
}

function resolveSuiteLabel(test: ReporterTest): string {
    const title = typeof test.title === 'string' ? test.title.trim() : ''

    if (title.includes('>')) {
        const [suiteLabel] = title.split('>')

        if (suiteLabel && suiteLabel.trim().length > 0) {
            return suiteLabel.trim()
        }
    }

    const filePath = typeof test.location?.file === 'string' ? test.location.file.trim() : ''

    if (filePath) {
        const normalizedPath = filePath.replace(/\\/g, '/')
        const fileName = normalizedPath.split('/').pop() ?? normalizedPath
        return fileName.replace(/\.spec\.[^.]+$/i, '').replace(/\.[^.]+$/i, '') || 'Набор без названия'
    }

    return 'Набор без названия'
}

function resolveBrowserDimensionLabel(browser: string | undefined): string {
    if (typeof browser === 'string' && browser.trim().length > 0) {
        return browser.trim()
    }

    return 'Chrome'
}

function collectFlakyCandidates(archivedRuns: Array<{ run: DashboardHistoryEntry; report: ReporterRoot }>): DashboardFlakyTestMetric[] {
    const candidates = new Map<string, {
        title: string
        file: string
        project: string
        observations: Array<{
            timestamp: string | null
            status: string
            flaky: boolean
            retries: number
            attempts: number
            errorMessage: string | null
        }>
        totalAttempts: number
        failedAttempts: number
    }>()

    for (const archivedRun of archivedRuns) {
        for (const test of archivedRun.report.tests ?? []) {
            const title = test.title ?? ''
            const file = test.location?.file ?? 'неизвестно'
            const project = test.project ?? 'неизвестно'

            if (!title) {
                continue
            }

            const key = `${project}::${file}::${title}`
            const attempts = test.attempts ?? []
            const failedAttempts = attempts.filter((attempt) => ['failed', 'timedout', 'interrupted'].includes(getAttemptStatus(attempt.status))).length
            const attemptsCount = attempts.length > 0 ? attempts.length : (safeNumber(test.retries) + 1)
            const candidate = candidates.get(key) ?? {
                title,
                file,
                project,
                observations: [],
                totalAttempts: 0,
                failedAttempts: 0,
            }

            candidate.observations.push({
                timestamp: archivedRun.run.reportTimestamp ?? archivedRun.run.generatedAt,
                status: getFinalStatus(test),
                flaky: Boolean(test.flaky),
                retries: safeNumber(test.retries),
                attempts: attemptsCount,
                errorMessage: extractErrorMessage(test),
            })
            candidate.totalAttempts += attemptsCount
            candidate.failedAttempts += failedAttempts
            candidates.set(key, candidate)
        }
    }

    return [...candidates.values()]
        .map((candidate) => {
            const unstableObservations = candidate.observations.filter((observation) => observation.flaky || ['failed', 'timedout', 'interrupted'].includes(observation.status))
            const latestObservation = [...candidate.observations]
                .sort((left, right) => getObservationTime(right.timestamp) - getObservationTime(left.timestamp))[0]
            const mtbfDays = calculateMtbfDays(unstableObservations.map((observation) => observation.timestamp))
            const failRate = candidate.totalAttempts > 0 ? candidate.failedAttempts / candidate.totalAttempts : 0
            const patternFactor = unstableObservations.length === candidate.observations.length && candidate.observations.length > 0 ? 1.0 : 0.4
            const mtbfFactor = mtbfDays === null ? 0.2 : (mtbfDays < 1 ? 1.0 : (mtbfDays <= 3 ? 0.5 : 0.2))
            const flakyScore = roundToOneDigit((failRate * 0.4 + patternFactor * 0.3 + mtbfFactor * 0.3) * 100)

            return {
                title: candidate.title,
                file: candidate.file,
                project: candidate.project,
                flakyScore,
                failRate: roundToOneDigit(failRate * 100),
                mtbfDays: mtbfDays === null ? null : roundToTwoDigits(mtbfDays),
                unstableRuns: unstableObservations.length,
                totalRuns: candidate.observations.length,
                latestStatus: latestObservation?.status ?? 'unknown',
                latestErrorMessage: latestObservation?.errorMessage ?? null,
            }
        })
        .filter((candidate) => candidate.unstableRuns > 0)
}

function collectFirstFlakeToFixMetric(
    archivedRuns: Array<{ run: DashboardHistoryEntry; report: ReporterRoot }>,
): DashboardFlakyResolutionMetric | null {
    const resolvedCandidates = collectResolvedFlakyFixMetrics(archivedRuns)
        .sort((left, right) => {
            if (left.days !== right.days) {
                return left.days - right.days
            }

            return getObservationTime(left.detectedAt) - getObservationTime(right.detectedAt)
        })

    return resolvedCandidates[0] ?? null
}

function collectResolvedFlakyFixMetrics(
    archivedRuns: Array<{ run: DashboardHistoryEntry; report: ReporterRoot }>,
): DashboardFlakyResolutionMetric[] {
    const candidates = new Map<string, {
        title: string
        file: string
        project: string
        observations: Array<{
            timestamp: string | null
            status: string
            flaky: boolean
        }>
    }>()

    for (const archivedRun of archivedRuns) {
        for (const test of archivedRun.report.tests ?? []) {
            const title = test.title ?? ''
            const file = test.location?.file ?? 'неизвестно'
            const project = test.project ?? 'неизвестно'

            if (!title) {
                continue
            }

            const key = `${project}::${file}::${title}`
            const candidate = candidates.get(key) ?? {
                title,
                file,
                project,
                observations: [],
            }

            candidate.observations.push({
                timestamp: archivedRun.run.reportTimestamp ?? archivedRun.run.generatedAt,
                status: getFinalStatus(test),
                flaky: Boolean(test.flaky),
            })
            candidates.set(key, candidate)
        }
    }

    return [...candidates.values()]
        .map((candidate) => {
            const observations = [...candidate.observations]
                .filter((observation) => Number.isFinite(getObservationTime(observation.timestamp)))
                .sort((left, right) => getObservationTime(left.timestamp) - getObservationTime(right.timestamp))
            const firstUnstableObservation = observations.find((observation) => isUnstableObservation(observation.status, observation.flaky))

            if (!firstUnstableObservation) {
                return null
            }

            const firstUnstableTime = getObservationTime(firstUnstableObservation.timestamp)
            const firstStableAfter = observations.find((observation) => {
                const observationTime = getObservationTime(observation.timestamp)
                return observationTime > firstUnstableTime && observation.status === 'passed' && !observation.flaky
            })

            if (!firstStableAfter) {
                return null
            }

            const fixedAtTime = getObservationTime(firstStableAfter.timestamp)

            return {
                days: roundToTwoDigits((fixedAtTime - firstUnstableTime) / (1000 * 60 * 60 * 24)),
                title: candidate.title,
                file: candidate.file,
                project: candidate.project,
                detectedAt: firstUnstableObservation.timestamp,
                fixedAt: firstStableAfter.timestamp,
            }
        })
        .filter((candidate): candidate is DashboardFlakyResolutionMetric => candidate !== null)
}

function isUnstableObservation(status: string, flaky: boolean): boolean {
    return flaky || status === 'failed' || status === 'timedout' || status === 'interrupted'
}

function calculateMtbfDays(timestamps: Array<string | null>): number | null {
    const sortedTimes = timestamps
        .map((timestamp) => getObservationTime(timestamp))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right)

    if (sortedTimes.length < 2) {
        return null
    }

    const intervalsInDays: number[] = []

    for (let index = 1; index < sortedTimes.length; index += 1) {
        intervalsInDays.push((sortedTimes[index] - sortedTimes[index - 1]) / (1000 * 60 * 60 * 24))
    }

    return average(intervalsInDays)
}

function getObservationTime(timestamp: string | null): number {
    if (!timestamp) {
        return Number.NaN
    }

    return new Date(timestamp).getTime()
}

function buildFallbackAdvancedMetrics(
    tests: ReporterTest[],
    historyRuns: DashboardHistoryEntry[],
    passRate: number,
    flakyTests: number,
    totalDurationMs: number,
): DashboardAdvancedMetrics {
    const previousRun = historyRuns.length > 1 ? historyRuns[historyRuns.length - 2] : null
    const performanceMetrics = buildPerformanceMetrics({ tests, durationMs: totalDurationMs }, historyRuns)

    return {
        performance: performanceMetrics,
        flakyAnalytics: {
            averageFlakyScore: null,
            averageMtbfDays: null,
            topFlakyTests: [],
            firstFlakeToFix: null,
            flakyTrend: {
                currentFlakyTests: flakyTests,
                previousFlakyTests: previousRun?.flakyTests ?? null,
                delta: previousRun ? flakyTests - previousRun.flakyTests : null,
            },
        },
        charts: {
            durationTrend: {
                labels: historyRuns.length > 0
                    ? historyRuns.map((run, index) => formatHistoryRunLabel(run, index))
                    : ['Текущий прогон'],
                values: historyRuns.length > 0
                    ? historyRuns.map((run) => roundToOneDigit(run.totalDurationMs / 60000))
                    : [roundToOneDigit(totalDurationMs / 60000)],
            },
            flakyTrend: {
                labels: historyRuns.length > 0
                    ? historyRuns.map((run, index) => formatHistoryRunLabel(run, index))
                    : ['Текущий прогон'],
                values: historyRuns.length > 0
                    ? historyRuns.map((run) => run.flakyTests)
                    : [flakyTests],
            },
        },
        businessMetrics: buildBusinessMetrics(
            {
                tests,
                durationMs: totalDurationMs,
            },
            historyRuns,
            [],
        ),
    }
}

function buildBusinessMetrics(
    report: ReporterRoot,
    historyRuns: DashboardHistoryEntry[],
    archivedRuns: Array<{ run: DashboardHistoryEntry; report: ReporterRoot }>,
): DashboardAdvancedMetrics['businessMetrics'] {
    const reports = archivedRuns.length > 0
        ? archivedRuns.map((item) => item.report)
        : [report]
    const observedTests = reports.flatMap((currentReport) => currentReport.tests ?? [])
    const extraRetries = observedTests.reduce((total, test) => {
        const attemptsCount = getAttemptsCount(test)
        return total + Math.max(attemptsCount - 1, 0)
    }, 0)
    const extraRetryMinutes = roundToTwoDigits(sum(observedTests.map(getExtraRetryDurationMs)) / 60000)
    const unstableRuns = observedTests.filter(isUnstableTestObservation).length
    const activeDays = getActiveDays(historyRuns, report)
    const resolvedFixMetrics = collectResolvedFlakyFixMetrics(archivedRuns)
    const ciMinuteCostRub = readOptionalNumberFromEnv('AQA_PULSE_CI_MINUTE_COST')
    const developerHourlyCostRub = readOptionalNumberFromEnv('AQA_PULSE_DEV_HOURLY_COST')
    const analysisMinutesPerUnstable = readOptionalNumberFromEnv('AQA_PULSE_ANALYSIS_MINUTES_PER_UNSTABLE')
    const ciCostRub = ciMinuteCostRub === null ? null : roundToTwoDigits(extraRetryMinutes * ciMinuteCostRub)
    const developerCostRub = developerHourlyCostRub === null || analysisMinutesPerUnstable === null
        ? null
        : roundToTwoDigits(unstableRuns * (analysisMinutesPerUnstable / 60) * developerHourlyCostRub)
    const totalRub = ciCostRub === null && developerCostRub === null
        ? null
        : roundToTwoDigits((ciCostRub ?? 0) + (developerCostRub ?? 0))
    const costPerActiveDayRub = totalRub === null || activeDays === 0
        ? null
        : roundToTwoDigits(totalRub / activeDays)
    const developerFriction = {
        rerunProxyPerActiveDay: activeDays === 0 ? roundToTwoDigits(extraRetries + unstableRuns) : roundToTwoDigits((extraRetries + unstableRuns) / activeDays),
        extraRetries,
        unstableRuns,
        activeDays,
    }
    const currentTests = report.tests ?? []
    const currentTotalTests = currentTests.length
    const currentPassRate = currentTotalTests === 0 ? 0 : (currentTests.filter((test) => getFinalStatus(test) === 'passed').length / currentTotalTests) * 100
    const currentFlakyRatio = currentTotalTests === 0 ? 0 : (currentTests.filter((test) => Boolean(test.flaky)).length / currentTotalTests) * 100
    const releaseConfidenceScore = calculateReleaseConfidenceScore(
        currentPassRate,
        currentFlakyRatio,
        collectErrorClusters(currentTests).length,
        currentTotalTests,
        historyRuns,
    )

    return {
        timeToDetect: {
            minutes: null,
            source: 'pendingIntegration',
        },
        timeToFixFlaky: {
            averageDays: resolvedFixMetrics.length > 0
                ? roundToTwoDigits(average(resolvedFixMetrics.map((metric) => metric.days)))
                : null,
            resolvedIncidents: resolvedFixMetrics.length,
        },
        costOfFlakiness: {
            totalRub,
            ciCostRub,
            developerCostRub,
            extraRetryMinutes,
            extraRetries,
            unstableRuns,
            activeDays,
            costPerActiveDayRub,
            assumptions: {
                ciMinuteCostRub,
                developerHourlyCostRub,
                analysisMinutesPerUnstable,
            },
        },
        developerFriction,
        releaseConfidenceScore,
        automationRoi: {
            percent: null,
            source: 'pendingAssumptions',
        },
    }
}

function buildEmptyBusinessMetrics(): DashboardAdvancedMetrics['businessMetrics'] {
    return {
        timeToDetect: {
            minutes: null,
            source: 'pendingIntegration',
        },
        timeToFixFlaky: {
            averageDays: null,
            resolvedIncidents: 0,
        },
        costOfFlakiness: {
            totalRub: null,
            ciCostRub: null,
            developerCostRub: null,
            extraRetryMinutes: 0,
            extraRetries: 0,
            unstableRuns: 0,
            activeDays: 0,
            costPerActiveDayRub: null,
            assumptions: {
                ciMinuteCostRub: null,
                developerHourlyCostRub: null,
                analysisMinutesPerUnstable: null,
            },
        },
        developerFriction: {
            rerunProxyPerActiveDay: 0,
            extraRetries: 0,
            unstableRuns: 0,
            activeDays: 0,
        },
        releaseConfidenceScore: 0,
        automationRoi: {
            percent: null,
            source: 'pendingAssumptions',
        },
    }
}

export function collectCurrentRunTests(tests: ReporterTest[]): DashboardCurrentRunTests {
    const normalizedTests = tests
        .map((test) => {
            const errorDetails = extractErrorMessage(test)

            return {
                title: test.title ?? 'Тест без названия',
                file: test.location?.file ?? 'неизвестно',
                project: test.project ?? 'неизвестно',
                status: getFinalStatus(test),
                flaky: Boolean(test.flaky),
                durationMs: safeNumber(test.durationMs),
                errorMessage: errorDetails ? normalizeErrorMessage(errorDetails) : null,
                errorDetails,
            }
        })
        .sort((left, right) => left.title.localeCompare(right.title, 'ru'))

    return {
        all: normalizedTests,
        passed: normalizedTests.filter((test) => test.status === 'passed'),
        failed: normalizedTests.filter((test) => test.status === 'failed'),
        flaky: normalizedTests.filter((test) => test.flaky),
        skipped: normalizedTests.filter((test) => test.status === 'skipped'),
        timedOut: normalizedTests.filter((test) => test.status === 'timedout'),
        interrupted: normalizedTests.filter((test) => test.status === 'interrupted'),
    }
}

function recoverCurrentRunTestsFromSource(sourceFile: string): DashboardCurrentRunTests {
    try {
        if (!sourceFile || !fs.existsSync(sourceFile)) {
            return buildEmptyCurrentRunTests()
        }

        const report = loadReporterReport(sourceFile)
        return collectCurrentRunTests(report.tests ?? [])
    } catch {
        return buildEmptyCurrentRunTests()
    }
}

function buildEmptyCurrentRunTests(): DashboardCurrentRunTests {
    return {
        all: [],
        passed: [],
        failed: [],
        flaky: [],
        skipped: [],
        timedOut: [],
        interrupted: [],
    }
}

function buildManagerSummary(input: {
    kpis: DashboardKpis
    trend: DashboardSummary['trend']
    historyTotalRuns: number
    performance: DashboardAdvancedMetrics['performance']
    flakyAnalytics: DashboardAdvancedMetrics['flakyAnalytics']
    businessMetrics: DashboardAdvancedMetrics['businessMetrics']
    topProblematicTests: DashboardProblematicTest[]
    errorClusters: DashboardErrorCluster[]
}): DashboardManagerSummary {
    const releaseReadinessScore = clampScore(
        input.businessMetrics.releaseConfidenceScore
        - (input.kpis.failedTests > 0 ? Math.min(25, input.kpis.failedTests * 2.5) : 0)
        - (input.trend.passRateDelta !== null && input.trend.passRateDelta < 0 ? Math.min(15, Math.abs(input.trend.passRateDelta) * 2) : 0),
    )
    const qualityRiskScore = clampScore(
        ((100 - input.kpis.passRate) * 0.45)
        + (input.kpis.flakyRatio * 0.25)
        + (Math.min(100, input.kpis.errorClusterCount * 12) * 0.15)
        + ((input.flakyAnalytics.averageFlakyScore ?? (input.kpis.flakyTests > 0 ? 60 : 0)) * 0.15),
    )
    const slowestTest = input.performance.slowestTests[0] ?? null
    const slowestDurationSeconds = slowestTest ? safeNumber(slowestTest.durationMs) / 1000 : 0
    const durationDeltaPercent = Math.max(input.performance.durationTrend.deltaPercent ?? 0, 0)
    const deliveryRiskScore = clampScore(
        (Math.min(100, durationDeltaPercent) * 0.35)
        + (Math.min(100, input.businessMetrics.developerFriction.rerunProxyPerActiveDay * 18) * 0.25)
        + (Math.min(100, slowestDurationSeconds * 1.5) * 0.25)
        + (Math.min(100, Math.max(input.trend.flakyTestsDelta ?? 0, 0) * 20) * 0.15),
    )

    const blockers: DashboardManagerBlocker[] = []
    const primaryProblematicTest = input.topProblematicTests[0] ?? null
    const primaryFlakyTest = input.flakyAnalytics.topFlakyTests[0] ?? null
    const dominantCluster = input.errorClusters[0] ?? null

    if (input.historyTotalRuns < 3) {
        blockers.push({
            kind: 'history-coverage',
            severity: input.historyTotalRuns === 0 ? 'warning' : 'info',
            title: 'Истории пока мало для уверенного тренда',
            value: `${input.historyTotalRuns} прогонов`,
            details: 'Для управленческого сигнала лучше иметь хотя бы 3-5 архивных запусков.',
            testTitle: null,
            project: null,
            file: null,
        })
    }

    if (releaseReadinessScore < 75 || input.kpis.failedTests > 0 || (input.trend.passRateDelta ?? 0) < 0) {
        blockers.push({
            kind: 'release-confidence',
            severity: releaseReadinessScore < 55 ? 'critical' : 'warning',
            title: 'Релизный сигнал просел',
            value: `${roundToOneDigit(releaseReadinessScore)} / 100`,
            details: `Pass Rate ${formatPercent(input.kpis.passRate)}, flaky ${formatPercent(input.kpis.flakyRatio)}, failed ${input.kpis.failedTests}.`,
            testTitle: null,
            project: null,
            file: null,
        })
    }

    if (primaryProblematicTest) {
        blockers.push({
            kind: 'problematic-test',
            severity: primaryProblematicTest.status === 'failed' || primaryProblematicTest.status === 'timedout' || primaryProblematicTest.status === 'interrupted' || primaryProblematicTest.failureRate >= 50
                ? 'critical'
                : 'warning',
            title: `Проблемный тест: ${shorten(primaryProblematicTest.title, 48)}`,
            value: `${roundToOneDigit(primaryProblematicTest.failureRate)}% падений`,
            details: `${primaryProblematicTest.project} • ${shorten(primaryProblematicTest.errorMessage, 96)}`,
            testTitle: primaryProblematicTest.title,
            project: primaryProblematicTest.project,
            file: primaryProblematicTest.file,
        })
    }

    if (primaryFlakyTest && (primaryFlakyTest.flakyScore >= 45 || input.kpis.flakyTests > 0)) {
        blockers.push({
            kind: 'flaky',
            severity: primaryFlakyTest.flakyScore >= 70 ? 'critical' : 'warning',
            title: `Нестабильность держится в истории: ${shorten(primaryFlakyTest.title, 44)}`,
            value: `${roundToOneDigit(primaryFlakyTest.flakyScore)} / 100`,
            details: `MTBF ${primaryFlakyTest.mtbfDays === null ? '—' : `${primaryFlakyTest.mtbfDays.toFixed(2)} дн`} • нестабильных прогонов ${primaryFlakyTest.unstableRuns}.`,
            testTitle: primaryFlakyTest.title,
            project: primaryFlakyTest.project,
            file: primaryFlakyTest.file,
        })
    }

    if (slowestTest && (durationDeltaPercent >= 10 || slowestDurationSeconds >= 45)) {
        blockers.push({
            kind: 'duration',
            severity: durationDeltaPercent >= 25 || slowestDurationSeconds >= 90 ? 'critical' : 'warning',
            title: 'Пайплайн теряет скорость',
            value: durationDeltaPercent > 0
                ? `${roundToOneDigit(durationDeltaPercent)}% к прошлому прогону`
                : formatDuration(slowestTest.durationMs),
            details: `Самый медленный тест: ${shorten(slowestTest.title, 44)} • ${formatDuration(slowestTest.durationMs)}.`,
            testTitle: slowestTest.title,
            project: slowestTest.project,
            file: slowestTest.file,
        })
    }

    if (dominantCluster && dominantCluster.count >= 2) {
        blockers.push({
            kind: 'error-cluster',
            severity: dominantCluster.count >= 4 ? 'critical' : 'warning',
            title: 'Ошибки повторяются сериями',
            value: `${dominantCluster.count} инцидентов`,
            details: shorten(dominantCluster.message, 110),
            testTitle: dominantCluster.tests[0] ?? null,
            project: null,
            file: null,
        })
    }

    return {
        releaseReadiness: {
            score: roundToOneDigit(releaseReadinessScore),
            level: getManagerPositiveSignalLevel(releaseReadinessScore),
        },
        qualityRisk: {
            score: roundToOneDigit(qualityRiskScore),
            level: getManagerRiskSignalLevel(qualityRiskScore),
        },
        deliveryRisk: {
            score: roundToOneDigit(deliveryRiskScore),
            level: getManagerRiskSignalLevel(deliveryRiskScore),
        },
        blockers: blockers
            .sort((left, right) => getManagerBlockerPriority(right) - getManagerBlockerPriority(left))
            .slice(0, 3),
        changes: buildManagerChanges(input),
    }
}

function buildManagerChanges(input: {
    kpis: DashboardKpis
    trend: DashboardSummary['trend']
    performance: DashboardAdvancedMetrics['performance']
}): DashboardManagerChange[] {
    if (
        input.trend.passRateDelta === null
        && input.trend.failedTestsDelta === null
        && input.trend.flakyTestsDelta === null
        && input.trend.durationMsDelta === null
    ) {
        return []
    }

    return [
        {
            label: 'Pass Rate',
            value: formatManagerDelta(input.trend.passRateDelta, 'pp'),
            details: `Сейчас ${formatPercent(input.kpis.passRate)}.`,
            direction: getManagerDirection(input.trend.passRateDelta, false),
        },
        {
            label: 'Падения',
            value: formatManagerDelta(input.trend.failedTestsDelta, 'count'),
            details: `Сейчас ${input.kpis.failedTests} тестов с финальным неуспешным статусом.`,
            direction: getManagerDirection(input.trend.failedTestsDelta, true),
        },
        {
            label: 'Flaky',
            value: formatManagerDelta(input.trend.flakyTestsDelta, 'count'),
            details: `Сейчас ${input.kpis.flakyTests} нестабильных тестов в текущем прогоне.`,
            direction: getManagerDirection(input.trend.flakyTestsDelta, true),
        },
        {
            label: 'Длительность',
            value: formatManagerDelta(input.performance.durationTrend.deltaPercent, 'percent'),
            details: `Сейчас ${formatDuration(input.kpis.totalDurationMs)}.`,
            direction: getManagerDirection(input.performance.durationTrend.deltaPercent, true),
        },
    ]
}

function getManagerPositiveSignalLevel(score: number): DashboardManagerSignal['level'] {
    if (score >= 75) {
        return 'healthy'
    }

    if (score >= 55) {
        return 'warning'
    }

    return 'critical'
}

function getManagerRiskSignalLevel(score: number): DashboardManagerSignal['level'] {
    if (score < 30) {
        return 'healthy'
    }

    if (score < 60) {
        return 'warning'
    }

    return 'critical'
}

function getManagerBlockerPriority(blocker: DashboardManagerBlocker): number {
    const severityScore = blocker.severity === 'critical' ? 300 : blocker.severity === 'warning' ? 200 : 100
    const kindScore = blocker.kind === 'release-confidence'
        ? 50
        : blocker.kind === 'problematic-test'
            ? 40
            : blocker.kind === 'flaky'
                ? 30
                : blocker.kind === 'duration'
                    ? 20
                    : blocker.kind === 'error-cluster'
                        ? 10
                        : 0

    return severityScore + kindScore
}

function getManagerDirection(delta: number | null, inverted: boolean): DashboardManagerChange['direction'] {
    if (delta === null || delta === 0) {
        return 'stable'
    }

    if (inverted) {
        return delta < 0 ? 'improving' : 'regressing'
    }

    return delta > 0 ? 'improving' : 'regressing'
}

function formatManagerDelta(delta: number | null, kind: 'pp' | 'count' | 'percent'): string {
    if (delta === null || delta === 0) {
        return 'Без изменений'
    }

    const sign = delta > 0 ? '+' : '-'
    const absoluteDelta = Math.abs(delta)

    if (kind === 'count') {
        return `${sign}${absoluteDelta}`
    }

    if (kind === 'percent') {
        return `${sign}${roundToOneDigit(absoluteDelta)}%`
    }

    return `${sign}${roundToOneDigit(absoluteDelta)} п.п.`
}

function getAttemptsCount(test: ReporterTest): number {
    const attempts = test.attempts ?? []
    return attempts.length > 0 ? attempts.length : safeNumber(test.retries) + 1
}

function getExtraRetryDurationMs(test: ReporterTest): number {
    const attempts = test.attempts ?? []

    if (attempts.length > 1) {
        return sum(attempts.slice(1).map((attempt) => safeNumber(attempt.durationMs)))
    }

    const attemptsCount = getAttemptsCount(test)

    if (attemptsCount <= 1) {
        return 0
    }

    return (safeNumber(test.durationMs) / attemptsCount) * (attemptsCount - 1)
}

function isUnstableTestObservation(test: ReporterTest): boolean {
    const status = getFinalStatus(test)

    return Boolean(test.flaky)
        || status === 'failed'
        || status === 'timedout'
        || status === 'interrupted'
}

function getActiveDays(historyRuns: DashboardHistoryEntry[], report: ReporterRoot): number {
    const days = new Set(
        historyRuns
            .map((run) => run.reportTimestamp ?? run.generatedAt)
            .map(normalizeDateToDay)
            .filter((day): day is string => day !== null),
    )

    if (days.size > 0) {
        return days.size
    }

    return normalizeDateToDay(report.timestamp ?? new Date().toISOString()) ? 1 : 0
}

function normalizeDateToDay(timestamp: string | null): string | null {
    if (!timestamp) {
        return null
    }

    const date = new Date(timestamp)

    if (Number.isNaN(date.getTime())) {
        return null
    }

    return date.toISOString().slice(0, 10)
}

function readOptionalNumberFromEnv(name: string): number | null {
    const rawValue = process.env[name]

    if (!rawValue || rawValue.trim().length === 0) {
        return null
    }

    const parsedValue = Number(rawValue)
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null
}

function calculateReleaseConfidenceScore(
    passRate: number,
    flakyRatio: number,
    errorClusterCount: number,
    totalTests: number,
    historyRuns: DashboardHistoryEntry[],
): number {
    const errorHealth = totalTests === 0 ? 100 : Math.max(0, 100 - ((errorClusterCount / totalTests) * 100))
    const recentRuns = historyRuns.slice(-5)
    const historyConsistency = recentRuns.length > 0
        ? average(recentRuns.map((run) => clampScore(run.passRate - run.flakyRatio)))
        : clampScore(passRate - flakyRatio)

    return roundToOneDigit(clampScore(
        (passRate * 0.4)
        + ((100 - flakyRatio) * 0.3)
        + (errorHealth * 0.15)
        + (historyConsistency * 0.15),
    ))
}

function clampScore(value: number): number {
    return Math.min(Math.max(value, 0), 100)
}

function formatHistoryRunLabel(run: DashboardHistoryEntry, index: number): string {
    const timestamp = run.reportTimestamp ?? run.generatedAt
    const date = new Date(timestamp)

    if (Number.isNaN(date.getTime())) {
        return `Run ${index + 1}`
    }

    return new Intl.DateTimeFormat('ru-RU', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function buildAvailableFilters(historyRuns: DashboardHistoryEntry[], tests: ReporterTest[]): DashboardAvailableFilters {
    const branches = [...new Set(historyRuns.map((run) => run.branch).filter((branch): branch is string => Boolean(branch)))].sort()
    const projects = [...new Set(tests.map((test) => test.project).filter((project): project is string => Boolean(project)))].sort()
    const files = [...new Set(tests.map((test) => test.location?.file).filter((file): file is string => Boolean(file)))].sort()
    const projectsByBranch: Record<string, string[]> = {}
    const filesByBranch: Record<string, string[]> = {}
    const filesByProject: Record<string, string[]> = {}
    const filesByBranchProject: Record<string, Record<string, string[]>> = {}

    for (const branch of branches) {
        projectsByBranch[branch] = projects
        filesByBranch[branch] = files
        filesByBranchProject[branch] = {}
    }

    for (const test of tests) {
        const project = test.project
        const file = test.location?.file

        if (project && file) {
            filesByProject[project] = [...new Set([...(filesByProject[project] ?? []), file])].sort()
        }
    }

    for (const branch of branches) {
        for (const project of projects) {
            filesByBranchProject[branch][project] = filesByProject[project] ?? []
        }
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

function readJsonFile<T>(filePath: string, fileDescription: string): T {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Не найден ${fileDescription}: \"${filePath}\".`)
    }

    try {
        const fileText = fs.readFileSync(filePath, 'utf8')
        return JSON.parse(fileText) as T
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Не удалось прочитать ${fileDescription} из \"${filePath}\": ${errorMessage}`)
    }
}



