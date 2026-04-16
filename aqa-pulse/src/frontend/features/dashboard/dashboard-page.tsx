/**
 * Назначение: React dashboard-страница с табами, KPI, графиками и переходами в test history для standalone и workspace режимов.
 */
import React from 'react'
import { DashboardPageContent } from './dashboard-page-content'
import { useDashboardRouteController } from './dashboard-route-controller'
import { DashboardRouteStateBoundary } from './dashboard-route-states'

/**
 * Dashboard умеет переиспользовать bootstrap summary только когда URL и workspace совпадают с исходным shell, чтобы не показывать устаревшие данные после client-side navigation.
 */
export function DashboardPage(props: { workspaceSlug: string | null }): React.JSX.Element {
    const controller = useDashboardRouteController(props.workspaceSlug)

    return (
        <DashboardRouteStateBoundary
            summary={controller.routeState.summary}
            isLoading={controller.routeState.isLoading}
            errorMessage={controller.routeState.errorMessage}
            reloadHref={controller.routeState.reloadHref}
        >
            {(resolvedSummary) => (
                <DashboardPageContent
                    workspaceSlug={props.workspaceSlug}
                    summary={resolvedSummary}
                    {...controller.pageContentProps}
                />
            )}
        </DashboardRouteStateBoundary>
    )
}
