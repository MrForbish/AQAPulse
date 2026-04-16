import React from 'react'
import { Link } from 'react-router-dom'
import type { TestHistoryResponse } from '../../../api-store'
import { formatPercent } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { TEST_HISTORY_METRIC_DESCRIPTIONS } from '../../../shared/test-history-metric-info'
import { MetricCard } from '../../shared/ui'

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
