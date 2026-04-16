import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { averageDashboardNumber, roundOne } from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { EmptyState, MetricCard, Panel } from '../../shared/ui'
import { DashboardClusterCard, DashboardClusterMetricHint } from './dashboard-cluster-parts'
import { ReadinessCard } from './dashboard-display-parts'
import { DashboardFlakyTestRow, DashboardTablePanel } from './dashboard-test-table-parts'

const DASHBOARD_TEXT = ru.dashboard

export function DashboardAiOverviewMetrics(props: { summary: DashboardSummary }): React.JSX.Element {
    const { summary } = props
    const signalCoverage = buildAiSignalCoverage(summary)

    return (
        <>
            <MetricCard label={DASHBOARD_TEXT.metrics.topFlakyTests} labelMetricKey="topFlakyTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topFlakyTests} value={String(summary.flakyAnalytics.topFlakyTests.length)} tone={summary.flakyAnalytics.topFlakyTests.length > 0 ? 'warn' : 'default'} hint="Risk ranking candidates" />
            <MetricCard
                label={DASHBOARD_TEXT.metrics.errorClusters}
                labelMetricKey="errorClusters"
                labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.clusterList}
                value={String(summary.errorClusters.length)}
                tone={summary.errorClusters.length > 0 ? 'warn' : 'good'}
                hint={<DashboardClusterMetricHint cluster={summary.errorClusters[0]} emptyLabel="Root-cause clusters unavailable" showTrace={false} />}
            />
            <MetricCard label="Signal coverage" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.signalCoverage} value={`${signalCoverage}%`} tone={signalCoverage >= 75 ? 'good' : signalCoverage >= 45 ? 'warn' : 'danger'} hint="Готовность данных для heuristics/ML" />
            <MetricCard label="First flake to fix" labelMetricKey="timeToFixFlaky" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.timeToFixFlaky} value={summary.flakyAnalytics.firstFlakeToFix ? `${summary.flakyAnalytics.firstFlakeToFix.days.toFixed(1)} дн` : '—'} hint="Исторический feedback loop" />
        </>
    )
}

export function DashboardAiRiskRankingSection(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    return (
        <DashboardTablePanel
            title="Risk ranking"
            titleMetricKey="topFlakyTests"
            titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topFlakyTests}
            description="Текущий React-модуль уже может ранжировать тесты для последующего root-cause и next-run risk scoring."
            className="span-2"
            headers={[
                DASHBOARD_TEXT.tables.test,
                DASHBOARD_TEXT.tables.file,
                DASHBOARD_TEXT.metrics.flakyScore,
                'Fail Rate',
                'MTBF',
                DASHBOARD_TEXT.metrics.lastStatus,
            ]}
            rowCount={props.summary.flakyAnalytics.topFlakyTests.length}
            emptyTitle="Исторических сигналов мало"
            emptyMessage={DASHBOARD_TEXT.states.flakyTestsEmpty}
        >
            {props.summary.flakyAnalytics.topFlakyTests.map((test) => <DashboardFlakyTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} />)}
        </DashboardTablePanel>
    )
}

export function DashboardAiClustersSection(props: { summary: DashboardSummary }): React.JSX.Element {
    return (
        <Panel title="Root-cause clusters" titleMetricKey="errorClusters" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.clusterList} description="Повторяемые ошибки уже можно использовать как базу для кластеризации, объяснений и рекомендаций." className="span-2">
            <div className="cluster-list compact-top">
                {props.summary.errorClusters.length > 0 ? props.summary.errorClusters.map((cluster) => (
                    <DashboardClusterCard key={cluster.message} cluster={cluster} />
                )) : <EmptyState title="Кластеры не обнаружены" message={DASHBOARD_TEXT.states.failuresEmpty} />}
            </div>
        </Panel>
    )
}

export function DashboardAiReadinessSection(props: { summary: DashboardSummary }): React.JSX.Element {
    return (
        <Panel title="Model readiness" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.modelReadiness} description="Эта секция показывает, насколько текущий ingestion уже даёт сигналы для heuristic/AI слоя.">
            <div className="readiness-list compact-top">
                <ReadinessCard label="История запусков" value={`${props.summary.history.totalRuns}`} hint="База для аномалий, risk ranking и trend моделей" tone={props.summary.history.totalRuns >= 5 ? 'good' : 'warn'} />
                <ReadinessCard label="Error clusters" value={`${props.summary.errorClusters.length}`} hint="База для группировки root cause и retrieval" tone={props.summary.errorClusters.length > 0 ? 'good' : 'warn'} />
                <ReadinessCard label="Resolved flaky incidents" value={props.summary.businessMetrics.timeToFixFlaky.resolvedIncidents.toString()} hint="Нужны для обучения recovery/fix feedback loop" tone={props.summary.businessMetrics.timeToFixFlaky.resolvedIncidents > 0 ? 'good' : 'warn'} />
            </div>
        </Panel>
    )
}

function buildAiSignalCoverage(summary: DashboardSummary): number {
    const signals = [
        summary.history.totalRuns >= 5 ? 100 : summary.history.totalRuns * 20,
        summary.errorClusters.length > 0 ? 100 : 25,
        summary.flakyAnalytics.topFlakyTests.length > 0 ? 100 : 30,
        summary.businessMetrics.timeToFixFlaky.resolvedIncidents > 0 ? 100 : 20,
    ]

    return roundOne(averageDashboardNumber(signals))
}