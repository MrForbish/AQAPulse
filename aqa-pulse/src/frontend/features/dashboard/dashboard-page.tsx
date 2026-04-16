/**
 * Назначение: React dashboard-страница с табами, KPI, графиками и переходами в test history для standalone и workspace режимов.
 */
import React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import { formatDelta, formatScore, getScoreTone } from '../../../shared/dashboard-helpers'
import { ru } from '../../../shared/i18n/ru'
import { useDashboardSummaryData } from '../../hooks/use-dashboard-summary'
import {
    buildDashboardHref,
    buildSummaryApiUrl,
    readFiltersFromSearchParams,
    useRuntime,
} from '../../runtime'
import { ErrorView, LoadingView, MetricCard, PageFrame, SegmentedTabs } from '../../shared/ui'
import { FlakyTab, OverviewTab, PerformanceTab } from './dashboard-core-tabs'
import { AiModule, BusinessModule, CodeQualityModule, TeamModule } from './dashboard-modules'

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

/**
 * Dashboard умеет переиспользовать bootstrap summary только когда URL и workspace совпадают с исходным shell, чтобы не показывать устаревшие данные после client-side navigation.
 */
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

    const { summary, isLoading, errorMessage } = useDashboardSummaryData({
        workspaceSlug: props.workspaceSlug,
        apiUrl,
        currentRequestUrl,
        initialSummary,
        isStaticMode,
    })

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
                        унифицированная экосистема для автоматизации тестирования, агрегации артефактов и контроля здоровья продукта на всех этапах CI/CD.
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

            {activeTab === 'overview' ? <OverviewTab summary={summary} workspaceSlug={props.workspaceSlug} /> : null}

            {activeTab === 'performance' ? <PerformanceTab summary={summary} workspaceSlug={props.workspaceSlug} /> : null}

            {activeTab === 'flaky' ? <FlakyTab summary={summary} workspaceSlug={props.workspaceSlug} /> : null}

            {activeTab === 'business' ? (
                <BusinessModule summary={summary} workspaceSlug={props.workspaceSlug} />
            ) : null}

            {activeTab === 'codeQuality' ? <CodeQualityModule summary={summary} workspaceSlug={props.workspaceSlug} /> : null}
            {activeTab === 'team' ? <TeamModule summary={summary} workspaceSlug={props.workspaceSlug} /> : null}
            {activeTab === 'ai' ? <AiModule summary={summary} workspaceSlug={props.workspaceSlug} /> : null}
        </PageFrame>
    )
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
