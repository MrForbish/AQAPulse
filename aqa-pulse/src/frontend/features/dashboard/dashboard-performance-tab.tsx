import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { formatDuration, formatPercent } from '../../../shared/formatting'
import {
    formatPerformancePhaseLabel,
    roundOne,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { ChartCard } from '../../shared/chart-card'
import { MetricCard, Panel } from '../../shared/ui'
import {
    buildDashboardBarChart,
    buildDashboardLineChart,
    DashboardBreakdownTable,
    formatDashboardDurationDelta,
} from './dashboard-tab-helpers'
import {
    DashboardSlowTestRow,
    DashboardTablePanel,
} from './dashboard-test-table-parts'

const DASHBOARD_TEXT = ru.dashboard

export function PerformanceTab(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const leadingPhase = props.summary.performance.phaseBreakdown[0] ?? null
    const topBrowser = props.summary.performance.durationPerBrowser[0] ?? null
    const topSuite = props.summary.performance.suiteDuration[0] ?? null

    return (
        <div className="page-grid">
            <MetricCard className="metric-card--compact-value" label={DASHBOARD_TEXT.metrics.p95Duration} labelMetricKey="p95Duration" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.p95Duration} value={formatDuration(props.summary.performance.p95DurationMs)} hint="95% тестов укладываются в это значение или быстрее" />
            <MetricCard className="metric-card--compact-value" label={DASHBOARD_TEXT.metrics.p99Duration} labelMetricKey="p99Duration" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.p99Duration} value={formatDuration(props.summary.performance.p99DurationMs)} hint="Хвост самых долгих 1% тестов текущего среза" />
            <MetricCard className="metric-card--compact-value" label={DASHBOARD_TEXT.metrics.leadingPhase} labelMetricKey="leadingPhase" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} value={leadingPhase ? formatPerformancePhaseLabel(leadingPhase.label) : '—'} hint={leadingPhase ? `${formatPercent(leadingPhase.sharePercent)} от длительности прогона` : 'Нет данных по фазам'} />
            <MetricCard className="metric-card--compact-value" label={DASHBOARD_TEXT.metrics.durationPerBrowser} labelMetricKey="durationPerBrowser" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationPerBrowser} value={topBrowser?.label ?? '—'} hint={topBrowser ? `${formatDuration(topBrowser.durationMs)} • ${topBrowser.tests} тестов` : 'Нет данных по браузерам / проектам'} />
            <MetricCard className="metric-card--compact-value" label={DASHBOARD_TEXT.metrics.suiteDuration} labelMetricKey="suiteDuration" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.suiteDuration} value={topSuite?.label ?? '—'} hint={topSuite ? `${formatDuration(topSuite.durationMs)} • ${topSuite.tests} тестов` : 'Нет данных по наборам'} />
            <MetricCard className="metric-card--compact-value" label={DASHBOARD_TEXT.metrics.durationTrend} labelMetricKey="durationTrend" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationTrend} value={formatDuration(props.summary.performance.durationTrend.currentDurationMs)} tone={props.summary.performance.durationTrend.deltaPercent !== null && props.summary.performance.durationTrend.deltaPercent > 0 ? 'warn' : 'good'} hint={formatDashboardDurationDelta(props.summary.performance.durationTrend.deltaPercent, props.summary.comparison.mode)} />

            <ChartCard title={DASHBOARD_TEXT.metrics.durationTrend} titleMetricKey="durationTrend" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationTrend} description={DASHBOARD_METRIC_DESCRIPTIONS.durationTrend} valueHint="минуты прогона" type="line" data={buildDashboardLineChart(props.summary.charts.durationTrend.labels, props.summary.charts.durationTrend.values, '#1d4ed8')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.topSlowestTests} titleMetricKey="topSlowestTests" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topSlowestTests} description={DASHBOARD_METRIC_DESCRIPTIONS.topSlowestTests} valueHint="секунды на тест" type="bar" data={buildDashboardBarChart(props.summary.charts.slowestTests.labels, props.summary.charts.slowestTests.values, '#f97316')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.phaseBreakdown} titleMetricKey="phaseBreakdown" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} description={DASHBOARD_TEXT.performance.phaseBreakdownDescription} valueHint="доля времени, %" type="bar" data={buildDashboardBarChart(props.summary.performance.phaseBreakdown.map((item) => formatPerformancePhaseLabel(item.label)), props.summary.performance.phaseBreakdown.map((item) => roundOne(item.sharePercent)), '#f59e0b')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.suiteDuration} titleMetricKey="suiteDuration" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription} valueHint="минуты по набору" type="bar" data={buildDashboardBarChart(props.summary.performance.suiteDuration.map((item) => item.label), props.summary.performance.suiteDuration.map((item) => roundOne(item.durationMs / 60000)), '#22c55e')} />

            <Panel title={DASHBOARD_TEXT.performance.runtimeBreakdownTitle} titleMetricKey="durationPerBrowser" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationPerBrowser} description={DASHBOARD_TEXT.performance.durationPerBrowserDescription}>
                <DashboardBreakdownTable labelColumn={DASHBOARD_TEXT.filters.project} items={props.summary.performance.durationPerBrowser} emptyMessage={DASHBOARD_TEXT.states.performanceBreakdownEmpty} />
            </Panel>
            <Panel title={DASHBOARD_TEXT.metrics.suiteDuration} titleMetricKey="suiteDuration" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription}>
                <DashboardBreakdownTable labelColumn={DASHBOARD_TEXT.tables.group} items={props.summary.performance.suiteDuration} emptyMessage={DASHBOARD_TEXT.states.performanceBreakdownEmpty} />
            </Panel>

            <DashboardTablePanel
                title={DASHBOARD_TEXT.metrics.topSlowestTestsP1}
                titleMetricKey="topSlowestTestsP1"
                titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topSlowestTests}
                className="span-2"
                headers={[
                    DASHBOARD_TEXT.tables.test,
                    DASHBOARD_TEXT.tables.file,
                    DASHBOARD_TEXT.tables.status,
                    DASHBOARD_TEXT.tables.flaky,
                    DASHBOARD_TEXT.tables.duration,
                    DASHBOARD_TEXT.tables.lastError,
                ]}
                rowCount={props.summary.performance.slowestTests.length}
                emptyTitle="Медленные тесты не обнаружены"
                emptyMessage={DASHBOARD_TEXT.states.slowTestsEmpty}
            >
                {props.summary.performance.slowestTests.map((test) => <DashboardSlowTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} yesLabel={DASHBOARD_TEXT.states.yes} noLabel={DASHBOARD_TEXT.states.no} />)}
            </DashboardTablePanel>
        </div>
    )
}