import React from 'react'
import type {
    DashboardSummary,
} from '../../../dashboard-utils'
import { formatDuration, formatPercent } from '../../../shared/formatting'
import {
    buildFlakyHistoryInsight,
    formatDelta,
    formatPerformancePhaseLabel,
    formatScore,
    getFlakyTopTestsEmptyState,
    getScoreTone,
    roundOne,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { ChartCard } from '../../shared/chart-card'
import { EmptyState, MetricCard, OverflowText, Panel, StatusBadge } from '../../shared/ui'
import {
    DashboardCurrentRunTestsBrowserSection,
    DashboardLatestRunsSection,
    DashboardManagerOverviewSection,
} from './dashboard-overview-sections'
import {
    buildDashboardBarChart,
    buildDashboardDoughnutChart,
    buildDashboardLineChart,
    DashboardBreakdownTable,
    formatDashboardDurationDelta,
} from './dashboard-tab-helpers'
import {
    DashboardErrorClusterRow,
    DashboardFlakyTestRow,
    DashboardProblematicTestRow,
    DashboardSlowTestRow,
    DashboardTablePanel,
} from './dashboard-test-table-parts'

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

export function PerformanceTab(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const leadingPhase = props.summary.performance.phaseBreakdown[0] ?? null
    const topBrowser = props.summary.performance.durationPerBrowser[0] ?? null
    const topSuite = props.summary.performance.suiteDuration[0] ?? null

    return (
        <div className="page-grid">
            <MetricCard label={DASHBOARD_TEXT.metrics.p95Duration} labelMetricKey="p95Duration" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.p95Duration} value={formatDuration(props.summary.performance.p95DurationMs)} hint="95% тестов укладываются в это значение или быстрее" />
            <MetricCard label={DASHBOARD_TEXT.metrics.p99Duration} labelMetricKey="p99Duration" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.p99Duration} value={formatDuration(props.summary.performance.p99DurationMs)} hint="Хвост самых долгих 1% тестов текущего среза" />
            <MetricCard label={DASHBOARD_TEXT.metrics.leadingPhase} labelMetricKey="leadingPhase" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} value={leadingPhase ? formatPerformancePhaseLabel(leadingPhase.label) : '—'} hint={leadingPhase ? `${formatPercent(leadingPhase.sharePercent)} от длительности прогона` : 'Нет данных по фазам'} />
            <MetricCard label={DASHBOARD_TEXT.metrics.durationPerBrowser} labelMetricKey="durationPerBrowser" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationPerBrowser} value={topBrowser?.label ?? '—'} hint={topBrowser ? `${formatDuration(topBrowser.durationMs)} • ${topBrowser.tests} тестов` : 'Нет данных по браузерам / проектам'} />
            <MetricCard label={DASHBOARD_TEXT.metrics.suiteDuration} labelMetricKey="suiteDuration" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.suiteDuration} value={topSuite?.label ?? '—'} hint={topSuite ? `${formatDuration(topSuite.durationMs)} • ${topSuite.tests} тестов` : 'Нет данных по наборам'} />
            <MetricCard label={DASHBOARD_TEXT.metrics.durationTrend} labelMetricKey="durationTrend" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationTrend} value={formatDuration(props.summary.performance.durationTrend.currentDurationMs)} tone={props.summary.performance.durationTrend.deltaPercent !== null && props.summary.performance.durationTrend.deltaPercent > 0 ? 'warn' : 'good'} hint={formatDashboardDurationDelta(props.summary.performance.durationTrend.deltaPercent)} />

            <ChartCard title={DASHBOARD_TEXT.metrics.durationTrend} titleMetricKey="durationTrend" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationTrend} description={DASHBOARD_METRIC_DESCRIPTIONS.durationTrend} type="line" data={buildDashboardLineChart(props.summary.charts.durationTrend.labels, props.summary.charts.durationTrend.values, '#1d4ed8')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.topSlowestTests} titleMetricKey="topSlowestTests" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topSlowestTests} description={DASHBOARD_METRIC_DESCRIPTIONS.topSlowestTests} type="bar" data={buildDashboardBarChart(props.summary.charts.slowestTests.labels, props.summary.charts.slowestTests.values, '#f97316')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.phaseBreakdown} titleMetricKey="phaseBreakdown" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} description={DASHBOARD_TEXT.performance.phaseBreakdownDescription} type="bar" data={buildDashboardBarChart(props.summary.performance.phaseBreakdown.map((item) => formatPerformancePhaseLabel(item.label)), props.summary.performance.phaseBreakdown.map((item) => roundOne(item.sharePercent)), '#f59e0b')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.suiteDuration} titleMetricKey="suiteDuration" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription} type="bar" data={buildDashboardBarChart(props.summary.performance.suiteDuration.map((item) => item.label), props.summary.performance.suiteDuration.map((item) => roundOne(item.durationMs / 60000)), '#22c55e')} />

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

