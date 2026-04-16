import { useLocation, useSearchParams } from 'react-router-dom'
import { useDashboardSummaryData } from './use-dashboard-summary'
import { buildSummaryApiUrl, readFiltersFromSearchParams, useRuntime } from '../runtime'
import { readDashboardSelectedFilters, resolveDashboardActiveTab } from '../features/dashboard/dashboard-query-state'

export function useDashboardPageModel(workspaceSlug: string | null): {
    activeTab: ReturnType<typeof resolveDashboardActiveTab>
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
    const runtime = useRuntime()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = resolveDashboardActiveTab(searchParams)
    const currentRequestUrl = `${location.pathname}${location.search}`
    const filters = readFiltersFromSearchParams(searchParams)
    const apiUrl = buildSummaryApiUrl(workspaceSlug, filters)
    const isStaticMode = runtime.route.kind === 'static-dashboard'
    const bootstrapMatches = runtime.route.kind === 'static-dashboard'
        || (runtime.route.kind === 'dashboard'
            && runtime.route.workspaceSlug === workspaceSlug
            && runtime.initialRequestUrl === currentRequestUrl)
    const initialSummary = bootstrapMatches ? runtime.initialDashboardSummary : null
    const { selectedBranch, selectedProject, selectedFile } = readDashboardSelectedFilters(searchParams)
    const { summary, isLoading, errorMessage } = useDashboardSummaryData({
        workspaceSlug,
        apiUrl,
        currentRequestUrl,
        initialSummary,
        isStaticMode,
    })

    return {
        activeTab,
        filters,
        isStaticMode,
        selectedBranch,
        selectedProject,
        selectedFile,
        setSearchParams,
        summary,
        isLoading,
        errorMessage,
    }
}