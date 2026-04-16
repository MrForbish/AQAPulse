/**
 * Назначение: полноценные React-модули dashboard для business/code quality/team/ai. Здесь собирается feature-level UI поверх уже рассчитанных summary-метрик без возврата к legacy string renderer.
 */
import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import {
    formatCommit,
    formatDailyRatio,
    formatScore,
    getScoreTone,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { MetricCard, Panel } from '../../shared/ui'
import {
    DashboardBusinessConfigAssumptionsSection,
    DashboardBusinessCostSection,
    DashboardBusinessOverviewMetrics,
    DashboardBusinessReadinessSection,
    DashboardBusinessReleaseConfidenceSection,
    DashboardBusinessSummarySection,
} from './dashboard-business-sections'
import {
    DashboardAiClustersSection,
    DashboardAiOverviewMetrics,
    DashboardAiReadinessSection,
    DashboardAiRiskRankingSection,
} from './dashboard-ai-sections'
import { mapChangeTone, mapManagerTone } from './dashboard-manager-helpers'
import {
    DashboardEmptyTableRow,
    DashboardProblematicTestRow,
    DashboardSlowTestRow,
    DashboardTablePanel,
} from './dashboard-test-table-parts'
import {
    DashboardManagerBlockersSection,
    DashboardManagerChangesSection,
    DashboardManagerSummarySection,
} from './dashboard-manager-sections'
import { DashboardTeamOverviewMetrics, DashboardTeamRecentRunsSection } from './dashboard-team-sections'

const DASHBOARD_TEXT = ru.dashboard

export function BusinessModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <DashboardBusinessOverviewMetrics summary={summary} />
            <DashboardBusinessSummarySection summary={summary} />
            <DashboardBusinessReleaseConfidenceSection summary={summary} />
            <DashboardBusinessReadinessSection summary={summary} />
            <DashboardBusinessCostSection summary={summary} />
            <DashboardBusinessConfigAssumptionsSection summary={summary} />

            <DashboardManagerSummarySection summary={summary} mapTone={mapManagerTone} />
            <DashboardManagerBlockersSection summary={summary} />
            <DashboardManagerChangesSection summary={summary} mapTone={mapChangeTone} mode="pill-with-value" />
        </div>
    )
}

export function CodeQualityModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <MetricCard label="Problem hotspots" labelMetricKey="problematicTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.problematicTests} value={String(summary.topProblematicTests.length)} tone={summary.topProblematicTests.length > 0 ? 'warn' : 'good'} hint="Текущий backlog по тестам с максимальным риском" />
            <MetricCard label={DASHBOARD_TEXT.metrics.flakyScore} labelMetricKey="flakyScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyScore} value={summary.flakyAnalytics.averageFlakyScore === null ? '—' : formatScore(summary.flakyAnalytics.averageFlakyScore)} tone={summary.flakyAnalytics.averageFlakyScore === null ? 'default' : getScoreTone(summary.flakyAnalytics.averageFlakyScore)} hint="Средний исторический сигнал нестабильности" />
            <MetricCard label={DASHBOARD_TEXT.metrics.errorClusters} labelMetricKey="errorClusters" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.errorClusters} value={String(summary.errorClusters.length)} tone={summary.errorClusters.length > 0 ? 'warn' : 'good'} hint="Повторяемые patterns падений" />
            <MetricCard label={DASHBOARD_TEXT.metrics.leadingPhase} labelMetricKey="leadingPhase" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} value={summary.performance.phaseBreakdown[0]?.label ?? '—'} hint={summary.performance.phaseBreakdown[0] ? formatPercent(summary.performance.phaseBreakdown[0].sharePercent) : DASHBOARD_TEXT.states.noChanges} />

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

            <Panel title={DASHBOARD_TEXT.metrics.phaseBreakdown} titleMetricKey="phaseBreakdown" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} description={DASHBOARD_TEXT.performance.phaseBreakdownDescription}>
                <div className="stacked-bars compact-top">
                    {summary.performance.phaseBreakdown.map((item) => (
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

            <Panel title={DASHBOARD_TEXT.metrics.suiteDuration} titleMetricKey="suiteDuration" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription}>
                <div className="stacked-bars compact-top">
                    {summary.performance.suiteDuration.map((item) => (
                        <div key={item.label} className="stacked-bar-item">
                            <div className="stacked-bar-copy stacked-bar-copy-spread">
                                <span>{item.label}</span>
                                <strong>{formatDuration(item.durationMs)} • {item.tests}</strong>
                            </div>
                            <div className="stacked-bar-track">
                                <div className="stacked-bar-fill is-warn" style={{ width: `${Math.max(8, item.sharePercent)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>

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
        </div>
    )
}

export function TeamModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <DashboardTeamOverviewMetrics summary={summary} />
            <DashboardManagerSummarySection summary={summary} mapTone={mapManagerTone} />
            <DashboardManagerBlockersSection summary={summary} includeMeta />
            <DashboardManagerChangesSection summary={summary} mapTone={mapChangeTone} mode="separate-value" />
            <DashboardTeamRecentRunsSection summary={summary} />
        </div>
    )
}

export function AiModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <DashboardAiOverviewMetrics summary={summary} />
            <DashboardAiRiskRankingSection summary={summary} workspaceSlug={props.workspaceSlug} />
            <DashboardAiClustersSection summary={summary} />
            <DashboardAiReadinessSection summary={summary} />
        </div>
    )
}

