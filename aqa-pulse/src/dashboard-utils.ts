import * as fs from 'node:fs'
import * as path from 'node:path'
import type * as TypeScript from 'typescript'
import {
    applyBusinessAssumptionsToSummary,
    normalizeDashboardBusinessAssumptions,
    recalculateCostOfFlakinessMetrics,
    type DashboardBusinessAssumptions,
} from './shared/business-assumptions'
import { formatDate, formatDuration, formatPercent } from './shared/formatting'
import {
    findArchivedRunDirectory,
    readArchivedRunRecord,
    type DashboardHistoryEntry,
} from './history-utils'

export { formatDate, formatDuration, formatPercent } from './shared/formatting'
export {
    applyBusinessAssumptionsToSummary,
    normalizeDashboardBusinessAssumptions,
    type DashboardBusinessAssumptions,
} from './shared/business-assumptions'

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

export interface ReporterErrorObject {
    message?: string
    stack?: string
}

export type ReporterError = ReporterErrorObject | string

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
    offsetMs?: number
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
    aqaPulseSourceFacts?: PrecomputedCodeQualitySourceFacts
}

export interface PrecomputedCodeQualityTestFacts {
    startLine: number
    endLine: number
    title: string | null
    assertionCount: number
    smartWaitCount: number
    hardWaitCount: number
    stepCount: number
    directLocatorCount: number
    directPageActionCount: number
    stableSelectorCount: number
    textSelectorCount: number
    fragileSelectorCount: number
    pomReferenceCount: number
    pomFixtureReferenceCount: number
    sharedStateMutationCount: number
    usesPom: boolean
}

export interface PrecomputedCodeQualityFileFacts {
    file: string
    tests: PrecomputedCodeQualityTestFacts[]
    hasPomImports: boolean
    beforeAllCount: number
    beforeEachCount: number
    serialModeCount: number
    topLevelMutableStateCount: number
}

export interface PrecomputedCodeQualitySourceFacts {
    schemaVersion: number
    analyzerVersion?: string
    files: PrecomputedCodeQualityFileFacts[]
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
    medianDays: number | null
    averageDays: number | null
    resolvedIncidents: number
}

export interface DashboardBusinessAutomationRoiMetric {
    percent: number | null
    source: 'pendingAssumptions'
}

export interface DashboardCodeQualityRiskDriver {
    label: string
    count: number
    impact: 'low' | 'medium' | 'high'
    hint: string
}

export interface DashboardCodeQualityFileMetric {
    file: string
    matchedTests: number
    declaredTests: number
    smellScore: number | null
    pomCompliancePercent: number | null
    assertionDensity: number | null
    waitStrategyScore: number | null
    stepGranularity: number | null
    isolationScore: number | null
    selectorStabilityPercent: number | null
    notableSignals: string[]
    sourceResolved: boolean
}

export interface DashboardCodeQualityMetrics {
    analyzedFiles: number
    matchedTests: number
    analyzableTests: number
    sourceCoveragePercent: number
    testSmellScore: number | null
    pomCompliancePercent: number | null
    assertionDensity: number | null
    waitStrategyScore: number | null
    stepGranularity: number | null
    isolationScore: number | null
    selectorStabilityPercent: number | null
    drivers: DashboardCodeQualityRiskDriver[]
    topRiskFiles: DashboardCodeQualityFileMetric[]
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
            assumptions: DashboardBusinessAssumptions
        }
        developerFriction: {
            rerunProxyPerActiveDay: number
            rerunBurdenPer100Runs: number
            extraRetries: number
            unstableRuns: number
            activeDays: number
            observedRuns: number
        }
        releaseConfidenceScore: number
        automationRoi: DashboardBusinessAutomationRoiMetric
    }
    codeQuality: DashboardCodeQualityMetrics
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

export type DashboardComparisonMode = 'adjacent' | 'comparable'

export interface DashboardRunComparisonIdentity {
    key: string
    label: string | null
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
        previousOverallRun: DashboardHistoryEntry | null
        mode: DashboardComparisonMode
        scopeLabel: string | null
    }
    history: {
        totalRuns: number
        recentRuns: DashboardHistoryEntry[]
    }
    performance: DashboardAdvancedMetrics['performance']
    flakyAnalytics: DashboardAdvancedMetrics['flakyAnalytics']
    businessMetrics: DashboardAdvancedMetrics['businessMetrics']
    codeQuality: DashboardAdvancedMetrics['codeQuality']
    managerSummary: DashboardManagerSummary
    currentRunTests: DashboardCurrentRunTests
    topProblematicTests: DashboardProblematicTest[]
    errorClusters: DashboardErrorCluster[]
}

