import { type DashboardHistoryEntry } from './history-utils';
export { formatDate, formatDuration, formatPercent } from './shared/formatting';
export interface DashboardRunMetadata {
    branch: string | null;
    commit: string | null;
    author: string | null;
}
export interface DashboardFilters {
    branch: string | null;
    project: string | null;
    file: string | null;
}
export interface DashboardAvailableFilters {
    branches: string[];
    projects: string[];
    files: string[];
    projectsByBranch: Record<string, string[]>;
    filesByBranch: Record<string, string[]>;
    filesByProject: Record<string, string[]>;
    filesByBranchProject: Record<string, Record<string, string[]>>;
}
export interface ReporterSummary {
    total?: number;
    passed?: number;
    failed?: number;
    flaky?: number;
    skipped?: number;
    timedOut?: number;
    interrupted?: number;
}
export interface ReporterLocation {
    file?: string;
    line?: number;
    column?: number;
}
export interface ReporterError {
    message?: string;
    stack?: string;
}
export interface ReporterAttachment {
    name?: string;
    contentType?: string;
    path?: string;
    url?: string;
    inlineContentBase64?: string;
    inlineContentEncoding?: 'base64' | string;
    inlineContentSizeBytes?: number;
}
export interface ReporterStep {
    title?: string;
    category?: string;
    depth?: number;
    durationMs?: number;
    status?: string;
    failed?: boolean;
    error?: ReporterError;
}
export interface ReporterAttempt {
    attempt?: number;
    status?: string;
    durationMs?: number;
    startTime?: string;
    error?: ReporterError;
    attachments?: ReporterAttachment[];
    steps?: ReporterStep[];
    failedStepIndex?: number;
    failedStepTitle?: string;
}
export interface ReporterTest {
    id?: string;
    title?: string;
    status?: string;
    flaky?: boolean;
    durationMs?: number;
    location?: ReporterLocation;
    project?: string;
    browser?: string;
    retries?: number;
    errors?: ReporterError[];
    attempts?: ReporterAttempt[];
}
export interface ReporterEnvironment {
    playwrightVersion?: string;
    nodeVersion?: string;
    os?: string;
    workers?: number;
    retries?: number;
    projects?: string[];
}
export interface ReporterRoot {
    schemaVersion?: number;
    timestamp?: string;
    durationMs?: number;
    summary?: ReporterSummary;
    environment?: ReporterEnvironment;
    tests?: ReporterTest[];
}
export interface DashboardKpis {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    flakyTests: number;
    skippedTests: number;
    timedOutTests: number;
    interruptedTests: number;
    passRate: number;
    flakyRatio: number;
    totalDurationMs: number;
    medianDurationMs: number;
    errorClusterCount: number;
}
export interface DashboardChartDataset {
    labels: string[];
    values: number[];
}
export interface DashboardCurrentRunTest {
    title: string;
    file: string;
    project: string;
    status: string;
    flaky: boolean;
    durationMs: number;
    errorMessage: string | null;
    errorDetails?: string | null;
}
export interface DashboardCurrentRunTests {
    all: DashboardCurrentRunTest[];
    passed: DashboardCurrentRunTest[];
    failed: DashboardCurrentRunTest[];
    flaky: DashboardCurrentRunTest[];
    skipped: DashboardCurrentRunTest[];
    timedOut: DashboardCurrentRunTest[];
    interrupted: DashboardCurrentRunTest[];
}
export interface DashboardProblematicTest {
    title: string;
    file: string;
    project: string;
    status: string;
    flaky: boolean;
    durationMs: number;
    retries: number;
    attempts: number;
    failureRate: number;
    errorMessage: string;
    errorDetails?: string | null;
}
export interface DashboardErrorCluster {
    message: string;
    sampleMessage?: string;
    count: number;
    tests: string[];
}
export interface DashboardSlowTest {
    title: string;
    file: string;
    project: string;
    status: string;
    flaky: boolean;
    durationMs: number;
    errorMessage: string | null;
    errorDetails?: string | null;
}
export interface DashboardFlakyTestMetric {
    title: string;
    file: string;
    project: string;
    flakyScore: number;
    failRate: number;
    mtbfDays: number | null;
    unstableRuns: number;
    totalRuns: number;
    latestStatus: string;
    latestErrorMessage: string | null;
}
export interface DashboardFlakyResolutionMetric {
    days: number;
    title: string;
    file: string;
    project: string;
    detectedAt: string | null;
    fixedAt: string | null;
}
export interface DashboardBusinessTimeToDetectMetric {
    minutes: number | null;
    source: 'pendingIntegration';
}
export interface DashboardBusinessTimeToFixMetric {
    averageDays: number | null;
    resolvedIncidents: number;
}
export interface DashboardBusinessAutomationRoiMetric {
    percent: number | null;
    source: 'pendingAssumptions';
}
export interface DashboardPhaseBreakdownItem {
    label: string;
    durationMs: number;
    sharePercent: number;
}
export interface DashboardDurationBreakdownItem {
    label: string;
    durationMs: number;
    sharePercent: number;
    tests: number;
}
export interface DashboardAdvancedMetrics {
    performance: {
        p95DurationMs: number;
        p99DurationMs: number;
        slowestTests: DashboardSlowTest[];
        phaseBreakdown: DashboardPhaseBreakdownItem[];
        suiteDuration: DashboardDurationBreakdownItem[];
        durationPerBrowser: DashboardDurationBreakdownItem[];
        durationTrend: {
            currentDurationMs: number;
            previousDurationMs: number | null;
            deltaPercent: number | null;
        };
    };
    flakyAnalytics: {
        averageFlakyScore: number | null;
        averageMtbfDays: number | null;
        topFlakyTests: DashboardFlakyTestMetric[];
        firstFlakeToFix: DashboardFlakyResolutionMetric | null;
        flakyTrend: {
            currentFlakyTests: number;
            previousFlakyTests: number | null;
            delta: number | null;
        };
    };
    charts: {
        durationTrend: DashboardChartDataset;
        flakyTrend: DashboardChartDataset;
    };
    businessMetrics: {
        timeToDetect: DashboardBusinessTimeToDetectMetric;
        timeToFixFlaky: DashboardBusinessTimeToFixMetric;
        costOfFlakiness: {
            totalRub: number | null;
            ciCostRub: number | null;
            developerCostRub: number | null;
            extraRetryMinutes: number;
            extraRetries: number;
            unstableRuns: number;
            activeDays: number;
            costPerActiveDayRub: number | null;
            assumptions: {
                ciMinuteCostRub: number | null;
                developerHourlyCostRub: number | null;
                analysisMinutesPerUnstable: number | null;
            };
        };
        developerFriction: {
            rerunProxyPerActiveDay: number;
            extraRetries: number;
            unstableRuns: number;
            activeDays: number;
        };
        releaseConfidenceScore: number;
        automationRoi: DashboardBusinessAutomationRoiMetric;
    };
}
export interface DashboardManagerSignal {
    score: number;
    level: 'healthy' | 'warning' | 'critical';
}
export interface DashboardManagerBlocker {
    kind: 'release-confidence' | 'problematic-test' | 'flaky' | 'duration' | 'error-cluster' | 'history-coverage';
    severity: 'critical' | 'warning' | 'info';
    title: string;
    value: string;
    details: string;
    testTitle: string | null;
    project: string | null;
    file: string | null;
}
export interface DashboardManagerChange {
    label: string;
    value: string;
    details: string;
    direction: 'improving' | 'regressing' | 'stable';
}
export interface DashboardManagerSummary {
    releaseReadiness: DashboardManagerSignal;
    qualityRisk: DashboardManagerSignal;
    deliveryRisk: DashboardManagerSignal;
    blockers: DashboardManagerBlocker[];
    changes: DashboardManagerChange[];
}
export interface DashboardSummary {
    generatedAt: string;
    sourceFile: string;
    schemaVersion: number | null;
    reportTimestamp: string | null;
    notes: string[];
    runMetadata: DashboardRunMetadata;
    filters: DashboardFilters;
    availableFilters: DashboardAvailableFilters;
    environment: {
        playwrightVersion: string;
        nodeVersion: string;
        os: string;
        workers: number;
        retries: number;
        projects: string[];
    };
    kpis: DashboardKpis;
    charts: {
        passRateTrend: DashboardChartDataset;
        durationTrend: DashboardChartDataset;
        flakyTrend: DashboardChartDataset;
        statusDistribution: DashboardChartDataset;
        errorClusters: DashboardChartDataset;
        slowestTests: DashboardChartDataset;
    };
    trend: {
        previousRun: DashboardHistoryEntry | null;
        passRateDelta: number | null;
        failedTestsDelta: number | null;
        flakyTestsDelta: number | null;
        durationMsDelta: number | null;
    };
    comparison: {
        currentRun: DashboardHistoryEntry | null;
        previousRun: DashboardHistoryEntry | null;
    };
    history: {
        totalRuns: number;
        recentRuns: DashboardHistoryEntry[];
    };
    performance: DashboardAdvancedMetrics['performance'];
    flakyAnalytics: DashboardAdvancedMetrics['flakyAnalytics'];
    businessMetrics: DashboardAdvancedMetrics['businessMetrics'];
    managerSummary: DashboardManagerSummary;
    currentRunTests: DashboardCurrentRunTests;
    topProblematicTests: DashboardProblematicTest[];
    errorClusters: DashboardErrorCluster[];
}
export declare function loadReporterReport(reportPath: string): ReporterRoot;
export declare function enrichReporterReport(report: ReporterRoot): ReporterRoot;
export declare function readDashboardSummary(summaryPath: string): DashboardSummary;
export declare function normalizeDashboardSummary(summary: DashboardSummary): DashboardSummary;
export declare function ensureDirectoryForFile(filePath: string): void;
export declare function writeJsonFile(filePath: string, payload: unknown): void;
export declare function writeTextFile(filePath: string, payload: string): void;
export declare function buildDashboardSummary(report: ReporterRoot, sourceFile: string, historyRuns?: DashboardHistoryEntry[], runMetadata?: DashboardRunMetadata, advancedMetrics?: DashboardAdvancedMetrics | null, filters?: DashboardFilters, availableFilters?: DashboardAvailableFilters | null): DashboardSummary;
export declare function buildAdvancedMetrics(report: ReporterRoot, historyRuns: DashboardHistoryEntry[], archiveRootPath: string): DashboardAdvancedMetrics;
export declare function buildAdvancedMetricsFromArchivedRuns(report: ReporterRoot, historyRuns: DashboardHistoryEntry[], archivedRuns: Array<{
    run: DashboardHistoryEntry;
    report: ReporterRoot;
}>): DashboardAdvancedMetrics;
export declare function collectCurrentRunTests(tests: ReporterTest[]): DashboardCurrentRunTests;
