import React from 'react'
import {
    createEmptyFrontendBootstrap,
    parseFrontendBootstrap,
    type FrontendBootstrapData,
} from '../frontend-bootstrap'

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
    const pathname = workspaceSlug ? `/w/${encodeURIComponent(workspaceSlug)}` : '/'
    const query = buildQueryString(filters)
    return query ? `${pathname}?${query}` : pathname
}

export function buildSummaryApiUrl(workspaceSlug: string | null, filters: FrontendFilters): string {
    const pathname = workspaceSlug ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/summary` : '/api/summary'
    const query = buildQueryString(filters)
    return query ? `${pathname}?${query}` : pathname
}

export function buildTestHistoryHref(workspaceSlug: string | null, testName: string, filters: FrontendFilters): string {
    const basePath = workspaceSlug
        ? `/w/${encodeURIComponent(workspaceSlug)}/test/${encodeURIComponent(testName)}`
        : `/test/${encodeURIComponent(testName)}`
    const query = buildQueryString(filters)
    return query ? `${basePath}?${query}` : basePath
}

export function buildTestHistoryApiUrl(workspaceSlug: string | null, testName: string, filters: FrontendFilters): string {
    const basePath = workspaceSlug
        ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/test/${encodeURIComponent(testName)}`
        : `/api/test/${encodeURIComponent(testName)}`
    const query = buildQueryString(filters)
    return query ? `${basePath}?${query}` : basePath
}

export function buildArtifactBaseUrl(workspaceSlug: string | null): string {
    return workspaceSlug
        ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/artifacts`
        : '/api/artifacts'
}

export function readFiltersFromSearchParams(searchParams: URLSearchParams): FrontendFilters {
    return {
        branch: normalizeQueryValue(searchParams.get('branch')),
        project: normalizeQueryValue(searchParams.get('project')),
        file: normalizeQueryValue(searchParams.get('file')),
    }
}

export interface FrontendFilters {
    branch?: string | null
    project?: string | null
    file?: string | null
}

function buildQueryString(filters: FrontendFilters): string {
    const searchParams = new URLSearchParams()

    if (filters.branch) {
        searchParams.set('branch', filters.branch)
    }

    if (filters.project) {
        searchParams.set('project', filters.project)
    }

    if (filters.file) {
        searchParams.set('file', filters.file)
    }

    return searchParams.toString()
}

function normalizeQueryValue(value: string | null): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}