import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DatabaseSync as NodeSqliteDatabaseSync } from 'node:sqlite'
import { normalizeDashboardSummary, readDashboardSummary, type DashboardSummary, type ReporterRoot } from '../dashboard-utils'
import {
    createEmptyHistory,
    findArchivedRunDirectory as findArchivedRunDirectoryInFiles,
    readArchivedRunRecord as readArchivedRunRecordFromFiles,
    readDashboardHistory,
    type ArchivedRunMetadata,
    type ArchivedRunRecord,
    type DashboardHistory,
    type DashboardHistoryEntry,
} from '../history-utils'
import type { WorkspacePaths, WorkspaceRegistrySnapshot } from './contracts'
import type { DashboardReadStorage, WorkspaceRegistryStorage, WorkspaceRunStorage } from './storage'

const REGISTRY_SCHEMA_VERSION = 1

type SqliteDatabase = NodeSqliteDatabaseSync

export class SqliteWorkspaceRegistryStorage implements WorkspaceRegistryStorage {
    readonly registryPath: string
    private readonly database: SqliteDatabase

    constructor(sqlitePath: string) {
        this.registryPath = path.resolve(sqlitePath)
        this.database = openSqliteDatabase(this.registryPath)
        ensureSchema(this.database)
    }

    readRegistry(): WorkspaceRegistrySnapshot {
        const statement = this.database.prepare('SELECT value_json FROM aqa_kv WHERE namespace = ? AND key = ?')
        const row = statement.get('registry', 'snapshot') as { value_json?: string } | undefined

        if (!row?.value_json) {
            return createEmptyRegistry()
        }

        const parsed = JSON.parse(row.value_json) as Partial<WorkspaceRegistrySnapshot>

        return {
            schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : REGISTRY_SCHEMA_VERSION,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
            workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
        }
    }

    writeRegistry(snapshot: WorkspaceRegistrySnapshot): void {
        upsertJson(this.database, 'registry', 'snapshot', {
            ...snapshot,
            updatedAt: new Date().toISOString(),
        })
    }
}

export class SqliteWorkspaceRunStorage implements WorkspaceRunStorage, DashboardReadStorage {
    readonly paths: WorkspacePaths
    private readonly database: SqliteDatabase

    constructor(private readonly sqlitePath: string, private readonly workspaceSlug: string) {
        this.database = openSqliteDatabase(sqlitePath)
        ensureSchema(this.database)
        this.paths = buildSqliteWorkspacePaths(sqlitePath, workspaceSlug)
    }

    readSummary(): DashboardSummary {
        const summary = readJsonValue<DashboardSummary>(this.database, buildWorkspaceNamespace(this.workspaceSlug, 'summary'), 'current')

        if (!summary) {
            throw new Error(`Не найден summary для workspace "${this.workspaceSlug}" в SQLite storage.`)
        }

        return normalizeDashboardSummary(summary)
    }

    readHistory(): DashboardHistory {
        return readJsonValue<DashboardHistory>(this.database, buildWorkspaceNamespace(this.workspaceSlug, 'history'), 'current') ?? createEmptyHistory()
    }

    findArchivedRunDirectory(entryId: string): string | null {
        const runDirectory = buildRunDirectoryKey(entryId)
        const exists = readJsonValue<ArchivedRunRecord>(this.database, buildWorkspaceNamespace(this.workspaceSlug, 'archive'), runDirectory)
            ? runDirectory
            : null

        return exists
    }

    readArchivedRunRecord(runDirectory: string): ArchivedRunRecord {
        const record = readJsonValue<ArchivedRunRecord>(this.database, buildWorkspaceNamespace(this.workspaceSlug, 'archive'), runDirectory)

        if (!record) {
            throw new Error(`Не найден архивный прогон "${runDirectory}" для workspace "${this.workspaceSlug}" в SQLite storage.`)
        }

        return record
    }

    writeSummary(summary: DashboardSummary): void {
        upsertJson(this.database, buildWorkspaceNamespace(this.workspaceSlug, 'summary'), 'current', summary)
    }

    writeHistory(history: DashboardHistory): void {
        upsertJson(this.database, buildWorkspaceNamespace(this.workspaceSlug, 'history'), 'current', history)
    }

    archiveRun(report: ReporterRoot, entry: DashboardHistoryEntry): ArchivedRunMetadata {
        const runDirectory = buildRunDirectoryKey(entry.id)
        const metadata: ArchivedRunMetadata = {
            schemaVersion: 1,
            id: entry.id,
            runDirectory,
            dataFile: 'sqlite:data',
            metadataFile: 'sqlite:metadata',
            reportTimestamp: entry.reportTimestamp,
            generatedAt: entry.generatedAt,
            sourceFile: entry.sourceFile,
            branch: entry.branch,
            commit: entry.commit,
            author: entry.author,
            kpis: {
                totalTests: entry.totalTests,
                passedTests: entry.passedTests,
                failedTests: entry.failedTests,
                flakyTests: entry.flakyTests,
                skippedTests: entry.skippedTests,
                timedOutTests: entry.timedOutTests,
                interruptedTests: entry.interruptedTests,
                passRate: entry.passRate,
                flakyRatio: entry.flakyRatio,
                totalDurationMs: entry.totalDurationMs,
                medianDurationMs: entry.medianDurationMs,
                errorClusterCount: entry.errorClusterCount,
            },
        }

        upsertJson(this.database, buildWorkspaceNamespace(this.workspaceSlug, 'archive'), runDirectory, {
            metadata,
            data: report,
        } satisfies ArchivedRunRecord)

        return metadata
    }

