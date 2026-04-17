import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import {
    buildFlakyHistoryInsight,
    formatDelta,
    formatScore,
    getFlakyTopTestsEmptyState,
    getScoreTone,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { ChartCard } from '../../shared/chart-card'
import { MetricCard } from '../../shared/ui'
import { buildDashboardBarChart } from './dashboard-tab-helpers'
import {
    DashboardErrorClusterRow,
    DashboardFlakyTestRow,
    DashboardProblematicTestRow,
    DashboardTablePanel,
} from './dashboard-test-table-parts'

const DASHBOARD_TEXT = ru.dashboard

export function FlakyTab(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const flakyInsight = buildFlakyHistoryInsight(props.summary)

    return (
        <div className="page-grid">
            <MetricCard label={DASHBOARD_TEXT.metrics.flakyScore} labelMetricKey="flakyScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyScore} value={props.summary.flakyAnalytics.averageFlakyScore === null ? '—' : formatScore(props.summary.flakyAnalytics.averageFlakyScore)} tone={props.summary.flakyAnalytics.averageFlakyScore === null ? 'default' : getScoreTone(props.summary.flakyAnalytics.averageFlakyScore)} />
            <MetricCard label="Average MTBF" labelMetricKey="mtbf" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.mtbf} value={props.summary.flakyAnalytics.averageMtbfDays === null ? '—' : `${props.summary.flakyAnalytics.averageMtbfDays.toFixed(2)} дн`} />
            <MetricCard label="First Flake to Fix" labelMetricKey="timeToFixFlaky" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.timeToFixFlaky} value={props.summary.flakyAnalytics.firstFlakeToFix ? `${props.summary.flakyAnalytics.firstFlakeToFix.days.toFixed(1)} дн` : '—'} />
            <MetricCard label="Исторических flaky" labelMetricKey="topFlakyTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topFlakyTests} value={String(props.summary.flakyAnalytics.topFlakyTests.length)} hint={formatDelta(props.summary.flakyAnalytics.flakyTrend.delta, 'к прошлому прогону')} />

            <ChartCard title={DASHBOARD_TEXT.metrics.flakyTrend} titleMetricKey="flakyTrend" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyTrend} valueHint="количество flaky-тестов" type="bar" data={buildDashboardBarChart(props.summary.charts.flakyTrend.labels, props.summary.charts.flakyTrend.values, '#d97706')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.clusterDistribution} titleMetricKey="clusterDistribution" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.clusterList} valueHint="количество падений в кластере" type="bar" data={buildDashboardBarChart(props.summary.charts.errorClusters.labels, props.summary.charts.errorClusters.values, '#ef4444')} />

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

            <DashboardTablePanel
                title={DASHBOARD_TEXT.metrics.topFlakyTests}
                titleMetricKey="topFlakyTests"
                titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topFlakyTests}
                className="span-2"
                intro={(
                    <div className={`inline-note${flakyInsight.tone === 'warn' ? ' is-warning' : flakyInsight.tone === 'info' ? ' is-info' : ''}`}>
                        <strong>{flakyInsight.title}</strong>
                        <div className="compact-top">{flakyInsight.body}</div>
                    </div>
                )}
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