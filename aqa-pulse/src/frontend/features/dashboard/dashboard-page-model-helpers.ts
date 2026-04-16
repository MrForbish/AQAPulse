import type { DashboardSummary } from '../../../dashboard-utils'
import type { FrontendBootstrapData } from '../../../frontend-bootstrap'
import { buildSummaryApiUrl, readFiltersFromSearchParams, type FrontendFilters } from '../../runtime'
import { readDashboardSelectedFilters, resolveDashboardActiveTab } from './dashboard-query-state'
import type { DashboardTabId } from './dashboard-tab-content'

export interface DashboardRuntimeBootstrapState {
    isStaticMode: boolean
    initialSummary: DashboardSummary | null
}

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

export function resolveDashboardRuntimeBootstrap(props: {
    runtime: FrontendBootstrapData
    workspaceSlug: string | null
    currentRequestUrl: string
}): DashboardRuntimeBootstrapState {
    const isStaticMode = props.runtime.route.kind === 'static-dashboard'
    const bootstrapMatches = props.runtime.route.kind === 'static-dashboard'
        || (props.runtime.route.kind === 'dashboard'
            && props.runtime.route.workspaceSlug === props.workspaceSlug
            && props.runtime.initialRequestUrl === props.currentRequestUrl)

    return {
        isStaticMode,
        initialSummary: bootstrapMatches ? props.runtime.initialDashboardSummary : null,
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