import * as fs from 'node:fs'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import type { ReporterRoot } from './dashboard-utils'

export interface DashboardHistoryEntry {
    id: string
    reportTimestamp: string | null
    generatedAt: string
    sourceFile: string
    comparisonKey: string | null
    comparisonLabel: string | null
    branch: string | null
    commit: string | null
    author: string | null
    totalTests: number
    passedTests: number
    failedTests: number
    flakyTests: number
    skippedTests: number
    timedOutTests: number
    interruptedTests: number
    passRate: number
    flakyRatio: number
    totalDurationMs: number
    medianDurationMs: number
    errorClusterCount: number
}

export interface DashboardHistory {
    schemaVersion: number
    updatedAt: string
    runs: DashboardHistoryEntry[]
}

export interface ArchivedRunMetadata {
    schemaVersion: number
    id: string
    runDirectory: string
    dataFile: string
    metadataFile: string
    reportTimestamp: string | null
    generatedAt: string
    sourceFile: string
    comparisonKey: string | null
    comparisonLabel: string | null
    branch: string | null
    commit: string | null
    author: string | null
    kpis: {
        totalTests: number
        passedTests: number
        failedTests: number
        flakyTests: number
        skippedTests: number
        timedOutTests: number
        interruptedTests: number
        passRate: number
        flakyRatio: number
        totalDurationMs: number
        medianDurationMs: number
        errorClusterCount: number
    }
}

export interface ArchivedRunRecord {
    metadata: ArchivedRunMetadata
    data: ReporterRoot
}

const DEFAULT_SCHEMA_VERSION = 2
const ARCHIVE_SCHEMA_VERSION = 1
const DEFAULT_HISTORY_LIMIT = 20