const ANSI_PATTERN = /\u001B\[[0-9;]*m/g

export function deriveDashboardRunComparisonIdentity(report: ReporterRoot, sourceFile: string): DashboardRunComparisonIdentity {
    const projects = collectComparisonProjects(report)

    if (projects.length === 1) {
        return {
            key: `project:${projects[0]}`,
            label: projects[0],
        }
    }

    if (projects.length > 1) {
        return {
            key: `projects:${projects.join('|')}`,
            label: projects.join(' + '),
        }
    }

    const normalizedSource = normalizeSourceFileForComparison(sourceFile)
    return {
        key: `source:${normalizedSource}`,
        label: path.basename(sourceFile),
    }
}

interface ResolvedComparisonBaseline {
    currentRun: DashboardHistoryEntry | null
    previousRun: DashboardHistoryEntry | null
    previousOverallRun: DashboardHistoryEntry | null
    mode: DashboardComparisonMode
    scopeLabel: string | null
}

function resolveComparisonBaseline(historyRuns: DashboardHistoryEntry[]): ResolvedComparisonBaseline {
    const currentRun = historyRuns[historyRuns.length - 1] ?? null
    const previousOverallRun = historyRuns.length > 1 ? historyRuns[historyRuns.length - 2] : null

    if (!currentRun) {
        return {
            currentRun: null,
            previousRun: null,
            previousOverallRun: null,
            mode: 'adjacent',
            scopeLabel: null,
        }
    }

    const currentComparisonKey = getHistoryRunComparisonKey(currentRun)
    let previousComparableRun: DashboardHistoryEntry | null = null

    if (currentComparisonKey) {
        for (let index = historyRuns.length - 2; index >= 0; index -= 1) {
            const candidate = historyRuns[index]

            if (getHistoryRunComparisonKey(candidate) === currentComparisonKey) {
                previousComparableRun = candidate
                break
            }
        }
    }

    return {
        currentRun,
        previousRun: previousComparableRun ?? previousOverallRun,
        previousOverallRun,
        mode: previousComparableRun && previousOverallRun && previousComparableRun.id !== previousOverallRun.id ? 'comparable' : 'adjacent',
        scopeLabel: currentRun.comparisonLabel ?? previousComparableRun?.comparisonLabel ?? null,
    }
}

function getHistoryRunComparisonKey(run: DashboardHistoryEntry): string | null {
    if (run.comparisonKey) {
        return run.comparisonKey
    }

    const normalizedSource = normalizeSourceFileForComparison(run.sourceFile)
    return normalizedSource.length > 0 ? `source:${normalizedSource}` : null
}

function collectComparisonProjects(report: ReporterRoot): string[] {
    const environmentProjects = (report.environment?.projects ?? [])
        .map(normalizeComparisonToken)
        .filter((project): project is string => project.length > 0)

    if (environmentProjects.length > 0) {
        return [...new Set(environmentProjects)].sort()
    }

    return [...new Set(
        (report.tests ?? [])
            .map((test) => normalizeComparisonToken(test.project))
            .filter((project): project is string => project.length > 0),
    )].sort()
}

function normalizeComparisonToken(value: string | undefined): string {
    return (value ?? '').trim().toLowerCase()
}

function normalizeSourceFileForComparison(sourceFile: string): string {
    const fileName = path.basename(sourceFile, path.extname(sourceFile)).toLowerCase()

    return fileName
        .replace(/\b(previous|prev|latest|current|last)\b/g, ' ')
        .replace(/\b\d{4}[-_]\d{2}[-_]\d{2}(?:[t_ -]?\d{2}[-_:]?\d{2}(?:[-_:]?\d{2})?)?\b/g, ' ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

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

    const explicitCandidates = steps
        .map((step, index) => ({ step, index }))
        .filter(({ step }) => step.failed === true || hasReporterErrorMessage(step.error) || isReporterUnstableStatus(normalizeReporterStatus(step.status)))

    if (explicitCandidates.length > 0) {
        const teardownStartIndex = findReporterTeardownStartIndex(steps)

        return [...explicitCandidates].sort((left, right) => {
            const scoreDelta = getReporterFailurePointPriority(right.step, right.index, steps, teardownStartIndex)
                - getReporterFailurePointPriority(left.step, left.index, steps, teardownStartIndex)

            if (scoreDelta !== 0) {
                return scoreDelta
            }

            return right.index - left.index
        })[0]?.index ?? null
    }

    if (isReporterUnstableStatus(normalizeReporterStatus(attempt.status)) && steps.length > 0) {
        return steps.length - 1
    }

    return null
}

function getReporterFailurePointPriority(
    step: ReporterStep,
    stepIndex: number,
    allSteps: ReporterStep[],
    teardownStartIndex: number,
): number {
    const category = typeof step.category === 'string' && step.category.trim().length > 0 ? step.category.trim() : null
    const status = normalizeReporterStatus(step.status)
    const errorMessage = getReporterErrorMessage(step.error)
    const depth = typeof step.depth === 'number' && Number.isFinite(step.depth)
        ? Math.max(0, Math.trunc(step.depth))
        : 0

    let score = stepIndex

    if (errorMessage) {
        score += 120
    }

    if (step.failed === true) {
        score += 140
    }

    if (isReporterUnstableStatus(status)) {
        score += 50
    }

    score += depth * 14

    switch (category) {
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

    if (category === 'test.step' || category === 'hook') {
        score -= 60
    }

    if (isReporterGenericLifecycleStep(step)) {
        score -= 48
    }

    if (isReporterGenericTeardownStep(step)) {
        score -= 200
    }

    if (isReporterCascadingTeardownInfrastructureStep(step)) {
        score -= 180
    }

    if (isReporterActionableAutomationErrorStep(step)) {
        score += 36
    }

    if (teardownStartIndex >= 0 && stepIndex >= teardownStartIndex) {
        score -= 240
    }

    if (hasMeaningfulReporterProgressAfterStep(allSteps, stepIndex, teardownStartIndex)) {
        score -= 260
    }

    return score
}

function hasMeaningfulReporterProgressAfterStep(
    steps: ReporterStep[],
    stepIndex: number,
    teardownStartIndex: number,
): boolean {
    const step = steps[stepIndex]
    const endIndex = isReporterScopeWrapper(step)
        ? findReporterSubtreeEndIndex(steps, stepIndex)
        : (teardownStartIndex >= 0 && stepIndex < teardownStartIndex ? teardownStartIndex : steps.length)
    const currentDepth = typeof step.depth === 'number' && Number.isFinite(step.depth)
        ? Math.max(0, Math.trunc(step.depth))
        : 0

    for (let index = stepIndex + 1; index < endIndex; index += 1) {
        const laterStep = steps[index]
        const laterDepth = typeof laterStep.depth === 'number' && Number.isFinite(laterStep.depth)
            ? Math.max(0, Math.trunc(laterStep.depth))
            : 0

        if (isReporterGenericLifecycleStep(laterStep) && !hasReporterErrorMessage(laterStep.error)) {
            continue
        }

        if (
            hasReporterErrorMessage(laterStep.error)
            || laterStep.category === 'expect'
            || laterStep.category === 'pw:api'
            || laterStep.category === 'test.step'
            || laterDepth > currentDepth
        ) {
            return true
        }
    }

    return false
}

function isReporterScopeWrapper(step: ReporterStep): boolean {
    return step.category === 'test.step' || step.category === 'hook'
}

function findReporterSubtreeEndIndex(steps: ReporterStep[], stepIndex: number): number {
    const step = steps[stepIndex]
    const depth = typeof step.depth === 'number' && Number.isFinite(step.depth)
        ? Math.max(0, Math.trunc(step.depth))
        : 0

    for (let index = stepIndex + 1; index < steps.length; index += 1) {
        const laterStep = steps[index]
        const laterDepth = typeof laterStep?.depth === 'number' && Number.isFinite(laterStep.depth)
            ? Math.max(0, Math.trunc(laterStep.depth))
            : 0

        if (laterDepth <= depth) {
            return index
        }
    }

    return steps.length
}

function findReporterTeardownStartIndex(steps: ReporterStep[]): number {
    return steps.findIndex((step) => {
        const depth = typeof step.depth === 'number' && Number.isFinite(step.depth)
            ? Math.max(0, Math.trunc(step.depth))
            : 0

        return depth === 0 && isReporterGenericTeardownStep(step)
    })
}

function isReporterGenericLifecycleStep(step: ReporterStep): boolean {
    const category = (step.category ?? '').trim().toLowerCase()
    const title = (step.title ?? '').trim().toLowerCase()

    return /(^|\W)(before hooks|after hooks|setup|teardown|cleanup|worker cleanup|fixture|hook)($|\W)/.test(title)
        || /(hook:before|hook:after|fixture:setup|fixture:teardown|beforeall|beforeeach|afterall|aftereach)/.test(category)
}

function isReporterGenericTeardownStep(step: ReporterStep): boolean {
    const category = (step.category ?? '').trim().toLowerCase()
    const title = (step.title ?? '').trim().toLowerCase()

    return /(^|\W)(after hooks|worker cleanup|cleanup|clean up|teardown|tear down)($|\W)/.test(title)
        || /(hook:after|fixture:teardown|afterall|aftereach|cleanup|clean up|teardown)/.test(category)
}

function isReporterCascadingTeardownInfrastructureStep(step: ReporterStep): boolean {
    const titleCorpus = (step.title ?? '').trim().toLowerCase()
    const categoryCorpus = (step.category ?? '').trim().toLowerCase()
    const errorCorpus = (getReporterErrorMessage(step.error) ?? '').trim().toLowerCase()

    if (!errorCorpus) {
        return false
    }

    const hasClosedResourceSignal = /target page, context or browser has been closed|browser has been closed|context has been closed|page has been closed|browser\.close:|context\.close:|page\.close:/.test(errorCorpus)
    const isCloseOperation = /(close browser|close context|close page|browser close|context close|page close)/.test(titleCorpus)
    const isLifecycleCleanup = isReporterGenericLifecycleStep(step)
        || isReporterGenericTeardownStep(step)
        || categoryCorpus === 'hook'

    return hasClosedResourceSignal && (isCloseOperation || isLifecycleCleanup)
}

function isReporterActionableAutomationErrorStep(step: ReporterStep): boolean {
    const titleCorpus = (step.title ?? '').trim().toLowerCase()
    const categoryCorpus = (step.category ?? '').trim().toLowerCase()
    const errorCorpus = (getReporterErrorMessage(step.error) ?? '').trim().toLowerCase()
    const combinedCorpus = `${titleCorpus} ${categoryCorpus} ${errorCorpus}`

    return step.category === 'pw:api'
        && /(timeouterror|timeout \d+ms exceeded|timed out|waitfor|wait for|locator\.|selector)/.test(combinedCorpus)
}

function hasReporterErrorMessage(error: ReporterError | undefined): boolean {
    return Boolean(getReporterErrorMessage(error))
}

export function getReporterErrorMessage(error: ReporterError | undefined | null): string | null {
    if (typeof error === 'string' && error.trim().length > 0) {
        return error.trim()
    }

    if (error && typeof error === 'object' && typeof error.message === 'string' && error.message.trim().length > 0) {
        return error.message.trim()
    }

    return null
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
    const fallbackCodeQuality = buildEmptyCodeQualityMetrics(0)
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
    const codeQuality = summary.codeQuality ?? recoverCodeQualityMetricsFromSource(summary.sourceFile)
    const normalizedCodeQuality = {
        ...fallbackCodeQuality,
        ...codeQuality,
        drivers: codeQuality?.drivers ?? fallbackCodeQuality.drivers,
        topRiskFiles: codeQuality?.topRiskFiles ?? fallbackCodeQuality.topRiskFiles,
    }
    const currentRunTests = summary.currentRunTests ?? recoverCurrentRunTestsFromSource(summary.sourceFile)
    const topProblematicTests = summary.topProblematicTests ?? []
    const errorClusters = summary.errorClusters ?? []
    const normalizedComparison = {
        currentRun: summary.comparison?.currentRun ?? null,
        previousRun: summary.comparison?.previousRun ?? null,
        previousOverallRun: summary.comparison?.previousOverallRun ?? summary.comparison?.previousRun ?? null,
        mode: summary.comparison?.mode ?? 'adjacent',
        scopeLabel: summary.comparison?.scopeLabel ?? null,
    }

    return {
        ...summary,
        businessMetrics: normalizedBusinessMetrics,
        codeQuality: normalizedCodeQuality,
        currentRunTests,
        topProblematicTests,
        errorClusters,
        comparison: normalizedComparison,
        managerSummary: summary.managerSummary ?? buildManagerSummary({
            kpis: summary.kpis,
            trend: summary.trend,
            comparison: normalizedComparison,
            historyTotalRuns: summary.history.totalRuns,
            performance: summary.performance,
            flakyAnalytics: summary.flakyAnalytics,
            businessMetrics: normalizedBusinessMetrics,
            codeQuality: normalizedCodeQuality,
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
    const comparisonBaseline = resolveComparisonBaseline(historyRuns)
    const currentRun = comparisonBaseline.currentRun
    const previousRun = comparisonBaseline.previousRun
    const resolvedAdvancedMetrics = advancedMetrics ?? buildFallbackAdvancedMetrics(report, historyRuns, flakyTests, totalDurationMs, sourceFile)
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
        comparison: {
            currentRun,
            previousRun,
            previousOverallRun: comparisonBaseline.previousOverallRun,
            mode: comparisonBaseline.mode,
            scopeLabel: comparisonBaseline.scopeLabel,
        },
        historyTotalRuns: historyRuns.length,
        performance: resolvedAdvancedMetrics.performance,
        flakyAnalytics: resolvedAdvancedMetrics.flakyAnalytics,
        businessMetrics: resolvedAdvancedMetrics.businessMetrics,
        codeQuality: resolvedAdvancedMetrics.codeQuality,
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
            previousOverallRun: comparisonBaseline.previousOverallRun,
            mode: comparisonBaseline.mode,
            scopeLabel: comparisonBaseline.scopeLabel,
        },
        history: {
            totalRuns: historyRuns.length,
            recentRuns: [...recentRuns].reverse(),
        },
        performance: resolvedAdvancedMetrics.performance,
        flakyAnalytics: resolvedAdvancedMetrics.flakyAnalytics,
        businessMetrics: resolvedAdvancedMetrics.businessMetrics,
        codeQuality: resolvedAdvancedMetrics.codeQuality,
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
    sourceFile: string | null = null,
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

    return buildAdvancedMetricsFromArchivedRuns(report, historyRuns, archivedRuns, sourceFile)
}

export function buildAdvancedMetricsFromArchivedRuns(
    report: ReporterRoot,
    historyRuns: DashboardHistoryEntry[],
    archivedRuns: Array<{ run: DashboardHistoryEntry; report: ReporterRoot }>,
    sourceFile: string | null = null,
): DashboardAdvancedMetrics {
    const tests = report.tests ?? []
    const durationValues = tests
        .map((test) => safeNumber(test.durationMs))
        .filter((durationMs) => durationMs > 0)
    const performanceMetrics = buildPerformanceMetrics(report, historyRuns)

    const comparisonBaseline = resolveComparisonBaseline(historyRuns)
    const previousRun = comparisonBaseline.previousRun

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
        codeQuality: buildCodeQualityMetrics(report, sourceFile),
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
    const directError = firstNonEmpty((test.errors ?? []).map((error) => getReporterErrorMessage(error) ?? undefined))

    if (directError) {
        return directError
    }

    return firstNonEmpty(
        (test.attempts ?? [])
            .filter((attempt) => ['failed', 'timedout', 'interrupted'].includes(getAttemptStatus(attempt.status)))
            .map((attempt) => getReporterErrorMessage(attempt.error) ?? undefined),
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
    const previousRun = resolveComparisonBaseline(historyRuns).previousRun

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

    const totalPhaseMs = setupMs + testsMs + teardownMs
    const normalizationBase = totalPhaseMs > 0 ? totalPhaseMs : totalDurationMs

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

interface ParsedSourceTestMetric {
    startLine: number
    endLine: number
    title: string | null
    assertionCount: number
    smartWaitCount: number
    hardWaitCount: number
    stepCount: number
    directLocatorCount: number
    directPageActionCount: number
    stableSelectorCount: number
    textSelectorCount: number
    fragileSelectorCount: number
    pomReferenceCount: number
    pomFixtureReferenceCount: number
    sharedStateMutationCount: number
    usesPom: boolean
}

interface ParsedSourceFileAnalysis {
    tests: ParsedSourceTestMetric[]
    hasPomImports: boolean
    pomImportIdentifiers: string[]
    beforeAllCount: number
    beforeEachCount: number
    serialModeCount: number
    topLevelMutableStateCount: number
    topLevelMutableIdentifiers: string[]
}

interface CodeQualityAggregateResult {
    testCount: number
    testsWithoutPom: number
    testsWithoutSteps: number
    lowAssertionTests: number
    totalAssertions: number
    totalSmartWaits: number
    totalHardWaits: number
    totalSteps: number
    totalDirectLocators: number
    totalDirectPageActions: number
    totalStableSelectors: number
    totalTextSelectors: number
    totalFragileSelectors: number
    totalPomReferences: number
    totalPomFixtureReferences: number
    totalSharedStateMutations: number
    smellScore: number | null
    pomCompliancePercent: number | null
    assertionDensity: number | null
    waitStrategyScore: number | null
    stepGranularity: number | null
    isolationScore: number | null
    selectorStabilityPercent: number | null
}

const DIRECT_LOCATOR_METHODS = new Set([
    'locator',
    'getByRole',
    'getByLabel',
    'getByTestId',
    'getByText',
    'getByPlaceholder',
    'getByAltText',
    'getByTitle',
    '$',
    '$$',
])

const STABLE_LOCATOR_METHODS = new Set(['getByRole', 'getByLabel', 'getByTestId'])
const TEXT_LOCATOR_METHODS = new Set(['getByText', 'getByPlaceholder', 'getByAltText', 'getByTitle'])
const SMART_WAIT_METHODS = new Set(['waitForSelector', 'waitForResponse', 'waitForNavigation', 'waitForURL', 'waitForLoadState'])
const PAGE_ACTION_METHODS = new Set(['click', 'dblclick', 'tap', 'fill', 'press', 'check', 'uncheck', 'selectOption', 'goto', 'reload', 'setInputFiles', 'dragTo', 'hover'])
const SHARED_MUTATION_METHODS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'set', 'add', 'delete', 'clear'])

let cachedTypeScriptModule: typeof TypeScript | null | undefined

function getTypeScriptModule(): typeof TypeScript | null {
    if (cachedTypeScriptModule !== undefined) {
        return cachedTypeScriptModule
    }

    try {
        cachedTypeScriptModule = require('typescript') as typeof TypeScript
    } catch {
        cachedTypeScriptModule = null
    }

    return cachedTypeScriptModule
}

export function normalizePrecomputedSourceFacts(value: unknown): PrecomputedCodeQualitySourceFacts | null {
    if (!value || typeof value !== 'object') {
        return null
    }

    const sourceFactsRecord = value as Record<string, unknown>
    const files = Array.isArray(sourceFactsRecord.files)
        ? sourceFactsRecord.files
            .map((fileFacts) => normalizePrecomputedSourceFileFacts(fileFacts))
            .filter((fileFacts): fileFacts is PrecomputedCodeQualityFileFacts => fileFacts !== null)
        : []

    if (files.length === 0) {
        return null
    }

    return {
        schemaVersion: pickPositiveInteger(sourceFactsRecord.schemaVersion) ?? 1,
        analyzerVersion: pickTrimmedString(sourceFactsRecord.analyzerVersion) ?? undefined,
        files,
    }
}

function normalizePrecomputedSourceFileFacts(value: unknown): PrecomputedCodeQualityFileFacts | null {
    if (!value || typeof value !== 'object') {
        return null
    }

    const fileFactsRecord = value as Record<string, unknown>
    const file = pickTrimmedString(fileFactsRecord.file)

    if (!file) {
        return null
    }

    const tests = Array.isArray(fileFactsRecord.tests)
        ? fileFactsRecord.tests
            .map((testFacts) => normalizePrecomputedSourceTestFacts(testFacts))
            .filter((testFacts): testFacts is PrecomputedCodeQualityTestFacts => testFacts !== null)
        : []

    return {
        file,
        tests,
        hasPomImports: pickBoolean(fileFactsRecord.hasPomImports) ?? false,
        beforeAllCount: normalizeNonNegativeInteger(fileFactsRecord.beforeAllCount),
        beforeEachCount: normalizeNonNegativeInteger(fileFactsRecord.beforeEachCount),
        serialModeCount: normalizeNonNegativeInteger(fileFactsRecord.serialModeCount),
        topLevelMutableStateCount: normalizeNonNegativeInteger(fileFactsRecord.topLevelMutableStateCount),
    }
}

function normalizePrecomputedSourceTestFacts(value: unknown): PrecomputedCodeQualityTestFacts | null {
    if (!value || typeof value !== 'object') {
        return null
    }

    const testFactsRecord = value as Record<string, unknown>
    const startLine = pickPositiveInteger(testFactsRecord.startLine)

    if (startLine === null) {
        return null
    }

    const endLine = Math.max(startLine, pickPositiveInteger(testFactsRecord.endLine) ?? startLine)
    const pomReferenceCount = normalizeNonNegativeInteger(testFactsRecord.pomReferenceCount)
    const pomFixtureReferenceCount = normalizeNonNegativeInteger(testFactsRecord.pomFixtureReferenceCount)

    return {
        startLine,
        endLine,
        title: pickTrimmedString(testFactsRecord.title),
        assertionCount: normalizeNonNegativeInteger(testFactsRecord.assertionCount),
        smartWaitCount: normalizeNonNegativeInteger(testFactsRecord.smartWaitCount),
        hardWaitCount: normalizeNonNegativeInteger(testFactsRecord.hardWaitCount),
        stepCount: normalizeNonNegativeInteger(testFactsRecord.stepCount),
        directLocatorCount: normalizeNonNegativeInteger(testFactsRecord.directLocatorCount),
        directPageActionCount: normalizeNonNegativeInteger(testFactsRecord.directPageActionCount),
        stableSelectorCount: normalizeNonNegativeInteger(testFactsRecord.stableSelectorCount),
        textSelectorCount: normalizeNonNegativeInteger(testFactsRecord.textSelectorCount),
        fragileSelectorCount: normalizeNonNegativeInteger(testFactsRecord.fragileSelectorCount),
        pomReferenceCount,
        pomFixtureReferenceCount,
        sharedStateMutationCount: normalizeNonNegativeInteger(testFactsRecord.sharedStateMutationCount),
        usesPom: pickBoolean(testFactsRecord.usesPom) ?? (pomReferenceCount + pomFixtureReferenceCount > 0),
    }
}

function pickTrimmedString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function pickPositiveInteger(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null
    }

    const normalizedValue = Math.trunc(value)
    return normalizedValue > 0 ? normalizedValue : null
}

function normalizeNonNegativeInteger(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0
    }

    return Math.max(0, Math.trunc(value))
}

function pickBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null
}

function normalizeSourceFactsFileIdentity(filePath: string): string {
    return filePath.trim().replace(/\\/g, '/').toLowerCase()
}

function buildParsedAnalysisFromPrecomputedFacts(fileFacts: PrecomputedCodeQualityFileFacts): ParsedSourceFileAnalysis {
    return {
        tests: fileFacts.tests.map((testFacts) => ({
            startLine: testFacts.startLine,
            endLine: testFacts.endLine,
            title: testFacts.title,
            assertionCount: testFacts.assertionCount,
            smartWaitCount: testFacts.smartWaitCount,
            hardWaitCount: testFacts.hardWaitCount,
            stepCount: testFacts.stepCount,
            directLocatorCount: testFacts.directLocatorCount,
            directPageActionCount: testFacts.directPageActionCount,
            stableSelectorCount: testFacts.stableSelectorCount,
            textSelectorCount: testFacts.textSelectorCount,
            fragileSelectorCount: testFacts.fragileSelectorCount,
            pomReferenceCount: testFacts.pomReferenceCount,
            pomFixtureReferenceCount: testFacts.pomFixtureReferenceCount,
            sharedStateMutationCount: testFacts.sharedStateMutationCount,
            usesPom: testFacts.usesPom,
        })),
        hasPomImports: fileFacts.hasPomImports,
        pomImportIdentifiers: [],
        beforeAllCount: fileFacts.beforeAllCount,
        beforeEachCount: fileFacts.beforeEachCount,
        serialModeCount: fileFacts.serialModeCount,
        topLevelMutableStateCount: fileFacts.topLevelMutableStateCount,
        topLevelMutableIdentifiers: [],
    }
}

function collectReporterTestsByFile(tests: ReporterTest[]): Map<string, ReporterTest[]> {
    const testsByFile = new Map<string, ReporterTest[]>()

    for (const test of tests) {
        const filePath = typeof test.location?.file === 'string' ? test.location.file.trim() : ''

        if (!filePath) {
            continue
        }

        const fileTests = testsByFile.get(filePath) ?? []
        fileTests.push(test)
        testsByFile.set(filePath, fileTests)
    }

    return testsByFile
}

function buildCodeQualityMetricsFromResolvedAnalyses(options: {
    testsByFile: Map<string, ReporterTest[]>
    analyzableTests: number
    resolveAnalysis(file: string): ParsedSourceFileAnalysis | null
}): DashboardCodeQualityMetrics | null {
    const weightedTotals = {
        smellScore: 0,
        pomCompliancePercent: 0,
        assertionDensity: 0,
        waitStrategyScore: 0,
        stepGranularity: 0,
        isolationScore: 0,
        selectorStabilityPercent: 0,
    }
    const driverCounts = {
        hardWaits: 0,
        directLocators: 0,
        testsWithoutPom: 0,
        testsWithoutSteps: 0,
        fragileSelectors: 0,
        lowAssertionTests: 0,
        sharedStateSignals: 0,
    }

    let analyzedFiles = 0
    let matchedTests = 0

    const topRiskFiles: DashboardCodeQualityFileMetric[] = [...options.testsByFile.entries()]
        .map(([file, fileTests]) => {
            const parsedAnalysis = options.resolveAnalysis(file)

            if (!parsedAnalysis || parsedAnalysis.tests.length === 0) {
                return null
            }

            analyzedFiles += 1

            const matchedSourceTests = matchReportTestsToSourceMetrics(fileTests, parsedAnalysis.tests)

            if (matchedSourceTests.length === 0) {
                return null
            }

            matchedTests += matchedSourceTests.length

            const aggregate = buildCodeQualityAggregate(matchedSourceTests, parsedAnalysis)

            driverCounts.hardWaits += aggregate.totalHardWaits
            driverCounts.directLocators += aggregate.totalDirectLocators + aggregate.totalDirectPageActions
            driverCounts.testsWithoutPom += aggregate.testsWithoutPom
            driverCounts.testsWithoutSteps += aggregate.testsWithoutSteps
            driverCounts.fragileSelectors += aggregate.totalFragileSelectors
            driverCounts.lowAssertionTests += aggregate.lowAssertionTests
            driverCounts.sharedStateSignals += parsedAnalysis.beforeAllCount + parsedAnalysis.serialModeCount + parsedAnalysis.topLevelMutableStateCount + aggregate.totalSharedStateMutations

            weightedTotals.smellScore += (aggregate.smellScore ?? 0) * matchedSourceTests.length
            weightedTotals.pomCompliancePercent += (aggregate.pomCompliancePercent ?? 0) * matchedSourceTests.length
            weightedTotals.assertionDensity += (aggregate.assertionDensity ?? 0) * matchedSourceTests.length
            weightedTotals.waitStrategyScore += (aggregate.waitStrategyScore ?? 0) * matchedSourceTests.length
            weightedTotals.stepGranularity += (aggregate.stepGranularity ?? 0) * matchedSourceTests.length
            weightedTotals.isolationScore += (aggregate.isolationScore ?? 0) * matchedSourceTests.length
            weightedTotals.selectorStabilityPercent += (aggregate.selectorStabilityPercent ?? 0) * matchedSourceTests.length

            return {
                file,
                matchedTests: matchedSourceTests.length,
                declaredTests: parsedAnalysis.tests.length,
                smellScore: aggregate.smellScore,
                pomCompliancePercent: aggregate.pomCompliancePercent,
                assertionDensity: aggregate.assertionDensity,
                waitStrategyScore: aggregate.waitStrategyScore,
                stepGranularity: aggregate.stepGranularity,
                isolationScore: aggregate.isolationScore,
                selectorStabilityPercent: aggregate.selectorStabilityPercent,
                notableSignals: buildCodeQualityNotableSignals(aggregate, parsedAnalysis),
                sourceResolved: true,
            }
        })
        .filter((value): value is NonNullable<typeof value> => value !== null)
        .sort((left, right) => {
            const leftScore = left.smellScore ?? 101
            const rightScore = right.smellScore ?? 101

            if (leftScore !== rightScore) {
                return leftScore - rightScore
            }

            return right.matchedTests - left.matchedTests
        })
        .slice(0, 6)

    if (matchedTests === 0) {
        return null
    }

    return {
        analyzedFiles,
        matchedTests,
        analyzableTests: options.analyzableTests,
        sourceCoveragePercent: options.analyzableTests === 0 ? 0 : roundToOneDigit((matchedTests / options.analyzableTests) * 100),
        testSmellScore: roundToOneDigit(weightedTotals.smellScore / matchedTests),
        pomCompliancePercent: roundToOneDigit(weightedTotals.pomCompliancePercent / matchedTests),
        assertionDensity: roundToTwoDigits(weightedTotals.assertionDensity / matchedTests),
        waitStrategyScore: roundToOneDigit(weightedTotals.waitStrategyScore / matchedTests),
        stepGranularity: roundToTwoDigits(weightedTotals.stepGranularity / matchedTests),
        isolationScore: roundToOneDigit(weightedTotals.isolationScore / matchedTests),
        selectorStabilityPercent: roundToOneDigit(weightedTotals.selectorStabilityPercent / matchedTests),
        drivers: buildCodeQualityDrivers(driverCounts, matchedTests),
        topRiskFiles,
    }
}

function buildCodeQualityMetrics(report: ReporterRoot, reportSourceFile: string | null): DashboardCodeQualityMetrics {
    const tests = report.tests ?? []
    const analyzableTests = tests.filter((test) => typeof test.location?.file === 'string' && test.location.file.trim().length > 0).length

    if (analyzableTests === 0) {
        return buildEmptyCodeQualityMetrics(0)
    }

    const testsByFile = collectReporterTestsByFile(tests)
    const precomputedSourceFacts = normalizePrecomputedSourceFacts(report.aqaPulseSourceFacts)

    if (precomputedSourceFacts) {
        const parsedAnalysesByFile = new Map<string, ParsedSourceFileAnalysis>()

        for (const fileFacts of precomputedSourceFacts.files) {
            parsedAnalysesByFile.set(normalizeSourceFactsFileIdentity(fileFacts.file), buildParsedAnalysisFromPrecomputedFacts(fileFacts))
        }

        const precomputedMetrics = buildCodeQualityMetricsFromResolvedAnalyses({
            testsByFile,
            analyzableTests,
            resolveAnalysis(file) {
                return parsedAnalysesByFile.get(normalizeSourceFactsFileIdentity(file)) ?? null
            },
        })

        if (precomputedMetrics) {
            return precomputedMetrics
        }
    }

    const typeScriptModule = getTypeScriptModule()

    if (!typeScriptModule) {
        return buildEmptyCodeQualityMetrics(analyzableTests)
    }

    const sourceAnalysisMetrics = buildCodeQualityMetricsFromResolvedAnalyses({
        testsByFile,
        analyzableTests,
        resolveAnalysis(file) {
            const resolvedPath = resolveTestSourcePath(file, reportSourceFile)

            if (!resolvedPath) {
                return null
            }

            return analyzeSourceFile(resolvedPath, typeScriptModule)
        },
    })

    return sourceAnalysisMetrics ?? buildEmptyCodeQualityMetrics(analyzableTests)
}

function analyzeSourceFile(filePath: string, typeScriptModule: typeof TypeScript): ParsedSourceFileAnalysis | null {
    try {
        const sourceText = fs.readFileSync(filePath, 'utf8')
        const sourceFile = typeScriptModule.createSourceFile(
            filePath,
            sourceText,
            typeScriptModule.ScriptTarget.Latest,
            true,
            filePath.endsWith('.tsx') ? typeScriptModule.ScriptKind.TSX : typeScriptModule.ScriptKind.TS,
        )

        let hasPomImports = false
        let pomImportIdentifiers = new Set<string>()
        let beforeAllCount = 0
        let beforeEachCount = 0
        let serialModeCount = 0
        let topLevelMutableStateCount = 0
        let topLevelMutableIdentifiers = new Set<string>()
        const tests: ParsedSourceTestMetric[] = []

        for (const statement of sourceFile.statements) {
            if (typeScriptModule.isImportDeclaration(statement)) {
                const importPath = statement.moduleSpecifier.getText(sourceFile).slice(1, -1)

                if (isPomImportPath(importPath)) {
                    hasPomImports = true

                    if (statement.importClause?.name) {
                        pomImportIdentifiers.add(statement.importClause.name.text)
                    }

                    if (statement.importClause?.namedBindings && typeScriptModule.isNamedImports(statement.importClause.namedBindings)) {
                        for (const element of statement.importClause.namedBindings.elements) {
                            pomImportIdentifiers.add(element.name.text)
                        }
                    }
                }

                continue
            }

            if (typeScriptModule.isVariableStatement(statement)) {
                const declarationFlags = statement.declarationList.flags
                const isConst = (declarationFlags & typeScriptModule.NodeFlags.Const) !== 0

                if (!isConst) {
                    topLevelMutableStateCount += statement.declarationList.declarations.length

                    for (const declaration of statement.declarationList.declarations) {
                        if (typeScriptModule.isIdentifier(declaration.name)) {
                            topLevelMutableIdentifiers.add(declaration.name.text)
                        }
                    }
                }
            }
        }

        visitCallExpressions(sourceFile, typeScriptModule, (callExpression) => {
            if (getCallExpressionName(callExpression, typeScriptModule) === 'beforeAll') {
                beforeAllCount += 1
            }

            if (getCallExpressionName(callExpression, typeScriptModule) === 'beforeEach') {
                beforeEachCount += 1
            }

            if (isSerialConfigureCall(callExpression, sourceFile, typeScriptModule)) {
                serialModeCount += 1
            }

            if (!isTestDeclarationCall(callExpression, typeScriptModule)) {
                return
            }

            const callback = getTestCallback(callExpression, typeScriptModule)

            if (!callback) {
                return
            }

            tests.push(collectSourceTestMetric(callback, sourceFile, typeScriptModule, {
                hasPomImports,
                pomImportIdentifiers,
                topLevelMutableIdentifiers,
            }))
        })

        return {
            tests,
            hasPomImports,
            pomImportIdentifiers: [...pomImportIdentifiers],
            beforeAllCount,
            beforeEachCount,
            serialModeCount,
            topLevelMutableStateCount,
            topLevelMutableIdentifiers: [...topLevelMutableIdentifiers],
        }
    } catch {
        return null
    }
}

function collectSourceTestMetric(
    callback: TypeScript.FunctionExpression | TypeScript.ArrowFunction,
    sourceFile: TypeScript.SourceFile,
    typeScriptModule: typeof TypeScript,
    context: {
        hasPomImports: boolean
        pomImportIdentifiers: Set<string>
        topLevelMutableIdentifiers: Set<string>
    },
): ParsedSourceTestMetric {
    let assertionCount = 0
    let smartWaitCount = 0
    let hardWaitCount = 0
    let stepCount = 0
    let directLocatorCount = 0
    let directPageActionCount = 0
    let stableSelectorCount = 0
    let textSelectorCount = 0
    let fragileSelectorCount = 0
    let pomReferenceCount = 0
    let pomFixtureReferenceCount = 0
    let sharedStateMutationCount = 0
    const pomFixtureNames = new Set(getPomFixtureNames(callback, typeScriptModule))

    visitCallExpressions(callback.body, typeScriptModule, (callExpression) => {
        if (isExpectCall(callExpression, typeScriptModule)) {
            assertionCount += 1
            smartWaitCount += 1
            return
        }

        if (isTestStepCall(callExpression, typeScriptModule)) {
            stepCount += 1
            return
        }

        const callName = getCallExpressionName(callExpression, typeScriptModule)

        if (!callName) {
            return
        }

        if (callName === 'waitForTimeout') {
            hardWaitCount += 1
            return
        }

        if (SMART_WAIT_METHODS.has(callName)) {
            smartWaitCount += 1
        }

        if (isDirectPageActionCall(callExpression, typeScriptModule)) {
            directPageActionCount += 1
        }

        if (isPomInteractionCall(callExpression, typeScriptModule, context.pomImportIdentifiers, pomFixtureNames)) {
            if (isFixtureBackedPomCall(callExpression, typeScriptModule, pomFixtureNames)) {
                pomFixtureReferenceCount += 1
            } else {
                pomReferenceCount += 1
            }
        }

        if (isSharedMutableMutationCall(callExpression, typeScriptModule, context.topLevelMutableIdentifiers)) {
            sharedStateMutationCount += 1
        }

        if (DIRECT_LOCATOR_METHODS.has(callName)) {
            directLocatorCount += 1

            if (STABLE_LOCATOR_METHODS.has(callName)) {
                stableSelectorCount += 1
                return
            }

            if (TEXT_LOCATOR_METHODS.has(callName)) {
                textSelectorCount += 1
                return
            }

            const selectorKind = classifySelectorLiteral(readFirstStringArgument(callExpression, sourceFile, typeScriptModule))

            if (selectorKind === 'stable') {
                stableSelectorCount += 1
            } else if (selectorKind === 'text') {
                textSelectorCount += 1
            } else {
                fragileSelectorCount += 1
            }
        }
    })

    visitNodes(callback.body, typeScriptModule, (node) => {
        if (typeScriptModule.isIdentifier(node) && context.pomImportIdentifiers.has(node.text)) {
            pomReferenceCount += 1
        }

        if (typeScriptModule.isIdentifier(node) && pomFixtureNames.has(node.text)) {
            pomFixtureReferenceCount += 1
        }

        if (isSharedMutableAssignment(node, typeScriptModule, context.topLevelMutableIdentifiers)) {
            sharedStateMutationCount += 1
        }
    })

    const startLine = sourceFile.getLineAndCharacterOfPosition(callback.getStart(sourceFile)).line + 1
    const endLine = sourceFile.getLineAndCharacterOfPosition(callback.getEnd()).line + 1

    return {
        startLine,
        endLine,
        title: null,
        assertionCount,
        smartWaitCount,
        hardWaitCount,
        stepCount,
        directLocatorCount,
        directPageActionCount,
        stableSelectorCount,
        textSelectorCount,
        fragileSelectorCount,
        pomReferenceCount,
        pomFixtureReferenceCount,
        sharedStateMutationCount,
        usesPom: evaluatePomUsage({
            hasPomImports: context.hasPomImports,
            pomReferenceCount,
            pomFixtureReferenceCount,
            directLocatorCount,
            directPageActionCount,
        }),
    }
}

function visitCallExpressions(node: TypeScript.Node, typeScriptModule: typeof TypeScript, callback: (callExpression: TypeScript.CallExpression) => void): void {
    const visit = (currentNode: TypeScript.Node): void => {
        if (typeScriptModule.isCallExpression(currentNode)) {
            callback(currentNode)
        }

        typeScriptModule.forEachChild(currentNode, visit)
    }

    visit(node)
}

function visitNodes(node: TypeScript.Node, typeScriptModule: typeof TypeScript, callback: (node: TypeScript.Node) => void): void {
    const visit = (currentNode: TypeScript.Node): void => {
        callback(currentNode)
        typeScriptModule.forEachChild(currentNode, visit)
    }

    visit(node)
}

function isPomImportPath(importPath: string): boolean {
    return /(^|\/)(pages?|page-objects?|pageobjects?|pom|screen-objects?|page-models?)(\/|$)/i.test(importPath)
}

function isTestDeclarationCall(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): boolean {
    const expression = callExpression.expression

    if (typeScriptModule.isIdentifier(expression)) {
        return expression.text === 'test' || expression.text === 'it'
    }

    if (typeScriptModule.isPropertyAccessExpression(expression) && typeScriptModule.isIdentifier(expression.expression)) {
        return (expression.expression.text === 'test' || expression.expression.text === 'it')
            && ['only', 'skip', 'fixme', 'fail'].includes(expression.name.text)
    }

    return false
}

function getTestCallback(
    callExpression: TypeScript.CallExpression,
    typeScriptModule: typeof TypeScript,
): TypeScript.FunctionExpression | TypeScript.ArrowFunction | null {
    const callbackCandidate = [...callExpression.arguments]
        .reverse()
        .find((argument) => typeScriptModule.isArrowFunction(argument) || typeScriptModule.isFunctionExpression(argument))

    if (!callbackCandidate) {
        return null
    }

    return callbackCandidate as TypeScript.FunctionExpression | TypeScript.ArrowFunction
}

function getPomFixtureNames(
    callback: TypeScript.FunctionExpression | TypeScript.ArrowFunction,
    typeScriptModule: typeof TypeScript,
): string[] {
    const firstParameter = callback.parameters[0]

    if (!firstParameter || !typeScriptModule.isObjectBindingPattern(firstParameter.name)) {
        return []
    }

    return firstParameter.name.elements
        .map((element) => typeScriptModule.isIdentifier(element.name) ? element.name.text : null)
        .filter((value): value is string => typeof value === 'string')
        .filter((value) => isPomLikeIdentifier(value))
}

function isTestStepCall(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): boolean {
    return typeScriptModule.isPropertyAccessExpression(callExpression.expression)
        && typeScriptModule.isIdentifier(callExpression.expression.expression)
        && callExpression.expression.expression.text === 'test'
        && callExpression.expression.name.text === 'step'
}

function isExpectCall(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): boolean {
    if (typeScriptModule.isIdentifier(callExpression.expression)) {
        return callExpression.expression.text === 'expect'
    }

    return typeScriptModule.isPropertyAccessExpression(callExpression.expression)
        && typeScriptModule.isIdentifier(callExpression.expression.expression)
        && callExpression.expression.expression.text === 'expect'
        && ['soft', 'poll'].includes(callExpression.expression.name.text)
}

function isSerialConfigureCall(
    callExpression: TypeScript.CallExpression,
    sourceFile: TypeScript.SourceFile,
    typeScriptModule: typeof TypeScript,
): boolean {
    if (!typeScriptModule.isPropertyAccessExpression(callExpression.expression)) {
        return false
    }

    const objectExpression = callExpression.expression.expression

    if (!typeScriptModule.isIdentifier(objectExpression) || objectExpression.text !== 'test' || callExpression.expression.name.text !== 'describe') {
        return false
    }

    return callExpression.arguments.some((argument) => argument.getText(sourceFile).includes('serial'))
}

function getCallExpressionName(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): string | null {
    const expression = callExpression.expression

    if (typeScriptModule.isIdentifier(expression)) {
        return expression.text
    }

    if (typeScriptModule.isPropertyAccessExpression(expression)) {
        return expression.name.text
    }

    return null
}

function isDirectPageActionCall(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): boolean {
    return typeScriptModule.isPropertyAccessExpression(callExpression.expression)
        && typeScriptModule.isIdentifier(callExpression.expression.expression)
        && callExpression.expression.expression.text === 'page'
        && PAGE_ACTION_METHODS.has(callExpression.expression.name.text)
}

function isPomInteractionCall(
    callExpression: TypeScript.CallExpression,
    typeScriptModule: typeof TypeScript,
    pomImportIdentifiers: Set<string>,
    pomFixtureNames: Set<string>,
): boolean {
    if (!typeScriptModule.isPropertyAccessExpression(callExpression.expression)) {
        return false
    }

    const target = callExpression.expression.expression

    if (!typeScriptModule.isIdentifier(target)) {
        return false
    }

    return pomImportIdentifiers.has(target.text)
        || pomFixtureNames.has(target.text)
        || isPomLikeIdentifier(target.text)
}

function isFixtureBackedPomCall(
    callExpression: TypeScript.CallExpression,
    typeScriptModule: typeof TypeScript,
    pomFixtureNames: Set<string>,
): boolean {
    return typeScriptModule.isPropertyAccessExpression(callExpression.expression)
        && typeScriptModule.isIdentifier(callExpression.expression.expression)
        && pomFixtureNames.has(callExpression.expression.expression.text)
}

function isSharedMutableMutationCall(
    callExpression: TypeScript.CallExpression,
    typeScriptModule: typeof TypeScript,
    topLevelMutableIdentifiers: Set<string>,
): boolean {
    if (!typeScriptModule.isPropertyAccessExpression(callExpression.expression)) {
        return false
    }

    const target = callExpression.expression.expression

    return typeScriptModule.isIdentifier(target)
        && topLevelMutableIdentifiers.has(target.text)
        && SHARED_MUTATION_METHODS.has(callExpression.expression.name.text)
}

function isSharedMutableAssignment(
    node: TypeScript.Node,
    typeScriptModule: typeof TypeScript,
    topLevelMutableIdentifiers: Set<string>,
): boolean {
    if (typeScriptModule.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind, typeScriptModule)) {
        return typeScriptModule.isIdentifier(node.left) && topLevelMutableIdentifiers.has(node.left.text)
    }

    if (typeScriptModule.isPrefixUnaryExpression(node) || typeScriptModule.isPostfixUnaryExpression(node)) {
        const operand = node.operand
        return typeScriptModule.isIdentifier(operand)
            && topLevelMutableIdentifiers.has(operand.text)
            && (node.operator === typeScriptModule.SyntaxKind.PlusPlusToken || node.operator === typeScriptModule.SyntaxKind.MinusMinusToken)
    }

    return false
}

function isAssignmentOperator(kind: TypeScript.SyntaxKind, typeScriptModule: typeof TypeScript): boolean {
    return kind >= typeScriptModule.SyntaxKind.FirstAssignment && kind <= typeScriptModule.SyntaxKind.LastAssignment
}

function isPomLikeIdentifier(value: string): boolean {
    return /(?:page|screen|modal|dialog|drawer|form|flow|widget|section|panel|steps|po|model)$/i.test(value)
        && value.toLowerCase() !== 'page'
}

function evaluatePomUsage(input: {
    hasPomImports: boolean
    pomReferenceCount: number
    pomFixtureReferenceCount: number
    directLocatorCount: number
    directPageActionCount: number
}): boolean {
    const pomSignals = input.pomReferenceCount + input.pomFixtureReferenceCount
    const directSignals = input.directLocatorCount + input.directPageActionCount

    if (pomSignals >= 2 && directSignals <= 4) {
        return true
    }

    if (input.pomFixtureReferenceCount > 0 && directSignals <= 3) {
        return true
    }

    if (input.hasPomImports && pomSignals > 0 && input.directLocatorCount <= 1 && input.directPageActionCount <= 2) {
        return true
    }

    return false
}

function readFirstStringArgument(
    callExpression: TypeScript.CallExpression,
    sourceFile: TypeScript.SourceFile,
    typeScriptModule: typeof TypeScript,
): string | null {
    const firstArgument = callExpression.arguments[0]

    if (!firstArgument) {
        return null
    }

    if (typeScriptModule.isStringLiteral(firstArgument) || typeScriptModule.isNoSubstitutionTemplateLiteral(firstArgument)) {
        return firstArgument.text
    }

    const rawText = firstArgument.getText(sourceFile)
    return rawText.length > 0 ? rawText : null
}

function classifySelectorLiteral(selector: string | null): 'stable' | 'text' | 'fragile' {
    if (!selector) {
        return 'fragile'
    }

    const normalizedSelector = selector.trim().toLowerCase()

    if (/data-testid|data-test|qa-id|testid/.test(normalizedSelector)) {
        return 'stable'
    }

    if (/text=|has-text|:text|\btext\(/.test(normalizedSelector)) {
        return 'text'
    }

    if (/^\/\/|^xpath=|nth-child|:nth|\s>\s|\.[a-z0-9_-]+\.[a-z0-9_.-]+|\[class|\.filter-option|\.btn|\.button/.test(normalizedSelector)) {
        return 'fragile'
    }

    return normalizedSelector.includes('#') ? 'stable' : 'fragile'
}

function resolveTestSourcePath(filePath: string, reportSourceFile: string | null): string | null {
    const normalizedPath = filePath.trim()

    if (!normalizedPath) {
        return null
    }

    const candidatePaths = new Set<string>()
    const baseDirectories = new Set<string>()
    const packageRoot = path.resolve(__dirname, '..')
    const workingDirectory = process.cwd()

    if (reportSourceFile) {
        baseDirectories.add(path.dirname(reportSourceFile))
        baseDirectories.add(path.resolve(path.dirname(reportSourceFile), '..'))
        baseDirectories.add(path.resolve(path.dirname(reportSourceFile), '../..'))
    }

    baseDirectories.add(workingDirectory)
    baseDirectories.add(path.resolve(workingDirectory, '..'))
    baseDirectories.add(path.resolve(workingDirectory, '../..'))
    baseDirectories.add(packageRoot)
    baseDirectories.add(path.resolve(packageRoot, '..'))
    baseDirectories.add(path.resolve(packageRoot, '../..'))

    if (path.isAbsolute(normalizedPath)) {
        candidatePaths.add(normalizedPath)
    }

    for (const baseDirectory of baseDirectories) {
        candidatePaths.add(path.resolve(baseDirectory, normalizedPath))
    }

    for (const candidatePath of candidatePaths) {
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
            return candidatePath
        }
    }

    return null
}

function matchReportTestsToSourceMetrics(
    reporterTests: ReporterTest[],
    sourceTests: ParsedSourceTestMetric[],
): ParsedSourceTestMetric[] {
    if (sourceTests.length === 0) {
        return []
    }

    return reporterTests.map((test, index) => sourceTests[findBestSourceMetricIndex(test, index, sourceTests)] ?? sourceTests[Math.min(index, sourceTests.length - 1)])
}

function findBestSourceMetricIndex(test: ReporterTest, fallbackIndex: number, sourceTests: ParsedSourceTestMetric[]): number {
    const lineNumber = typeof test.location?.line === 'number' && Number.isFinite(test.location.line)
        ? Math.max(1, Math.trunc(test.location.line))
        : null

    if (lineNumber === null) {
        return Math.min(fallbackIndex, sourceTests.length - 1)
    }

    const containingIndex = sourceTests.findIndex((sourceTest) => lineNumber >= sourceTest.startLine && lineNumber <= sourceTest.endLine)

    if (containingIndex >= 0) {
        return containingIndex
    }

    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY

    sourceTests.forEach((sourceTest, index) => {
        const distance = Math.abs(sourceTest.startLine - lineNumber)

        if (distance < bestDistance) {
            bestDistance = distance
            bestIndex = index
        }
    })

    return bestIndex
}

function buildCodeQualityAggregate(
    tests: ParsedSourceTestMetric[],
    analysis: ParsedSourceFileAnalysis,
): CodeQualityAggregateResult {
    const testCount = tests.length

    if (testCount === 0) {
        return {
            testCount: 0,
            testsWithoutPom: 0,
            testsWithoutSteps: 0,
            lowAssertionTests: 0,
            totalAssertions: 0,
            totalSmartWaits: 0,
            totalHardWaits: 0,
            totalSteps: 0,
            totalDirectLocators: 0,
            totalDirectPageActions: 0,
            totalStableSelectors: 0,
            totalTextSelectors: 0,
            totalFragileSelectors: 0,
            totalPomReferences: 0,
            totalPomFixtureReferences: 0,
            totalSharedStateMutations: 0,
            smellScore: null,
            pomCompliancePercent: null,
            assertionDensity: null,
            waitStrategyScore: null,
            stepGranularity: null,
            isolationScore: null,
            selectorStabilityPercent: null,
        }
    }

    const testsWithoutPom = tests.filter((test) => !test.usesPom).length
    const testsWithoutSteps = tests.filter((test) => test.stepCount === 0).length
    const lowAssertionTests = tests.filter((test) => test.assertionCount < 2).length
    const totalAssertions = sum(tests.map((test) => test.assertionCount))
    const totalSmartWaits = sum(tests.map((test) => test.smartWaitCount))
    const totalHardWaits = sum(tests.map((test) => test.hardWaitCount))
    const totalSteps = sum(tests.map((test) => test.stepCount))
    const totalDirectLocators = sum(tests.map((test) => test.directLocatorCount))
    const totalDirectPageActions = sum(tests.map((test) => test.directPageActionCount))
    const totalStableSelectors = sum(tests.map((test) => test.stableSelectorCount))
    const totalTextSelectors = sum(tests.map((test) => test.textSelectorCount))
    const totalFragileSelectors = sum(tests.map((test) => test.fragileSelectorCount))
    const totalPomReferences = sum(tests.map((test) => test.pomReferenceCount))
    const totalPomFixtureReferences = sum(tests.map((test) => test.pomFixtureReferenceCount))
    const totalSharedStateMutations = sum(tests.map((test) => test.sharedStateMutationCount))
    const pomCompliancePercent = roundToOneDigit(((testCount - testsWithoutPom) / testCount) * 100)
    const assertionDensity = roundToTwoDigits(totalAssertions / testCount)
    const totalWaitSignals = totalSmartWaits + totalHardWaits
    const waitStrategyScore = totalWaitSignals === 0 ? 100 : roundToOneDigit((totalSmartWaits / totalWaitSignals) * 100)
    const stepGranularity = roundToTwoDigits(totalSteps / testCount)
    const totalSelectorSignals = totalStableSelectors + totalTextSelectors + totalFragileSelectors
    const selectorStabilityPercent = totalSelectorSignals === 0
        ? 100
        : roundToOneDigit((((totalStableSelectors * 1) + (totalTextSelectors * 0.65) + (totalFragileSelectors * 0.2)) / totalSelectorSignals) * 100)
    const hardWaitRatio = totalWaitSignals === 0 ? 0 : totalHardWaits / totalWaitSignals
    const directLocatorDensity = Math.min((totalDirectLocators + (totalDirectPageActions * 0.7)) / Math.max(testCount * 4, 1), 1)
    const noPomRatio = testsWithoutPom / testCount
    const noStepRatio = testsWithoutSteps / testCount
    const lowAssertionRatio = lowAssertionTests / testCount
    const fragileSelectorRatio = totalSelectorSignals === 0 ? 0 : totalFragileSelectors / totalSelectorSignals
    const sharedStatePenalty = Math.min(Math.max(
        analysis.beforeAllCount * 15
        + analysis.serialModeCount * 20
        + analysis.topLevelMutableStateCount * 10
        + totalSharedStateMutations * 12
        - analysis.beforeEachCount * 6,
        0,
    ), 70)
    const smellScore = roundToOneDigit(clampScore(
        100
        - (hardWaitRatio * 28 * 100)
        - (directLocatorDensity * 18 * 100)
        - (noPomRatio * 18 * 100)
        - (noStepRatio * 12 * 100)
        - (lowAssertionRatio * 12 * 100)
        - (fragileSelectorRatio * 12 * 100)
        - sharedStatePenalty,
    ))
    const isolationScore = roundToOneDigit(clampScore(100 - sharedStatePenalty))

    return {
        testCount,
        testsWithoutPom,
        testsWithoutSteps,
        lowAssertionTests,
        totalAssertions,
        totalSmartWaits,
        totalHardWaits,
        totalSteps,
        totalDirectLocators,
        totalDirectPageActions,
        totalStableSelectors,
        totalTextSelectors,
        totalFragileSelectors,
        totalPomReferences,
        totalPomFixtureReferences,
        totalSharedStateMutations,
        smellScore,
        pomCompliancePercent,
        assertionDensity,
        waitStrategyScore,
        stepGranularity,
        isolationScore,
        selectorStabilityPercent,
    }
}

function buildCodeQualityNotableSignals(
    aggregate: CodeQualityAggregateResult,
    analysis: ParsedSourceFileAnalysis,
): string[] {
    const signals: Array<{ label: string; count: number }> = [
        { label: 'waitForTimeout', count: aggregate.totalHardWaits },
        { label: 'direct locators', count: aggregate.totalDirectLocators + aggregate.totalDirectPageActions },
        { label: 'fragile selectors', count: aggregate.totalFragileSelectors },
        { label: 'tests without test.step', count: aggregate.testsWithoutSteps },
        { label: 'tests without POM', count: aggregate.testsWithoutPom },
        { label: 'shared state / beforeAll', count: analysis.beforeAllCount + analysis.serialModeCount + analysis.topLevelMutableStateCount + aggregate.totalSharedStateMutations },
    ]

    return signals
        .filter((signal) => signal.count > 0)
        .sort((left, right) => right.count - left.count)
        .slice(0, 3)
        .map((signal) => `${signal.label} × ${signal.count}`)
}

function buildCodeQualityDrivers(
    driverCounts: {
        hardWaits: number
        directLocators: number
        testsWithoutPom: number
        testsWithoutSteps: number
        fragileSelectors: number
        lowAssertionTests: number
        sharedStateSignals: number
    },
    matchedTests: number,
): DashboardCodeQualityRiskDriver[] {
    const buildImpact = (count: number): DashboardCodeQualityRiskDriver['impact'] => {
        const ratio = matchedTests === 0 ? 0 : count / matchedTests

        if (ratio >= 1 || count >= 8) {
            return 'high'
        }

        if (ratio >= 0.35 || count >= 3) {
            return 'medium'
        }

        return 'low'
    }

    return [
        {
            label: 'waitForTimeout и жёсткие паузы',
            count: driverCounts.hardWaits,
            impact: buildImpact(driverCounts.hardWaits),
            hint: 'Жёсткие ожидания хуже переживают колебания UI и чаще приводят к flaky-поведению.',
        },
        {
            label: 'Прямые locator-вызовы в spec',
            count: driverCounts.directLocators,
            impact: buildImpact(driverCounts.directLocators),
            hint: 'Большой объём locator-логики прямо в тестах обычно указывает на низкую переиспользуемость и слабую изоляцию.',
        },
        {
            label: 'Тесты без POM-сигнала',
            count: driverCounts.testsWithoutPom,
            impact: buildImpact(driverCounts.testsWithoutPom),
            hint: 'Если сценарий не проходит через page object / screen-model слой, поддержка и миграции UI обычно дорожают.',
        },
        {
            label: 'Тесты без test.step',
            count: driverCounts.testsWithoutSteps,
            impact: buildImpact(driverCounts.testsWithoutSteps),
            hint: 'Без явной step-структуры сложнее читать отчёты и локализовать первичную точку сбоя.',
        },
        {
            label: 'Хрупкие CSS/XPath селекторы',
            count: driverCounts.fragileSelectors,
            impact: buildImpact(driverCounts.fragileSelectors),
            hint: 'Длинные CSS-цепочки, XPath и nth-child дают высокий риск ложных падений при изменении верстки.',
        },
        {
            label: 'Слабая assertion coverage',
            count: driverCounts.lowAssertionTests,
            impact: buildImpact(driverCounts.lowAssertionTests),
            hint: 'Низкая плотность expect() часто означает, что сценарий делает действия, но слабо проверяет результат.',
        },
        {
            label: 'Shared state / beforeAll',
            count: driverCounts.sharedStateSignals,
            impact: buildImpact(driverCounts.sharedStateSignals),
            hint: 'Общий mutable state, serial-режим и heavy beforeAll снижают изоляцию тестов и усложняют параллельный запуск.',
        },
    ]
        .filter((driver) => driver.count > 0)
        .sort((left, right) => right.count - left.count)
        .slice(0, 4)
}

function buildEmptyCodeQualityMetrics(analyzableTests: number): DashboardCodeQualityMetrics {
    return {
        analyzedFiles: 0,
        matchedTests: 0,
        analyzableTests,
        sourceCoveragePercent: 0,
        testSmellScore: null,
        pomCompliancePercent: null,
        assertionDensity: null,
        waitStrategyScore: null,
        stepGranularity: null,
        isolationScore: null,
        selectorStabilityPercent: null,
        drivers: [],
        topRiskFiles: [],
    }
}

function buildDurationBreakdownItems(
    source: Map<string, { durationMs: number; tests: number }>,
    totalDurationMs: number,
): DashboardDurationBreakdownItem[] {
    const totalBreakdownMs = [...source.values()].reduce((sum, entry) => sum + entry.durationMs, 0)
    const normalizationBase = totalBreakdownMs > 0 ? totalBreakdownMs : totalDurationMs

    return [...source.entries()]
        .map(([label, entry]) => ({
            label,
            durationMs: roundToOneDigit(entry.durationMs),
            sharePercent: normalizationBase <= 0 ? 0 : roundToOneDigit((entry.durationMs / normalizationBase) * 100),
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
    report: ReporterRoot,
    historyRuns: DashboardHistoryEntry[],
    flakyTests: number,
    totalDurationMs: number,
    sourceFile: string,
): DashboardAdvancedMetrics {
    const previousRun = resolveComparisonBaseline(historyRuns).previousRun
    const tests = report.tests ?? []
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
        codeQuality: buildCodeQualityMetrics(report, sourceFile),
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
    const costOfFlakiness = recalculateCostOfFlakinessMetrics({
        extraRetryMinutes,
        extraRetries,
        unstableRuns,
        activeDays,
    }, readDashboardBusinessAssumptionsFromEnv())
    const developerFriction = {
        rerunProxyPerActiveDay: activeDays === 0 ? roundToTwoDigits(extraRetries + unstableRuns) : roundToTwoDigits((extraRetries + unstableRuns) / activeDays),
        rerunBurdenPer100Runs: observedTests.length === 0 ? 0 : roundToTwoDigits(((extraRetries + unstableRuns) / observedTests.length) * 100),
        extraRetries,
        unstableRuns,
        activeDays,
        observedRuns: observedTests.length,
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
            medianDays: resolvedFixMetrics.length > 0
                ? roundToTwoDigits(getMedian(resolvedFixMetrics.map((metric) => metric.days)))
                : null,
            averageDays: resolvedFixMetrics.length > 0
                ? roundToTwoDigits(average(resolvedFixMetrics.map((metric) => metric.days)))
                : null,
            resolvedIncidents: resolvedFixMetrics.length,
        },
        costOfFlakiness,
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
            medianDays: null,
            averageDays: null,
            resolvedIncidents: 0,
        },
        costOfFlakiness: recalculateCostOfFlakinessMetrics({
            extraRetryMinutes: 0,
            extraRetries: 0,
            unstableRuns: 0,
            activeDays: 0,
        }, {
            ciMinuteCostRub: null,
            developerHourlyCostRub: null,
            analysisMinutesPerUnstable: null,
        }),
        developerFriction: {
            rerunProxyPerActiveDay: 0,
            rerunBurdenPer100Runs: 0,
            extraRetries: 0,
            unstableRuns: 0,
            activeDays: 0,
            observedRuns: 0,
        },
        releaseConfidenceScore: 0,
        automationRoi: {
            percent: null,
            source: 'pendingAssumptions',
        },
    }
}

function recoverCodeQualityMetricsFromSource(sourceFile: string): DashboardCodeQualityMetrics {
    try {
        if (!sourceFile || !fs.existsSync(sourceFile)) {
            return buildEmptyCodeQualityMetrics(0)
        }

        const report = loadReporterReport(sourceFile)
        return buildCodeQualityMetrics(report, sourceFile)
    } catch {
        return buildEmptyCodeQualityMetrics(0)
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
    comparison: DashboardSummary['comparison']
    historyTotalRuns: number
    performance: DashboardAdvancedMetrics['performance']
    flakyAnalytics: DashboardAdvancedMetrics['flakyAnalytics']
    businessMetrics: DashboardAdvancedMetrics['businessMetrics']
    codeQuality: DashboardAdvancedMetrics['codeQuality']
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
                ? `${roundToOneDigit(durationDeltaPercent)}% ${input.comparison.mode === 'comparable' ? 'к сопоставимому прогону' : 'к прошлому прогону'}`
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

function readDashboardBusinessAssumptionsFromEnv(): DashboardBusinessAssumptions {
    return {
        ciMinuteCostRub: readOptionalNumberFromEnv('AQA_PULSE_CI_MINUTE_COST'),
        developerHourlyCostRub: readOptionalNumberFromEnv('AQA_PULSE_DEV_HOURLY_COST'),
        analysisMinutesPerUnstable: readOptionalNumberFromEnv('AQA_PULSE_ANALYSIS_MINUTES_PER_UNSTABLE'),
    }
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



