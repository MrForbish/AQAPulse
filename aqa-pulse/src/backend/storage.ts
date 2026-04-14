import * as fs from 'node:fs'
import * as path from 'node:path'
import {
    readDashboardSummary,
    type DashboardSummary,
    type ReporterRoot,
    writeJsonFile,
} from '../dashboard-utils'
import {
    archiveHistoryRun,
    findArchivedRunDirectory,
    readArchivedRunRecord,
    readDashboardHistory,
    type ArchivedRunMetadata,
    type ArchivedRunRecord,
    type DashboardHistory,
    type DashboardHistoryEntry,
    writeDashboardHistory,
} from '../history-utils'
import type { SaasAppConfig } from './config'
import type { WorkspacePaths, WorkspaceRegistrySnapshot } from './contracts'
import { PostgresBackendStorage, PostgresWorkspaceRegistryStorage, PostgresWorkspaceRunStorage } from './postgres-storage'
import { SqliteBackendStorage, SqliteWorkspaceRegistryStorage, SqliteWorkspaceRunStorage } from './sqlite-storage'
import { getWorkspacePathsFromDataRoot, getWorkspaceRegistryPathFromDataRoot, resolveWorkspaceDataRoot } from './workspace-paths'

export { PostgresBackendStorage, PostgresWorkspaceRegistryStorage, PostgresWorkspaceRunStorage } from './postgres-storage'
export { SqliteBackendStorage, SqliteWorkspaceRegistryStorage, SqliteWorkspaceRunStorage } from './sqlite-storage'

const REGISTRY_SCHEMA_VERSION = 1

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
}

export class FileSystemDashboardReadStorage implements DashboardReadStorage {
    protected readonly storagePaths: DashboardStoragePaths

    constructor(storagePaths: Partial<DashboardStoragePaths> = {}) {
        this.storagePaths = resolveDashboardStoragePaths(storagePaths)
    }

    readSummary(): DashboardSummary {
        return readDashboardSummary(this.storagePaths.summaryPath)
    }

    readHistory(): DashboardHistory {
        return readDashboardHistory(this.storagePaths.historyPath)
    }

    findArchivedRunDirectory(entryId: string): string | null {
        return findArchivedRunDirectory(this.storagePaths.archiveRootPath, entryId)
    }

    readArchivedRunRecord(runDirectory: string): ArchivedRunRecord {
        return readArchivedRunRecord(this.storagePaths.archiveRootPath, runDirectory)
    }
}

export class FileSystemWorkspaceRunStorage extends FileSystemDashboardReadStorage implements WorkspaceRunStorage {
    constructor(public readonly paths: WorkspacePaths) {
        super(paths)
    }

    writeSummary(summary: DashboardSummary): void {
        writeJsonFile(this.paths.summaryPath, summary)
    }

    writeHistory(history: DashboardHistory): void {
        writeDashboardHistory(this.paths.historyPath, history)
    }

    archiveRun(report: ReporterRoot, entry: DashboardHistoryEntry): ArchivedRunMetadata {
        return archiveHistoryRun(this.paths.archiveRootPath, report, entry)
    }

    persistRawReport(runId: string, report: ReporterRoot): string {
        fs.mkdirSync(this.paths.rawReportsPath, { recursive: true })
        const normalizedRunId = runId
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'run'
        const rawReportPath = path.join(this.paths.rawReportsPath, `${normalizedRunId}.json`)

        fs.writeFileSync(rawReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
        return rawReportPath
    }
}

export class FileSystemWorkspaceRegistryStorage implements WorkspaceRegistryStorage {
    constructor(public readonly registryPath = getWorkspaceRegistryPathFromDataRoot(resolveWorkspaceDataRoot())) {}

    readRegistry(): WorkspaceRegistrySnapshot {
        if (!fs.existsSync(this.registryPath)) {
            return createEmptyRegistry()
        }

        const text = fs.readFileSync(this.registryPath, 'utf8')
        const parsed = JSON.parse(text) as Partial<WorkspaceRegistrySnapshot>

        return {
            schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : REGISTRY_SCHEMA_VERSION,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
            workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
        }
    }

    writeRegistry(snapshot: WorkspaceRegistrySnapshot): void {
        fs.mkdirSync(path.dirname(this.registryPath), { recursive: true })
        fs.writeFileSync(this.registryPath, `${JSON.stringify({
            ...snapshot,
            updatedAt: new Date().toISOString(),
        }, null, 2)}\n`, 'utf8')
    }
}

export class FileSystemBackendStorage implements BackendStorage {
    readonly registry: FileSystemWorkspaceRegistryStorage

    constructor(public readonly dataRoot = resolveWorkspaceDataRoot()) {
        this.registry = new FileSystemWorkspaceRegistryStorage(getWorkspaceRegistryPathFromDataRoot(dataRoot))
    }

    createDashboardReadStorage(paths: Partial<DashboardStoragePaths> = {}): FileSystemDashboardReadStorage {
        return new FileSystemDashboardReadStorage(resolveDashboardStoragePaths(paths))
    }

    createWorkspaceStorage(slug: string, overrides: Partial<WorkspacePaths> = {}): FileSystemWorkspaceRunStorage {
        const basePaths = getWorkspacePathsFromDataRoot(slug, this.dataRoot)

        return new FileSystemWorkspaceRunStorage({
            ...basePaths,
            ...overrides,
        })
    }

    getWorkspaceStorage(slug: string): FileSystemWorkspaceRunStorage {
        return this.createWorkspaceStorage(slug)
    }
}

export function createBackendStorage(config: Pick<SaasAppConfig, 'storageDriver' | 'sqlitePath' | 'postgresConnectionString' | 'dataRoot'>): BackendStorage {
    if (config.storageDriver === 'postgres') {
        const postgresConnectionString = config.postgresConnectionString ?? process.env.AQA_PULSE_POSTGRES_URL

        if (!postgresConnectionString) {
            throw new Error('Для storageDriver=postgres требуется AQA_PULSE_POSTGRES_URL.')
        }

        return new PostgresBackendStorage(postgresConnectionString)
    }

    if (config.storageDriver === 'sqlite') {
        return new SqliteBackendStorage(config.sqlitePath ?? path.join(config.dataRoot, 'aqa-pulse.sqlite'))
    }

    return new FileSystemBackendStorage(config.dataRoot)
}

function resolveDashboardStoragePaths(paths: Partial<DashboardStoragePaths> = {}): DashboardStoragePaths {
    return {
        summaryPath: path.resolve(process.cwd(), paths.summaryPath ?? process.env.AQA_PULSE_SUMMARY_PATH ?? './dist/dashboard-data.json'),
        historyPath: path.resolve(process.cwd(), paths.historyPath ?? process.env.AQA_PULSE_HISTORY_PATH ?? './dist/history.json'),
        archiveRootPath: path.resolve(process.cwd(), paths.archiveRootPath ?? process.env.AQA_PULSE_ARCHIVE_PATH ?? './history'),
    }
}

function createEmptyRegistry(): WorkspaceRegistrySnapshot {
    return {
        schemaVersion: REGISTRY_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        workspaces: [],
    }
}


