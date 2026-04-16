import { buildDashboardHref } from '../../navigation'
import { useDashboardPageModel } from '../../hooks/use-dashboard-page-model'
import { resetDashboardFilters, updateDashboardSearchParam } from './dashboard-query-state'
import type { DashboardPageContentProps } from './dashboard-page-content'

export function useDashboardRouteController(workspaceSlug: string | null): {
    routeState: {
        summary: ReturnType<typeof useDashboardPageModel>['summary']
        isLoading: boolean
        errorMessage: string | null
        reloadHref: string
    }
    pageContentProps: Omit<DashboardPageContentProps, 'workspaceSlug' | 'summary'>
} {
    const {
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
    } = useDashboardPageModel(workspaceSlug)

    return {
        routeState: {
            summary,
            isLoading,
            errorMessage,
            reloadHref: buildDashboardHref(workspaceSlug, filters),
        },
        pageContentProps: {
            activeTab,
            isStaticMode,
            selectedBranch,
            selectedProject,
            selectedFile,
            isLoading,
            errorMessage,
            onBranchChange: (value) => updateDashboardSearchParam(setSearchParams, 'branch', value),
            onProjectChange: (value) => updateDashboardSearchParam(setSearchParams, 'project', value),
            onFileChange: (value) => updateDashboardSearchParam(setSearchParams, 'file', value),
            onReset: () => resetDashboardFilters(setSearchParams),
            onTabChange: (value) => updateDashboardSearchParam(setSearchParams, 'tab', value, true),
        },
    }
}