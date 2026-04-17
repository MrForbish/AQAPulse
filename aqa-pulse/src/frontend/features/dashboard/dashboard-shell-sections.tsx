import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import { formatDelta, formatScore, getManagerReadinessLabel, getScoreTone } from '../../../shared/dashboard-helpers'
import { ru } from '../../../shared/i18n/ru'
import { MetricCard } from '../../shared/ui'

const DASHBOARD_TEXT = ru.dashboard

export function DashboardHeroSection(props: {
    summary: DashboardSummary
    workspaceSlug: string | null
    isStaticMode: boolean
}): React.JSX.Element {
    return (
        <section className="hero-block">
            <div>
                <div className="eyebrow">TestOps</div>
                <h1>{DASHBOARD_TEXT.title}</h1>
                <p>
                    унифицированная экосистема для автоматизации тестирования, агрегации артефактов и контроля здоровья продукта на всех этапах CI/CD.
                </p>
            </div>
            <div className="hero-meta-card">
                <div className="hero-meta-row"><span>Workspace</span><strong>{props.workspaceSlug ?? 'default'}</strong></div>
                <div className="hero-meta-row"><span>Отчёт</span><strong>{formatDate(props.summary.reportTimestamp ?? props.summary.generatedAt)}</strong></div>
                <div className="hero-meta-row"><span>Источник</span><strong>{props.summary.sourceFile}</strong></div>
                {props.isStaticMode ? <div className="hero-note">Статический snapshot, фильтры работают только в server mode.</div> : null}
            </div>
        </section>
    )
}

export function DashboardFiltersSection(props: {
    summary: DashboardSummary
    isStaticMode: boolean
    selectedBranch: string
    selectedProject: string
    selectedFile: string
    onBranchChange: (value: string) => void
    onProjectChange: (value: string) => void
    onFileChange: (value: string) => void
    onReset: () => void
}): React.JSX.Element {
    return (
        <section className="filters-block">
            <div className="filters-copy">
                <h2>{DASHBOARD_TEXT.filters.title}</h2>
                <p>{DASHBOARD_TEXT.filters.description}</p>
            </div>
            <div className="filters-grid">
                <label>
                    <span>{DASHBOARD_TEXT.filters.branch}</span>
                    <select value={props.selectedBranch} disabled={props.isStaticMode} onChange={(event) => props.onBranchChange(event.target.value)}>
                        <option value="">{DASHBOARD_TEXT.filters.all}</option>
                        {props.summary.availableFilters.branches.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>{DASHBOARD_TEXT.filters.project}</span>
                    <select value={props.selectedProject} disabled={props.isStaticMode} onChange={(event) => props.onProjectChange(event.target.value)}>
                        <option value="">{DASHBOARD_TEXT.filters.all}</option>
                        {props.summary.availableFilters.projects.map((project) => (
                            <option key={project} value={project}>{project}</option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>{DASHBOARD_TEXT.filters.file}</span>
                    <select value={props.selectedFile} disabled={props.isStaticMode} onChange={(event) => props.onFileChange(event.target.value)}>
                        <option value="">{DASHBOARD_TEXT.filters.all}</option>
                        {props.summary.availableFilters.files.map((file) => (
                            <option key={file} value={file}>{file}</option>
                        ))}
                    </select>
                </label>
                <button type="button" className="secondary-button" disabled={props.isStaticMode} onClick={props.onReset}>
                    {DASHBOARD_TEXT.filters.reset}
                </button>
            </div>
        </section>
    )
}

export function DashboardMetricsSection(props: {
    summary: DashboardSummary
}): React.JSX.Element {
    const clusteredFailures = props.summary.errorClusters.reduce((total, cluster) => total + cluster.count, 0)
    const comparisonMode = props.summary.comparison.mode

    return (
        <section className="metrics-grid">
            <MetricCard label={DASHBOARD_TEXT.metrics.passRate} labelMetricKey="passRate" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.passRate} value={formatPercent(props.summary.kpis.passRate)} tone="good" hint={`${props.summary.kpis.passedTests} / ${props.summary.kpis.totalTests}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.failedTests} labelMetricKey="failedTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.failedTests} value={String(props.summary.kpis.failedTests)} tone={props.summary.kpis.failedTests > 0 ? 'danger' : 'default'} hint={formatDelta(props.summary.trend.failedTestsDelta, 'падений', comparisonMode)} />
            <MetricCard label={DASHBOARD_TEXT.metrics.flakyTests} labelMetricKey="flakyTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyTests} value={String(props.summary.kpis.flakyTests)} tone={props.summary.kpis.flakyTests > 0 ? 'warn' : 'default'} hint={formatDelta(props.summary.trend.flakyTestsDelta, 'flaky', comparisonMode)} />
            <MetricCard label={DASHBOARD_TEXT.metrics.runDuration} labelMetricKey="runDuration" labelTooltip={`${DASHBOARD_METRIC_DESCRIPTIONS.runDuration} ${DASHBOARD_METRIC_DESCRIPTIONS.medianDuration}`} value={formatDuration(props.summary.kpis.totalDurationMs)} hint={formatDuration(props.summary.kpis.medianDurationMs)} />
            <MetricCard
                label="Паттерны падений"
                labelMetricKey="errorClusters"
                labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.errorClusters}
                value={String(props.summary.kpis.errorClusterCount)}
                tone={props.summary.kpis.errorClusterCount > 0 ? 'warn' : 'default'}
                hint={clusteredFailures > 0 ? `Покрывают ${clusteredFailures} ${pluralizeFailures(clusteredFailures)} в текущем прогоне` : 'Повторяющихся падений в текущем прогоне нет'}
            />
            <MetricCard label={DASHBOARD_TEXT.metrics.releaseConfidenceScore} labelMetricKey="releaseConfidenceScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore} value={formatScore(props.summary.businessMetrics.releaseConfidenceScore)} tone={getScoreTone(props.summary.businessMetrics.releaseConfidenceScore)} hint={getManagerReadinessLabel(props.summary.managerSummary.releaseReadiness.level)} />
        </section>
    )
}

export function DashboardRuntimeNotices(props: {
    summaryPresent: boolean
    isLoading: boolean
    errorMessage: string | null
}): React.JSX.Element | null {
    if (props.errorMessage) {
        return <div className="inline-note is-warning">Последний запрос к API завершился с ошибкой: {props.errorMessage}</div>
    }

    if (props.isLoading && props.summaryPresent) {
        return <div className="inline-note">Обновляем данные под новый фильтр...</div>
    }

    return null
}

function pluralizeFailures(count: number): string {
    const absoluteCount = Math.abs(count) % 100
    const lastDigit = absoluteCount % 10

    if (absoluteCount >= 11 && absoluteCount <= 19) {
        return 'падений'
    }

    if (lastDigit === 1) {
        return 'падение'
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
        return 'падения'
    }

    return 'падений'
}