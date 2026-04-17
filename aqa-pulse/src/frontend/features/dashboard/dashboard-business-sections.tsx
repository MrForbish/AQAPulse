import React from 'react'
import type { DashboardBusinessAssumptions, DashboardSummary } from '../../../dashboard-utils'
import {
    buildBusinessMetricReadiness,
    buildReleaseConfidenceBreakdown,
    formatAssumptionValue,
    formatCostShare,
    formatCostShareWidth,
    formatCurrency,
    formatMinutes,
    formatNullableDays,
    formatRunsPerHundred,
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

export function DashboardBusinessTrackIntro(props: { eyebrow: string; title: string; description: string }): React.JSX.Element {
    return (
        <section className="business-track-intro span-2">
            <div className="eyebrow">{props.eyebrow}</div>
            <h2>{props.title}</h2>
            <p>{props.description}</p>
        </section>
    )
}

export function DashboardBusinessOpsOverviewMetrics(props: { summary: DashboardSummary }): React.JSX.Element {
    const frictionMetrics = props.summary.businessMetrics.developerFriction
    const costMetrics = props.summary.businessMetrics.costOfFlakiness

    return (
        <>
            <MetricCard label={DASHBOARD_TEXT.metrics.timeToFixFlaky} labelMetricKey="timeToFixFlaky" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.timeToFixFlaky} value={formatNullableDays(props.summary.businessMetrics.timeToFixFlaky.medianDays)} hint={`${DASHBOARD_TEXT.business.timeToFixHintPrefix}: ${props.summary.businessMetrics.timeToFixFlaky.resolvedIncidents}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.ciWasteTime} labelMetricKey="ciWasteTime" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.ciWasteTime} value={formatMinutes(costMetrics.extraRetryMinutes)} tone={costMetrics.extraRetryMinutes >= 60 ? 'warn' : 'good'} hint={`${DASHBOARD_TEXT.business.extraRetries}: ${costMetrics.extraRetries}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.developerFriction} labelMetricKey="developerFriction" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.developerFriction} value={formatRunsPerHundred(frictionMetrics.rerunBurdenPer100Runs)} tone={frictionMetrics.rerunBurdenPer100Runs >= 25 ? 'warn' : 'good'} hint={`${DASHBOARD_TEXT.business.extraRetries}: ${frictionMetrics.extraRetries} • ${DASHBOARD_TEXT.business.observedRuns}: ${frictionMetrics.observedRuns}`} />
        </>
    )
}

