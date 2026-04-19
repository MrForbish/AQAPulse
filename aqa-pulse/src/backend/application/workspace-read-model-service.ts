import { applyBusinessAssumptionsToSummary, buildDashboardSummary } from '../../dashboard-utils'
import { createEmptyHistory } from '../../history-utils'
import type { SaasAppConfig } from '../config'
import type { AdminIngestionHealthReport, WorkspaceIngestionHealthItem } from '../contracts'
import type { ReadModelWorkspaceRegistry, WorkspaceReadModelBackendStorage } from './workspace-read-model-ports'

export function ensureWorkspaceReadModelInitialized(slug: string, backendStorage: WorkspaceReadModelBackendStorage, config: SaasAppConfig): void {
    const workspaceStorage = backendStorage.getWorkspaceStorage(slug)
    const history = workspaceStorage.readHistory()

    try {
        workspaceStorage.readSummary()
    } catch {
        workspaceStorage.writeSummary(applyBusinessAssumptionsToSummary(buildDashboardSummary(
            {
                tests: [],
                durationMs: 0,
                environment: {
                    projects: [],
                },
            },
            `workspace://${slug}/initial-empty-summary`,
            history.runs,
            { branch: null, commit: null, author: null },
        ), config.businessAssumptions))
    }

    if (!Array.isArray(history.runs)) {
        workspaceStorage.writeHistory(createEmptyHistory())
    }
}

export function buildAdminIngestionHealthReport(
    registry: ReadModelWorkspaceRegistry,
    backendStorage: WorkspaceReadModelBackendStorage,
    config: SaasAppConfig,
): AdminIngestionHealthReport {
    const items = registry.listWorkspaces()
        .map((workspace) => buildWorkspaceIngestionHealthItem(workspace.slug, workspace.name, backendStorage, config))
        .sort((left, right) => compareWorkspaceHealthItems(left, right))

    return {
        generatedAt: new Date().toISOString(),
        totals: {
            total: items.length,
            healthy: items.filter((item) => item.status === 'healthy').length,
            warning: items.filter((item) => item.status === 'warning').length,
            critical: items.filter((item) => item.status === 'critical').length,
            stale: items.filter((item) => item.status === 'stale').length,
            idle: items.filter((item) => item.status === 'idle').length,
        },
        items,
    }
}

function buildWorkspaceIngestionHealthItem(
    slug: string,
    name: string,
    backendStorage: WorkspaceReadModelBackendStorage,
    config: SaasAppConfig,
): WorkspaceIngestionHealthItem {
    ensureWorkspaceReadModelInitialized(slug, backendStorage, config)
    const history = backendStorage.getWorkspaceStorage(slug).readHistory()
    const latestRun = history.runs[history.runs.length - 1] ?? null
    const latestTimestamp = latestRun?.generatedAt ?? latestRun?.reportTimestamp ?? null
    const latestTime = latestTimestamp ? Date.parse(latestTimestamp) : Number.NaN
    const staleHours = Number.isFinite(latestTime)
        ? Math.max(0, Math.floor((Date.now() - latestTime) / (60 * 60 * 1000)))
        : null

    return {
        slug,
        name,
        status: latestRun === null
            ? 'idle'
            : staleHours !== null && staleHours >= 72
                ? 'stale'
                : latestRun.failedTests > 0 || latestRun.timedOutTests > 0 || latestRun.interruptedTests > 0
                    ? 'critical'
                    : latestRun.flakyTests > 0 || latestRun.passRate < 100
                        ? 'warning'
                        : 'healthy',
        runCount: history.runs.length,
        lastIngestionAt: latestTimestamp,
        staleHours,
        latestPassRate: latestRun?.passRate ?? null,
        latestFailedTests: latestRun?.failedTests ?? null,
        latestFlakyTests: latestRun?.flakyTests ?? null,
        latestDurationMs: latestRun?.totalDurationMs ?? null,
        latestSourceFile: latestRun?.sourceFile ?? null,
    }
}

function compareWorkspaceHealthItems(left: WorkspaceIngestionHealthItem, right: WorkspaceIngestionHealthItem): number {
    const statusRank: Record<WorkspaceIngestionHealthItem['status'], number> = {
        critical: 0,
        warning: 1,
        stale: 2,
        idle: 3,
        healthy: 4,
    }

    if (statusRank[left.status] !== statusRank[right.status]) {
        return statusRank[left.status] - statusRank[right.status]
    }

    const leftTime = left.lastIngestionAt ? Date.parse(left.lastIngestionAt) : Number.NEGATIVE_INFINITY
    const rightTime = right.lastIngestionAt ? Date.parse(right.lastIngestionAt) : Number.NEGATIVE_INFINITY

    return rightTime - leftTime
}