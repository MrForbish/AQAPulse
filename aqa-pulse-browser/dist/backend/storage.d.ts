import { type DashboardSummary, type ReporterRoot } from '../dashboard-utils';
import { type ArchivedRunMetadata, type ArchivedRunRecord, type DashboardHistory, type DashboardHistoryEntry } from '../history-utils';
import type { SaasAppConfig } from './config';
import type { WorkspacePaths, WorkspaceRegistrySnapshot } from './contracts';
export { PostgresBackendStorage, PostgresWorkspaceRegistryStorage, PostgresWorkspaceRunStorage } from './postgres-storage';
export { SqliteBackendStorage, SqliteWorkspaceRegistryStorage, SqliteWorkspaceRunStorage } from './sqlite-storage';
export interface DashboardStoragePaths {
    summaryPath: string;
    historyPath: string;
    archiveRootPath: string;
}
export interface DashboardReadStorage {
    readSummary(): DashboardSummary;
    readHistory(): DashboardHistory;
    findArchivedRunDirectory(entryId: string): string | null;
    readArchivedRunRecord(runDirectory: string): ArchivedRunRecord;
}
export interface WorkspaceRunStorage extends DashboardReadStorage {
    readonly paths: WorkspacePaths;
    writeSummary(summary: DashboardSummary): void;
    writeHistory(history: DashboardHistory): void;
    archiveRun(report: ReporterRoot, entry: DashboardHistoryEntry): ArchivedRunMetadata;
    persistRawReport(runId: string, report: ReporterRoot): string;
}
export interface WorkspaceRegistryStorage {
    readonly registryPath: string;
    readRegistry(): WorkspaceRegistrySnapshot;
    writeRegistry(snapshot: WorkspaceRegistrySnapshot): void;
}
export interface BackendStorage {
    readonly registry: WorkspaceRegistryStorage;
    createDashboardReadStorage(paths?: Partial<DashboardStoragePaths>): DashboardReadStorage;
    getWorkspaceStorage(slug: string): WorkspaceRunStorage;
}
export declare class FileSystemDashboardReadStorage implements DashboardReadStorage {
    protected readonly storagePaths: DashboardStoragePaths;
    constructor(storagePaths?: Partial<DashboardStoragePaths>);
    readSummary(): DashboardSummary;
    readHistory(): DashboardHistory;
    findArchivedRunDirectory(entryId: string): string | null;
    readArchivedRunRecord(runDirectory: string): ArchivedRunRecord;
}
export declare class FileSystemWorkspaceRunStorage extends FileSystemDashboardReadStorage implements WorkspaceRunStorage {
    readonly paths: WorkspacePaths;
    constructor(paths: WorkspacePaths);
    writeSummary(summary: DashboardSummary): void;
    writeHistory(history: DashboardHistory): void;
    archiveRun(report: ReporterRoot, entry: DashboardHistoryEntry): ArchivedRunMetadata;
    persistRawReport(runId: string, report: ReporterRoot): string;
}
export declare class FileSystemWorkspaceRegistryStorage implements WorkspaceRegistryStorage {
    readonly registryPath: string;
    constructor(registryPath?: string);
    readRegistry(): WorkspaceRegistrySnapshot;
    writeRegistry(snapshot: WorkspaceRegistrySnapshot): void;
}
export declare class FileSystemBackendStorage implements BackendStorage {
    readonly dataRoot: string;
    readonly registry: FileSystemWorkspaceRegistryStorage;
    constructor(dataRoot?: string);
    createDashboardReadStorage(paths?: Partial<DashboardStoragePaths>): FileSystemDashboardReadStorage;
    createWorkspaceStorage(slug: string, overrides?: Partial<WorkspacePaths>): FileSystemWorkspaceRunStorage;
    getWorkspaceStorage(slug: string): FileSystemWorkspaceRunStorage;
}
export declare function createBackendStorage(config: Pick<SaasAppConfig, 'storageDriver' | 'sqlitePath' | 'postgresConnectionString' | 'dataRoot'>): BackendStorage;
