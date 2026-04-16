import { useLocation, useSearchParams } from 'react-router-dom'
import { useDashboardSummaryData } from './use-dashboard-summary'
import { readFiltersFromSearchParams } from '../runtime'
import { useDashboardRuntimeBootstrapState } from '../runtime-hooks'
import { prepareDashboardSummaryRequest } from '../features/dashboard/dashboard-page-model-helpers'

export function useDashboardPageModel(workspaceSlug: string | null): {
    activeTab: ReturnType<typeof prepareDashboardSummaryRequest>['activeTab']
    filters: ReturnType<typeof readFiltersFromSearchParams>
    isStaticMode: boolean
    selectedBranch: string
    selectedProject: string
    selectedFile: string
    setSearchParams: ReturnType<typeof useSearchParams>[1]
    summary: ReturnType<typeof useDashboardSummaryData>['summary']
    isLoading: boolean
    errorMessage: string | null
} {
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const currentRequestUrl = `${location.pathname}${location.search}`
    const requestPreparation = prepareDashboardSummaryRequest({
        workspaceSlug,
        searchParams,
        currentRequestUrl,
    })
    const bootstrapState = useDashboardRuntimeBootstrapState(workspaceSlug, currentRequestUrl)
    const { summary, isLoading, errorMessage } = useDashboardSummaryData({
        ...requestPreparation.summaryDataRequest,
        initialSummary: bootstrapState.initialSummary,
        isStaticMode: bootstrapState.isStaticMode,
    })

    return {
        activeTab: requestPreparation.activeTab,
        filters: requestPreparation.filters,
        isStaticMode: bootstrapState.isStaticMode,
        selectedBranch: requestPreparation.selectedBranch,
        selectedProject: requestPreparation.selectedProject,
        selectedFile: requestPreparation.selectedFile,
        setSearchParams,
        summary,
        isLoading,
        errorMessage,
    }
}