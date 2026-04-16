import {
    buildArtifactBaseUrl as buildSharedArtifactBaseUrl,
    buildSummaryApiUrl as buildSharedSummaryApiUrl,
    buildWorkspaceDashboardHref,
    buildWorkspaceTestHistoryHref,
    buildTestHistoryApiUrl as buildSharedTestHistoryApiUrl,
    readFiltersFromSearchParams as readSharedFiltersFromSearchParams,
    type QueryFilters,
} from '../shared/navigation'

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