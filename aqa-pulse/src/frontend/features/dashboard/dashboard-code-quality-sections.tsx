import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import {
    formatNullablePercent,
    formatRunsPerHundred,
    formatScore,
    getCodeQualityFailureConcentration,
    getInverseScoreTone,
    getScoreTone,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { MetricCard } from '../../shared/ui'
import {
    DashboardProblematicTestRow,
    DashboardTablePanel,
} from './dashboard-test-table-parts'

const DASHBOARD_TEXT = ru.dashboard

export function DashboardCodeQualityOverviewMetrics(props: { summary: DashboardSummary }): React.JSX.Element {
    const { summary } = props
    const failureConcentration = getCodeQualityFailureConcentration(summary)
    const retryDensity = summary.businessMetrics.developerFriction.rerunBurdenPer100Runs

    return (
        <>
            <MetricCard label={DASHBOARD_TEXT.metrics.problemHotspots} labelMetricKey="problemHotspots" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.problemHotspots} value={String(summary.topProblematicTests.length)} tone={summary.topProblematicTests.length > 0 ? 'warn' : 'good'} hint="Сценарии, которые формируют текущий backlog на разбор" />
            <MetricCard label={DASHBOARD_TEXT.metrics.brittlenessProxy} labelMetricKey="brittlenessProxy" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.brittlenessProxy} value={summary.flakyAnalytics.averageFlakyScore === null ? '—' : formatScore(summary.flakyAnalytics.averageFlakyScore)} tone={summary.flakyAnalytics.averageFlakyScore === null ? 'default' : getInverseScoreTone(summary.flakyAnalytics.averageFlakyScore)} hint="Средний исторический flaky score по набору" />
            <MetricCard label={DASHBOARD_TEXT.metrics.failureConcentration} labelMetricKey="failureConcentration" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.failureConcentration} value={formatNullablePercent(failureConcentration)} tone={failureConcentration === null ? 'default' : failureConcentration >= 80 ? 'danger' : failureConcentration >= 50 ? 'warn' : 'good'} hint={failureConcentration === null ? 'В текущем прогоне нет неуспешных тестов' : 'Какая доля текущих неуспешных тестов сосредоточена в проблемных сценариях'} />
            <MetricCard label={DASHBOARD_TEXT.metrics.retryDensity} labelMetricKey="retryDensity" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.retryDensity} value={formatRunsPerHundred(retryDensity)} tone={retryDensity >= 25 ? 'warn' : 'good'} hint={`${summary.businessMetrics.developerFriction.extraRetries} лишних повторов • ${summary.businessMetrics.developerFriction.observedRuns} наблюдений в истории`} />
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
            title="Проблемные сценарии падений"
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
            emptyTitle="Проблемные сценарии не обнаружены"
            emptyMessage={DASHBOARD_TEXT.states.problematicTestsEmpty}
        >
            {summary.topProblematicTests.map((test) => <DashboardProblematicTestRow key={`${test.project}-${test.file}-${test.title}`} test={test} summary={summary} workspaceSlug={props.workspaceSlug} yesLabel={DASHBOARD_TEXT.states.yes} noLabel={DASHBOARD_TEXT.states.no} />)}
        </DashboardTablePanel>
    )
}
