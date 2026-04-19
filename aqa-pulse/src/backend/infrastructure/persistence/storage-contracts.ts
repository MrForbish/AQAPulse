/**
 * Назначение файла: объявляет persistence contracts для backend storage, registry и workspace data access.
 */
import type { DashboardSummary, ReporterRoot } from '../../../dashboard-utils'
import type { ArchivedRunMetadata, ArchivedRunRecord, DashboardHistory, DashboardHistoryEntry } from '../../../history-utils'
import type { WorkspacePaths, WorkspaceRegistrySnapshot } from '../../contracts'

export interface DashboardStoragePaths {
	summaryPath: string
	historyPath: string
	archiveRootPath: string
}

export interface DashboardReadStorage {
	readSummary(): DashboardSummary
	readHistory(): DashboardHistory
	findArchivedRunDirectory(entryId: string): string | null
	readArchivedRunRecord(runDirectory: string): ArchivedRunRecord
}

export interface WorkspaceRunStorage extends DashboardReadStorage {
	readonly paths: WorkspacePaths
	writeSummary(summary: DashboardSummary): void
	writeHistory(history: DashboardHistory): void
	archiveRun(report: ReporterRoot, entry: DashboardHistoryEntry): ArchivedRunMetadata
	persistRawReport(runId: string, report: ReporterRoot): string
}

export interface WorkspaceRegistryStorage {
	readonly registryPath: string
	readRegistry(): WorkspaceRegistrySnapshot
	writeRegistry(snapshot: WorkspaceRegistrySnapshot): void
}

export interface BackendStorage {
	readonly registry: WorkspaceRegistryStorage
	createDashboardReadStorage(paths?: Partial<DashboardStoragePaths>): DashboardReadStorage
	getWorkspaceStorage(slug: string): WorkspaceRunStorage
	renameWorkspaceData(previousSlug: string, nextSlug: string): void
	deleteWorkspaceData(slug: string): void
}