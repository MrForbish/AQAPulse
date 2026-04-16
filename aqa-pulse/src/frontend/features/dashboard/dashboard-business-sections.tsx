import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import {
    buildBusinessMetricReadiness,
    buildReleaseConfidenceBreakdown,
    formatAssumptionValue,
    formatCostShare,
    formatCostShareWidth,
    formatCurrency,
    formatDailyRatio,
    formatMinutes,
    formatNullableDays,
    formatNullableMinutes,
    formatNullablePercent,
    formatScore,
    getBusinessDriverInsightBody,
    getBusinessDriverInsightTitle,
    getBusinessImpactLabel,
    getBusinessScenarioStatusHint,
    getBusinessScenarioStatusLabel,
    getScoreTone,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { MetricCard, Panel } from '../../shared/ui'
import { CostBreakdownItem, DetailRow, FormulaCard, ReadinessCard, SignalSummaryCard } from './dashboard-display-parts'

const DASHBOARD_TEXT = ru.dashboard

export function DashboardBusinessOverviewMetrics(props: { summary: DashboardSummary }): React.JSX.Element {
    const costMetrics = props.summary.businessMetrics.costOfFlakiness

    return (
        <>
            <MetricCard label={DASHBOARD_TEXT.metrics.timeToDetect} labelMetricKey="timeToDetect" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.timeToDetect} value={formatNullableMinutes(props.summary.businessMetrics.timeToDetect.minutes)} hint={DASHBOARD_TEXT.business.timeToDetectHint} />
            <MetricCard label={DASHBOARD_TEXT.metrics.timeToFixFlaky} labelMetricKey="timeToFixFlaky" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.timeToFixFlaky} value={formatNullableDays(props.summary.businessMetrics.timeToFixFlaky.averageDays)} hint={`${DASHBOARD_TEXT.business.timeToFixHintPrefix}: ${props.summary.businessMetrics.timeToFixFlaky.resolvedIncidents}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.costOfFlakiness} labelMetricKey="costOfFlakiness" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.costOfFlakiness} value={formatCurrency(costMetrics.totalRub)} tone={getCostTone(costMetrics.totalRub)} hint={`${DASHBOARD_TEXT.business.costPerActiveDay}: ${formatCurrency(costMetrics.costPerActiveDayRub)}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.developerFriction} labelMetricKey="developerFriction" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.developerFriction} value={formatDailyRatio(props.summary.businessMetrics.developerFriction.rerunProxyPerActiveDay)} tone={props.summary.businessMetrics.developerFriction.rerunProxyPerActiveDay > 1 ? 'warn' : 'good'} hint={`${DASHBOARD_TEXT.business.extraRetries}: ${props.summary.businessMetrics.developerFriction.extraRetries}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.releaseConfidenceScore} labelMetricKey="releaseConfidenceScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore} value={formatScore(props.summary.businessMetrics.releaseConfidenceScore)} tone={getScoreTone(props.summary.businessMetrics.releaseConfidenceScore)} hint={DASHBOARD_TEXT.business.releaseConfidenceHint} />
            <MetricCard label={DASHBOARD_TEXT.metrics.automationRoi} labelMetricKey="automationRoi" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.automationRoi} value={formatNullablePercent(props.summary.businessMetrics.automationRoi.percent)} hint={DASHBOARD_TEXT.business.automationRoiHint} />
        </>
    )
}

export function DashboardBusinessSummarySection(props: { summary: DashboardSummary }): React.JSX.Element {
    const costMetrics = props.summary.businessMetrics.costOfFlakiness
    const costImpactTone = mapCostImpactTone(costMetrics.totalRub, costMetrics.costPerActiveDayRub)

    return (
        <Panel title={DASHBOARD_TEXT.business.summaryTitle} titleMetricKey="costOfFlakiness" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.costOfFlakiness} description={DASHBOARD_TEXT.business.summaryDescription} className="span-2">
            <div className="module-header-row">
                <div className="module-pills">
                    <span className={`module-pill is-${mapScenarioTone(props.summary)}`}>{getBusinessScenarioStatusLabel(costMetrics.assumptions)}</span>
                    <span className={`module-pill is-${costImpactTone}`}>{getBusinessImpactLabel(costMetrics.totalRub, costMetrics.costPerActiveDayRub)}</span>
                </div>
                <div className="subtle-copy">{getBusinessScenarioStatusHint(costMetrics.assumptions)}</div>
            </div>
            <div className="signal-grid compact-top">
                <SignalSummaryCard label={DASHBOARD_TEXT.metrics.timeToDetect} value={formatNullableMinutes(props.summary.businessMetrics.timeToDetect.minutes)} hint={DASHBOARD_TEXT.business.timeToDetectPending} />
                <SignalSummaryCard label={DASHBOARD_TEXT.metrics.timeToFixFlaky} value={formatNullableDays(props.summary.businessMetrics.timeToFixFlaky.averageDays)} hint={props.summary.businessMetrics.timeToFixFlaky.averageDays === null ? DASHBOARD_TEXT.business.timeToFixPending : 'Среднее по восстановленным flaky-инцидентам из истории.'} />
                <SignalSummaryCard label={DASHBOARD_TEXT.metrics.releaseConfidenceScore} value={formatScore(props.summary.businessMetrics.releaseConfidenceScore)} hint={DASHBOARD_TEXT.business.releaseConfidenceDetails} />
                <SignalSummaryCard label={DASHBOARD_TEXT.business.costPerActiveDay} value={formatCurrency(costMetrics.costPerActiveDayRub)} hint={DASHBOARD_TEXT.business.costScenarioDescription} />
            </div>
            <div className={`callout-card compact-top is-${costImpactTone}`}>
                <strong>{getBusinessDriverInsightTitle(costMetrics.ciCostRub, costMetrics.developerCostRub, costMetrics.totalRub)}</strong>
                <p>{getBusinessDriverInsightBody(costMetrics.ciCostRub, costMetrics.developerCostRub, costMetrics.totalRub)}</p>
            </div>
        </Panel>
    )
}

export function DashboardBusinessReleaseConfidenceSection(props: { summary: DashboardSummary }): React.JSX.Element {
    const breakdown = buildReleaseConfidenceBreakdown(props.summary)

    return (
        <Panel title={DASHBOARD_TEXT.business.releaseConfidenceBreakdownTitle} titleMetricKey="releaseConfidenceScore" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceBreakdownTitle} description={DASHBOARD_TEXT.business.releaseConfidenceBreakdownDescription}>
            <div className="stacked-bars compact-top">
                {breakdown.components.map((component) => (
                    <div key={component.label} className="stacked-bar-item">
                        <div className="stacked-bar-copy stacked-bar-copy-spread">
                            <span>{component.label}</span>
                            <strong>{component.formula}</strong>
                        </div>
                        <div className="stacked-bar-track">
                            <div className={`stacked-bar-fill is-${component.tone || 'good'}`} style={{ width: component.width }} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="summary-line compact-top">
                <span>{DASHBOARD_TEXT.business.releaseConfidenceTotal}</span>
                <strong>{formatScore(breakdown.total)}</strong>
            </div>
        </Panel>
    )
}

export function DashboardBusinessReadinessSection(props: { summary: DashboardSummary }): React.JSX.Element {
    const readinessItems = buildBusinessMetricReadiness(props.summary)

    return (
        <Panel title={DASHBOARD_TEXT.business.readinessTitle} titleMetricKey="releaseConfidenceScore" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore} description={DASHBOARD_TEXT.business.readinessDescription}>
            <div className="readiness-list compact-top">
                {readinessItems.map((item) => (
                    <ReadinessCard key={item.label} label={item.label} value={item.statusLabel} hint={item.hint} tone={mapReadinessTone(item.status)} />
                ))}
            </div>
        </Panel>
    )
}

export function DashboardBusinessCostSection(props: { summary: DashboardSummary }): React.JSX.Element {
    const costMetrics = props.summary.businessMetrics.costOfFlakiness

    return (
        <Panel title={DASHBOARD_TEXT.metrics.costSection} titleMetricKey="costSection" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.costOfFlakiness} description={DASHBOARD_TEXT.business.costScenarioDescription} className="span-2">
            <div className="split-grid compact-top">
                <div className="stack-list">
                    <FormulaCard title={DASHBOARD_TEXT.business.ciCost} body={DASHBOARD_TEXT.business.ciFormula} />
                    <FormulaCard title={DASHBOARD_TEXT.business.developmentCost} body={DASHBOARD_TEXT.business.developerFormula} />
                    <FormulaCard title={DASHBOARD_TEXT.business.overallCost} body={DASHBOARD_TEXT.business.totalFormula} />
                </div>
                <div className="stack-list">
                    <DetailRow label={DASHBOARD_TEXT.business.overallCost} value={formatCurrency(costMetrics.totalRub)} hint={DASHBOARD_TEXT.business.totalCostHint} />
                    <DetailRow label={DASHBOARD_TEXT.business.ciCost} value={formatCurrency(costMetrics.ciCostRub)} hint={`${DASHBOARD_TEXT.business.ciCostHintPrefix}: ${formatMinutes(costMetrics.extraRetryMinutes)}`} />
                    <DetailRow label={DASHBOARD_TEXT.business.developmentCost} value={formatCurrency(costMetrics.developerCostRub)} hint={`${DASHBOARD_TEXT.business.developmentCostHintPrefix}: ${costMetrics.unstableRuns}`} />
                    <DetailRow label={DASHBOARD_TEXT.business.costPerActiveDay} value={formatCurrency(costMetrics.costPerActiveDayRub)} hint={DASHBOARD_TEXT.business.costPerActiveDayHint} />
                </div>
            </div>
            <div className="cost-breakdown-stack compact-top">
                <CostBreakdownItem label={DASHBOARD_TEXT.business.ciShare} value={formatCostShare(costMetrics.ciCostRub, costMetrics.totalRub)} width={formatCostShareWidth(costMetrics.ciCostRub, costMetrics.totalRub)} />
                <CostBreakdownItem label={DASHBOARD_TEXT.business.developmentShare} value={formatCostShare(costMetrics.developerCostRub, costMetrics.totalRub)} width={formatCostShareWidth(costMetrics.developerCostRub, costMetrics.totalRub)} />
            </div>
        </Panel>
    )
}

export function DashboardBusinessConfigAssumptionsSection(props: { summary: DashboardSummary }): React.JSX.Element {
    const assumptions = props.summary.businessMetrics.costOfFlakiness.assumptions

    return (
        <Panel title={DASHBOARD_TEXT.metrics.configAssumptions} titleMetricKey="configAssumptions" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.configAssumptions} description={DASHBOARD_TEXT.business.editorHint}>
            <div className="stack-list compact-top">
                <DetailRow label={DASHBOARD_TEXT.business.ciMinuteCost} value={formatAssumptionValue(assumptions.ciMinuteCostRub, '₽/мин')} />
                <DetailRow label={DASHBOARD_TEXT.business.devHourCost} value={formatAssumptionValue(assumptions.developerHourlyCostRub, '₽/час')} />
                <DetailRow label={DASHBOARD_TEXT.business.analysisMinutes} value={formatAssumptionValue(assumptions.analysisMinutesPerUnstable, 'мин/инцидент')} />
            </div>
        </Panel>
    )
}

function mapReadinessTone(status: 'ready' | 'partial' | 'pending'): 'good' | 'warn' | 'danger' {
    if (status === 'ready') {
        return 'good'
    }

    if (status === 'partial') {
        return 'warn'
    }

    return 'danger'
}

function mapScenarioTone(summary: DashboardSummary): 'good' | 'warn' | 'danger' {
    const assumptions = summary.businessMetrics.costOfFlakiness.assumptions
    const hasCi = assumptions.ciMinuteCostRub !== null
    const hasDev = assumptions.developerHourlyCostRub !== null && assumptions.analysisMinutesPerUnstable !== null

    if (hasCi && hasDev) {
        return 'good'
    }

    if (hasCi || assumptions.developerHourlyCostRub !== null || assumptions.analysisMinutesPerUnstable !== null) {
        return 'warn'
    }

    return 'danger'
}

function mapCostImpactTone(totalCost: number | null, costPerDay: number | null): 'good' | 'warn' | 'danger' {
    if (totalCost === null) {
        return 'warn'
    }

    if (totalCost >= 50000 || (costPerDay !== null && costPerDay >= 10000)) {
        return 'danger'
    }

    if (totalCost >= 15000 || (costPerDay !== null && costPerDay >= 3000)) {
        return 'warn'
    }

    return 'good'
}

function getCostTone(totalCost: number | null): 'default' | 'good' | 'warn' | 'danger' {
    if (totalCost === null) {
        return 'default'
    }

    if (totalCost >= 50000) {
        return 'danger'
    }

    if (totalCost >= 15000) {
        return 'warn'
    }

    return 'good'
}