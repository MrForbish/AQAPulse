import { type DashboardSummary, type ReporterRoot } from '../dashboard-utils';
import { type ArchivedRunMetadata, type ArchivedRunRecord, type DashboardHistory, type DashboardHistoryEntry } from '../history-utils';
import { type FileBackedDashboardReadStoragePaths } from './file-backed-dashboard-read-storage';
import type { WorkspacePaths, WorkspaceRegistrySnapshot } from './contracts';
import type { DashboardReadStorage, WorkspaceRegistryStorage, WorkspaceRunStorage } from './storage';
export declare class SqliteWorkspaceRegistryStorage implements WorkspaceRegistryStorage {
    readonly registryPath: string;
    private readonly database;
    constructor(sqlitePath: string);
    readRegistry(): WorkspaceRegistrySnapshot;
    writeRegistry(snapshot: WorkspaceRegistrySnapshot): void;
}
export declare class SqliteWorkspaceRunStorage implements WorkspaceRunStorage, DashboardReadStorage {
    private readonly sqlitePath;
    private readonly workspaceSlug;
    readonly paths: WorkspacePaths;
    private readonly database;
    constructor(sqlitePath: string, workspaceSlug: string, dataRoot?: string);
    readSummary(): DashboardSummary;
    readHistory(): DashboardHistory;
    findArchivedRunDirectory(entryId: string): string | null;
    readArchivedRunRecord(runDirectory: string): ArchivedRunRecord;
    writeSummary(summary: DashboardSummary): void;
    writeHistory(history: DashboardHistory): void;
    archiveRun(report: ReporterRoot, entry: DashboardHistoryEntry): ArchivedRunMetadata;
    persistRawReport(runId: string, report: ReporterRoot): string;
}
export declare class SqliteBackendStorage {
    readonly sqlitePath: string;
    private readonly dataRoot;
    readonly registry: SqliteWorkspaceRegistryStorage;
    constructor(sqlitePath: string, dataRoot?: string);
    createDashboardReadStorage(paths?: Partial<FileBackedDashboardReadStoragePaths>): DashboardReadStorage;
    getWorkspaceStorage(slug: string): SqliteWorkspaceRunStorage;
}
