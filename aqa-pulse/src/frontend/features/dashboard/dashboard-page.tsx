/**
 * Назначение: React dashboard-страница с табами, KPI, графиками и переходами в test history для standalone и workspace режимов.
 */
import React from 'react'
import { buildDashboardHref } from '../../runtime'
import { useDashboardPageModel } from '../../hooks/use-dashboard-page-model'
import { PageFrame, SegmentedTabs } from '../../shared/ui'
import { DashboardErrorState, DashboardLoadingState } from './dashboard-route-states'
import { resetDashboardFilters, updateDashboardSearchParam } from './dashboard-query-state'
import { DashboardFiltersSection, DashboardHeroSection, DashboardMetricsSection, DashboardRuntimeNotices } from './dashboard-shell-sections'
import { DashboardActiveTabContent, DASHBOARD_TABS } from './dashboard-tab-content'

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

    if (!summary && isLoading) {
        return <DashboardLoadingState />
    }

    if (!summary) {
        return <DashboardErrorState reloadHref={buildDashboardHref(props.workspaceSlug, filters)} errorMessage={errorMessage} />
    }

    return (
        <PageFrame>
            <DashboardHeroSection summary={summary} workspaceSlug={props.workspaceSlug} isStaticMode={isStaticMode} />
            <DashboardFiltersSection
                summary={summary}
                isStaticMode={isStaticMode}
                selectedBranch={selectedBranch}
                selectedProject={selectedProject}
                selectedFile={selectedFile}
                onBranchChange={(value) => updateDashboardSearchParam(setSearchParams, 'branch', value)}
                onProjectChange={(value) => updateDashboardSearchParam(setSearchParams, 'project', value)}
                onFileChange={(value) => updateDashboardSearchParam(setSearchParams, 'file', value)}
                onReset={() => resetDashboardFilters(setSearchParams)}
            />
            <DashboardMetricsSection summary={summary} />

            <SegmentedTabs activeTab={activeTab} items={DASHBOARD_TABS.map((item) => ({ id: item.id, label: item.label }))} onChange={(value) => updateDashboardSearchParam(setSearchParams, 'tab', value, true)} />

            <DashboardRuntimeNotices summaryPresent={Boolean(summary)} isLoading={isLoading} errorMessage={errorMessage} />
            <DashboardActiveTabContent activeTab={activeTab} summary={summary} workspaceSlug={props.workspaceSlug} />
        </PageFrame>
    )
}
