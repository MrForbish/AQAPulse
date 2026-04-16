import { type DashboardSummary } from '../dashboard-utils';
import { type ArchivedRunRecord, type DashboardHistory } from '../history-utils';
import type { DashboardReadStorage } from './storage';
export interface FileBackedDashboardReadStoragePaths {
    summaryPath: string;
    historyPath: string;
    archiveRootPath: string;
}
/**
 * Нужен отдельным модулем, чтобы SQLite/Postgres backend не дублировали один и тот же file-based read helper и одинаково читали legacy/default dashboard artifacts.
 */
export declare class FileBackedDashboardReadStorage implements DashboardReadStorage {
    private readonly summaryPath;
    private readonly historyPath;
    private readonly archiveRootPath;
    constructor(paths?: Partial<FileBackedDashboardReadStoragePaths>);
    readSummary(): DashboardSummary;
    readHistory(): DashboardHistory;
    findArchivedRunDirectory(entryId: string): string | null;
    readArchivedRunRecord(runDirectory: string): ArchivedRunRecord;
}