export function FlakyTab(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const flakyInsight = buildFlakyHistoryInsight(props.summary)

    return (
        <div className="page-grid">
            <MetricCard label={DASHBOARD_TEXT.metrics.flakyScore} labelMetricKey="flakyScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyScore} value={props.summary.flakyAnalytics.averageFlakyScore === null ? '—' : formatScore(props.summary.flakyAnalytics.averageFlakyScore)} tone={props.summary.flakyAnalytics.averageFlakyScore === null ? 'default' : getScoreTone(props.summary.flakyAnalytics.averageFlakyScore)} />
            <MetricCard label="Average MTBF" labelMetricKey="mtbf" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.mtbf} value={props.summary.flakyAnalytics.averageMtbfDays === null ? '—' : `${props.summary.flakyAnalytics.averageMtbfDays.toFixed(2)} дн`} />
            <MetricCard label="First Flake to Fix" labelMetricKey="timeToFixFlaky" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.timeToFixFlaky} value={props.summary.flakyAnalytics.firstFlakeToFix ? `${props.summary.flakyAnalytics.firstFlakeToFix.days.toFixed(1)} дн` : '—'} />
            <MetricCard label="Исторических flaky" labelMetricKey="topFlakyTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topFlakyTests} value={String(props.summary.flakyAnalytics.topFlakyTests.length)} hint={formatDelta(props.summary.flakyAnalytics.flakyTrend.delta, 'к прошлому прогону')} />

            <ChartCard title={DASHBOARD_TEXT.metrics.flakyTrend} titleMetricKey="flakyTrend" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyTrend} type="bar" data={buildDashboardBarChart(props.summary.charts.flakyTrend.labels, props.summary.charts.flakyTrend.values, '#d97706')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.clusterDistribution} titleMetricKey="clusterDistribution" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.clusterList} type="bar" data={buildDashboardBarChart(props.summary.charts.errorClusters.labels, props.summary.charts.errorClusters.values, '#ef4444')} />

            <DashboardTablePanel
                title={DASHBOARD_TEXT.metrics.problematicTests}
                titleMetricKey="problematicTests"
                titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.problematicTests}
                className="span-2"
                headers={[
                    DASHBOARD_TEXT.tables.test,
                    DASHBOARD_TEXT.tables.file,
                    DASHBOARD_TEXT.tables.status,
                    DASHBOARD_TEXT.tables.flaky,
                    'Failure Rate',
                    DASHBOARD_TEXT.tables.duration,
                    DASHBOARD_TEXT.tables.reason,
                ]}
                rowCount={props.summary.topProblematicTests.length}
                emptyTitle="Проблемные тесты не обнаружены"
                emptyMessage={DASHBOARD_TEXT.states.problematicTestsEmpty}
            >
                {props.summary.topProblematicTests.map((test) => <DashboardProblematicTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} yesLabel={DASHBOARD_TEXT.states.yes} noLabel={DASHBOARD_TEXT.states.no} />)}
            </DashboardTablePanel>

            <div className={`inline-note${flakyInsight.tone === 'warn' ? ' is-warning' : flakyInsight.tone === 'info' ? ' is-info' : ''} span-2`}>
                <strong>{flakyInsight.title}</strong>
                <div className="compact-top">{flakyInsight.body}</div>
            </div>

            <DashboardTablePanel
                title={DASHBOARD_TEXT.metrics.topFlakyTests}
                titleMetricKey="topFlakyTests"
                titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topFlakyTests}
                className="span-2"
                headers={[
                    DASHBOARD_TEXT.tables.test,
                    DASHBOARD_TEXT.tables.file,
                    DASHBOARD_TEXT.metrics.flakyScore,
                    'Fail Rate',
                    'MTBF',
                    DASHBOARD_TEXT.metrics.unstableRuns,
                    DASHBOARD_TEXT.metrics.lastStatus,
                ]}
                rowCount={props.summary.flakyAnalytics.topFlakyTests.length}
                emptyTitle="Исторический список flaky-тестов пуст"
                emptyMessage={getFlakyTopTestsEmptyState(props.summary)}
            >
                {props.summary.flakyAnalytics.topFlakyTests.map((test) => <DashboardFlakyTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} showRunCounts />)}
            </DashboardTablePanel>

            <DashboardTablePanel
                title={DASHBOARD_TEXT.metrics.errorClusters}
                titleMetricKey="errorClusters"
                titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.clusterList}
                className="span-2"
                headers={[
                    DASHBOARD_TEXT.tables.error,
                    DASHBOARD_TEXT.tables.count,
                    DASHBOARD_TEXT.tables.testExamples,
                ]}
                rowCount={props.summary.errorClusters.length}
                emptyTitle="Падений не обнаружено"
                emptyMessage={DASHBOARD_TEXT.states.failuresEmpty}
            >
                {props.summary.errorClusters.map((cluster) => <DashboardErrorClusterRow key={cluster.message} cluster={cluster} />)}
            </DashboardTablePanel>
        </div>
    )
}

