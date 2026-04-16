import type { TestHistoryConflict, TestHistoryResponse } from '../../../api-store'
import type { FrontendBootstrapData } from '../../../frontend-bootstrap'
import {
    buildArtifactBaseUrl,
    buildDashboardHref,
    buildTestHistoryApiUrl,
    readFiltersFromSearchParams,
    type FrontendFilters,
} from '../../runtime'

export interface TestHistoryRuntimeBootstrapState {
    isStaticMode: boolean
    initialPayload: TestHistoryResponse | TestHistoryConflict | null
}

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

export function resolveTestHistoryRuntimeBootstrap(props: {
    runtime: FrontendBootstrapData
    workspaceSlug: string | null
    requestedTitle: string
    currentRequestUrl: string
}): TestHistoryRuntimeBootstrapState {
    const isStaticMode = props.runtime.route.kind === 'static-dashboard'
    const bootstrapMatches = props.runtime.route.kind === 'test-history'
        && props.runtime.route.workspaceSlug === props.workspaceSlug
        && props.runtime.route.testName === props.requestedTitle
        && props.runtime.initialRequestUrl === props.currentRequestUrl

    return {
        isStaticMode,
        initialPayload: bootstrapMatches ? props.runtime.initialTestHistoryPayload : null,
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