import type { TestHistoryConflict, TestHistoryResponse } from '../../../api-store'
import {
    buildArtifactBaseUrl,
    buildDashboardHref,
    buildTestHistoryApiUrl,
    readFiltersFromSearchParams,
    type FrontendFilters,
} from '../../navigation'

export interface TestHistoryDataRequestPreparation {
    filters: FrontendFilters
    artifactBasePath: string
    dashboardHref: string
    testHistoryDataRequest: {
        workspaceSlug: string | null
        apiUrl: string
        currentRequestUrl: string
        branch?: string | null
        project?: string | null
        file?: string | null
        requestedTitle: string
    }
}

export function prepareTestHistoryDataRequest(props: {
    workspaceSlug: string | null
    requestedTitle: string
    searchParams: URLSearchParams
    currentRequestUrl: string
}): TestHistoryDataRequestPreparation {
    const filters = readFiltersFromSearchParams(props.searchParams)

    return {
        filters,
        artifactBasePath: buildArtifactBaseUrl(props.workspaceSlug),
        dashboardHref: buildDashboardHref(props.workspaceSlug, filters),
        testHistoryDataRequest: {
            workspaceSlug: props.workspaceSlug,
            apiUrl: buildTestHistoryApiUrl(props.workspaceSlug, props.requestedTitle, filters),
            currentRequestUrl: props.currentRequestUrl,
            branch: filters.branch,
            project: filters.project,
            file: filters.file,
            requestedTitle: props.requestedTitle,
        },
    }
}