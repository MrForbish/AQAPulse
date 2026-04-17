import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { formatDuration, formatPercent } from '../../../shared/formatting'
import {
    formatScore,
    getScoreTone,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { MetricCard, Panel } from '../../shared/ui'
import {
    DashboardProblematicTestRow,
    DashboardSlowTestRow,
    DashboardTablePanel,
} from './dashboard-test-table-parts'

const DASHBOARD_TEXT = ru.dashboard

export function DashboardCodeQualityOverviewMetrics(props: { summary: DashboardSummary }): React.JSX.Element {
    const { summary } = props

    return (
        <>
            <MetricCard label="Problem hotspots" labelMetricKey="problematicTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.problematicTests} value={String(summary.topProblematicTests.length)} tone={summary.topProblematicTests.length > 0 ? 'warn' : 'good'} hint="Текущий backlog по тестам с максимальным риском" />
            <MetricCard label={DASHBOARD_TEXT.metrics.flakyScore} labelMetricKey="flakyScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyScore} value={summary.flakyAnalytics.averageFlakyScore === null ? '—' : formatScore(summary.flakyAnalytics.averageFlakyScore)} tone={summary.flakyAnalytics.averageFlakyScore === null ? 'default' : getScoreTone(summary.flakyAnalytics.averageFlakyScore)} hint="Средний исторический сигнал нестабильности" />
            <MetricCard label={DASHBOARD_TEXT.metrics.errorClusters} labelMetricKey="errorClusters" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.errorClusters} value={String(summary.errorClusters.length)} tone={summary.errorClusters.length > 0 ? 'warn' : 'good'} hint="Повторяемые patterns падений" />
            <MetricCard label={DASHBOARD_TEXT.metrics.leadingPhase} labelMetricKey="leadingPhase" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} value={summary.performance.phaseBreakdown[0]?.label ?? '—'} hint={summary.performance.phaseBreakdown[0] ? formatPercent(summary.performance.phaseBreakdown[0].sharePercent) : DASHBOARD_TEXT.states.noChanges} />
        </>
    )
}

export function DashboardCodeQualityFailureHotspotsSection(props: {
    summary: DashboardSummary
    workspaceSlug: string | null
}): React.JSX.Element {
    const { summary } = props

    return (
        <DashboardTablePanel
            title="Failure hotspots"
            titleMetricKey="problematicTests"
            titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.problematicTests}
            description="Проблемные сценарии, которые прямо сейчас формируют основной backlog по качеству тестового кода."
            className="span-2"
            headers={[
                DASHBOARD_TEXT.tables.test,
                DASHBOARD_TEXT.tables.file,
                DASHBOARD_TEXT.tables.status,
                DASHBOARD_TEXT.tables.flaky,
                'Failure Rate',
                DASHBOARD_TEXT.tables.duration,
                DASHBOARD_TEXT.tables.lastError,
            ]}
            rowCount={summary.topProblematicTests.length}
            emptyTitle="Problem hotspots отсутствуют"
            emptyMessage={DASHBOARD_TEXT.states.problematicTestsEmpty}
        >
            {summary.topProblematicTests.map((test) => <DashboardProblematicTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={summary} workspaceSlug={props.workspaceSlug} yesLabel={DASHBOARD_TEXT.states.yes} noLabel={DASHBOARD_TEXT.states.no} />)}
        </DashboardTablePanel>
    )
}

export function DashboardCodeQualityPhaseBreakdownSection(props: { summary: DashboardSummary }): React.JSX.Element {
    return (
        <Panel title={DASHBOARD_TEXT.metrics.phaseBreakdown} titleMetricKey="phaseBreakdown" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} description={DASHBOARD_TEXT.performance.phaseBreakdownDescription}>
            <div className="stacked-bars compact-top">
                {props.summary.performance.phaseBreakdown.map((item) => (
                    <div key={item.label} className="stacked-bar-item">
                        <div className="stacked-bar-copy stacked-bar-copy-spread">
                            <span>{item.label}</span>
                            <strong>{formatDuration(item.durationMs)} • {formatPercent(item.sharePercent)}</strong>
                        </div>
                        <div className="stacked-bar-track">
                            <div className="stacked-bar-fill" style={{ width: `${Math.max(8, item.sharePercent)}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    )
}

export function DashboardCodeQualitySlowTestsSection(props: {
    summary: DashboardSummary
    workspaceSlug: string | null
}): React.JSX.Element {
    const { summary } = props

    return (
        <DashboardTablePanel
            title={DASHBOARD_TEXT.metrics.topSlowestTests}
            titleMetricKey="topSlowestTests"
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
            rowCount={summary.performance.slowestTests.length}
            emptyTitle="Медленные тесты не обнаружены"
            emptyMessage={DASHBOARD_TEXT.states.slowTestsEmpty}
        >
            {summary.performance.slowestTests.map((test) => <DashboardSlowTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={summary} workspaceSlug={props.workspaceSlug} yesLabel={DASHBOARD_TEXT.states.yes} noLabel={DASHBOARD_TEXT.states.no} />)}
        </DashboardTablePanel>
    )
}