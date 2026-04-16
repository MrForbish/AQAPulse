import React from 'react'
import type {
    DashboardDurationBreakdownItem,
    DashboardFlakyTestMetric,
    DashboardSummary,
} from '../../../dashboard-utils'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import {
    buildFlakyHistoryInsight,
    formatCommit,
    formatDelta,
    formatPerformancePhaseLabel,
    formatScore,
    formatStatusLabel,
    getFlakyTopTestsEmptyState,
    getManagerChangeLabel,
    getManagerReadinessLabel,
    getManagerRiskLabel,
    getScoreTone,
    getStatusTone,
    roundOne,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { ChartCard, type FrontendChartData } from '../../shared/chart-card'
import { EmptyState, MetricCard, NarrativeList, OverflowText, Panel, StatusBadge, SummaryStrip } from '../../shared/ui'
import {
    DashboardCurrentRunTestRow,
    DashboardEmptyTableRow,
    DashboardErrorClusterRow,
    DashboardProblematicTestRow,
    DashboardSlowTestRow,
    DashboardTable,
    DashboardTablePanel,
    DashboardTestHistoryLink,
} from './dashboard-test-table-parts'

const DASHBOARD_TEXT = ru.dashboard

export function OverviewTab(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    return (
        <div className="page-grid">
            <ManagerOverviewPanel summary={props.summary} />
            <ChartCard title={DASHBOARD_TEXT.metrics.passRateTrend} titleMetricKey="passRateTrend" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.passRateTrend} type="line" data={buildLineChart(props.summary.charts.passRateTrend.labels, props.summary.charts.passRateTrend.values, '#0f766e')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.statusDistribution} titleMetricKey="statusDistribution" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.statusDistribution} type="doughnut" data={buildDoughnutChart(props.summary.charts.statusDistribution.labels, props.summary.charts.statusDistribution.values)} />
            <CurrentRunTestsBrowser summary={props.summary} workspaceSlug={props.workspaceSlug} />
            <RecentRunsPanel summary={props.summary} />
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
            <MetricCard label={DASHBOARD_TEXT.metrics.durationTrend} labelMetricKey="durationTrend" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationTrend} value={formatDuration(props.summary.performance.durationTrend.currentDurationMs)} tone={props.summary.performance.durationTrend.deltaPercent !== null && props.summary.performance.durationTrend.deltaPercent > 0 ? 'warn' : 'good'} hint={formatDurationDelta(props.summary.performance.durationTrend.deltaPercent)} />

            <ChartCard title={DASHBOARD_TEXT.metrics.durationTrend} titleMetricKey="durationTrend" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationTrend} description={DASHBOARD_METRIC_DESCRIPTIONS.durationTrend} type="line" data={buildLineChart(props.summary.charts.durationTrend.labels, props.summary.charts.durationTrend.values, '#1d4ed8')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.topSlowestTests} titleMetricKey="topSlowestTests" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topSlowestTests} description={DASHBOARD_METRIC_DESCRIPTIONS.topSlowestTests} type="bar" data={buildBarChart(props.summary.charts.slowestTests.labels, props.summary.charts.slowestTests.values, '#f97316')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.phaseBreakdown} titleMetricKey="phaseBreakdown" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} description={DASHBOARD_TEXT.performance.phaseBreakdownDescription} type="bar" data={buildBarChart(props.summary.performance.phaseBreakdown.map((item) => formatPerformancePhaseLabel(item.label)), props.summary.performance.phaseBreakdown.map((item) => roundOne(item.sharePercent)), '#f59e0b')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.suiteDuration} titleMetricKey="suiteDuration" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription} type="bar" data={buildBarChart(props.summary.performance.suiteDuration.map((item) => item.label), props.summary.performance.suiteDuration.map((item) => roundOne(item.durationMs / 60000)), '#22c55e')} />

            <Panel title={DASHBOARD_TEXT.performance.runtimeBreakdownTitle} titleMetricKey="durationPerBrowser" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.durationPerBrowser} description={DASHBOARD_TEXT.performance.durationPerBrowserDescription}>
                <BreakdownTable labelColumn={DASHBOARD_TEXT.filters.project} items={props.summary.performance.durationPerBrowser} emptyMessage={DASHBOARD_TEXT.states.performanceBreakdownEmpty} />
            </Panel>
            <Panel title={DASHBOARD_TEXT.metrics.suiteDuration} titleMetricKey="suiteDuration" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription}>
                <BreakdownTable labelColumn={DASHBOARD_TEXT.tables.group} items={props.summary.performance.suiteDuration} emptyMessage={DASHBOARD_TEXT.states.performanceBreakdownEmpty} />
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

            <ChartCard title={DASHBOARD_TEXT.metrics.flakyTrend} titleMetricKey="flakyTrend" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyTrend} type="bar" data={buildBarChart(props.summary.charts.flakyTrend.labels, props.summary.charts.flakyTrend.values, '#d97706')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.clusterDistribution} titleMetricKey="clusterDistribution" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.clusterList} type="bar" data={buildBarChart(props.summary.charts.errorClusters.labels, props.summary.charts.errorClusters.values, '#ef4444')} />

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
                {props.summary.flakyAnalytics.topFlakyTests.map((test) => <FlakyTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} />)}
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

