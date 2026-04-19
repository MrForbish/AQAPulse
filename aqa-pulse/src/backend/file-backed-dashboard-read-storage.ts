/**
 * Назначение: единый file-backed read storage для summary/history/archive, который нужен как fallback для static/default dashboard read-path независимо от выбранного workspace storage driver.
 */
import * as path from 'node:path'
import { readDashboardSummary, type DashboardSummary } from '../dashboard-utils'
import {
    findArchivedRunDirectory as findArchivedRunDirectoryInFiles,
    readArchivedRunRecord as readArchivedRunRecordFromFiles,
    readDashboardHistory,
    type ArchivedRunRecord,
    type DashboardHistory,
} from '../history-utils'
import type { DashboardReadStorage } from './infrastructure/persistence/storage-contracts'

export interface FileBackedDashboardReadStoragePaths {
    summaryPath: string
    historyPath: string
    archiveRootPath: string
}

/**
 * Нужен отдельным модулем, чтобы SQLite/Postgres backend не дублировали один и тот же file-based read helper и одинаково читали static/default dashboard artifacts.
 */
export class FileBackedDashboardReadStorage implements DashboardReadStorage {
    private readonly summaryPath: string
    private readonly historyPath: string
    private readonly archiveRootPath: string

    constructor(paths: Partial<FileBackedDashboardReadStoragePaths> = {}) {
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