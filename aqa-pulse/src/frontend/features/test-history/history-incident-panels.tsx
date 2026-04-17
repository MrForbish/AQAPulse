import React from 'react'
import type { TestHistoryResponse } from '../../../api-store'
import { formatDate, formatDuration } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { TEST_HISTORY_METRIC_DESCRIPTIONS } from '../../../shared/test-history-metric-info'
import { formatCommit, formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import { buildHistoryRowAnchor, findIncidentStepAnchor } from '../../../shared/test-history-helpers'
import { MetricCard, Panel, StatusBadge, TraceDisclosure } from '../../shared/ui'

const HISTORY_TEXT = ru.testHistory
const DASHBOARD_TEXT = ru.dashboard

export function IncidentSummaryPanel(props: {
    incidentSummary: NonNullable<TestHistoryResponse['incidentSummary']>
    history: TestHistoryResponse['history']
}): React.JSX.Element {
    const incidentLead = extractIncidentLead(props.incidentSummary.summary)
    const incidentPrimarySignal = props.incidentSummary.failureStepErrorMessage ?? props.incidentSummary.latestErrorMessage ?? null
    const failureStepTitle = props.incidentSummary.failureStepTitle
    const failureStepCategory = props.incidentSummary.failureStepCategory
    const failureStepValue = failureStepTitle ?? failureStepCategory ?? HISTORY_TEXT.incident.notCaptured
    const failureStepAnchor = findIncidentStepAnchor(props.history, {
        failureStepTitle,
        failureStepCategory,
        failureStepErrorMessage: props.incidentSummary.failureStepErrorMessage,
        failureStepRunId: props.incidentSummary.failureStepRunId,
        failureStepAttempt: props.incidentSummary.failureStepAttempt,
        failureStepOffsetMs: props.incidentSummary.failureStepOffsetMs,
    })
    const primaryEvidence = props.incidentSummary.evidence.filter((item) => item.tone === 'primary')
    const secondaryEvidence = props.incidentSummary.evidence.filter((item) => item.tone !== 'primary')

    return (
        <Panel
            title={HISTORY_TEXT.incident.title}
            titleMetricKey="latestEvent"
            titleTooltip={HISTORY_TEXT.incident.tooltip}
            description={HISTORY_TEXT.incident.severityDescription[props.incidentSummary.severity]}
            className={`incident-panel is-${props.incidentSummary.severity}`}
        >
            <div className="module-pills compact-top">
                <span className={`module-pill is-${getIncidentSeverityTone(props.incidentSummary.severity)}`}>
                    {HISTORY_TEXT.incident.severity[props.incidentSummary.severity]}
                </span>
            </div>
            {incidentLead ? <div className="incident-summary-lead-react compact-top">{incidentLead}</div> : null}
            <div className="signal-grid compact-top">
                <div className="detail-card-react">
                    <span className="metric-label">{HISTORY_TEXT.incident.failureStepLabel}</span>
                    <strong>{failureStepValue}</strong>
                    {failureStepTitle && failureStepCategory ? <div className="detail-card-react-meta">{failureStepCategory}</div> : null}
                    {failureStepAnchor ? (
                        <div className="anchor-link-row compact-top">
                            <a className="ghost-link" href={`#${failureStepAnchor}`}>{HISTORY_TEXT.incident.jumpToFailureStep}</a>
                        </div>
                    ) : null}
                </div>
                <div className="detail-card-react">
                    <span className="metric-label">{HISTORY_TEXT.incident.primarySignalLabel}</span>
                    <TraceDisclosure text={incidentPrimarySignal} emptyLabel={HISTORY_TEXT.incident.notCaptured} badgeLabel="signal" />
                </div>
            </div>
            <div className="incident-grid-react">
                <MetricCard label={HISTORY_TEXT.incident.categoryLabel} value={HISTORY_TEXT.incident.category[props.incidentSummary.category]} tone="warn" />
                <MetricCard label={HISTORY_TEXT.incident.confidenceLabel} value={HISTORY_TEXT.incident.confidence[props.incidentSummary.confidence]} />
                <MetricCard label={HISTORY_TEXT.incident.unstableRunsLabel} value={String(props.incidentSummary.unstableRuns)} tone="danger" />
                <MetricCard label={HISTORY_TEXT.incident.matchingRunsLabel} value={String(props.incidentSummary.matchingRuns)} />
            </div>
            <div className="meta-badge-row compact-top">
                <span className="meta-badge">{HISTORY_TEXT.incident.firstSeenLabel}: {formatOptionalDate(props.incidentSummary.firstSeenAt)}</span>
                <span className="meta-badge">{HISTORY_TEXT.incident.latestSeenLabel}: {formatOptionalDate(props.incidentSummary.latestSeenAt)}</span>
                <span className="meta-badge">{HISTORY_TEXT.incident.recoveryLabel}: {formatOptionalDate(props.incidentSummary.latestRecoveryAt)}</span>
                <span className="meta-badge">{HISTORY_TEXT.incident.attemptsLabel}: {props.incidentSummary.affectedAttempts}</span>
            </div>
            {props.incidentSummary.evidence.length > 0 ? (
                <div className="incident-evidence-block compact-top">
                    <div className="section-kicker">{HISTORY_TEXT.incident.evidenceTitle}</div>
                    {primaryEvidence.length > 0 ? (
                        <div className="incident-evidence-primary-grid compact-top">
                            {primaryEvidence.map((item) => (
                                <div key={`${item.label}:${item.value}`} className="detail-card-react incident-evidence-card is-primary">
                                    <span className="metric-label">{item.label}</span>
                                    <TraceDisclosure text={item.value} emptyLabel={HISTORY_TEXT.incident.notCaptured} badgeLabel="focus" />
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {secondaryEvidence.length > 0 ? (
                        <div className="evidence-list compact-top">
                            {secondaryEvidence.map((item) => (
                                <div key={`${item.label}:${item.value}`} className={`incident-evidence-card is-${item.tone}`}>
                                    <span className="metric-label">{item.label}</span>
                                    <div className="incident-evidence-value">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </Panel>
    )
}

export function HistoryTimelinePanel(props: { history: TestHistoryResponse['history'] }): React.JSX.Element {
    return (
        <Panel title={HISTORY_TEXT.metrics.timeline} titleMetricKey="timeline" titleTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.timeline} className="span-2">
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>{DASHBOARD_TEXT.tables.time}</th>
                            <th>{DASHBOARD_TEXT.tables.branch}</th>
                            <th>{DASHBOARD_TEXT.tables.commit}</th>
                            <th>{HISTORY_TEXT.tables.author}</th>
                            <th>{DASHBOARD_TEXT.tables.status}</th>
                            <th>{DASHBOARD_TEXT.tables.duration}</th>
                            <th>{HISTORY_TEXT.meta.retries}</th>
                            <th>{HISTORY_TEXT.meta.attempts}</th>
                            <th>{DASHBOARD_TEXT.tables.lastError}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {props.history.map((item) => (
                            <tr key={item.runId} id={buildHistoryRowAnchor(item.runId)}>
                                <td>{formatDate(item.reportTimestamp ?? item.generatedAt)}</td>
                                <td>{item.branch ?? '—'}</td>
                                <td>{formatCommit(item.commit)}</td>
                                <td>{item.author ?? '—'}</td>
                                <td><StatusBadge label={formatStatusLabel(item.status, item.flaky)} tone={getStatusTone(item.status, item.flaky)} /></td>
                                <td>{formatDuration(item.durationMs)}</td>
                                <td>{item.retries}</td>
                                <td>{item.attempts}</td>
                                <td><TraceDisclosure text={item.errorMessage} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Panel>
    )
}

function formatOptionalDate(value: string | null): string {
    return value ? formatDate(value) : '—'
}

function extractIncidentLead(summary: string): string | null {
    const [lead] = summary
        .split(/\.\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)

    return lead ? (lead.endsWith('.') ? lead : `${lead}.`) : null
}

function getIncidentSeverityTone(severity: NonNullable<TestHistoryResponse['incidentSummary']>['severity']): 'danger' | 'warn' | 'good' {
    if (severity === 'active') {
        return 'danger'
    }

    if (severity === 'monitoring') {
        return 'warn'
    }

    return 'good'
}