function ManagerOverviewPanel(props: { summary: DashboardSummary }): React.JSX.Element {
    return (
        <Panel title={DASHBOARD_TEXT.manager.summaryTitle} titleMetricKey="managerSummary" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.managerSummary} description={DASHBOARD_TEXT.manager.summaryDescription} className="span-2">
            <div className="signal-grid compact-top">
                <MetricCard label={DASHBOARD_TEXT.manager.releaseReadiness} labelMetricKey="releaseReadiness" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseReadiness} value={formatScore(props.summary.managerSummary.releaseReadiness.score)} tone={mapManagerTone(props.summary.managerSummary.releaseReadiness.level)} hint={getManagerReadinessLabel(props.summary.managerSummary.releaseReadiness.level)} />
                <MetricCard label={DASHBOARD_TEXT.manager.qualityRisk} labelMetricKey="qualityRisk" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.qualityRisk} value={formatScore(props.summary.managerSummary.qualityRisk.score)} tone={mapManagerTone(props.summary.managerSummary.qualityRisk.level)} hint={getManagerRiskLabel(props.summary.managerSummary.qualityRisk.level)} />
                <MetricCard label={DASHBOARD_TEXT.manager.deliveryRisk} labelMetricKey="deliveryRisk" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.deliveryRisk} value={formatScore(props.summary.managerSummary.deliveryRisk.score)} tone={mapManagerTone(props.summary.managerSummary.deliveryRisk.level)} hint={getManagerRiskLabel(props.summary.managerSummary.deliveryRisk.level)} />
            </div>
            <div className="split-grid compact-top">
                <NarrativeList
                    items={props.summary.managerSummary.blockers.map((blocker, index) => ({
                        id: `${blocker.kind}-${index}`,
                        title: blocker.title,
                        pillLabel: blocker.value,
                        pillTone: blocker.severity === 'critical' ? 'danger' : blocker.severity === 'warning' ? 'warn' : 'accent',
                        body: blocker.details,
                        meta: blocker.testTitle,
                    }))}
                    emptyState={{ title: 'Блокеров нет', message: DASHBOARD_TEXT.manager.noBlockers }}
                />
                <NarrativeList
                    items={props.summary.managerSummary.changes.map((change) => ({
                        id: `${change.label}-${change.value}`,
                        title: change.label,
                        pillLabel: getManagerChangeLabel(change.direction),
                        pillTone: mapChangeTone(change.direction),
                        pillStyle: 'module-pill',
                        value: change.value,
                        body: change.details,
                    }))}
                    emptyState={{ title: 'Изменений нет', message: DASHBOARD_TEXT.manager.noChanges }}
                />
            </div>
        </Panel>
    )
}

