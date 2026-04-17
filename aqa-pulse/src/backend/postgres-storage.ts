import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
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
import type { DashboardReadStorage, WorkspaceRegistryStorage, WorkspaceRunStorage } from './storage'
import { getWorkspacePathsFromDataRoot, resolveWorkspaceDataRoot } from './workspace-paths'

const REGISTRY_SCHEMA_VERSION = 2

export class PostgresWorkspaceRegistryStorage implements WorkspaceRegistryStorage {
    readonly registryPath: string

    constructor(private readonly connectionString: string) {
        this.registryPath = connectionString
        ensureSchema(connectionString)
    }

    readRegistry(): WorkspaceRegistrySnapshot {
        const row = getJsonValue<Partial<WorkspaceRegistrySnapshot>>(this.connectionString, 'registry', 'snapshot')

        if (!row) {
            return createEmptyRegistry()
        }

        return {
            schemaVersion: typeof row.schemaVersion === 'number' ? row.schemaVersion : REGISTRY_SCHEMA_VERSION,
            updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
            adminSessions: Array.isArray(row.adminSessions) ? row.adminSessions : [],
            workspaces: Array.isArray(row.workspaces) ? row.workspaces : [],
        }
    }

    writeRegistry(snapshot: WorkspaceRegistrySnapshot): void {
        upsertJsonValue(this.connectionString, 'registry', 'snapshot', {
            ...snapshot,
            updatedAt: new Date().toISOString(),
        })
    }
}

export class PostgresWorkspaceRunStorage implements WorkspaceRunStorage, DashboardReadStorage {
    readonly paths: WorkspacePaths

    constructor(private readonly connectionString: string, private readonly workspaceSlug: string, dataRoot = resolveWorkspaceDataRoot()) {
        ensureSchema(connectionString)
        this.paths = buildPostgresWorkspacePaths(connectionString, workspaceSlug, dataRoot)
    }

    readSummary(): DashboardSummary {
        const summary = getJsonValue<DashboardSummary>(this.connectionString, buildWorkspaceNamespace(this.workspaceSlug, 'summary'), 'current')

        if (!summary) {
            throw new Error(`Не найден summary для workspace "${this.workspaceSlug}" в Postgres storage.`)
        }

        return normalizeDashboardSummary(summary)
    }

    readHistory(): DashboardHistory {
        return getJsonValue<DashboardHistory>(this.connectionString, buildWorkspaceNamespace(this.workspaceSlug, 'history'), 'current') ?? createEmptyHistory()
    }

    findArchivedRunDirectory(entryId: string): string | null {
        const runDirectory = buildRunDirectoryKey(entryId)
        return getJsonValue<ArchivedRunRecord>(this.connectionString, buildWorkspaceNamespace(this.workspaceSlug, 'archive'), runDirectory)
            ? runDirectory
            : null
    }

    readArchivedRunRecord(runDirectory: string): ArchivedRunRecord {
        const record = getJsonValue<ArchivedRunRecord>(this.connectionString, buildWorkspaceNamespace(this.workspaceSlug, 'archive'), runDirectory)

        if (!record) {
            throw new Error(`Не найден архивный прогон "${runDirectory}" для workspace "${this.workspaceSlug}" в Postgres storage.`)
        }

        return record
    }

    writeSummary(summary: DashboardSummary): void {
        upsertJsonValue(this.connectionString, buildWorkspaceNamespace(this.workspaceSlug, 'summary'), 'current', summary)
    }

    writeHistory(history: DashboardHistory): void {
        upsertJsonValue(this.connectionString, buildWorkspaceNamespace(this.workspaceSlug, 'history'), 'current', history)
    }