    persistRawReport(runId: string, report: ReporterRoot): string {
        const rawKey = buildRunDirectoryKey(runId)
        upsertJson(this.database, buildWorkspaceNamespace(this.workspaceSlug, 'raw-report'), rawKey, report)
        return `${this.paths.rawReportsPath}/${rawKey}.json`
    }
}

export class SqliteBackendStorage {
    readonly registry: SqliteWorkspaceRegistryStorage

    constructor(public readonly sqlitePath: string) {
        this.registry = new SqliteWorkspaceRegistryStorage(sqlitePath)
    }

    createDashboardReadStorage(paths: Partial<{ summaryPath: string; historyPath: string; archiveRootPath: string }> = {}): DashboardReadStorage {
        return new LegacyFileDashboardReadStorage(paths)
    }

    getWorkspaceStorage(slug: string): SqliteWorkspaceRunStorage {
        return new SqliteWorkspaceRunStorage(this.sqlitePath, slug)
    }
}

class LegacyFileDashboardReadStorage implements DashboardReadStorage {
    private readonly summaryPath: string
    private readonly historyPath: string
    private readonly archiveRootPath: string

    constructor(paths: Partial<{ summaryPath: string; historyPath: string; archiveRootPath: string }> = {}) {
        this.summaryPath = path.resolve(process.cwd(), paths.summaryPath ?? process.env.AQA_PULSE_SUMMARY_PATH ?? './dist/dashboard-data.json')
        this.historyPath = path.resolve(process.cwd(), paths.historyPath ?? process.env.AQA_PULSE_HISTORY_PATH ?? './dist/history.json')
        this.archiveRootPath = path.resolve(process.cwd(), paths.archiveRootPath ?? process.env.AQA_PULSE_ARCHIVE_PATH ?? './history')
    }

    readSummary(): DashboardSummary {
        return readDashboardSummary(this.summaryPath)
    }

    readHistory(): DashboardHistory {
        return readDashboardHistory(this.historyPath)
    }

    findArchivedRunDirectory(entryId: string): string | null {
        return findArchivedRunDirectoryInFiles(this.archiveRootPath, entryId)
    }

    readArchivedRunRecord(runDirectory: string): ArchivedRunRecord {
        return readArchivedRunRecordFromFiles(this.archiveRootPath, runDirectory)
    }
}

function ensureSchema(database: SqliteDatabase): void {
    database.exec(`
        CREATE TABLE IF NOT EXISTS aqa_kv (
            namespace TEXT NOT NULL,
            key TEXT NOT NULL,
            value_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (namespace, key)
        )
    `)
}

function upsertJson(database: SqliteDatabase, namespace: string, key: string, value: unknown): void {
    const statement = database.prepare(`
        INSERT INTO aqa_kv (namespace, key, value_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(namespace, key) DO UPDATE SET
            value_json = excluded.value_json,
            updated_at = excluded.updated_at
    `)

    statement.run(namespace, key, JSON.stringify(value), new Date().toISOString())
}

function readJsonValue<T>(database: SqliteDatabase, namespace: string, key: string): T | null {
    const statement = database.prepare('SELECT value_json FROM aqa_kv WHERE namespace = ? AND key = ?')
    const row = statement.get(namespace, key) as { value_json?: string } | undefined
    return row?.value_json ? JSON.parse(row.value_json) as T : null
}

function buildWorkspaceNamespace(slug: string, entity: string): string {
    return `workspace:${slug}:${entity}`
}

function buildRunDirectoryKey(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'run'
}

function buildSqliteWorkspacePaths(sqlitePath: string, slug: string): WorkspacePaths {
    const resolvedPath = path.resolve(sqlitePath).replace(/\\/g, '/')
    const baseUri = `sqlite://${resolvedPath}`

    return {
        rootPath: `${baseUri}#workspace=${slug}`,
        distPath: `${baseUri}#workspace=${slug}/dist`,
        summaryPath: `${baseUri}#workspace=${slug}/dist/dashboard-data.json`,
        historyPath: `${baseUri}#workspace=${slug}/dist/history.json`,
        archiveRootPath: `${baseUri}#workspace=${slug}/history`,
        rawReportsPath: `${baseUri}#workspace=${slug}/raw-reports`,
    }
}

function createEmptyRegistry(): WorkspaceRegistrySnapshot {
    return {
        schemaVersion: REGISTRY_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        workspaces: [],
    }
}

function openSqliteDatabase(sqlitePath: string): SqliteDatabase {
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true })
    const sqliteModule = require('node:sqlite') as typeof import('node:sqlite')
    return new sqliteModule.DatabaseSync(sqlitePath)
}



