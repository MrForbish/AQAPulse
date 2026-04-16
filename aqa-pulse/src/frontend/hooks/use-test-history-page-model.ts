import { useLocation, useSearchParams } from 'react-router-dom'
import { useTestHistoryData } from './use-test-history'
import { readFiltersFromSearchParams } from '../runtime'
import { useTestHistoryRuntimeBootstrapState } from '../runtime-hooks'
import { prepareTestHistoryDataRequest } from '../features/test-history/test-history-page-model-helpers'

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
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const currentRequestUrl = `${location.pathname}${location.search}`
    const requestPreparation = prepareTestHistoryDataRequest({
        workspaceSlug,
        requestedTitle,
        searchParams,
        currentRequestUrl,
    })
    const bootstrapState = useTestHistoryRuntimeBootstrapState(workspaceSlug, requestedTitle, currentRequestUrl)
    const { payload, isLoading, errorMessage } = useTestHistoryData({
        ...requestPreparation.testHistoryDataRequest,
        initialPayload: bootstrapState.initialPayload,
        isStaticMode: bootstrapState.isStaticMode,
    })

    return {
        filters: requestPreparation.filters,
        isStaticMode: bootstrapState.isStaticMode,
        apiUrl: requestPreparation.testHistoryDataRequest.apiUrl,
        artifactBasePath: requestPreparation.artifactBasePath,
        dashboardHref: requestPreparation.dashboardHref,
        payload,
        isLoading,
        errorMessage,
    }
}