export function DashboardBusinessScenarioOverviewMetrics(props: { summary: DashboardSummary }): React.JSX.Element {
    const costMetrics = props.summary.businessMetrics.costOfFlakiness

    return (
        <>
            <MetricCard label={DASHBOARD_TEXT.metrics.costOfFlakiness} labelMetricKey="costOfFlakiness" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.costOfFlakiness} value={formatCurrency(costMetrics.totalRub)} tone={getCostTone(costMetrics.totalRub)} hint={`${DASHBOARD_TEXT.business.costPerActiveDay}: ${formatCurrency(costMetrics.costPerActiveDayRub)}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.investigationCost} labelMetricKey="investigationCost" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.investigationCost} value={formatCurrency(costMetrics.developerCostRub)} tone={getCostTone(costMetrics.developerCostRub)} hint={`${DASHBOARD_TEXT.business.unstableRuns}: ${costMetrics.unstableRuns}`} />
        </>
    )
}

export function DashboardBusinessProductRiskOverviewMetrics(props: { summary: DashboardSummary }): React.JSX.Element {
    return (
        <MetricCard
            label={DASHBOARD_TEXT.metrics.releaseConfidenceScore}
            labelMetricKey="releaseConfidenceScore"
            labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore}
            value={formatScore(props.summary.businessMetrics.releaseConfidenceScore)}
            tone={getScoreTone(props.summary.businessMetrics.releaseConfidenceScore)}
            hint={DASHBOARD_TEXT.business.releaseConfidenceHint}
            className="span-2"
        />
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
                <SignalSummaryCard label={DASHBOARD_TEXT.metrics.costOfFlakiness} value={formatCurrency(costMetrics.totalRub)} hint={DASHBOARD_TEXT.business.totalCostHint} />
                <SignalSummaryCard label={DASHBOARD_TEXT.metrics.investigationCost} value={formatCurrency(costMetrics.developerCostRub)} hint={`${DASHBOARD_TEXT.business.developmentCostHintPrefix}: ${costMetrics.unstableRuns}`} />
                <SignalSummaryCard label={DASHBOARD_TEXT.metrics.ciWasteTime} value={formatMinutes(costMetrics.extraRetryMinutes)} hint={`${DASHBOARD_TEXT.business.extraRetries}: ${costMetrics.extraRetries}`} />
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

export function DashboardBusinessConfigAssumptionsSection(props: {
    summary: DashboardSummary
    assumptions: DashboardBusinessAssumptions
    presets: Array<{ key: string; label: string }>
    appliedPresetLabel: string | null
    isDirty: boolean
    onAssumptionChange: (key: keyof DashboardBusinessAssumptions, value: number | null) => void
    onApplyPreset: (presetKey: string) => void
    onReset: () => void
}): React.JSX.Element {
    const assumptions = props.assumptions

    return (
        <Panel title={DASHBOARD_TEXT.metrics.configAssumptions} titleMetricKey="configAssumptions" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.configAssumptions} description={DASHBOARD_TEXT.business.recalcHint}>
            <div className="module-header-row">
                <div className="module-pills">
                    <span className={`module-pill is-${mapScenarioTone(props.summary)}`}>{getBusinessScenarioStatusLabel(assumptions)}</span>
                    {props.appliedPresetLabel ? <span className="module-pill is-accent">{`${DASHBOARD_TEXT.business.presetApplied}: ${props.appliedPresetLabel}`}</span> : null}
                </div>
                <div className="subtle-copy">{DASHBOARD_TEXT.business.editorHint}</div>
            </div>
            <div className="business-assumptions-actions compact-top">
                {props.presets.map((preset) => (
                    <button key={preset.key} type="button" className="secondary-button" onClick={() => props.onApplyPreset(preset.key)}>{preset.label}</button>
                ))}
                <button type="button" className="ghost-link" onClick={props.onReset} disabled={!props.isDirty}>{DASHBOARD_TEXT.business.resetAssumptions}</button>
            </div>
            <form className="business-assumptions-grid admin-form compact-top" onSubmit={preventFormSubmission}>
                <label>
                    <span>{DASHBOARD_TEXT.business.ciMinuteCost}</span>
                    <input type="number" min="0" step="0.1" inputMode="decimal" value={formatEditableAssumptionValue(assumptions.ciMinuteCostRub)} onChange={(event) => props.onAssumptionChange('ciMinuteCostRub', parseScenarioInputValue(event.currentTarget.value))} />
                </label>
                <label>
                    <span>{DASHBOARD_TEXT.business.devHourCost}</span>
                    <input type="number" min="0" step="100" inputMode="decimal" value={formatEditableAssumptionValue(assumptions.developerHourlyCostRub)} onChange={(event) => props.onAssumptionChange('developerHourlyCostRub', parseScenarioInputValue(event.currentTarget.value))} />
                </label>
                <label>
                    <span>{DASHBOARD_TEXT.business.analysisMinutes}</span>
                    <input type="number" min="0" step="1" inputMode="decimal" value={formatEditableAssumptionValue(assumptions.analysisMinutesPerUnstable)} onChange={(event) => props.onAssumptionChange('analysisMinutesPerUnstable', parseScenarioInputValue(event.currentTarget.value))} />
                </label>
            </form>
            <div className="stack-list compact-top">
                <DetailRow label={DASHBOARD_TEXT.business.assumptionsConfiguredTitle} value={getBusinessScenarioStatusLabel(assumptions)} hint={DASHBOARD_TEXT.business.assumptionsConfiguredHint} />
                <DetailRow label={DASHBOARD_TEXT.business.ciMinuteCost} value={formatAssumptionValue(assumptions.ciMinuteCostRub, '₽/мин')} />
                <DetailRow label={DASHBOARD_TEXT.business.devHourCost} value={formatAssumptionValue(assumptions.developerHourlyCostRub, '₽/час')} />
                <DetailRow label={DASHBOARD_TEXT.business.analysisMinutes} value={formatAssumptionValue(assumptions.analysisMinutesPerUnstable, 'мин/инцидент')} />
            </div>
        </Panel>
    )
}

function preventFormSubmission(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
}

function parseScenarioInputValue(value: string): number | null {
    if (value.trim().length === 0) {
        return null
    }

    const parsedValue = Number(value)
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null
}

function formatEditableAssumptionValue(value: number | null): number | '' {
    return value ?? ''
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