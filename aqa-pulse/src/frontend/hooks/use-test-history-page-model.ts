import { useLocation, useSearchParams } from 'react-router-dom'
import { useTestHistoryData } from './use-test-history'
import {
    buildArtifactBaseUrl,
    buildDashboardHref,
    buildTestHistoryApiUrl,
    readFiltersFromSearchParams,
    useRuntime,
} from '../runtime'

export function useTestHistoryPageModel(workspaceSlug: string | null, requestedTitle: string): {
    filters: ReturnType<typeof readFiltersFromSearchParams>
    isStaticMode: boolean
    apiUrl: string
    artifactBasePath: string
    dashboardHref: string
    payload: ReturnType<typeof useTestHistoryData>['payload']
    isLoading: boolean
    errorMessage: string | null
} {
    const runtime = useRuntime()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const filters = readFiltersFromSearchParams(searchParams)
    const isStaticMode = runtime.route.kind === 'static-dashboard'
    const currentRequestUrl = `${location.pathname}${location.search}`
    const apiUrl = buildTestHistoryApiUrl(workspaceSlug, requestedTitle, filters)
    const artifactBasePath = buildArtifactBaseUrl(workspaceSlug)
    const dashboardHref = buildDashboardHref(workspaceSlug, filters)
    const bootstrapMatches = runtime.route.kind === 'test-history'
        && runtime.route.workspaceSlug === workspaceSlug
        && runtime.route.testName === requestedTitle
        && runtime.initialRequestUrl === currentRequestUrl
    const initialPayload = bootstrapMatches ? runtime.initialTestHistoryPayload : null
    const { payload, isLoading, errorMessage } = useTestHistoryData({
        workspaceSlug,
        apiUrl,
        currentRequestUrl,
        initialPayload,
        isStaticMode,
        branch: filters.branch,
        project: filters.project,
        file: filters.file,
        requestedTitle,
    })

    return {
        filters,
        isStaticMode,
        apiUrl,
        artifactBasePath,
        dashboardHref,
        payload,
        isLoading,
        errorMessage,
    }
}