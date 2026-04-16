import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { formatScore, getManagerChangeLabel } from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { MetricCard, NarrativeList, Panel } from '../../shared/ui'

const DASHBOARD_TEXT = ru.dashboard

export function DashboardManagerSummarySection(props: {
    summary: DashboardSummary
    mapTone: (level: 'healthy' | 'warning' | 'critical') => 'good' | 'warn' | 'danger'
}): React.JSX.Element {
    return (
        <Panel title={DASHBOARD_TEXT.manager.summaryTitle} titleMetricKey="managerSummary" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.managerSummary} description={DASHBOARD_TEXT.manager.summaryDescription}>
            <div className="signal-grid compact-top">
                <MetricCard label={DASHBOARD_TEXT.manager.releaseReadiness} labelMetricKey="releaseReadiness" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseReadiness} value={formatScore(props.summary.managerSummary.releaseReadiness.score)} hint={props.summary.managerSummary.releaseReadiness.level} tone={props.mapTone(props.summary.managerSummary.releaseReadiness.level)} />
                <MetricCard label={DASHBOARD_TEXT.manager.qualityRisk} labelMetricKey="qualityRisk" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.qualityRisk} value={formatScore(props.summary.managerSummary.qualityRisk.score)} hint={props.summary.managerSummary.qualityRisk.level} tone={props.mapTone(props.summary.managerSummary.qualityRisk.level)} />
                <MetricCard label={DASHBOARD_TEXT.manager.deliveryRisk} labelMetricKey="deliveryRisk" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.deliveryRisk} value={formatScore(props.summary.managerSummary.deliveryRisk.score)} hint={props.summary.managerSummary.deliveryRisk.level} tone={props.mapTone(props.summary.managerSummary.deliveryRisk.level)} />
            </div>
        </Panel>
    )
}

export function DashboardManagerBlockersSection(props: {
    summary: DashboardSummary
    includeMeta?: boolean
}): React.JSX.Element {
    return (
        <Panel title={DASHBOARD_TEXT.manager.blockersTitle} className="span-2">
            <NarrativeList
                className="compact-top"
                items={props.summary.managerSummary.blockers.map((blocker, index) => ({
                    id: `${blocker.kind}-${index}`,
                    title: blocker.title,
                    pillLabel: blocker.value,
                    pillTone: blocker.severity === 'critical' ? 'danger' : blocker.severity === 'warning' ? 'warn' : 'accent',
                    body: blocker.details,
                    meta: props.includeMeta ? blocker.testTitle : undefined,
                }))}
                emptyState={{ title: 'Блокеров нет', message: DASHBOARD_TEXT.manager.noBlockers }}
            />
        </Panel>
    )
}

export function DashboardManagerChangesSection(props: {
    summary: DashboardSummary
    mapTone: (direction: 'improving' | 'regressing' | 'stable') => 'good' | 'warn' | 'accent'
    mode: 'pill-with-value' | 'separate-value'
}): React.JSX.Element {
    return (
        <Panel title={DASHBOARD_TEXT.manager.changesTitle} className="span-2">
            <NarrativeList
                className="compact-top"
                items={props.summary.managerSummary.changes.map((change) => ({
                    id: `${change.label}-${change.value}`,
                    title: change.label,
                    pillLabel: props.mode === 'pill-with-value' ? `${getManagerChangeLabel(change.direction)} ${change.value}` : getManagerChangeLabel(change.direction),
                    pillTone: props.mapTone(change.direction),
                    pillStyle: 'module-pill' as const,
                    value: props.mode === 'separate-value' ? change.value : undefined,
                    body: change.details,
                }))}
                emptyState={{ title: 'Изменений нет', message: DASHBOARD_TEXT.states.noChanges }}
            />
        </Panel>
    )
}