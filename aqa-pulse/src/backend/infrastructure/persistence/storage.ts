import * as path from 'node:path'
import type { DashboardSummary, ReporterRoot } from '../../../dashboard-utils'
import type { ArchivedRunMetadata, ArchivedRunRecord, DashboardHistory, DashboardHistoryEntry } from '../../../history-utils'
import type { SaasAppConfig } from '../../config'
import { PostgresBackendStorage, PostgresWorkspaceRegistryStorage, PostgresWorkspaceRunStorage } from '../../postgres-storage'
import { SqliteBackendStorage, SqliteWorkspaceRegistryStorage, SqliteWorkspaceRunStorage } from '../../sqlite-storage'
import type { WorkspacePaths, WorkspaceRegistrySnapshot } from '../../contracts'
import {
	FileSystemBackendStorage,
	FileSystemDashboardReadStorage,
	FileSystemWorkspaceRegistryStorage,
	FileSystemWorkspaceRunStorage,
} from './file-system-storage'

export { PostgresBackendStorage, PostgresWorkspaceRegistryStorage, PostgresWorkspaceRunStorage } from '../../postgres-storage'
export { SqliteBackendStorage, SqliteWorkspaceRegistryStorage, SqliteWorkspaceRunStorage } from '../../sqlite-storage'
export {
	FileSystemBackendStorage,
	FileSystemDashboardReadStorage,
	FileSystemWorkspaceRegistryStorage,
	FileSystemWorkspaceRunStorage,
} from './file-system-storage'

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

export function createBackendStorage(config: Pick<SaasAppConfig, 'storageDriver' | 'sqlitePath' | 'postgresConnectionString' | 'dataRoot'>): BackendStorage {
	if (config.storageDriver === 'postgres') {
		const postgresConnectionString = config.postgresConnectionString ?? process.env.AQA_PULSE_POSTGRES_URL

		if (!postgresConnectionString) {
			throw new Error('Для storageDriver=postgres требуется AQA_PULSE_POSTGRES_URL.')
		}

		return new PostgresBackendStorage(postgresConnectionString, config.dataRoot)
	}

	if (config.storageDriver === 'sqlite') {
		return new SqliteBackendStorage(config.sqlitePath ?? path.join(config.dataRoot, 'aqa-pulse.sqlite'), config.dataRoot)
	}

	return new FileSystemBackendStorage(config.dataRoot)
}
