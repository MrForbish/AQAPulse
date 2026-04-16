/**
 * Назначение: React-страница истории теста с conflict-state, diagnostics и timeline для standalone и server маршрутов.
 */
import React from 'react'
import { PageFrame } from '../../shared/ui'
import { useTestHistoryPageModel } from '../../hooks/use-test-history-page-model'
import { TestHistoryInsightsGrid } from './history-insights-grid'
import { IncidentSummaryPanel } from './history-incident-panels'
import { ArchiveGapsNotice, TestHistoryHero, TestHistorySummaryMetrics } from './history-overview'
import { buildTestHistoryCandidateHref } from './history-query-state'
import { TestHistoryConflictState, TestHistoryErrorState, TestHistoryLoadingState, TestHistoryNotFoundState } from './history-route-states'

/**
 * Страница принимает `requestedTitle` из router-слоя, а дальше сама решает, можно ли переиспользовать bootstrap payload или нужен повторный fetch/static resolve для нового URL.
 */
export function TestHistoryPage(props: { workspaceSlug: string | null; requestedTitle: string }): React.JSX.Element {
    const {
        filters,
        isStaticMode,
        apiUrl,
        artifactBasePath,
        dashboardHref,
        payload,
        isLoading,
        errorMessage,
    } = useTestHistoryPageModel(props.workspaceSlug, props.requestedTitle)

    if (isLoading && !payload && !errorMessage) {
        return <TestHistoryLoadingState />
    }

    if (errorMessage) {
        return <TestHistoryErrorState message={errorMessage} />
    }

    if (!payload) {
        return <TestHistoryNotFoundState dashboardHref={dashboardHref} />
    }

    if ('candidates' in payload) {
        return (
            <TestHistoryConflictState
                payload={payload}
                buildCandidateHref={(candidate) => buildTestHistoryCandidateHref(props.workspaceSlug, candidate.title, filters, candidate.project, candidate.file)}
            />
        )
    }

    return (
        <PageFrame>
            <TestHistoryHero payload={payload} dashboardHref={dashboardHref} apiUrl={apiUrl} />
            <TestHistorySummaryMetrics summary={payload.summary} />
            <ArchiveGapsNotice missingRuns={payload.missingRuns} />
            {payload.incidentSummary ? <IncidentSummaryPanel incidentSummary={payload.incidentSummary} history={payload.history} /> : null}
            <TestHistoryInsightsGrid payload={payload} artifactBasePath={artifactBasePath} isStaticMode={isStaticMode} />
        </PageFrame>
    )
}

