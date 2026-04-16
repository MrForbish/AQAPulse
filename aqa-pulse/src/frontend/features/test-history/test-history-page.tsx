/**
 * Назначение: React-страница истории теста с conflict-state, diagnostics и timeline для standalone и server маршрутов.
 */
import React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useTestHistoryData } from '../../hooks/use-test-history'
import {
    buildArtifactBaseUrl,
    buildDashboardHref,
    buildTestHistoryApiUrl,
    readFiltersFromSearchParams,
    useRuntime,
} from '../../runtime'
import { ErrorView, LoadingView, PageFrame } from '../../shared/ui'
import { TestHistoryInsightsGrid } from './history-insights-grid'
import { ArchiveGapsNotice, IncidentSummaryPanel, TestHistoryHero, TestHistorySummaryMetrics } from './history-overview'
import { TestHistoryConflictState, TestHistoryNotFoundState } from './history-route-states'

/**
 * Страница принимает `requestedTitle` из router-слоя, а дальше сама решает, можно ли переиспользовать bootstrap payload или нужен повторный fetch/static resolve для нового URL.
 */
export function TestHistoryPage(props: { workspaceSlug: string | null; requestedTitle: string }): React.JSX.Element {
    const runtime = useRuntime()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const filters = readFiltersFromSearchParams(searchParams)
    const isStaticMode = runtime.route.kind === 'static-dashboard'
    const currentRequestUrl = `${location.pathname}${location.search}`
    const apiUrl = buildTestHistoryApiUrl(props.workspaceSlug, props.requestedTitle, filters)
    const artifactBasePath = buildArtifactBaseUrl(props.workspaceSlug)
    const bootstrapMatches = runtime.route.kind === 'test-history'
        && runtime.route.workspaceSlug === props.workspaceSlug
        && runtime.route.testName === props.requestedTitle
        && runtime.initialRequestUrl === currentRequestUrl
    const initialPayload = bootstrapMatches ? runtime.initialTestHistoryPayload : null

    const { payload, isLoading, errorMessage } = useTestHistoryData({
        workspaceSlug: props.workspaceSlug,
        apiUrl,
        currentRequestUrl,
        initialPayload,
        isStaticMode,
        branch: filters.branch,
        project: filters.project,
        file: filters.file,
        requestedTitle: props.requestedTitle,
    })

    if (isLoading && !payload && !errorMessage) {
        return (
            <PageFrame>
                <LoadingView label="Открываем историю теста..." />
            </PageFrame>
        )
    }

    if (errorMessage) {
        return (
            <PageFrame>
                <ErrorView title="Не удалось загрузить историю теста" message={errorMessage} />
            </PageFrame>
        )
    }

    if (!payload) {
        return <TestHistoryNotFoundState dashboardHref={buildDashboardHref(props.workspaceSlug, filters)} />
    }

    if ('candidates' in payload) {
        return (
            <TestHistoryConflictState
                payload={payload}
                buildCandidateHref={(candidate) => buildCandidateHref(props.workspaceSlug, candidate.title, filters, candidate.project, candidate.file)}
            />
        )
    }

    const dashboardHref = buildDashboardHref(props.workspaceSlug, filters)
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

function buildCandidateHref(
    workspaceSlug: string | null,
    title: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    project: string,
    file: string,
): string {
    const searchParams = new URLSearchParams()

    if (filters.branch) {
        searchParams.set('branch', filters.branch)
    }

    searchParams.set('project', project)
    searchParams.set('file', file)

    const pathname = workspaceSlug
        ? `/w/${encodeURIComponent(workspaceSlug)}/test/${encodeURIComponent(title)}`
        : `/test/${encodeURIComponent(title)}`

    return `${pathname}?${searchParams.toString()}`
}

