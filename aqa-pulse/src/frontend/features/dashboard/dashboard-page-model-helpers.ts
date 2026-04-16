import type { DashboardSummary } from '../../../dashboard-utils'
import { buildSummaryApiUrl, readFiltersFromSearchParams, type FrontendFilters } from '../../navigation'
import { readDashboardSelectedFilters, resolveDashboardActiveTab } from './dashboard-query-state'
import type { DashboardTabId } from './dashboard-tab-content'

export interface DashboardSummaryRequestPreparation {
    activeTab: DashboardTabId
    filters: FrontendFilters
    selectedBranch: string
    selectedProject: string
    selectedFile: string
    summaryDataRequest: {
        workspaceSlug: string | null
        apiUrl: string
        currentRequestUrl: string
    }
}

export function prepareDashboardSummaryRequest(props: {
    workspaceSlug: string | null
    searchParams: URLSearchParams
    currentRequestUrl: string
}): DashboardSummaryRequestPreparation {
    const activeTab = resolveDashboardActiveTab(props.searchParams)
    const filters = readFiltersFromSearchParams(props.searchParams)
    const { selectedBranch, selectedProject, selectedFile } = readDashboardSelectedFilters(props.searchParams)

    return {
        activeTab,
        filters,
        selectedBranch,
        selectedProject,
        selectedFile,
        summaryDataRequest: {
            workspaceSlug: props.workspaceSlug,
            apiUrl: buildSummaryApiUrl(props.workspaceSlug, filters),
            currentRequestUrl: props.currentRequestUrl,
        },
    }
}