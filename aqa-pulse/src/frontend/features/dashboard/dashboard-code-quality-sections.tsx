import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import {
    formatScore,
    getScoreTone,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { EmptyState, MetricCard, Panel } from '../../shared/ui'
import {
    DashboardProblematicTestRow,
    DashboardTablePanel,
} from './dashboard-test-table-parts'
import { ReadinessCard } from './dashboard-display-parts'

const DASHBOARD_TEXT = ru.dashboard

export function DashboardCodeQualityOverviewMetrics(props: { summary: DashboardSummary }): React.JSX.Element {
    const metrics = props.summary.codeQuality
    const coverageHint = `${metrics.matchedTests} из ${metrics.analyzableTests} тестов привязаны к исходникам • ${metrics.analyzedFiles} файлов разобрано`

    return (
        <>
            <MetricCard label={DASHBOARD_TEXT.metrics.testSmellScore} labelMetricKey="testSmellScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.testSmellScore} value={formatNullableScore(metrics.testSmellScore)} tone={metrics.testSmellScore === null ? 'default' : getScoreTone(metrics.testSmellScore)} hint={coverageHint} />
            <MetricCard label={DASHBOARD_TEXT.metrics.pomCompliance} labelMetricKey="pomCompliance" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.pomCompliance} value={formatNullablePercent(metrics.pomCompliancePercent)} tone={resolvePercentTone(metrics.pomCompliancePercent)} hint="Доля тестов, где spec-файл опирается на page object / screen-model слой" />
            <MetricCard label={DASHBOARD_TEXT.metrics.assertionDensity} labelMetricKey="assertionDensity" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.assertionDensity} value={formatPerTestMetric(metrics.assertionDensity)} tone={resolveAssertionDensityTone(metrics.assertionDensity)} hint="Среднее число expect() на тест по разобранным исходникам" />
            <MetricCard label={DASHBOARD_TEXT.metrics.waitStrategyScore} labelMetricKey="waitStrategyScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.waitStrategyScore} value={formatNullablePercent(metrics.waitStrategyScore)} tone={resolvePercentTone(metrics.waitStrategyScore)} hint="Соотношение web-first/assert-based ожиданий к waitForTimeout и другим жёстким паузам" />
            <MetricCard label={DASHBOARD_TEXT.metrics.stepGranularity} labelMetricKey="stepGranularity" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.stepGranularity} value={formatPerTestMetric(metrics.stepGranularity)} tone={resolveStepGranularityTone(metrics.stepGranularity)} hint="Среднее число test.step на тест" />
            <MetricCard label={DASHBOARD_TEXT.metrics.isolationScore} labelMetricKey="isolationScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.isolationScore} value={formatNullableScore(metrics.isolationScore)} tone={metrics.isolationScore === null ? 'default' : getScoreTone(metrics.isolationScore)} hint="Эвристика по shared state, beforeAll и serial-mode в test source" />
            <MetricCard label={DASHBOARD_TEXT.metrics.selectorStability} labelMetricKey="selectorStability" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.selectorStability} value={formatNullablePercent(metrics.selectorStabilityPercent)} tone={resolvePercentTone(metrics.selectorStabilityPercent)} hint="Баланс между role/testid-селекторами и хрупкими CSS/XPath-паттернами" />
            <MetricCard label={DASHBOARD_TEXT.metrics.sourceCoverage} labelMetricKey="sourceCoverage" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.sourceCoverage} value={formatNullablePercent(metrics.sourceCoveragePercent)} tone={resolvePercentTone(metrics.sourceCoveragePercent)} hint={coverageHint} />
        </>
    )
}

export function DashboardCodeQualityDriversSection(props: { summary: DashboardSummary }): React.JSX.Element {
    const { drivers } = props.summary.codeQuality

    return (
        <Panel
            title="Ключевые драйверы качества кода"
            titleMetricKey="codeQuality"
            titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.codeQuality}
            description="Самые сильные сигналы, которые сейчас тянут вниз smell score, wait strategy и поддерживаемость Playwright-слоя."
            className="span-2"
        >
            {drivers.length > 0 ? (
                <div className="page-grid compact-top">
                    {drivers.map((driver) => (
                        <ReadinessCard
                            key={driver.label}
                            label={driver.label}
                            value={`${driver.count}`}
                            hint={driver.hint}
                            tone={driver.impact === 'high' ? 'danger' : driver.impact === 'medium' ? 'warn' : 'good'}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState title="Недостаточно source coverage" message="AQA Pulse не нашёл test source рядом с репортом, поэтому драйверы качества кода пока не построены." />
            )}
        </Panel>
    )
}

export function DashboardCodeQualityRiskFilesSection(props: { summary: DashboardSummary }): React.JSX.Element {
    const { topRiskFiles } = props.summary.codeQuality

    return (
        <DashboardTablePanel
            title="Файлы с наибольшим риском качества"
            titleMetricKey="codeQuality"
            titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.codeQuality}
            description="Сводка по spec-файлам, где source-анализ нашёл наибольшую концентрацию smell-сигналов и хрупких практик."
            className="span-2"
            headers={[
                DASHBOARD_TEXT.tables.file,
                'Тестов',
                'Smell',
                'POM',
                'Assertions',
                'Waits',
                'Isolation',
                'Selectors',
                'Сигналы',
            ]}
            rowCount={topRiskFiles.length}
            emptyTitle="Source-анализ не собран"
            emptyMessage="Не удалось сопоставить тесты текущего среза с исходниками spec-файлов."
        >
            {topRiskFiles.map((fileMetric) => (
                <tr key={fileMetric.file}>
                    <td>{fileMetric.file}</td>
                    <td>{fileMetric.matchedTests}</td>
                    <td>{formatNullableScore(fileMetric.smellScore)}</td>
                    <td>{formatNullablePercent(fileMetric.pomCompliancePercent)}</td>
                    <td>{formatPerTestMetric(fileMetric.assertionDensity)}</td>
                    <td>{formatNullablePercent(fileMetric.waitStrategyScore)}</td>
                    <td>{formatNullableScore(fileMetric.isolationScore)}</td>
                    <td>{formatNullablePercent(fileMetric.selectorStabilityPercent)}</td>
                    <td>{fileMetric.notableSignals.length > 0 ? fileMetric.notableSignals.join(' • ') : '—'}</td>
                </tr>
            ))}
        </DashboardTablePanel>
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

function formatNullablePercent(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)}%`
}

function formatNullableScore(value: number | null): string {
    return value === null ? '—' : formatScore(value)
}

function formatPerTestMetric(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(2)} / тест`
}

function resolvePercentTone(value: number | null): 'default' | 'good' | 'warn' | 'danger' {
    if (value === null) {
        return 'default'
    }

    return getScoreTone(value)
}

function resolveAssertionDensityTone(value: number | null): 'default' | 'good' | 'warn' | 'danger' {
    if (value === null) {
        return 'default'
    }

    if (value >= 1.5 && value <= 4) {
        return 'good'
    }

    if (value >= 1) {
        return 'warn'
    }

    return 'danger'
}

function resolveStepGranularityTone(value: number | null): 'default' | 'good' | 'warn' | 'danger' {
    if (value === null) {
        return 'default'
    }

    if (value >= 1 && value <= 6) {
        return 'good'
    }

    if (value > 0) {
        return 'warn'
    }

    return 'danger'
}
