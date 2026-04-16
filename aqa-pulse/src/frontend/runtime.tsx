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

export function readBootstrapFromDocument(documentRef: Document = document): FrontendBootstrapData {
    const scriptElement = documentRef.getElementById('aqa-pulse-bootstrap')
    return parseFrontendBootstrap(scriptElement?.textContent)
}

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

export function readFiltersFromSearchParams(searchParams: URLSearchParams): FrontendFilters {
    return readSharedFiltersFromSearchParams(searchParams)
}

export type FrontendFilters = QueryFilters