export function readDashboardHistory(historyPath: string): DashboardHistory {
    if (!fs.existsSync(historyPath)) {
        return createEmptyHistory()
    }

    try {
        const historyText = fs.readFileSync(historyPath, 'utf8')
        const parsedHistory = JSON.parse(historyText) as Partial<DashboardHistory>

        return {
            schemaVersion: typeof parsedHistory.schemaVersion === 'number' ? parsedHistory.schemaVersion : DEFAULT_SCHEMA_VERSION,
            updatedAt: typeof parsedHistory.updatedAt === 'string' ? parsedHistory.updatedAt : new Date().toISOString(),
            runs: Array.isArray(parsedHistory.runs)
                ? parsedHistory.runs.map(normalizeHistoryEntry)
                : [],
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Не удалось прочитать history-файл из \"${historyPath}\": ${errorMessage}`)
    }
}

function normalizeHistoryEntry(run: Partial<DashboardHistoryEntry>): DashboardHistoryEntry {
    return {
        id: typeof run.id === 'string' ? run.id : buildHistoryEntryId(run.reportTimestamp ?? null, run.sourceFile ?? 'unknown'),
        reportTimestamp: typeof run.reportTimestamp === 'string' ? run.reportTimestamp : null,
        generatedAt: typeof run.generatedAt === 'string' ? run.generatedAt : new Date().toISOString(),
        sourceFile: typeof run.sourceFile === 'string' ? run.sourceFile : 'unknown',
        comparisonKey: typeof run.comparisonKey === 'string' ? run.comparisonKey : null,
        comparisonLabel: typeof run.comparisonLabel === 'string' ? run.comparisonLabel : null,
        branch: typeof run.branch === 'string' ? run.branch : null,
        commit: typeof run.commit === 'string' ? run.commit : null,
        author: typeof run.author === 'string' ? run.author : null,
        totalTests: typeof run.totalTests === 'number' ? run.totalTests : 0,
        passedTests: typeof run.passedTests === 'number' ? run.passedTests : 0,
        failedTests: typeof run.failedTests === 'number' ? run.failedTests : 0,
        flakyTests: typeof run.flakyTests === 'number' ? run.flakyTests : 0,
        skippedTests: typeof run.skippedTests === 'number' ? run.skippedTests : 0,
        timedOutTests: typeof run.timedOutTests === 'number' ? run.timedOutTests : 0,
        interruptedTests: typeof run.interruptedTests === 'number' ? run.interruptedTests : 0,
        passRate: typeof run.passRate === 'number' ? run.passRate : 0,
        flakyRatio: typeof run.flakyRatio === 'number' ? run.flakyRatio : 0,
        totalDurationMs: typeof run.totalDurationMs === 'number' ? run.totalDurationMs : 0,
        medianDurationMs: typeof run.medianDurationMs === 'number' ? run.medianDurationMs : 0,
        errorClusterCount: typeof run.errorClusterCount === 'number' ? run.errorClusterCount : 0,
    }
}

export function appendHistoryEntry(
    history: DashboardHistory,
    entry: DashboardHistoryEntry,
    limit = DEFAULT_HISTORY_LIMIT,
): DashboardHistory {
    const runsWithoutDuplicate = history.runs.filter((run) => run.id !== entry.id)
    const nextRuns = [...runsWithoutDuplicate, entry]
        .sort(compareHistoryEntries)
        .slice(-limit)

    return {
        schemaVersion: history.schemaVersion,
        updatedAt: new Date().toISOString(),
        runs: nextRuns,
    }
}

export function writeDashboardHistory(historyPath: string, history: DashboardHistory): void {
    fs.mkdirSync(path.dirname(historyPath), { recursive: true })
    fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8')
}

export function archiveHistoryRun(
    archiveRootPath: string,
    reportPayload: unknown,
    entry: DashboardHistoryEntry,
): ArchivedRunMetadata {
    fs.mkdirSync(archiveRootPath, { recursive: true })

    const existingRunDirectory = findArchivedRunDirectoryById(archiveRootPath, entry.id)
    const runDirectory = existingRunDirectory ?? buildUniqueRunDirectoryName(archiveRootPath, entry)
    const runDirectoryPath = path.join(archiveRootPath, runDirectory)
    const dataFileName = 'data.json'
    const metadataFileName = 'metadata.json'
    const dataFilePath = path.join(runDirectoryPath, dataFileName)
    const metadataFilePath = path.join(runDirectoryPath, metadataFileName)

    fs.mkdirSync(runDirectoryPath, { recursive: true })
    fs.writeFileSync(dataFilePath, `${JSON.stringify(reportPayload, null, 2)}\n`, 'utf8')

    const metadata: ArchivedRunMetadata = {
        schemaVersion: ARCHIVE_SCHEMA_VERSION,
        id: entry.id,
        runDirectory,
        dataFile: dataFileName,
        metadataFile: metadataFileName,
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

    fs.writeFileSync(metadataFilePath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')

    return metadata
}

export function readArchivedRunMetadata(metadataFilePath: string): ArchivedRunMetadata {
    const metadataText = fs.readFileSync(metadataFilePath, 'utf8')
    return JSON.parse(metadataText) as ArchivedRunMetadata
}

export function readArchivedRunRecord(archiveRootPath: string, runDirectory: string): ArchivedRunRecord {
    const runDirectoryPath = path.join(archiveRootPath, runDirectory)
    const metadataFilePath = path.join(runDirectoryPath, 'metadata.json')
    const dataFilePath = path.join(runDirectoryPath, 'data.json')

    if (!fs.existsSync(metadataFilePath)) {
        throw new Error(`Не найден metadata.json для архивного прогона: \"${runDirectoryPath}\".`)
    }

    if (!fs.existsSync(dataFilePath)) {
        throw new Error(`Не найден data.json для архивного прогона: \"${runDirectoryPath}\".`)
    }

    const metadata = readArchivedRunMetadata(metadataFilePath)
    const dataText = fs.readFileSync(dataFilePath, 'utf8')
    const data = JSON.parse(dataText) as ReporterRoot

    return {
        metadata,
        data,
    }
}

export function findArchivedRunDirectory(archiveRootPath: string, entryId: string): string | null {
    return findArchivedRunDirectoryById(archiveRootPath, entryId)
}

export function listArchivedRunDirectories(archiveRootPath: string): string[] {
    if (!fs.existsSync(archiveRootPath)) {
        return []
    }

    return fs.readdirSync(archiveRootPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
}

export function buildHistoryEntryId(reportTimestamp: string | null, sourceFile: string): string {
    return `${reportTimestamp ?? 'no-timestamp'}::${sourceFile}`
}

export function createEmptyHistory(): DashboardHistory {
    return {
        schemaVersion: DEFAULT_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        runs: [],
    }
}

function compareHistoryEntries(left: DashboardHistoryEntry, right: DashboardHistoryEntry): number {
    const leftTime = getEntryTime(left)
    const rightTime = getEntryTime(right)

    if (leftTime !== rightTime) {
        return leftTime - rightTime
    }

    return left.id.localeCompare(right.id)
}

function getEntryTime(entry: DashboardHistoryEntry): number {
    const reportTime = entry.reportTimestamp ? new Date(entry.reportTimestamp).getTime() : Number.NaN

    if (Number.isFinite(reportTime)) {
        return reportTime
    }

    const generatedTime = new Date(entry.generatedAt).getTime()

    if (Number.isFinite(generatedTime)) {
        return generatedTime
    }

    return 0
}

function findArchivedRunDirectoryById(archiveRootPath: string, entryId: string): string | null {
    if (!fs.existsSync(archiveRootPath)) {
        return null
    }

    for (const directoryEntry of fs.readdirSync(archiveRootPath, { withFileTypes: true })) {
        if (!directoryEntry.isDirectory()) {
            continue
        }

        const metadataFilePath = path.join(archiveRootPath, directoryEntry.name, 'metadata.json')

        if (!fs.existsSync(metadataFilePath)) {
            continue
        }

        try {
            const metadataText = fs.readFileSync(metadataFilePath, 'utf8')
            const metadata = JSON.parse(metadataText) as Partial<ArchivedRunMetadata>

            if (metadata.id === entryId) {
                return directoryEntry.name
            }
        } catch {
            continue
        }
    }

    return null
}

function buildUniqueRunDirectoryName(archiveRootPath: string, entry: DashboardHistoryEntry): string {
    const baseDirectoryName = formatArchiveDirectoryName(entry.reportTimestamp ?? entry.generatedAt)
    const preferredDirectoryPath = path.join(archiveRootPath, baseDirectoryName)

    if (!fs.existsSync(preferredDirectoryPath)) {
        return baseDirectoryName
    }

    const hashedSuffix = createHash('sha1').update(entry.id).digest('hex').slice(0, 8)
    return `${baseDirectoryName}--${hashedSuffix}`
}

function formatArchiveDirectoryName(timestamp: string): string {
    const date = new Date(timestamp)

    if (Number.isNaN(date.getTime())) {
        return 'unknown-run'
    }

    const year = date.getFullYear()
    const month = padNumber(date.getMonth() + 1)
    const day = padNumber(date.getDate())
    const hours = padNumber(date.getHours())
    const minutes = padNumber(date.getMinutes())
    const seconds = padNumber(date.getSeconds())

    return `${year}-${month}-${day}--${hours}-${minutes}-${seconds}`
}

function padNumber(value: number): string {
    return String(value).padStart(2, '0')
}

