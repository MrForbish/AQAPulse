/**
 * Назначение файла: содержит filesystem-specific helper functions для storage paths и raw report persistence.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ReporterRoot } from '../../../dashboard-utils'
import type { WorkspaceRegistrySnapshot } from '../../contracts'
import { getWorkspaceRegistryPathFromDataRoot, resolveWorkspaceDataRoot } from '../../workspace-paths'
import type { DashboardStoragePaths } from './storage-contracts'

const REGISTRY_SCHEMA_VERSION = 2

export function resolveDashboardStoragePaths(paths: Partial<DashboardStoragePaths> = {}): DashboardStoragePaths {
    return {
        summaryPath: path.resolve(process.cwd(), paths.summaryPath ?? process.env.AQA_PULSE_SUMMARY_PATH ?? './dist/dashboard-data.json'),
        historyPath: path.resolve(process.cwd(), paths.historyPath ?? process.env.AQA_PULSE_HISTORY_PATH ?? './dist/history.json'),
        archiveRootPath: path.resolve(process.cwd(), paths.archiveRootPath ?? process.env.AQA_PULSE_ARCHIVE_PATH ?? './history'),
    }
}

export function createEmptyRegistrySnapshot(): WorkspaceRegistrySnapshot {
    return {
        schemaVersion: REGISTRY_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        adminSessions: [],
        adminAuditLog: [],
        serverSettings: null,
        workspaces: [],
    }
}

export function getDefaultRegistryPath(): string {
    return getWorkspaceRegistryPathFromDataRoot(resolveWorkspaceDataRoot())
}

export function getRegistryPathForDataRoot(dataRoot: string): string {
    return getWorkspaceRegistryPathFromDataRoot(dataRoot)
}

export function readFileSystemRegistrySnapshot(registryPath: string): WorkspaceRegistrySnapshot {
    if (!fs.existsSync(registryPath)) {
        return createEmptyRegistrySnapshot()
    }

    const text = fs.readFileSync(registryPath, 'utf8')
    const parsed = JSON.parse(text) as Partial<WorkspaceRegistrySnapshot>

    return {
        schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : REGISTRY_SCHEMA_VERSION,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        adminSessions: Array.isArray(parsed.adminSessions) ? parsed.adminSessions : [],
        adminAuditLog: Array.isArray(parsed.adminAuditLog) ? parsed.adminAuditLog : [],
        serverSettings: parsed.serverSettings && typeof parsed.serverSettings === 'object' ? parsed.serverSettings : null,
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
    }
}

export function writeFileSystemRegistrySnapshot(registryPath: string, snapshot: WorkspaceRegistrySnapshot): void {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true })
    fs.writeFileSync(registryPath, `${JSON.stringify({
        ...snapshot,
        updatedAt: new Date().toISOString(),
    }, null, 2)}\n`, 'utf8')
}

export function persistRawReportToFileSystem(rawReportsPath: string, runId: string, report: ReporterRoot): string {
    fs.mkdirSync(rawReportsPath, { recursive: true })
    const normalizedRunId = runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'run'
    const rawReportPath = path.join(rawReportsPath, `${normalizedRunId}.json`)

    fs.writeFileSync(rawReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    return rawReportPath
}