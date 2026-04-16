import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { formatDailyRatio, formatScore, getScoreTone } from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { MetricCard } from '../../shared/ui'
import { DashboardRecentRunCompactRow, DashboardTablePanel } from './dashboard-test-table-parts'
import { mapManagerTone } from './dashboard-manager-helpers'

const DASHBOARD_TEXT = ru.dashboard

export function DashboardTeamOverviewMetrics(props: { summary: DashboardSummary }): React.JSX.Element {
    const { summary } = props

    return (
        <>
            <MetricCard label={DASHBOARD_TEXT.metrics.developerFriction} labelMetricKey="developerFriction" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.developerFriction} value={formatDailyRatio(summary.businessMetrics.developerFriction.rerunProxyPerActiveDay)} tone={summary.businessMetrics.developerFriction.rerunProxyPerActiveDay > 1 ? 'warn' : 'good'} hint={`${DASHBOARD_TEXT.business.unstableRuns}: ${summary.businessMetrics.developerFriction.unstableRuns}`} />
            <MetricCard label="Активные блокеры" labelMetricKey="problematicTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.problematicTests} value={String(summary.managerSummary.blockers.length)} tone={summary.managerSummary.blockers.length > 0 ? 'danger' : 'good'} hint="Критичные сигналы для команды" />
            <MetricCard label={DASHBOARD_TEXT.metrics.releaseConfidenceScore} labelMetricKey="releaseConfidenceScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore} value={formatScore(summary.businessMetrics.releaseConfidenceScore)} tone={getScoreTone(summary.businessMetrics.releaseConfidenceScore)} hint={summary.managerSummary.releaseReadiness.level} />
            <MetricCard label={DASHBOARD_TEXT.manager.deliveryRisk} labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.deliveryRisk} value={formatScore(summary.managerSummary.deliveryRisk.score)} tone={mapManagerTone(summary.managerSummary.deliveryRisk.level)} hint={summary.managerSummary.deliveryRisk.level} />
        </>
    )
}

export function DashboardTeamRecentRunsSection(props: { summary: DashboardSummary }): React.JSX.Element {
    return (
        <DashboardTablePanel
            title={DASHBOARD_TEXT.metrics.recentRuns}
            titleMetricKey="recentRuns"
            titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.recentRuns}
            className="span-2"
            headers={[
                DASHBOARD_TEXT.tables.time,
                DASHBOARD_TEXT.tables.branch,
                DASHBOARD_TEXT.tables.commit,
                DASHBOARD_TEXT.metrics.passRate,
                DASHBOARD_TEXT.metrics.failedTests,
                DASHBOARD_TEXT.metrics.flakyTests,
                DASHBOARD_TEXT.tables.duration,
                'Author',
            ]}
            rowCount={props.summary.history.recentRuns.length}
            emptyTitle="История запусков пуста"
            emptyMessage={DASHBOARD_TEXT.states.historyEmpty}
        >
            {props.summary.history.recentRuns.map((run) => <DashboardRecentRunCompactRow key={run.id} run={run} />)}
        </DashboardTablePanel>
    )
}