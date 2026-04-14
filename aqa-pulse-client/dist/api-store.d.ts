import { type DashboardFilters, type DashboardSummary } from './dashboard-utils';
import { type DashboardHistory, type DashboardHistoryEntry } from './history-utils';
import { type DashboardReadStorage } from './backend/storage';
export interface ApiStoreOptions {
    summaryPath?: string;
    historyPath?: string;
    archiveRootPath?: string;
    storage?: DashboardReadStorage;
}
export interface ApiFilters {
    branch?: string;
    project?: string;
    file?: string;
}
export interface DashboardRunResponse {
    run: DashboardHistoryEntry;
    fullSummary: DashboardSummary | null;
}
export interface TestHistoryFilters {
    project?: string;
    file?: string;
}
export interface TestHistoryItem {
    runId: string;
    reportTimestamp: string | null;
    generatedAt: string;
    branch: string | null;
    commit: string | null;
    author: string | null;
    status: string;
    flaky: boolean;
    durationMs: number;
    retries: number;
    attempts: number;
    errorMessage: string | null;
}
export interface TestHistoryResponse {
    test: {
        title: string;
        file: string;
        project: string;
    };
    summary: {
        totalRuns: number;
        failedRuns: number;
        flakyRuns: number;
        passRate: number;
        latestStatus: string | null;
        failRate: number;
        flakyScore: number;
        mtbfDays: number | null;
    };
    latestRun: TestHistoryItem | null;
    history: TestHistoryItem[];
    missingRuns: string[];
}
export interface TestHistoryConflict {
    message: string;
    candidates: Array<{
        title: string;
        file: string;
        project: string;
    }>;
}
export declare class ApiStore {
    private readonly storage;
    constructor(options?: ApiStoreOptions);
    getSummary(): DashboardSummary;
    getFilteredSummary(filters?: ApiFilters): DashboardSummary;
    getHistory(): DashboardHistory;
    getRuns(filters?: ApiFilters): DashboardHistoryEntry[];
    getRunById(id: string): DashboardRunResponse | null;
    getFlakyPayload(filters?: ApiFilters): {
        totalFlakyTests: number;
        flakyRatio: number;
        averageFlakyScore: number | null;
        averageMtbfDays: number | null;
        firstFlakeToFix: import("./dashboard-utils").DashboardFlakyResolutionMetric | null;
        trend: {
            currentFlakyTests: number;
            previousFlakyTests: number | null;
            delta: number | null;
        };
        tests: import("./dashboard-utils").DashboardFlakyTestMetric[];
    };
    getErrorClustersPayload(filters?: ApiFilters): {
        totalClusters: number;
        clusters: import("./dashboard-utils").DashboardErrorCluster[];
    };
    getCostMetricsPayload(filters?: ApiFilters): {
        filters: DashboardFilters;
        totalCostRub: number | null;
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
    getTestHistory(name: string, filters?: TestHistoryFilters & ApiFilters): TestHistoryResponse | TestHistoryConflict | null;
    private buildFilteredContext;
}
