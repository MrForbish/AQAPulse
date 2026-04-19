/**
 * Назначение файла: содержит SQLite-backed реализации backend storage и registry persistence.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DatabaseSync as NodeSqliteDatabaseSync } from 'node:sqlite'
import { normalizeDashboardSummary, type DashboardSummary, type ReporterRoot } from '../dashboard-utils'
import {
    createEmptyHistory,
    type ArchivedRunMetadata,
    type ArchivedRunRecord,
    type DashboardHistory,
    type DashboardHistoryEntry,
} from '../history-utils'
import { FileBackedDashboardReadStorage, type FileBackedDashboardReadStoragePaths } from './file-backed-dashboard-read-storage'
import type { WorkspacePaths, WorkspaceRegistrySnapshot } from './contracts'
import type { DashboardReadStorage, WorkspaceRegistryStorage, WorkspaceRunStorage } from './infrastructure/persistence/storage-contracts'
import { getWorkspacePathsFromDataRoot, resolveWorkspaceDataRoot } from './workspace-paths'

const REGISTRY_SCHEMA_VERSION = 2

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
            adminSessions: Array.isArray(parsed.adminSessions) ? parsed.adminSessions : [],
            adminAuditLog: Array.isArray(parsed.adminAuditLog) ? parsed.adminAuditLog : [],
            serverSettings: parsed.serverSettings && typeof parsed.serverSettings === 'object' ? parsed.serverSettings : null,
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

    constructor(private readonly sqlitePath: string, private readonly workspaceSlug: string, dataRoot = resolveWorkspaceDataRoot(path.dirname(sqlitePath))) {
        this.database = openSqliteDatabase(sqlitePath)
        ensureSchema(this.database)
        this.paths = buildSqliteWorkspacePaths(sqlitePath, workspaceSlug, dataRoot)
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
            comparisonKey: entry.comparisonKey,
            comparisonLabel: entry.comparisonLabel,
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

    constructor(public readonly sqlitePath: string, private readonly dataRoot = resolveWorkspaceDataRoot(path.dirname(sqlitePath))) {
        this.registry = new SqliteWorkspaceRegistryStorage(sqlitePath)
    }

    createDashboardReadStorage(paths: Partial<FileBackedDashboardReadStoragePaths> = {}): DashboardReadStorage {
        return new FileBackedDashboardReadStorage(paths)
    }

    getWorkspaceStorage(slug: string): SqliteWorkspaceRunStorage {
        return new SqliteWorkspaceRunStorage(this.sqlitePath, slug, this.dataRoot)
    }

    renameWorkspaceData(previousSlug: string, nextSlug: string): void {
        if (previousSlug === nextSlug) {
            return
        }

        const database = openSqliteDatabase(this.sqlitePath)
        ensureSchema(database)

        const previousPrefix = `workspace:${previousSlug}:`
        const nextPrefix = `workspace:${nextSlug}:`
        const statement = database.prepare(`
            UPDATE aqa_kv
            SET namespace = REPLACE(namespace, ?, ?), updated_at = ?
            WHERE namespace LIKE ?
        `)

        statement.run(previousPrefix, nextPrefix, new Date().toISOString(), `${previousPrefix}%`)
        moveWorkspaceDirectoryIfNeeded(this.dataRoot, previousSlug, nextSlug)
    }

    deleteWorkspaceData(slug: string): void {
        const database = openSqliteDatabase(this.sqlitePath)
        ensureSchema(database)
        database.prepare('DELETE FROM aqa_kv WHERE namespace LIKE ?').run(`workspace:${slug}:%`)
        deleteWorkspaceDirectoryIfPresent(this.dataRoot, slug)
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

function buildSqliteWorkspacePaths(sqlitePath: string, slug: string, dataRoot: string): WorkspacePaths {
    const resolvedPath = path.resolve(sqlitePath).replace(/\\/g, '/')
    const baseUri = `sqlite://${resolvedPath}`
    const fileSystemPaths = getWorkspacePathsFromDataRoot(slug, dataRoot)

    return {
        rootPath: `${baseUri}#workspace=${slug}`,
        distPath: `${baseUri}#workspace=${slug}/dist`,
        summaryPath: `${baseUri}#workspace=${slug}/dist/dashboard-data.json`,
        historyPath: `${baseUri}#workspace=${slug}/dist/history.json`,
        archiveRootPath: `${baseUri}#workspace=${slug}/history`,
        rawReportsPath: `${baseUri}#workspace=${slug}/raw-reports`,
        artifactsPath: fileSystemPaths.artifactsPath,
    }
}

function createEmptyRegistry(): WorkspaceRegistrySnapshot {
    return {
        schemaVersion: REGISTRY_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        adminSessions: [],
        adminAuditLog: [],
        serverSettings: null,
        workspaces: [],
    }
}

function moveWorkspaceDirectoryIfNeeded(dataRoot: string, previousSlug: string, nextSlug: string): void {
    const previousPaths = getWorkspacePathsFromDataRoot(previousSlug, dataRoot)
    const nextPaths = getWorkspacePathsFromDataRoot(nextSlug, dataRoot)

    if (!fs.existsSync(previousPaths.rootPath)) {
        return
    }

    fs.mkdirSync(path.dirname(nextPaths.rootPath), { recursive: true })

    if (fs.existsSync(nextPaths.rootPath)) {
        throw new Error(`Невозможно переименовать workspace data: путь "${nextPaths.rootPath}" уже существует.`)
    }

    fs.renameSync(previousPaths.rootPath, nextPaths.rootPath)
}

function deleteWorkspaceDirectoryIfPresent(dataRoot: string, slug: string): void {
    const workspacePaths = getWorkspacePathsFromDataRoot(slug, dataRoot)

    if (fs.existsSync(workspacePaths.rootPath)) {
        fs.rmSync(workspacePaths.rootPath, { recursive: true, force: true })
    }
}

function openSqliteDatabase(sqlitePath: string): SqliteDatabase {
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true })
    const sqliteModule = require('node:sqlite') as typeof import('node:sqlite')
    return new sqliteModule.DatabaseSync(sqlitePath)
}