function CurrentRunTestsBrowser(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const groups = [
        { id: 'all', label: DASHBOARD_TEXT.testsBrowser.all, tests: props.summary.currentRunTests.all },
        { id: 'passed', label: DASHBOARD_TEXT.testsBrowser.passed, tests: props.summary.currentRunTests.passed },
        { id: 'failed', label: DASHBOARD_TEXT.testsBrowser.failed, tests: props.summary.currentRunTests.failed },
        { id: 'flaky', label: DASHBOARD_TEXT.testsBrowser.flaky, tests: props.summary.currentRunTests.flaky },
        { id: 'skipped', label: DASHBOARD_TEXT.testsBrowser.skipped, tests: props.summary.currentRunTests.skipped },
        { id: 'timedOut', label: DASHBOARD_TEXT.testsBrowser.timedOut, tests: props.summary.currentRunTests.timedOut },
        { id: 'interrupted', label: DASHBOARD_TEXT.testsBrowser.interrupted, tests: props.summary.currentRunTests.interrupted },
    ] as const
    const [activeGroupId, setActiveGroupId] = React.useState<(typeof groups)[number]['id']>('all')
    const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0]

    return (
        <Panel title={DASHBOARD_TEXT.testsBrowser.title} titleMetricKey="currentRunTests" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.currentRunTests} description={DASHBOARD_TEXT.testsBrowser.description} className="span-2">
            <div className="status-switcher compact-top">
                {groups.map((group) => (
                    <button key={group.id} type="button" className={`status-switch-button${activeGroup.id === group.id ? ' is-active' : ''}`} onClick={() => setActiveGroupId(group.id)}>
                        <span>{group.label}</span>
                        <strong>{group.tests.length}</strong>
                    </button>
                ))}
            </div>
            <DashboardTable
                headers={[
                    DASHBOARD_TEXT.tables.test,
                    DASHBOARD_TEXT.tables.file,
                    DASHBOARD_TEXT.filters.project,
                    DASHBOARD_TEXT.tables.status,
                    DASHBOARD_TEXT.tables.flaky,
                    DASHBOARD_TEXT.tables.duration,
                    DASHBOARD_TEXT.tables.lastError,
                ]}
            >
                {activeGroup.tests.length > 0 ? activeGroup.tests.map((test) => <DashboardCurrentRunTestRow key={`${activeGroup.id}-${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} yesLabel={DASHBOARD_TEXT.states.yes} noLabel={DASHBOARD_TEXT.states.no} />) : <DashboardEmptyTableRow colSpan={7} message={DASHBOARD_TEXT.testsBrowser.empty} />}
            </DashboardTable>
        </Panel>
    )
}

function RecentRunsPanel(props: { summary: DashboardSummary }): React.JSX.Element {
    const previousRunLabel = props.summary.comparison.previousRun ? formatDate(props.summary.comparison.previousRun.reportTimestamp ?? props.summary.comparison.previousRun.generatedAt) : DASHBOARD_TEXT.states.noPreviousRunShort

    return (
        <Panel title={DASHBOARD_TEXT.metrics.latestRuns} titleMetricKey="latestRuns" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.recentRuns} className="span-2">
            <SummaryStrip
                className="compact-top"
                items={[
                    { label: DASHBOARD_TEXT.history.totalRuns, value: String(props.summary.history.totalRuns) },
                    { label: DASHBOARD_TEXT.history.previousRun, value: previousRunLabel },
                    { label: DASHBOARD_TEXT.history.latestSource, value: props.summary.sourceFile, muted: true },
                    { label: DASHBOARD_TEXT.history.currentBranch, value: `${props.summary.runMetadata.branch ?? '—'} • ${DASHBOARD_TEXT.commitMeta}: ${formatCommit(props.summary.runMetadata.commit)} • ${DASHBOARD_TEXT.authorMeta}: ${props.summary.runMetadata.author ?? '—'}`, muted: true },
                ]}
            />
            <DashboardTable
                headers={[
                    DASHBOARD_TEXT.tables.time,
                    DASHBOARD_TEXT.metrics.passRate,
                    DASHBOARD_TEXT.metrics.failures,
                    DASHBOARD_TEXT.metrics.flakyShort,
                    DASHBOARD_TEXT.tables.duration,
                    DASHBOARD_TEXT.tables.branch,
                    DASHBOARD_TEXT.tables.commit,
                    DASHBOARD_TEXT.tables.author,
                    DASHBOARD_TEXT.tables.source,
                ]}
            >
                {props.summary.history.recentRuns.length > 0 ? props.summary.history.recentRuns.map((run) => (
                    <tr key={run.id}>
                        <td>{formatDate(run.reportTimestamp ?? run.generatedAt)}</td>
                        <td>{formatPercent(run.passRate)}</td>
                        <td>{run.failedTests}</td>
                        <td>{run.flakyTests}</td>
                        <td>{formatDuration(run.totalDurationMs)}</td>
                        <td>{run.branch ?? '—'}</td>
                        <td>{formatCommit(run.commit)}</td>
                        <td>{run.author ?? '—'}</td>
                        <td>{run.sourceFile}</td>
                    </tr>
                )) : <DashboardEmptyTableRow colSpan={9} message={DASHBOARD_TEXT.states.historyEmpty} />}
            </DashboardTable>
        </Panel>
    )
}

function BreakdownTable(props: { labelColumn: string; items: DashboardDurationBreakdownItem[]; emptyMessage: string }): React.JSX.Element {
    return (
        <DashboardTable headers={[props.labelColumn, DASHBOARD_TEXT.tables.duration, DASHBOARD_TEXT.tables.share, DASHBOARD_TEXT.tables.tests]}>
            {props.items.length > 0 ? props.items.map((item) => (
                <tr key={`${item.label}-${item.durationMs}`}>
                    <td>{item.label}</td>
                    <td>{formatDuration(item.durationMs)}</td>
                    <td>{formatPercent(item.sharePercent)}</td>
                    <td>{item.tests}</td>
                </tr>
            )) : <DashboardEmptyTableRow colSpan={4} message={props.emptyMessage} />}
        </DashboardTable>
    )
}

function FlakyTestRow(props: { test: DashboardFlakyTestMetric; summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    return (
        <tr>
            <td><DashboardTestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={props.test.title} project={props.test.project} file={props.test.file} /></td>
            <td>{props.test.file}</td>
            <td>{formatScore(props.test.flakyScore)}</td>
            <td>{formatPercent(props.test.failRate)}</td>
            <td>{props.test.mtbfDays === null ? '—' : `${props.test.mtbfDays.toFixed(2)} дн`}</td>
            <td>{props.test.unstableRuns} / {props.test.totalRuns}</td>
            <td><StatusBadge label={formatStatusLabel(props.test.latestStatus, false)} tone={getStatusTone(props.test.latestStatus, false)} /></td>
        </tr>
    )
}

function buildLineChart(labels: string[], values: number[], color: string): FrontendChartData<'line'> {
    return {
        labels,
        datasets: [
            {
                label: 'dataset',
                data: values,
                borderColor: color,
                backgroundColor: `${color}33`,
                tension: 0.25,
                fill: true,
            },
        ],
    }
}

function buildBarChart(labels: string[], values: number[], color: string): FrontendChartData<'bar'> {
    return {
        labels,
        datasets: [
            {
                label: 'dataset',
                data: values,
                backgroundColor: color,
                borderRadius: 12,
            },
        ],
    }
}

function buildDoughnutChart(labels: string[], values: number[]): FrontendChartData<'doughnut'> {
    return {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: ['#0f766e', '#ea580c', '#ca8a04', '#1d4ed8', '#64748b', '#b91c1c'],
                borderWidth: 0,
            },
        ],
    }
}

function formatDurationDelta(value: number | null): string {
    if (value === null) {
        return DASHBOARD_TEXT.states.noPreviousRun
    }

    if (value === 0) {
        return DASHBOARD_TEXT.states.noChanges
    }

    const prefix = value > 0 ? '+' : ''
    return `${prefix}${value.toFixed(1)}% к прошлому прогону`
}

function mapManagerTone(level: 'healthy' | 'warning' | 'critical'): 'good' | 'warn' | 'danger' {
    if (level === 'healthy') {
        return 'good'
    }

    if (level === 'warning') {
        return 'warn'
    }

    return 'danger'
}

function mapChangeTone(direction: 'improving' | 'regressing' | 'stable'): 'good' | 'warn' | 'accent' {
    if (direction === 'improving') {
        return 'good'
    }

    if (direction === 'regressing') {
        return 'warn'
    }

    return 'accent'
}