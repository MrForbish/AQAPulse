/**
 * Назначение файла: выбирает и создаёт concrete backend storage implementation по runtime config.
 */
import * as path from 'node:path'
import type { SaasAppConfig } from '../../config'
import { PostgresBackendStorage, PostgresWorkspaceRegistryStorage, PostgresWorkspaceRunStorage } from '../../postgres-storage'
import { SqliteBackendStorage, SqliteWorkspaceRegistryStorage, SqliteWorkspaceRunStorage } from '../../sqlite-storage'
import {
	FileSystemBackendStorage,
	FileSystemDashboardReadStorage,
	FileSystemWorkspaceRegistryStorage,
	FileSystemWorkspaceRunStorage,
} from './file-system-storage'
export * from './storage-contracts'
import type { BackendStorage } from './storage-contracts'

export { PostgresBackendStorage, PostgresWorkspaceRegistryStorage, PostgresWorkspaceRunStorage } from '../../postgres-storage'
export { SqliteBackendStorage, SqliteWorkspaceRegistryStorage, SqliteWorkspaceRunStorage } from '../../sqlite-storage'
export {
	FileSystemBackendStorage,
	FileSystemDashboardReadStorage,
	FileSystemWorkspaceRegistryStorage,
	FileSystemWorkspaceRunStorage,
} from './file-system-storage'

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
