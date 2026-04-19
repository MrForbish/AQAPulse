/**
 * Назначение файла: содержит file-system реализации dashboard/workspace storage и registry persistence.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
    readDashboardSummary,
    type DashboardSummary,
    type ReporterRoot,
    writeJsonFile,
} from '../../../dashboard-utils'
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
} from '../../../history-utils'
import type { WorkspacePaths, WorkspaceRegistrySnapshot } from '../../contracts'
import { getWorkspacePathsFromDataRoot, resolveWorkspaceDataRoot } from '../../workspace-paths'
import type {
    BackendStorage,
    DashboardReadStorage,
    DashboardStoragePaths,
    WorkspaceRegistryStorage,
    WorkspaceRunStorage,
} from './storage-contracts'
import {
    getDefaultRegistryPath,
    getRegistryPathForDataRoot,
    persistRawReportToFileSystem,
    readFileSystemRegistrySnapshot,
    resolveDashboardStoragePaths,
    writeFileSystemRegistrySnapshot,
} from './storage-support'

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
        return persistRawReportToFileSystem(this.paths.rawReportsPath, runId, report)
    }
}

export class FileSystemWorkspaceRegistryStorage implements WorkspaceRegistryStorage {
    constructor(public readonly registryPath = getDefaultRegistryPath()) {}

    readRegistry(): WorkspaceRegistrySnapshot {
        return readFileSystemRegistrySnapshot(this.registryPath)
    }

    writeRegistry(snapshot: WorkspaceRegistrySnapshot): void {
        writeFileSystemRegistrySnapshot(this.registryPath, snapshot)
    }
}

export class FileSystemBackendStorage implements BackendStorage {
    readonly registry: FileSystemWorkspaceRegistryStorage

    constructor(public readonly dataRoot = resolveWorkspaceDataRoot()) {
        this.registry = new FileSystemWorkspaceRegistryStorage(getRegistryPathForDataRoot(dataRoot))
    }

    createDashboardReadStorage(paths: Partial<DashboardStoragePaths> = {}): FileSystemDashboardReadStorage {
        return new FileSystemDashboardReadStorage(paths)
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

    renameWorkspaceData(previousSlug: string, nextSlug: string): void {
        if (previousSlug === nextSlug) {
            return
        }

        const previousPaths = getWorkspacePathsFromDataRoot(previousSlug, this.dataRoot)
        const nextPaths = getWorkspacePathsFromDataRoot(nextSlug, this.dataRoot)

        if (!fs.existsSync(previousPaths.rootPath)) {
            return
        }

        fs.mkdirSync(path.dirname(nextPaths.rootPath), { recursive: true })

        if (fs.existsSync(nextPaths.rootPath)) {
            throw new Error(`Невозможно переименовать workspace data: путь "${nextPaths.rootPath}" уже существует.`)
        }

        fs.renameSync(previousPaths.rootPath, nextPaths.rootPath)
    }

    deleteWorkspaceData(slug: string): void {
        const workspacePaths = getWorkspacePathsFromDataRoot(slug, this.dataRoot)

        if (fs.existsSync(workspacePaths.rootPath)) {
            fs.rmSync(workspacePaths.rootPath, { recursive: true, force: true })
        }
    }
}