import React from 'react'
import type {
    DashboardSummary,
} from '../../../dashboard-utils'
import { ru } from '../../../shared/i18n/ru'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ChartCard } from '../../shared/chart-card'
import { EmptyState } from '../../shared/ui'
import {
    DashboardCurrentRunTestsBrowserSection,
    DashboardLatestRunsSection,
    DashboardManagerOverviewSection,
} from './dashboard-overview-sections'
import {
    DASHBOARD_STATUS_CHART_COLORS,
    buildDashboardDoughnutChart,
    buildDashboardLineChart,
} from './dashboard-tab-helpers'

const DASHBOARD_TEXT = ru.dashboard

export function OverviewTab(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const statusDistributionItems = props.summary.charts.statusDistribution.labels.map((label, index) => ({
        label: formatStatusDistributionLabel(label),
        value: props.summary.charts.statusDistribution.values[index] ?? 0,
        color: DASHBOARD_STATUS_CHART_COLORS[index] ?? '#94a3b8',
    }))

    return (
        <div className="page-grid">
            <DashboardManagerOverviewSection summary={props.summary} />
            <ChartCard title={DASHBOARD_TEXT.metrics.passRateTrend} titleMetricKey="passRateTrend" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.passRateTrend} valueHint="проценты успешных тестов" type="line" data={buildDashboardLineChart(props.summary.charts.passRateTrend.labels, props.summary.charts.passRateTrend.values, '#0f766e')} />
            <ChartCard
                title={DASHBOARD_TEXT.metrics.statusDistribution}
                titleMetricKey="statusDistribution"
                titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.statusDistribution}
                valueHint="количество тестов"
                type="doughnut"
                data={buildDashboardDoughnutChart(statusDistributionItems.map((item) => item.label), props.summary.charts.statusDistribution.values)}
                showLegend={false}
                aside={(
                    <div className="status-distribution-metrics">
                        {statusDistributionItems.map((item) => (
                            <article key={item.label} className="status-distribution-metric">
                                <div className="status-distribution-metric-label">
                                    <span className="status-distribution-metric-dot" style={{ backgroundColor: item.color }} aria-hidden="true" />
                                    <span>{item.label}</span>
                                </div>
                                <strong className="status-distribution-metric-value">{item.value}</strong>
                            </article>
                        ))}
                    </div>
                )}
            />
            <DashboardCurrentRunTestsBrowserSection summary={props.summary} workspaceSlug={props.workspaceSlug} />
            <DashboardLatestRunsSection summary={props.summary} />
        </div>
    )
}

function formatStatusDistributionLabel(label: string): string {
    return DASHBOARD_TEXT.statusLabels[label as keyof typeof DASHBOARD_TEXT.statusLabels] ?? label
}

