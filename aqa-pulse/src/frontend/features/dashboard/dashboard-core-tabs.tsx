import React from 'react'
import { Link } from 'react-router-dom'
import type {
    DashboardCurrentRunTest,
    DashboardDurationBreakdownItem,
    DashboardFlakyTestMetric,
    DashboardProblematicTest,
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
import { ru } from '../../../shared/i18n/ru'
import { buildTestHistoryHref } from '../../runtime'
import { ChartCard, type FrontendChartData } from '../../shared/chart-card'
import { EmptyState, MetricCard, Panel, StatusBadge } from '../../shared/ui'

const DASHBOARD_TEXT = ru.dashboard

export function OverviewTab(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    return (
        <div className="page-grid">
            <ManagerOverviewPanel summary={props.summary} />
            <ChartCard title={DASHBOARD_TEXT.metrics.passRateTrend} type="line" data={buildLineChart(props.summary.charts.passRateTrend.labels, props.summary.charts.passRateTrend.values, '#0f766e')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.statusDistribution} type="doughnut" data={buildDoughnutChart(props.summary.charts.statusDistribution.labels, props.summary.charts.statusDistribution.values)} />
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
            <MetricCard label={DASHBOARD_TEXT.metrics.p95Duration} value={formatDuration(props.summary.performance.p95DurationMs)} hint="95% тестов укладываются в это значение или быстрее" />
            <MetricCard label={DASHBOARD_TEXT.metrics.p99Duration} value={formatDuration(props.summary.performance.p99DurationMs)} hint="Хвост самых долгих 1% тестов текущего среза" />
            <MetricCard label={DASHBOARD_TEXT.metrics.leadingPhase} value={leadingPhase ? formatPerformancePhaseLabel(leadingPhase.label) : '—'} hint={leadingPhase ? `${formatPercent(leadingPhase.sharePercent)} от длительности прогона` : 'Нет данных по фазам'} />
            <MetricCard label={DASHBOARD_TEXT.metrics.durationPerBrowser} value={topBrowser?.label ?? '—'} hint={topBrowser ? `${formatDuration(topBrowser.durationMs)} • ${topBrowser.tests} тестов` : 'Нет данных по браузерам / проектам'} />
            <MetricCard label={DASHBOARD_TEXT.metrics.suiteDuration} value={topSuite?.label ?? '—'} hint={topSuite ? `${formatDuration(topSuite.durationMs)} • ${topSuite.tests} тестов` : 'Нет данных по наборам'} />
            <MetricCard label={DASHBOARD_TEXT.metrics.durationTrend} value={formatDuration(props.summary.performance.durationTrend.currentDurationMs)} tone={props.summary.performance.durationTrend.deltaPercent !== null && props.summary.performance.durationTrend.deltaPercent > 0 ? 'warn' : 'good'} hint={formatDurationDelta(props.summary.performance.durationTrend.deltaPercent)} />

            <ChartCard title={DASHBOARD_TEXT.metrics.durationTrend} description={DASHBOARD_TEXT.tooltips.durationTrend} type="line" data={buildLineChart(props.summary.charts.durationTrend.labels, props.summary.charts.durationTrend.values, '#1d4ed8')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.topSlowestTests} description={DASHBOARD_TEXT.tooltips.topSlowestTests} type="bar" data={buildBarChart(props.summary.charts.slowestTests.labels, props.summary.charts.slowestTests.values, '#f97316')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.phaseBreakdown} description={DASHBOARD_TEXT.performance.phaseBreakdownDescription} type="bar" data={buildBarChart(props.summary.performance.phaseBreakdown.map((item) => formatPerformancePhaseLabel(item.label)), props.summary.performance.phaseBreakdown.map((item) => roundOne(item.sharePercent)), '#f59e0b')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription} type="bar" data={buildBarChart(props.summary.performance.suiteDuration.map((item) => item.label), props.summary.performance.suiteDuration.map((item) => roundOne(item.durationMs / 60000)), '#22c55e')} />

            <Panel title={DASHBOARD_TEXT.performance.runtimeBreakdownTitle} description={DASHBOARD_TEXT.performance.durationPerBrowserDescription}>
                <BreakdownTable labelColumn={DASHBOARD_TEXT.filters.project} items={props.summary.performance.durationPerBrowser} emptyMessage={DASHBOARD_TEXT.states.performanceBreakdownEmpty} />
            </Panel>
            <Panel title={DASHBOARD_TEXT.metrics.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription}>
                <BreakdownTable labelColumn={DASHBOARD_TEXT.tables.group} items={props.summary.performance.suiteDuration} emptyMessage={DASHBOARD_TEXT.states.performanceBreakdownEmpty} />
            </Panel>

            <Panel title={DASHBOARD_TEXT.metrics.topSlowestTestsP1} className="span-2">
                {props.summary.performance.slowestTests.length > 0 ? (
                    <div className="table-wrap compact-top">
                        <table>
                            <thead>
                                <tr>
                                    <th>{DASHBOARD_TEXT.tables.test}</th>
                                    <th>{DASHBOARD_TEXT.tables.file}</th>
                                    <th>{DASHBOARD_TEXT.tables.status}</th>
                                    <th>{DASHBOARD_TEXT.tables.flaky}</th>
                                    <th>{DASHBOARD_TEXT.tables.duration}</th>
                                    <th>{DASHBOARD_TEXT.tables.lastError}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.summary.performance.slowestTests.map((test) => (
                                    <tr key={`${test.project}-${test.file}-${test.title}`}>
                                        <td><TestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={test.title} project={test.project} file={test.file} /></td>
                                        <td>{test.file}</td>
                                        <td><StatusBadge label={formatStatusLabel(test.status, test.flaky)} tone={getStatusTone(test.status, test.flaky)} /></td>
                                        <td>{test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no}</td>
                                        <td>{formatDuration(test.durationMs)}</td>
                                        <td className="mono-cell">{test.errorMessage ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="Медленные тесты не обнаружены" message={DASHBOARD_TEXT.states.slowTestsEmpty} />
                )}
            </Panel>
        </div>
    )
}

export function FlakyTab(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const flakyInsight = buildFlakyHistoryInsight(props.summary)

    return (
        <div className="page-grid">
            <MetricCard label={DASHBOARD_TEXT.metrics.flakyScore} value={props.summary.flakyAnalytics.averageFlakyScore === null ? '—' : formatScore(props.summary.flakyAnalytics.averageFlakyScore)} tone={props.summary.flakyAnalytics.averageFlakyScore === null ? 'default' : getScoreTone(props.summary.flakyAnalytics.averageFlakyScore)} />
            <MetricCard label="Average MTBF" value={props.summary.flakyAnalytics.averageMtbfDays === null ? '—' : `${props.summary.flakyAnalytics.averageMtbfDays.toFixed(2)} дн`} />
            <MetricCard label="First Flake to Fix" value={props.summary.flakyAnalytics.firstFlakeToFix ? `${props.summary.flakyAnalytics.firstFlakeToFix.days.toFixed(1)} дн` : '—'} />
            <MetricCard label="Исторических flaky" value={String(props.summary.flakyAnalytics.topFlakyTests.length)} hint={formatDelta(props.summary.flakyAnalytics.flakyTrend.delta, 'к прошлому прогону')} />

            <ChartCard title={DASHBOARD_TEXT.metrics.flakyTrend} type="bar" data={buildBarChart(props.summary.charts.flakyTrend.labels, props.summary.charts.flakyTrend.values, '#d97706')} />
            <ChartCard title={DASHBOARD_TEXT.metrics.clusterDistribution} type="bar" data={buildBarChart(props.summary.charts.errorClusters.labels, props.summary.charts.errorClusters.values, '#ef4444')} />

            <Panel title={DASHBOARD_TEXT.metrics.problematicTests} className="span-2">
                {props.summary.topProblematicTests.length > 0 ? (
                    <div className="table-wrap compact-top">
                        <table>
                            <thead>
                                <tr>
                                    <th>{DASHBOARD_TEXT.tables.test}</th>
                                    <th>{DASHBOARD_TEXT.tables.file}</th>
                                    <th>{DASHBOARD_TEXT.tables.status}</th>
                                    <th>{DASHBOARD_TEXT.tables.flaky}</th>
                                    <th>Failure Rate</th>
                                    <th>{DASHBOARD_TEXT.tables.duration}</th>
                                    <th>{DASHBOARD_TEXT.tables.reason}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.summary.topProblematicTests.map((test) => <ProblematicTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} />)}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="Проблемные тесты не обнаружены" message={DASHBOARD_TEXT.states.problematicTestsEmpty} />
                )}
            </Panel>

            <div className={`inline-note${flakyInsight.tone === 'warn' ? ' is-warning' : flakyInsight.tone === 'info' ? ' is-info' : ''} span-2`}>
                <strong>{flakyInsight.title}</strong>
                <div className="compact-top">{flakyInsight.body}</div>
            </div>

            <Panel title={DASHBOARD_TEXT.metrics.topFlakyTests} className="span-2">
                {props.summary.flakyAnalytics.topFlakyTests.length > 0 ? (
                    <div className="table-wrap compact-top">
                        <table>
                            <thead>
                                <tr>
                                    <th>{DASHBOARD_TEXT.tables.test}</th>
                                    <th>{DASHBOARD_TEXT.tables.file}</th>
                                    <th>{DASHBOARD_TEXT.metrics.flakyScore}</th>
                                    <th>Fail Rate</th>
                                    <th>MTBF</th>
                                    <th>{DASHBOARD_TEXT.metrics.unstableRuns}</th>
                                    <th>{DASHBOARD_TEXT.metrics.lastStatus}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.summary.flakyAnalytics.topFlakyTests.map((test) => <FlakyTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} />)}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="Исторический список flaky-тестов пуст" message={getFlakyTopTestsEmptyState(props.summary)} />
                )}
            </Panel>

            <Panel title={DASHBOARD_TEXT.metrics.errorClusters} className="span-2">
                {props.summary.errorClusters.length > 0 ? (
                    <div className="table-wrap compact-top">
                        <table>
                            <thead>
                                <tr>
                                    <th>{DASHBOARD_TEXT.tables.error}</th>
                                    <th>{DASHBOARD_TEXT.tables.count}</th>
                                    <th>{DASHBOARD_TEXT.tables.testExamples}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.summary.errorClusters.map((cluster) => (
                                    <tr key={cluster.message}>
                                        <td className="mono-cell">{cluster.message}</td>
                                        <td>{cluster.count}</td>
                                        <td>{cluster.tests.join(' • ')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="Падений не обнаружено" message={DASHBOARD_TEXT.states.failuresEmpty} />
                )}
            </Panel>
        </div>
    )
}

function ManagerOverviewPanel(props: { summary: DashboardSummary }): React.JSX.Element {
    return (
        <Panel title={DASHBOARD_TEXT.manager.summaryTitle} description={DASHBOARD_TEXT.manager.summaryDescription} className="span-2">
            <div className="signal-grid compact-top">
                <MetricCard label={DASHBOARD_TEXT.manager.releaseReadiness} value={formatScore(props.summary.managerSummary.releaseReadiness.score)} tone={mapManagerTone(props.summary.managerSummary.releaseReadiness.level)} hint={getManagerReadinessLabel(props.summary.managerSummary.releaseReadiness.level)} />
                <MetricCard label={DASHBOARD_TEXT.manager.qualityRisk} value={formatScore(props.summary.managerSummary.qualityRisk.score)} tone={mapManagerTone(props.summary.managerSummary.qualityRisk.level)} hint={getManagerRiskLabel(props.summary.managerSummary.qualityRisk.level)} />
                <MetricCard label={DASHBOARD_TEXT.manager.deliveryRisk} value={formatScore(props.summary.managerSummary.deliveryRisk.score)} tone={mapManagerTone(props.summary.managerSummary.deliveryRisk.level)} hint={getManagerRiskLabel(props.summary.managerSummary.deliveryRisk.level)} />
            </div>
            <div className="split-grid compact-top">
                <div className="stack-list">
                    {props.summary.managerSummary.blockers.length > 0 ? props.summary.managerSummary.blockers.map((blocker, index) => (
                        <article key={`${blocker.kind}-${index}`} className="stack-item">
                            <div className="stack-item-header">
                                <strong>{blocker.title}</strong>
                                <StatusBadge label={blocker.value} tone={blocker.severity === 'critical' ? 'danger' : blocker.severity === 'warning' ? 'warn' : 'accent'} />
                            </div>
                            <p>{blocker.details}</p>
                            {blocker.testTitle ? <div className="subtle-copy">{blocker.testTitle}</div> : null}
                        </article>
                    )) : <EmptyState title="Блокеров нет" message={DASHBOARD_TEXT.manager.noBlockers} />}
                </div>
                <div className="stack-list">
                    {props.summary.managerSummary.changes.length > 0 ? props.summary.managerSummary.changes.map((change) => (
                        <article key={`${change.label}-${change.value}`} className="stack-item">
                            <div className="stack-item-header">
                                <strong>{change.label}</strong>
                                <span className={`module-pill is-${mapChangeTone(change.direction)}`}>{getManagerChangeLabel(change.direction)}</span>
                            </div>
                            <div className="summary-line compact-top">
                                <span>{change.value}</span>
                            </div>
                            <p>{change.details}</p>
                        </article>
                    )) : <EmptyState title="Изменений нет" message={DASHBOARD_TEXT.manager.noChanges} />}
                </div>
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
        <Panel title={DASHBOARD_TEXT.testsBrowser.title} description={DASHBOARD_TEXT.testsBrowser.description} className="span-2">
            <div className="status-switcher compact-top">
                {groups.map((group) => (
                    <button key={group.id} type="button" className={`status-switch-button${activeGroup.id === group.id ? ' is-active' : ''}`} onClick={() => setActiveGroupId(group.id)}>
                        <span>{group.label}</span>
                        <strong>{group.tests.length}</strong>
                    </button>
                ))}
            </div>
            <div className="table-wrap compact-top">
                <table>
                    <thead>
                        <tr>
                            <th>{DASHBOARD_TEXT.tables.test}</th>
                            <th>{DASHBOARD_TEXT.tables.file}</th>
                            <th>{DASHBOARD_TEXT.filters.project}</th>
                            <th>{DASHBOARD_TEXT.tables.status}</th>
                            <th>{DASHBOARD_TEXT.tables.flaky}</th>
                            <th>{DASHBOARD_TEXT.tables.duration}</th>
                            <th>{DASHBOARD_TEXT.tables.lastError}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeGroup.tests.length > 0 ? activeGroup.tests.map((test) => <CurrentRunTestRow key={`${activeGroup.id}-${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} />) : (
                            <tr>
                                <td colSpan={7}>{DASHBOARD_TEXT.testsBrowser.empty}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Panel>
    )
}

function RecentRunsPanel(props: { summary: DashboardSummary }): React.JSX.Element {
    const previousRunLabel = props.summary.comparison.previousRun ? formatDate(props.summary.comparison.previousRun.reportTimestamp ?? props.summary.comparison.previousRun.generatedAt) : DASHBOARD_TEXT.states.noPreviousRunShort

    return (
        <Panel title={DASHBOARD_TEXT.metrics.latestRuns} className="span-2">
            <div className="summary-strip compact-top">
                <SummaryStripItem label={DASHBOARD_TEXT.history.totalRuns} value={String(props.summary.history.totalRuns)} />
                <SummaryStripItem label={DASHBOARD_TEXT.history.previousRun} value={previousRunLabel} />
                <SummaryStripItem label={DASHBOARD_TEXT.history.latestSource} value={props.summary.sourceFile} muted />
                <SummaryStripItem label={DASHBOARD_TEXT.history.currentBranch} value={`${props.summary.runMetadata.branch ?? '—'} • ${DASHBOARD_TEXT.commitMeta}: ${formatCommit(props.summary.runMetadata.commit)} • ${DASHBOARD_TEXT.authorMeta}: ${props.summary.runMetadata.author ?? '—'}`} muted />
            </div>
            <div className="table-wrap compact-top">
                <table>
                    <thead>
                        <tr>
                            <th>{DASHBOARD_TEXT.tables.time}</th>
                            <th>{DASHBOARD_TEXT.metrics.passRate}</th>
                            <th>{DASHBOARD_TEXT.metrics.failures}</th>
                            <th>{DASHBOARD_TEXT.metrics.flakyShort}</th>
                            <th>{DASHBOARD_TEXT.tables.duration}</th>
                            <th>{DASHBOARD_TEXT.tables.branch}</th>
                            <th>{DASHBOARD_TEXT.tables.commit}</th>
                            <th>{DASHBOARD_TEXT.tables.author}</th>
                            <th>{DASHBOARD_TEXT.tables.source}</th>
                        </tr>
                    </thead>
                    <tbody>
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
                        )) : (
                            <tr>
                                <td colSpan={9}>{DASHBOARD_TEXT.states.historyEmpty}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Panel>
    )
}

function SummaryStripItem(props: { label: string; value: string; muted?: boolean }): React.JSX.Element {
    return (
        <article className="summary-strip-item">
            <span>{props.label}</span>
            <strong className={props.muted ? 'summary-strip-text' : ''}>{props.value}</strong>
        </article>
    )
}

function BreakdownTable(props: { labelColumn: string; items: DashboardDurationBreakdownItem[]; emptyMessage: string }): React.JSX.Element {
    return (
        <div className="table-wrap compact-top">
            <table>
                <thead>
                    <tr>
                        <th>{props.labelColumn}</th>
                        <th>{DASHBOARD_TEXT.tables.duration}</th>
                        <th>{DASHBOARD_TEXT.tables.share}</th>
                        <th>{DASHBOARD_TEXT.tables.tests}</th>
                    </tr>
                </thead>
                <tbody>
                    {props.items.length > 0 ? props.items.map((item) => (
                        <tr key={`${item.label}-${item.durationMs}`}>
                            <td>{item.label}</td>
                            <td>{formatDuration(item.durationMs)}</td>
                            <td>{formatPercent(item.sharePercent)}</td>
                            <td>{item.tests}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={4}>{props.emptyMessage}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

function CurrentRunTestRow(props: { test: DashboardCurrentRunTest; summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    return (
        <tr>
            <td><TestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={props.test.title} project={props.test.project} file={props.test.file} /></td>
            <td>{props.test.file}</td>
            <td>{props.test.project}</td>
            <td><StatusBadge label={formatStatusLabel(props.test.status, props.test.flaky)} tone={getStatusTone(props.test.status, props.test.flaky)} /></td>
            <td>{props.test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no}</td>
            <td>{formatDuration(props.test.durationMs)}</td>
            <td className="mono-cell">{props.test.errorMessage ?? '—'}</td>
        </tr>
    )
}

function ProblematicTestRow(props: { test: DashboardProblematicTest; summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    return (
        <tr>
            <td><TestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={props.test.title} project={props.test.project} file={props.test.file} /></td>
            <td>{props.test.file}</td>
            <td><StatusBadge label={formatStatusLabel(props.test.status, props.test.flaky)} tone={getStatusTone(props.test.status, props.test.flaky)} /></td>
            <td>{props.test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no}</td>
            <td>{formatPercent(props.test.failureRate)} ({props.test.attempts})</td>
            <td>{formatDuration(props.test.durationMs)}</td>
            <td className="mono-cell">{props.test.errorMessage}</td>
        </tr>
    )
}

function FlakyTestRow(props: { test: DashboardFlakyTestMetric; summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    return (
        <tr>
            <td><TestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={props.test.title} project={props.test.project} file={props.test.file} /></td>
            <td>{props.test.file}</td>
            <td>{formatScore(props.test.flakyScore)}</td>
            <td>{formatPercent(props.test.failRate)}</td>
            <td>{props.test.mtbfDays === null ? '—' : `${props.test.mtbfDays.toFixed(2)} дн`}</td>
            <td>{props.test.unstableRuns} / {props.test.totalRuns}</td>
            <td><StatusBadge label={formatStatusLabel(props.test.latestStatus, false)} tone={getStatusTone(props.test.latestStatus, false)} /></td>
        </tr>
    )
}

function TestHistoryLink(props: { workspaceSlug: string | null; summary: DashboardSummary; title: string; project: string; file: string }): React.JSX.Element {
    return (
        <Link className="entity-link" to={buildTestHistoryHref(props.workspaceSlug, props.title, {
            branch: props.summary.filters.branch,
            project: props.project,
            file: props.file,
        })}>
            {props.title}
        </Link>
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