/**
 * Назначение: общий frontend runtime для bootstrap, navigation helpers и доступа к текущему route/session состоянию.
 */
import React from 'react'
import {
    createEmptyFrontendBootstrap,
    parseFrontendBootstrap,
    type FrontendBootstrapData,
} from '../frontend-bootstrap'
import {
    buildArtifactBaseUrl as buildSharedArtifactBaseUrl,
    buildSummaryApiUrl as buildSharedSummaryApiUrl,
    buildWorkspaceDashboardHref,
    buildWorkspaceTestHistoryHref,
    buildTestHistoryApiUrl as buildSharedTestHistoryApiUrl,
    readFiltersFromSearchParams as readSharedFiltersFromSearchParams,
    type QueryFilters,
} from '../shared/navigation'

const RuntimeContext = React.createContext<FrontendBootstrapData>(createEmptyFrontendBootstrap())

/**
 * Читает bootstrap из inline script в документе, чтобы React стартовал из server/static shell без отдельного prefetch запроса.
 */
export function readBootstrapFromDocument(documentRef: Document = document): FrontendBootstrapData {
    const scriptElement = documentRef.getElementById('aqa-pulse-bootstrap')
    return parseFrontendBootstrap(scriptElement?.textContent)
}

/**
 * Держит bootstrap как единый runtime context, чтобы feature-хуки и страницы не тащили напрямую DOM или глобалы браузера.
 */
export function RuntimeProvider(props: { bootstrap: FrontendBootstrapData; children: React.ReactNode }): React.JSX.Element {
    return <RuntimeContext.Provider value={props.bootstrap}>{props.children}</RuntimeContext.Provider>
}

export function useRuntime(): FrontendBootstrapData {
    return React.useContext(RuntimeContext)
}

export function buildDashboardHref(workspaceSlug: string | null, filters: FrontendFilters): string {
    return buildWorkspaceDashboardHref(workspaceSlug, filters)
}

export function buildSummaryApiUrl(workspaceSlug: string | null, filters: FrontendFilters): string {
    return buildSharedSummaryApiUrl(workspaceSlug, filters)
}

export function buildTestHistoryHref(workspaceSlug: string | null, testName: string, filters: FrontendFilters): string {
    return buildWorkspaceTestHistoryHref(workspaceSlug, testName, filters)
}

export function buildTestHistoryApiUrl(workspaceSlug: string | null, testName: string, filters: FrontendFilters): string {
    return buildSharedTestHistoryApiUrl(workspaceSlug, testName, filters)
}

export function buildArtifactBaseUrl(workspaceSlug: string | null): string {
    return buildSharedArtifactBaseUrl(workspaceSlug)
}

/**
 * Frontend читает фильтры тем же кодом, что и backend/legacy renderers, чтобы query-параметры не расходились между runtime слоями.
 */
export function readFiltersFromSearchParams(searchParams: URLSearchParams): FrontendFilters {
    return readSharedFiltersFromSearchParams(searchParams)
}

export type FrontendFilters = QueryFilters