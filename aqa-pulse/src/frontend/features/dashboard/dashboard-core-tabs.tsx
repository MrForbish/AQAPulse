import React from 'react'
import type {
    DashboardSummary,
} from '../../../dashboard-utils'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { ChartCard } from '../../shared/chart-card'
import { EmptyState } from '../../shared/ui'
import {
    DashboardCurrentRunTestsBrowserSection,
    DashboardLatestRunsSection,
    DashboardManagerOverviewSection,
} from './dashboard-overview-sections'
import {
    buildDashboardDoughnutChart,
    buildDashboardLineChart,
} from './dashboard-tab-helpers'

const DASHBOARD_TEXT = ru.dashboard

export function OverviewTab(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    return (
        <div className="page-grid">
            <DashboardManagerOverviewSection summary={props.summary} />
            <ChartCard title={DASHBOARD_TEXT.metrics.passRateTrend} titleMetricKey="passRateTrend" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.passRateTrend} type="line" data={buildDashboardLineChart(props.summary.charts.passRateTrend.labels, props.summary.charts.passRateTrend.values, '#0f766e')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.statusDistribution} titleMetricKey="statusDistribution" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.statusDistribution} type="doughnut" data={buildDashboardDoughnutChart(props.summary.charts.statusDistribution.labels, props.summary.charts.statusDistribution.values)} />
            <DashboardCurrentRunTestsBrowserSection summary={props.summary} workspaceSlug={props.workspaceSlug} />
            <DashboardLatestRunsSection summary={props.summary} />
        </div>
    )
}

