import * as path from 'node:path'
import {
    buildAdvancedMetrics,
    buildDashboardSummary,
    type DashboardRunMetadata,
    type ReporterRoot,
    writeJsonFile,
} from '../dashboard-utils'
import {
    appendHistoryEntry,
    archiveHistoryRun,
    buildHistoryEntryId,
} from '../history-utils'
import type { IngestionResult, WorkspaceDescriptor } from './contracts'
import type { WorkspaceRunStorage } from './storage'

export function ingestReporterRun(options: {
    workspace: WorkspaceDescriptor
    storage: WorkspaceRunStorage
    report: ReporterRoot
    metadata?: Partial<DashboardRunMetadata>
    sourceFile?: string
}): IngestionResult {
    const runMetadata: DashboardRunMetadata = {
        branch: normalizeOptionalText(options.metadata?.branch),
        commit: normalizeOptionalText(options.metadata?.commit),
        author: normalizeOptionalText(options.metadata?.author),
    }
    const sourceFile = options.sourceFile
        ? options.sourceFile
        : buildDefaultSourceFile(options.workspace.slug, options.report)

    const summaryWithoutHistory = buildDashboardSummary(options.report, sourceFile, [], runMetadata)
    const nextHistoryEntry = {
        id: buildHistoryEntryId(summaryWithoutHistory.reportTimestamp, sourceFile),
        reportTimestamp: summaryWithoutHistory.reportTimestamp,
        generatedAt: summaryWithoutHistory.generatedAt,
        sourceFile,
        branch: runMetadata.branch,
        commit: runMetadata.commit,
        author: runMetadata.author,
        totalTests: summaryWithoutHistory.kpis.totalTests,
        passedTests: summaryWithoutHistory.kpis.passedTests,
        failedTests: summaryWithoutHistory.kpis.failedTests,
        flakyTests: summaryWithoutHistory.kpis.flakyTests,
        skippedTests: summaryWithoutHistory.kpis.skippedTests,
        timedOutTests: summaryWithoutHistory.kpis.timedOutTests,
        interruptedTests: summaryWithoutHistory.kpis.interruptedTests,
        passRate: summaryWithoutHistory.kpis.passRate,
        flakyRatio: summaryWithoutHistory.kpis.flakyRatio,
        totalDurationMs: summaryWithoutHistory.kpis.totalDurationMs,
        medianDurationMs: summaryWithoutHistory.kpis.medianDurationMs,
        errorClusterCount: summaryWithoutHistory.kpis.errorClusterCount,
    }

    options.storage.persistRawReport(nextHistoryEntry.id, options.report)

    const history = appendHistoryEntry(options.storage.readHistory(), nextHistoryEntry)
    const archivedRun = options.storage.archiveRun(options.report, nextHistoryEntry)
    const advancedMetrics = buildAdvancedMetrics(options.report, history.runs, options.storage.paths.archiveRootPath)
    const dashboardSummary = buildDashboardSummary(options.report, sourceFile, history.runs, runMetadata, advancedMetrics)

    options.storage.writeSummary(dashboardSummary)
    options.storage.writeHistory(history)

    return {
        workspace: options.workspace,
        summaryPath: options.storage.paths.summaryPath,
        historyPath: options.storage.paths.historyPath,
        archivedRunDirectory: path.join(options.storage.paths.archiveRootPath, archivedRun.runDirectory),
        runId: nextHistoryEntry.id,
        sourceFile,
        summaryGeneratedAt: dashboardSummary.generatedAt,
    }
}


function buildDefaultSourceFile(workspaceSlug: string, report: ReporterRoot): string {
    const timestamp = normalizeOptionalText(report.timestamp) ?? new Date().toISOString()
    return `saas://${workspaceSlug}/ingestions/${timestamp}`
}

function normalizeOptionalText(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

