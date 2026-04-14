import type { ReporterRoot } from './dashboard-utils';
export interface DashboardHistoryEntry {
    id: string;
    reportTimestamp: string | null;
    generatedAt: string;
    sourceFile: string;
    branch: string | null;
    commit: string | null;
    author: string | null;
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
export interface DashboardHistory {
    schemaVersion: number;
    updatedAt: string;
    runs: DashboardHistoryEntry[];
}
export interface ArchivedRunMetadata {
    schemaVersion: number;
    id: string;
    runDirectory: string;
    dataFile: string;
    metadataFile: string;
    reportTimestamp: string | null;
    generatedAt: string;
    sourceFile: string;
    branch: string | null;
    commit: string | null;
    author: string | null;
    kpis: {
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
    };
}
export interface ArchivedRunRecord {
    metadata: ArchivedRunMetadata;
    data: ReporterRoot;
}
export declare function readDashboardHistory(historyPath: string): DashboardHistory;
export declare function appendHistoryEntry(history: DashboardHistory, entry: DashboardHistoryEntry, limit?: number): DashboardHistory;
export declare function writeDashboardHistory(historyPath: string, history: DashboardHistory): void;
export declare function archiveHistoryRun(archiveRootPath: string, reportPayload: unknown, entry: DashboardHistoryEntry): ArchivedRunMetadata;
export declare function readArchivedRunMetadata(metadataFilePath: string): ArchivedRunMetadata;
export declare function readArchivedRunRecord(archiveRootPath: string, runDirectory: string): ArchivedRunRecord;
export declare function findArchivedRunDirectory(archiveRootPath: string, entryId: string): string | null;
export declare function listArchivedRunDirectories(archiveRootPath: string): string[];
export declare function buildHistoryEntryId(reportTimestamp: string | null, sourceFile: string): string;
export declare function createEmptyHistory(): DashboardHistory;
