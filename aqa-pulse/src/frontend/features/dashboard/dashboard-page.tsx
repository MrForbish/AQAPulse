/**
 * Назначение: React dashboard-страница с табами, KPI, графиками и переходами в test history для standalone и workspace режимов.
 */
import React from 'react'
import { buildDashboardHref } from '../../runtime'
import { useDashboardPageModel } from '../../hooks/use-dashboard-page-model'
import { DashboardPageContent } from './dashboard-page-content'
import { DashboardRouteStateBoundary } from './dashboard-route-states'
import { resetDashboardFilters, updateDashboardSearchParam } from './dashboard-query-state'

/**
 * Dashboard умеет переиспользовать bootstrap summary только когда URL и workspace совпадают с исходным shell, чтобы не показывать устаревшие данные после client-side navigation.
 */
export function DashboardPage(props: { workspaceSlug: string | null }): React.JSX.Element {
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
    } = useDashboardPageModel(props.workspaceSlug)

    return (
        <DashboardRouteStateBoundary
            summary={summary}
            isLoading={isLoading}
            errorMessage={errorMessage}
            reloadHref={buildDashboardHref(props.workspaceSlug, filters)}
        >
            {(resolvedSummary) => (
                <DashboardPageContent
                    workspaceSlug={props.workspaceSlug}
                    summary={resolvedSummary}
                    activeTab={activeTab}
                    isStaticMode={isStaticMode}
                    selectedBranch={selectedBranch}
                    selectedProject={selectedProject}
                    selectedFile={selectedFile}
                    isLoading={isLoading}
                    errorMessage={errorMessage}
                    onBranchChange={(value) => updateDashboardSearchParam(setSearchParams, 'branch', value)}
                    onProjectChange={(value) => updateDashboardSearchParam(setSearchParams, 'project', value)}
                    onFileChange={(value) => updateDashboardSearchParam(setSearchParams, 'file', value)}
                    onReset={() => resetDashboardFilters(setSearchParams)}
                    onTabChange={(value) => updateDashboardSearchParam(setSearchParams, 'tab', value, true)}
                />
            )}
        </DashboardRouteStateBoundary>
    )
}
