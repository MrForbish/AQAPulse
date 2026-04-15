import React from 'react'
import type { ChartData } from 'chart.js'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import type { DashboardErrorCluster, DashboardSummary } from '../../../dashboard-utils'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import {
    buildDashboardHref,
    buildSummaryApiUrl,
    buildTestHistoryHref,
    readFiltersFromSearchParams,
    useRuntime,
} from '../../runtime'
import { ChartCard } from '../../shared/chart-card'
import { EmptyState, ErrorView, LoadingView, MetricCard, PageFrame, Panel, SegmentedTabs, StatusBadge } from '../../shared/ui'

const DASHBOARD_TEXT = ru.dashboard

const DASHBOARD_TABS = [
    { id: 'overview', label: DASHBOARD_TEXT.tabs.overview },
    { id: 'performance', label: DASHBOARD_TEXT.tabs.performance },
    { id: 'flaky', label: DASHBOARD_TEXT.tabs.flaky },
    { id: 'business', label: DASHBOARD_TEXT.tabs.business },
    { id: 'codeQuality', label: DASHBOARD_TEXT.tabs.codeQuality },
    { id: 'team', label: DASHBOARD_TEXT.tabs.team },
    { id: 'ai', label: DASHBOARD_TEXT.tabs.ai },
] as const

