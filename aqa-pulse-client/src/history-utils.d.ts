import type { ReporterRoot } from './dashboard-utils'

export interface DashboardHistoryEntry {
    id: string
    reportTimestamp: string | null
    generatedAt: string
    sourceFile: string
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