    archiveRun(report: ReporterRoot, entry: DashboardHistoryEntry): ArchivedRunMetadata {
        const runDirectory = buildRunDirectoryKey(entry.id)
        const metadata: ArchivedRunMetadata = {
            schemaVersion: 1,
            id: entry.id,
            runDirectory,
            dataFile: 'postgres:data',
            metadataFile: 'postgres:metadata',
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

        upsertJsonValue(this.connectionString, buildWorkspaceNamespace(this.workspaceSlug, 'archive'), runDirectory, {
            metadata,
            data: report,
        } satisfies ArchivedRunRecord)

        return metadata
    }

    persistRawReport(runId: string, report: ReporterRoot): string {
        const rawKey = buildRunDirectoryKey(runId)
        upsertJsonValue(this.connectionString, buildWorkspaceNamespace(this.workspaceSlug, 'raw-report'), rawKey, report)
        return `${this.paths.rawReportsPath}/${rawKey}.json`
    }
}

export class PostgresBackendStorage {
    readonly registry: PostgresWorkspaceRegistryStorage

    constructor(public readonly connectionString: string, private readonly dataRoot = resolveWorkspaceDataRoot()) {
        this.registry = new PostgresWorkspaceRegistryStorage(connectionString)
    }

    createDashboardReadStorage(paths: Partial<FileBackedDashboardReadStoragePaths> = {}): DashboardReadStorage {
        return new FileBackedDashboardReadStorage(paths)
    }

    getWorkspaceStorage(slug: string): PostgresWorkspaceRunStorage {
        return new PostgresWorkspaceRunStorage(this.connectionString, slug, this.dataRoot)
    }
}

function ensureSchema(connectionString: string): void {
    execPsql(connectionString, `
        CREATE TABLE IF NOT EXISTS aqa_kv (
            namespace TEXT NOT NULL,
            key TEXT NOT NULL,
            value_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (namespace, key)
        );
    `)
}

function upsertJsonValue(connectionString: string, namespace: string, key: string, value: unknown): void {
    const escapedNamespace = escapeSqlLiteral(namespace)
    const escapedKey = escapeSqlLiteral(key)
    const escapedValue = escapeSqlLiteral(JSON.stringify(value))

    execPsql(connectionString, `
        INSERT INTO aqa_kv (namespace, key, value_json, updated_at)
        VALUES ('${escapedNamespace}', '${escapedKey}', '${escapedValue}'::jsonb, NOW())
        ON CONFLICT (namespace, key) DO UPDATE SET
            value_json = EXCLUDED.value_json,
            updated_at = EXCLUDED.updated_at;
    `)
}

function getJsonValue<T>(connectionString: string, namespace: string, key: string): T | null {
    const escapedNamespace = escapeSqlLiteral(namespace)
    const escapedKey = escapeSqlLiteral(key)
    const output = execPsql(connectionString, `
        SELECT value_json::text
        FROM aqa_kv
        WHERE namespace = '${escapedNamespace}' AND key = '${escapedKey}'
        LIMIT 1;
    `, { tuplesOnly: true })

    const normalizedOutput = output.trim()
    return normalizedOutput ? JSON.parse(normalizedOutput) as T : null
}

function execPsql(
    connectionString: string,
    sql: string,
    options: { tuplesOnly?: boolean } = {},
): string {
    const args = [connectionString, '-v', 'ON_ERROR_STOP=1']

    if (options.tuplesOnly) {
        args.push('-t', '-A')
    }

    args.push('-c', sql)

    const result = spawnSync('psql', args, {
        encoding: 'utf8',
        env: process.env,
    })

    if (result.error) {
        throw new Error(`Не удалось запустить psql: ${result.error.message}`)
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`Postgres command failed: ${result.stderr || result.stdout}`)
    }

    return result.stdout ?? ''
}

function escapeSqlLiteral(value: string): string {
    return value.replace(/'/g, "''")
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

function buildPostgresWorkspacePaths(connectionString: string, slug: string, dataRoot: string): WorkspacePaths {
    const baseUri = connectionString.replace(/\s+/g, '')
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
        workspaces: [],
    }
}