export function DashboardPage(props: { workspaceSlug: string | null }): React.JSX.Element {
    const runtime = useRuntime()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = DASHBOARD_TABS.some((tab) => tab.id === searchParams.get('tab'))
        ? searchParams.get('tab') ?? 'overview'
        : 'overview'
    const currentRequestUrl = `${location.pathname}${location.search}`
    const filters = readFiltersFromSearchParams(searchParams)
    const apiUrl = buildSummaryApiUrl(props.workspaceSlug, filters)
    const isStaticMode = runtime.route.kind === 'static-dashboard'
    const bootstrapMatches = runtime.route.kind === 'static-dashboard'
        || (runtime.route.kind === 'dashboard'
            && runtime.route.workspaceSlug === props.workspaceSlug
            && runtime.initialRequestUrl === currentRequestUrl)
    const initialSummary = bootstrapMatches ? runtime.initialDashboardSummary : null

    const [summary, setSummary] = React.useState<DashboardSummary | null>(() => initialSummary)
    const [loadedRequestUrl, setLoadedRequestUrl] = React.useState<string | null>(() => initialSummary ? currentRequestUrl : null)
    const [isLoading, setIsLoading] = React.useState<boolean>(() => !initialSummary && !isStaticMode)
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (isStaticMode) {
            return undefined
        }

        if (loadedRequestUrl === currentRequestUrl && summary) {
            return undefined
        }

        const abortController = new AbortController()
        setIsLoading(true)
        setErrorMessage(null)

        void fetch(apiUrl, { signal: abortController.signal })
            .then(async (response) => {
                if (!response.ok) {
                    const payload = await safeReadError(response)
                    throw new Error(payload)
                }

                return response.json() as Promise<DashboardSummary>
            })
            .then((payload) => {
                setSummary(payload)
                setLoadedRequestUrl(currentRequestUrl)
            })
            .catch((error: unknown) => {
                if (!abortController.signal.aborted) {
                    setErrorMessage(error instanceof Error ? error.message : String(error))
                }
            })
            .finally(() => {
                if (!abortController.signal.aborted) {
                    setIsLoading(false)
                }
            })

        return () => {
            abortController.abort()
        }
    }, [apiUrl, currentRequestUrl, isStaticMode, loadedRequestUrl, summary])

    if (!summary && isLoading) {
        return (
            <PageFrame>
                <LoadingView label="Собираем React dashboard..." />
            </PageFrame>
        )
    }

    if (!summary) {
        return (
            <PageFrame>
                <ErrorView
                    title="Не удалось загрузить dashboard"
                    message={errorMessage ?? 'Сводка временно недоступна.'}
                    action={<a className="ghost-link" href={buildDashboardHref(props.workspaceSlug, filters)}>Перезагрузить страницу</a>}
                />
            </PageFrame>
        )
    }

    const selectedBranch = searchParams.get('branch') ?? ''
    const selectedProject = searchParams.get('project') ?? ''
    const selectedFile = searchParams.get('file') ?? ''

    return (
        <PageFrame>
            <section className="hero-block">
                <div>
                    <div className="eyebrow">React UI</div>
                    <h1>{DASHBOARD_TEXT.title}</h1>
                    <p>
                        UI теперь строится как модульный React frontend поверх существующих API и workspace-маршрутов.
                        Структура ориентирована на feature-модули, а не на одну строковую HTML-функцию на тысячи строк.
                    </p>
                </div>
                <div className="hero-meta-card">
                    <div className="hero-meta-row"><span>Workspace</span><strong>{props.workspaceSlug ?? 'default'}</strong></div>
                    <div className="hero-meta-row"><span>Отчёт</span><strong>{formatDate(summary.reportTimestamp ?? summary.generatedAt)}</strong></div>
                    <div className="hero-meta-row"><span>Источник</span><strong>{summary.sourceFile}</strong></div>
                    {isStaticMode ? <div className="hero-note">Статический snapshot, фильтры работают только в server mode.</div> : null}
                </div>
            </section>

            <section className="filters-block">
                <div className="filters-copy">
                    <h2>{DASHBOARD_TEXT.filters.title}</h2>
                    <p>{DASHBOARD_TEXT.filters.description}</p>
                </div>
                <div className="filters-grid">
                    <label>
                        <span>{DASHBOARD_TEXT.filters.branch}</span>
                        <select value={selectedBranch} disabled={isStaticMode} onChange={(event) => updateSearchParams(setSearchParams, 'branch', event.target.value)}>
                            <option value="">{DASHBOARD_TEXT.filters.all}</option>
                            {summary.availableFilters.branches.map((branch) => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>{DASHBOARD_TEXT.filters.project}</span>
                        <select value={selectedProject} disabled={isStaticMode} onChange={(event) => updateSearchParams(setSearchParams, 'project', event.target.value)}>
                            <option value="">{DASHBOARD_TEXT.filters.all}</option>
                            {summary.availableFilters.projects.map((project) => (
                                <option key={project} value={project}>{project}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>{DASHBOARD_TEXT.filters.file}</span>
                        <select value={selectedFile} disabled={isStaticMode} onChange={(event) => updateSearchParams(setSearchParams, 'file', event.target.value)}>
                            <option value="">{DASHBOARD_TEXT.filters.all}</option>
                            {summary.availableFilters.files.map((file) => (
                                <option key={file} value={file}>{file}</option>
                            ))}
                        </select>
                    </label>
                    <button type="button" className="secondary-button" disabled={isStaticMode} onClick={() => resetFilters(setSearchParams)}>
                        {DASHBOARD_TEXT.filters.reset}
                    </button>
                </div>
            </section>

            <section className="metrics-grid">
                <MetricCard label={DASHBOARD_TEXT.metrics.passRate} value={formatPercent(summary.kpis.passRate)} tone="good" hint={`${summary.kpis.passedTests} / ${summary.kpis.totalTests}`} />
                <MetricCard label={DASHBOARD_TEXT.metrics.failedTests} value={String(summary.kpis.failedTests)} tone={summary.kpis.failedTests > 0 ? 'danger' : 'default'} hint={formatDelta(summary.trend.failedTestsDelta, 'падений')} />
                <MetricCard label={DASHBOARD_TEXT.metrics.flakyTests} value={String(summary.kpis.flakyTests)} tone={summary.kpis.flakyTests > 0 ? 'warn' : 'default'} hint={formatDelta(summary.trend.flakyTestsDelta, 'flaky')} />
                <MetricCard label={DASHBOARD_TEXT.metrics.runDuration} value={formatDuration(summary.kpis.totalDurationMs)} hint={formatDuration(summary.kpis.medianDurationMs)} />
                <MetricCard label={DASHBOARD_TEXT.metrics.errorClusters} value={String(summary.kpis.errorClusterCount)} tone={summary.kpis.errorClusterCount > 0 ? 'warn' : 'default'} hint={summary.errorClusters[0]?.message ?? DASHBOARD_TEXT.states.notesEmpty} />
                <MetricCard label={DASHBOARD_TEXT.metrics.releaseConfidenceScore} value={formatScore(summary.businessMetrics.releaseConfidenceScore)} tone={getScoreTone(summary.businessMetrics.releaseConfidenceScore)} hint={summary.managerSummary.releaseReadiness.level} />
            </section>

            <SegmentedTabs activeTab={activeTab} items={DASHBOARD_TABS.map((item) => ({ id: item.id, label: item.label }))} onChange={(value) => updateSearchParams(setSearchParams, 'tab', value, true)} />

            {errorMessage ? <div className="inline-note is-warning">Последний запрос к API завершился с ошибкой: {errorMessage}</div> : null}
            {isLoading && summary ? <div className="inline-note">Обновляем данные под новый фильтр...</div> : null}

            {activeTab === 'overview' ? (
                <div className="page-grid">
                    <ChartCard title={DASHBOARD_TEXT.metrics.passRateTrend} type="line" data={buildLineChart(summary.charts.passRateTrend.labels, summary.charts.passRateTrend.values, '#0f766e')} />
                    <ChartCard title={DASHBOARD_TEXT.metrics.statusDistribution} type="doughnut" data={buildDoughnutChart(summary.charts.statusDistribution.labels, summary.charts.statusDistribution.values)} />
                    <Panel title={DASHBOARD_TEXT.testsBrowser.title} description={DASHBOARD_TEXT.testsBrowser.description} className="span-2">
                        <div className="status-strip">
                            {buildCurrentRunGroups(summary).map((item) => (
                                <div key={item.label} className="status-strip-item">
                                    <span>{item.label}</span>
                                    <strong>{item.count}</strong>
                                </div>
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
                                        <th>{DASHBOARD_TEXT.tables.duration}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.currentRunTests.all.slice(0, 10).map((test) => (
                                        <tr key={`${test.project}-${test.file}-${test.title}`}>
                                            <td>
                                                <Link className="entity-link" to={buildTestHistoryHref(props.workspaceSlug, test.title, {
                                                    branch: summary.filters.branch,
                                                    project: test.project,
                                                    file: test.file,
                                                })}>{test.title}</Link>
                                            </td>
                                            <td>{test.file}</td>
                                            <td>{test.project}</td>
                                            <td><StatusBadge label={formatStatusLabel(test.status, test.flaky)} tone={getStatusTone(test.status, test.flaky)} /></td>
                                            <td>{formatDuration(test.durationMs)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                    <Panel title={DASHBOARD_TEXT.metrics.problematicTests} className="span-2">
                        {summary.topProblematicTests.length > 0 ? (
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{DASHBOARD_TEXT.tables.test}</th>
                                            <th>{DASHBOARD_TEXT.tables.file}</th>
                                            <th>{DASHBOARD_TEXT.tables.status}</th>
                                            <th>Failure Rate</th>
                                            <th>{DASHBOARD_TEXT.tables.lastError}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.topProblematicTests.slice(0, 10).map((test) => (
                                            <tr key={`${test.project}-${test.file}-${test.title}`}>
                                                <td>
                                                    <Link className="entity-link" to={buildTestHistoryHref(props.workspaceSlug, test.title, {
                                                        branch: summary.filters.branch,
                                                        project: test.project,
                                                        file: test.file,
                                                    })}>{test.title}</Link>
                                                </td>
                                                <td>{test.file}</td>
                                                <td><StatusBadge label={formatStatusLabel(test.status, test.flaky)} tone={getStatusTone(test.status, test.flaky)} /></td>
                                                <td>{formatPercent(test.failureRate)}</td>
                                                <td className="mono-cell">{test.errorMessage}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState title="Чистый прогон" message={DASHBOARD_TEXT.states.problematicTestsEmpty} />
                        )}
                    </Panel>
                    <Panel title={DASHBOARD_TEXT.metrics.recentRuns} className="span-2">
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{DASHBOARD_TEXT.tables.time}</th>
                                        <th>{DASHBOARD_TEXT.tables.branch}</th>
                                        <th>{DASHBOARD_TEXT.tables.commit}</th>
                                        <th>{DASHBOARD_TEXT.metrics.passRate}</th>
                                        <th>{DASHBOARD_TEXT.metrics.runDuration}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.history.recentRuns.map((run) => (
                                        <tr key={run.id}>
                                            <td>{formatDate(run.reportTimestamp ?? run.generatedAt)}</td>
                                            <td>{run.branch ?? '—'}</td>
                                            <td>{formatCommit(run.commit)}</td>
                                            <td>{formatPercent(run.passRate)}</td>
                                            <td>{formatDuration(run.totalDurationMs)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </div>
            ) : null}

            {activeTab === 'performance' ? (
                <div className="page-grid">
                    <MetricCard label={DASHBOARD_TEXT.metrics.p95Duration} value={formatDuration(summary.performance.p95DurationMs)} />
                    <MetricCard label={DASHBOARD_TEXT.metrics.p99Duration} value={formatDuration(summary.performance.p99DurationMs)} />
                    <MetricCard label={DASHBOARD_TEXT.metrics.leadingPhase} value={summary.performance.phaseBreakdown[0]?.label ?? '—'} hint={summary.performance.phaseBreakdown[0] ? formatPercent(summary.performance.phaseBreakdown[0].sharePercent) : '—'} />
                    <MetricCard label={DASHBOARD_TEXT.performance.runtimeBreakdownTitle} value={summary.performance.durationPerBrowser[0]?.label ?? '—'} hint={summary.performance.durationPerBrowser[0] ? formatDuration(summary.performance.durationPerBrowser[0].durationMs) : '—'} />
                    <ChartCard title={DASHBOARD_TEXT.metrics.durationTrend} description={DASHBOARD_TEXT.tooltips.durationTrend} type="line" data={buildLineChart(summary.charts.durationTrend.labels, summary.charts.durationTrend.values, '#1d4ed8')} />
                    <ChartCard title={DASHBOARD_TEXT.metrics.phaseBreakdown} description={DASHBOARD_TEXT.performance.phaseBreakdownDescription} type="bar" data={buildBarChart(summary.performance.phaseBreakdown.map((item) => item.label), summary.performance.phaseBreakdown.map((item) => roundOne(item.sharePercent)), '#f59e0b')} />
                    <Panel title={DASHBOARD_TEXT.metrics.topSlowestTests} className="span-2">
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{DASHBOARD_TEXT.tables.test}</th>
                                        <th>{DASHBOARD_TEXT.tables.file}</th>
                                        <th>{DASHBOARD_TEXT.tables.status}</th>
                                        <th>{DASHBOARD_TEXT.tables.duration}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.performance.slowestTests.map((test) => (
                                        <tr key={`${test.project}-${test.file}-${test.title}`}>
                                            <td><Link className="entity-link" to={buildTestHistoryHref(props.workspaceSlug, test.title, {
                                                branch: summary.filters.branch,
                                                project: test.project,
                                                file: test.file,
                                            })}>{test.title}</Link></td>
                                            <td>{test.file}</td>
                                            <td><StatusBadge label={formatStatusLabel(test.status, test.flaky)} tone={getStatusTone(test.status, test.flaky)} /></td>
                                            <td>{formatDuration(test.durationMs)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                    <Panel title={DASHBOARD_TEXT.metrics.durationPerBrowser} description={DASHBOARD_TEXT.performance.durationPerBrowserDescription}>
                        <StackedBars items={summary.performance.durationPerBrowser.map((item) => ({
                            label: item.label,
                            value: formatDuration(item.durationMs),
                            width: `${Math.max(8, item.sharePercent)}%`,
                        }))} />
                    </Panel>
                    <Panel title={DASHBOARD_TEXT.metrics.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription}>
                        <StackedBars items={summary.performance.suiteDuration.map((item) => ({
                            label: item.label,
                            value: `${formatDuration(item.durationMs)} • ${item.tests} тестов`,
                            width: `${Math.max(8, item.sharePercent)}%`,
                        }))} />
                    </Panel>
                </div>
            ) : null}

            {activeTab === 'flaky' ? (
                <div className="page-grid">
                    <MetricCard label={DASHBOARD_TEXT.metrics.flakyScore} value={summary.flakyAnalytics.averageFlakyScore === null ? '—' : formatScore(summary.flakyAnalytics.averageFlakyScore)} />
                    <MetricCard label="Average MTBF" value={summary.flakyAnalytics.averageMtbfDays === null ? '—' : `${summary.flakyAnalytics.averageMtbfDays.toFixed(2)} дн`} />
                    <MetricCard label="First Flake to Fix" value={summary.flakyAnalytics.firstFlakeToFix ? `${summary.flakyAnalytics.firstFlakeToFix.days.toFixed(1)} дн` : '—'} />
                    <MetricCard label="Исторических flaky" value={String(summary.flakyAnalytics.topFlakyTests.length)} />
                    <ChartCard title={DASHBOARD_TEXT.metrics.flakyTrend} type="bar" data={buildBarChart(summary.charts.flakyTrend.labels, summary.charts.flakyTrend.values, '#d97706')} />
                    <Panel title={DASHBOARD_TEXT.metrics.topFlakyTests} className="span-2">
                        {summary.flakyAnalytics.topFlakyTests.length > 0 ? (
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{DASHBOARD_TEXT.tables.test}</th>
                                            <th>{DASHBOARD_TEXT.tables.file}</th>
                                            <th>{DASHBOARD_TEXT.metrics.flakyScore}</th>
                                            <th>Fail Rate</th>
                                            <th>MTBF</th>
                                            <th>{DASHBOARD_TEXT.metrics.lastStatus}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.flakyAnalytics.topFlakyTests.map((test) => (
                                            <tr key={`${test.project}-${test.file}-${test.title}`}>
                                                <td><Link className="entity-link" to={buildTestHistoryHref(props.workspaceSlug, test.title, {
                                                    branch: summary.filters.branch,
                                                    project: test.project,
                                                    file: test.file,
                                                })}>{test.title}</Link></td>
                                                <td>{test.file}</td>
                                                <td>{formatScore(test.flakyScore)}</td>
                                                <td>{formatPercent(test.failRate)}</td>
                                                <td>{test.mtbfDays === null ? '—' : `${test.mtbfDays.toFixed(2)} дн`}</td>
                                                <td><StatusBadge label={formatStatusLabel(test.latestStatus, false)} tone={getStatusTone(test.latestStatus, false)} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState title="История чистая" message={DASHBOARD_TEXT.states.flakyTestsEmpty} />
                        )}
                    </Panel>
                    <Panel title={DASHBOARD_TEXT.metrics.clusterDistribution} className="span-2">
                        <div className="cluster-list">
                            {summary.errorClusters.length > 0 ? summary.errorClusters.map((cluster) => <ClusterCard key={cluster.message} cluster={cluster} />) : <EmptyState title="Без кластеров" message={DASHBOARD_TEXT.states.failuresEmpty} />}
                        </div>
                    </Panel>
                </div>
            ) : null}

            {activeTab === 'business' ? (
                <div className="page-grid">
                    <MetricCard label={DASHBOARD_TEXT.metrics.costOfFlakiness} value={formatCurrency(summary.businessMetrics.costOfFlakiness.totalRub)} tone="warn" hint={DASHBOARD_TEXT.business.totalCostHint} />
                    <MetricCard label={DASHBOARD_TEXT.metrics.developerFriction} value={summary.businessMetrics.developerFriction.rerunProxyPerActiveDay.toFixed(2)} hint="rerun/day" />
                    <MetricCard label={DASHBOARD_TEXT.metrics.timeToFixFlaky} value={summary.businessMetrics.timeToFixFlaky.averageDays === null ? '—' : `${summary.businessMetrics.timeToFixFlaky.averageDays.toFixed(2)} дн`} />
                    <MetricCard label={DASHBOARD_TEXT.metrics.releaseConfidenceScore} value={formatScore(summary.businessMetrics.releaseConfidenceScore)} tone={getScoreTone(summary.businessMetrics.releaseConfidenceScore)} />
                    <Panel title={DASHBOARD_TEXT.business.releaseConfidenceBreakdownTitle} description={DASHBOARD_TEXT.business.releaseConfidenceBreakdownDescription}>
                        <StackedBars items={buildReleaseConfidenceBars(summary)} />
                    </Panel>
                    <Panel title={DASHBOARD_TEXT.manager.summaryTitle} description={DASHBOARD_TEXT.manager.summaryDescription}>
                        <div className="signal-grid">
                            <SignalCard label={DASHBOARD_TEXT.manager.releaseReadiness} score={summary.managerSummary.releaseReadiness.score} tone={summary.managerSummary.releaseReadiness.level} />
                            <SignalCard label={DASHBOARD_TEXT.manager.qualityRisk} score={summary.managerSummary.qualityRisk.score} tone={summary.managerSummary.qualityRisk.level} />
                            <SignalCard label={DASHBOARD_TEXT.manager.deliveryRisk} score={summary.managerSummary.deliveryRisk.score} tone={summary.managerSummary.deliveryRisk.level} />
                        </div>
                    </Panel>
                    <Panel title={DASHBOARD_TEXT.manager.blockersTitle} className="span-2">
                        <div className="stack-list">
                            {summary.managerSummary.blockers.length > 0 ? summary.managerSummary.blockers.map((blocker, index) => (
                                <article key={`${blocker.kind}-${index}`} className="stack-item">
                                    <div className="stack-item-header">
                                        <strong>{blocker.title}</strong>
                                        <StatusBadge label={blocker.value} tone={blocker.severity === 'critical' ? 'danger' : blocker.severity === 'warning' ? 'warn' : 'accent'} />
                                    </div>
                                    <p>{blocker.details}</p>
                                </article>
                            )) : <EmptyState title="Блокеров нет" message={DASHBOARD_TEXT.manager.noBlockers} />}
                        </div>
                    </Panel>
                </div>
            ) : null}

            {activeTab === 'codeQuality' ? <PlaceholderPanel title={DASHBOARD_TEXT.tabs.codeQuality} items={DASHBOARD_TEXT.placeholderMetrics.codeQuality} /> : null}
            {activeTab === 'team' ? <PlaceholderPanel title={DASHBOARD_TEXT.tabs.team} items={DASHBOARD_TEXT.placeholderMetrics.team} /> : null}
            {activeTab === 'ai' ? <PlaceholderPanel title={DASHBOARD_TEXT.tabs.ai} items={DASHBOARD_TEXT.placeholderMetrics.ai} /> : null}
        </PageFrame>
    )
}

function PlaceholderPanel(props: { title: string; items: readonly string[] }): React.JSX.Element {
    return (
        <Panel title={props.title} description="Этот раздел уже живет в новой архитектуре как отдельный feature-слой и готов к дальнейшему наращиванию без раздувания dashboard entrypoint.">
            <div className="placeholder-list">
                {props.items.map((item) => <div key={item} className="placeholder-item">{item}</div>)}
            </div>
        </Panel>
    )
}

function ClusterCard(props: { cluster: DashboardErrorCluster }): React.JSX.Element {
    return (
        <article className="stack-item">
            <div className="stack-item-header">
                <strong>{props.cluster.message}</strong>
                <StatusBadge label={`${props.cluster.count}`} tone="warn" />
            </div>
            <div className="subtle-copy">{props.cluster.tests.slice(0, 4).join(' • ')}</div>
        </article>
    )
}

function SignalCard(props: { label: string; score: number; tone: 'healthy' | 'warning' | 'critical' }): React.JSX.Element {
    return (
        <article className={`metric-card is-${props.tone === 'healthy' ? 'good' : props.tone === 'warning' ? 'warn' : 'danger'}`}>
            <div className="metric-label">{props.label}</div>
            <div className="metric-value">{formatScore(props.score)}</div>
            <div className="metric-hint">{props.tone}</div>
        </article>
    )
}

function StackedBars(props: { items: Array<{ label: string; value: string; width: string }> }): React.JSX.Element {
    return (
        <div className="stacked-bars">
            {props.items.map((item) => (
                <div key={`${item.label}-${item.value}`} className="stacked-bar-item">
                    <div className="stacked-bar-copy">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                    </div>
                    <div className="stacked-bar-track">
                        <div className="stacked-bar-fill" style={{ width: item.width }} />
                    </div>
                </div>
            ))}
        </div>
    )
}

function buildCurrentRunGroups(summary: DashboardSummary): Array<{ label: string; count: number }> {
    return [
        { label: DASHBOARD_TEXT.testsBrowser.passed, count: summary.currentRunTests.passed.length },
        { label: DASHBOARD_TEXT.testsBrowser.failed, count: summary.currentRunTests.failed.length },
        { label: DASHBOARD_TEXT.testsBrowser.flaky, count: summary.currentRunTests.flaky.length },
        { label: DASHBOARD_TEXT.testsBrowser.skipped, count: summary.currentRunTests.skipped.length },
        { label: DASHBOARD_TEXT.testsBrowser.timedOut, count: summary.currentRunTests.timedOut.length },
        { label: DASHBOARD_TEXT.testsBrowser.interrupted, count: summary.currentRunTests.interrupted.length },
    ]
}

function buildReleaseConfidenceBars(summary: DashboardSummary): Array<{ label: string; value: string; width: string }> {
    const passRate = Math.max(0, Math.min(100, summary.kpis.passRate))
    const inverseFlaky = Math.max(0, Math.min(100, 100 - summary.kpis.flakyRatio))
    const errorHealth = summary.kpis.totalTests === 0
        ? 100
        : Math.max(0, Math.min(100, 100 - ((summary.errorClusters.length / summary.kpis.totalTests) * 100)))
    const historyConsistency = summary.history.recentRuns.length > 0
        ? summary.history.recentRuns.reduce((total, run) => total + (run.passRate - run.flakyRatio), 0) / summary.history.recentRuns.length
        : summary.kpis.passRate - summary.kpis.flakyRatio

    return [
        { label: DASHBOARD_TEXT.business.releaseConfidencePassRate, value: `${roundOne(passRate)} × 0.4`, width: `${passRate}%` },
        { label: DASHBOARD_TEXT.business.releaseConfidenceFlakyRatio, value: `${roundOne(inverseFlaky)} × 0.3`, width: `${inverseFlaky}%` },
        { label: DASHBOARD_TEXT.business.releaseConfidenceErrorHealth, value: `${roundOne(errorHealth)} × 0.15`, width: `${errorHealth}%` },
        { label: DASHBOARD_TEXT.business.releaseConfidenceHistoryConsistency, value: `${roundOne(historyConsistency)} × 0.15`, width: `${Math.max(0, Math.min(100, historyConsistency))}%` },
    ]
}

function buildLineChart(labels: string[], values: number[], color: string): ChartData<'line'> {
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

function buildBarChart(labels: string[], values: number[], color: string): ChartData<'bar'> {
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

function buildDoughnutChart(labels: string[], values: number[]): ChartData<'doughnut'> {
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

function formatCommit(commit: string | null): string {
    return commit ? commit.slice(0, 8) : '—'
}

function formatStatusLabel(status: string, flaky: boolean): string {
    if (flaky) {
        return DASHBOARD_TEXT.statusLabels.flaky
    }

    return DASHBOARD_TEXT.statusLabels[status as keyof typeof DASHBOARD_TEXT.statusLabels] ?? status
}

function getStatusTone(status: string, flaky: boolean): 'neutral' | 'good' | 'warn' | 'danger' {
    if (flaky) {
        return 'warn'
    }

    const normalized = status.trim().toLowerCase()

    if (normalized === 'passed') {
        return 'good'
    }

    if (normalized === 'failed' || normalized === 'timedout' || normalized === 'timed out' || normalized === 'interrupted') {
        return 'danger'
    }

    if (normalized === 'skipped') {
        return 'neutral'
    }

    return 'neutral'
}

function getScoreTone(value: number): 'default' | 'good' | 'warn' | 'danger' {
    if (value >= 80) {
        return 'good'
    }

    if (value >= 60) {
        return 'warn'
    }

    return 'danger'
}

function formatCurrency(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(2)} ₽`
}

function formatScore(value: number): string {
    return `${roundOne(value)} / 100`
}

function formatDelta(value: number | null, label: string): string {
    if (value === null) {
        return DASHBOARD_TEXT.states.noPreviousRun
    }

    if (value === 0) {
        return DASHBOARD_TEXT.states.noChanges
    }

    const prefix = value > 0 ? '+' : ''
    return `${prefix}${value} ${label}`
}

function roundOne(value: number): number {
    return Math.round(value * 10) / 10
}

function updateSearchParams(
    setSearchParams: ReturnType<typeof useSearchParams>[1],
    key: string,
    value: string,
    keepValueWhenEmpty = false,
): void {
    setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)

        if (!value && !keepValueWhenEmpty) {
            nextParams.delete(key)
        } else {
            nextParams.set(key, value)
        }

        return nextParams
    })
}

function resetFilters(setSearchParams: ReturnType<typeof useSearchParams>[1]): void {
    setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.delete('branch')
        nextParams.delete('project')
        nextParams.delete('file')
        return nextParams
    })
}

async function safeReadError(response: Response): Promise<string> {
    try {
        const payload = await response.json() as { error?: string }
        return payload.error ?? `HTTP ${response.status}`
    } catch {
        return `HTTP ${response.status}`
    }
}