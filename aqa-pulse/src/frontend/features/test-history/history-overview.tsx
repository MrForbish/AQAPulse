import React from 'react'
import { Link } from 'react-router-dom'
import type { TestHistoryResponse } from '../../../api-store'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { TEST_HISTORY_METRIC_DESCRIPTIONS } from '../../../shared/test-history-metric-info'
import { formatCommit, formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import { buildHistoryRowAnchor, findIncidentStepAnchor } from '../../../shared/test-history-helpers'
import { MetricCard, Panel, StatusBadge } from '../../shared/ui'

const HISTORY_TEXT = ru.testHistory
const DASHBOARD_TEXT = ru.dashboard

export function TestHistoryHero(props: {
    payload: TestHistoryResponse
    dashboardHref: string
    apiUrl: string
}): React.JSX.Element {
    return (
        <section className="hero-block">
            <div>
                <div className="eyebrow">Test History</div>
                <h1>{props.payload.test.title}</h1>
                <p>
                    React-страница читает ту же API-модель, но уже без server-generated HTML на каждый сценарий.
                    История, инциденты и attempt diagnostics теперь живут как отдельные feature-модули.
                </p>
            </div>
            <div className="hero-meta-card">
                <div className="hero-meta-row"><span>{DASHBOARD_TEXT.filters.project}</span><strong>{props.payload.test.project}</strong></div>
                <div className="hero-meta-row"><span>{DASHBOARD_TEXT.tables.file}</span><strong>{props.payload.test.file}</strong></div>
                <div className="hero-meta-row"><span>{HISTORY_TEXT.metrics.totalRuns}</span><strong>{props.payload.summary.totalRuns}</strong></div>
                <div className="hero-actions">
                    <Link className="primary-link" to={props.dashboardHref}>{HISTORY_TEXT.backToDashboard}</Link>
                    <a className="ghost-link" href={props.apiUrl}>{HISTORY_TEXT.openJson}</a>
                </div>
            </div>
        </section>
    )
}

export function TestHistorySummaryMetrics(props: { summary: TestHistoryResponse['summary'] }): React.JSX.Element {
    return (
        <section className="metrics-grid">
            <MetricCard label={HISTORY_TEXT.metrics.totalRuns} labelMetricKey="totalRuns" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.totalRuns} value={String(props.summary.totalRuns)} />
            <MetricCard label={HISTORY_TEXT.metrics.failedRuns} labelMetricKey="failedRuns" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.failedRuns} value={String(props.summary.failedRuns)} tone={props.summary.failedRuns > 0 ? 'danger' : 'default'} />
            <MetricCard label={HISTORY_TEXT.metrics.flakyRuns} labelMetricKey="flakyRuns" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.flakyRuns} value={String(props.summary.flakyRuns)} tone={props.summary.flakyRuns > 0 ? 'warn' : 'default'} />
            <MetricCard label={HISTORY_TEXT.metrics.passRate} labelMetricKey="passRate" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.passRate} value={formatPercent(props.summary.passRate)} tone="good" />
            <MetricCard label={HISTORY_TEXT.metrics.flakyScore} labelMetricKey="flakyScore" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.flakyScore} value={props.summary.flakyScore.toFixed(1)} />
            <MetricCard label="MTBF" labelMetricKey="mtbf" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.mtbf} value={props.summary.mtbfDays === null ? '—' : `${props.summary.mtbfDays.toFixed(2)} дн`} hint={HISTORY_TEXT.subtitles.mtbf} />
        </section>
    )
}

export function ArchiveGapsNotice(props: { missingRuns: string[] }): React.JSX.Element | null {
    if (props.missingRuns.length === 0) {
        return null
    }

    return (
        <div className="inline-note is-warning">
            <strong>{HISTORY_TEXT.metrics.archiveGaps}</strong>
            <div className="mono-cell compact-top">{props.missingRuns.join(', ')}</div>
        </div>
    )
}

export function IncidentSummaryPanel(props: {
    incidentSummary: NonNullable<TestHistoryResponse['incidentSummary']>
    history: TestHistoryResponse['history']
}): React.JSX.Element {
    const incidentLead = extractIncidentLead(props.incidentSummary.summary)
    const incidentPrimarySignal = props.incidentSummary.failureStepErrorMessage ?? props.incidentSummary.latestErrorMessage ?? null
    const failureStepAnchor = findIncidentStepAnchor(props.history, props.incidentSummary.failureStepTitle)

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
                    <span className="metric-label">{HISTORY_TEXT.incident.categoryLabel}</span>
                    <strong>{HISTORY_TEXT.incident.category[props.incidentSummary.category]}</strong>
                </div>
                <div className="detail-card-react">
                    <span className="metric-label">{HISTORY_TEXT.incident.failureStepLabel}</span>
                    <strong>{props.incidentSummary.failureStepTitle ?? props.incidentSummary.failureStepCategory ?? HISTORY_TEXT.incident.notCaptured}</strong>
                    {failureStepAnchor ? (
                        <div className="anchor-link-row compact-top">
                            <a className="ghost-link" href={`#${failureStepAnchor}`}>{HISTORY_TEXT.incident.jumpToFailureStep}</a>
                        </div>
                    ) : null}
                </div>
                <div className="detail-card-react">
                    <span className="metric-label">{HISTORY_TEXT.incident.primarySignalLabel}</span>
                    <strong className="mono-cell">{incidentPrimarySignal ?? HISTORY_TEXT.incident.notCaptured}</strong>
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
                <div className="evidence-list">
                    {props.incidentSummary.evidence.map((item) => <div key={item} className="evidence-chip">{item}</div>)}
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
                                <td className="mono-cell">{item.errorMessage ?? '—'}</td>
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