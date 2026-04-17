import React from 'react'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { MetricCard } from '../../shared/ui'

const DASHBOARD_TEXT = ru.dashboard

export function SignalSummaryCard(props: { label: string; value: string; hint: string; tone?: 'default' | 'good' | 'warn' | 'danger' }): React.JSX.Element {
    return <MetricCard label={props.label} labelTooltip={resolveDashboardMetricDescription(props.label)} value={props.value} hint={props.hint} tone={props.tone} />
}

export function ReadinessCard(props: { label: string; value: string; hint: string; tone: 'good' | 'warn' | 'danger' }): React.JSX.Element {
    return (
        <article className="readiness-item">
            <div className="readiness-item-header">
                <strong>{props.label}</strong>
                <span className={`module-pill is-${props.tone}`}>{props.value}</span>
            </div>
            <p>{props.hint}</p>
        </article>
    )
}

export function FormulaCard(props: { title: string; body: string }): React.JSX.Element {
    return (
        <article className="formula-card-react">
            <strong>{props.title}</strong>
            <p>{props.body}</p>
        </article>
    )
}

export function DetailRow(props: { label: string; value: string; hint?: string }): React.JSX.Element {
    return (
        <article className="detail-card-react">
            <div className="summary-line">
                <span>{props.label}</span>
                <strong>{props.value}</strong>
            </div>
            {props.hint ? <div className="subtle-copy compact-top">{props.hint}</div> : null}
        </article>
    )
}

export function CostBreakdownItem(props: { label: string; value: string; width: string }): React.JSX.Element {
    return (
        <div className="cost-breakdown-item-react">
            <div className="cost-breakdown-head-react">
                <span>{props.label}</span>
                <strong>{props.value}</strong>
            </div>
            <div className="stacked-bar-track">
                <div className="stacked-bar-fill is-accent" style={{ width: props.width }} />
            </div>
        </div>
    )
}

function resolveDashboardMetricDescription(label: string): string | undefined {
    if (label === DASHBOARD_TEXT.metrics.timeToDetect) {
        return DASHBOARD_METRIC_DESCRIPTIONS.timeToDetect
    }

    if (label === DASHBOARD_TEXT.metrics.timeToFixFlaky) {
        return DASHBOARD_METRIC_DESCRIPTIONS.timeToFixFlaky
    }

    if (label === DASHBOARD_TEXT.metrics.ciWasteTime) {
        return DASHBOARD_METRIC_DESCRIPTIONS.ciWasteTime
    }

    if (label === DASHBOARD_TEXT.metrics.investigationCost) {
        return DASHBOARD_METRIC_DESCRIPTIONS.investigationCost
    }

    if (label === DASHBOARD_TEXT.metrics.releaseConfidenceScore) {
        return DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore
    }

    if (label === DASHBOARD_TEXT.metrics.developerFriction) {
        return DASHBOARD_METRIC_DESCRIPTIONS.developerFriction
    }

    if (label === DASHBOARD_TEXT.manager.deliveryRisk) {
        return DASHBOARD_METRIC_DESCRIPTIONS.deliveryRisk
    }

    if (label === DASHBOARD_TEXT.manager.releaseReadiness) {
        return DASHBOARD_METRIC_DESCRIPTIONS.releaseReadiness
    }

    if (label === DASHBOARD_TEXT.manager.qualityRisk) {
        return DASHBOARD_METRIC_DESCRIPTIONS.qualityRisk
    }

    return undefined
}