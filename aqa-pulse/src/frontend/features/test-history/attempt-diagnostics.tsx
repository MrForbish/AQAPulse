import React from 'react'
import type { TestHistoryResponse } from '../../../api-store'
import { formatDate, formatDuration } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import { EmptyState, StatusBadge, TraceDisclosure } from '../../shared/ui'
import { AttemptAttachmentGrid } from './attempt-diagnostic-attachments'
import { AttemptStepTree } from './attempt-diagnostic-steps'

const HISTORY_TEXT = ru.testHistory

export function AttemptDiagnostics(props: {
    runId: string
    attempts: TestHistoryResponse['history'][number]['attemptDetails']
    artifactBasePath: string
    isStaticMode: boolean
    incidentSummary: TestHistoryResponse['incidentSummary']
}): React.JSX.Element {
    if (props.attempts.length === 0) {
        return <EmptyState title="Attempt details отсутствуют" message={HISTORY_TEXT.diagnostics.emptyAttempt} />
    }

    const totalSteps = props.attempts.reduce((sum, attempt) => sum + attempt.steps.length, 0)
    const totalAttachments = props.attempts.reduce((sum, attempt) => sum + attempt.attachments.length, 0)
    const unstableAttempts = props.attempts.filter((attempt) => attempt.status !== 'passed' && attempt.status !== 'skipped').length
    const primaryFailureTitle = props.incidentSummary?.failureStepTitle ?? props.incidentSummary?.failureStepCategory ?? null

    return (
        <div className="attempt-list-react attempt-list-scroll-react incident-console-react">
            <div className="incident-console-toolbar-react">
                <div className="incident-console-head-react">
                    <span className="incident-console-kicker-react">Incident console</span>
                    <strong className="incident-console-title-react">Трассировка последнего запуска</strong>
                    <div className="subtle-copy incident-console-copy-react">Единый экран для разбора попыток, шагов и артефактов без переключения между отдельными блоками.</div>
                </div>
                <div className="incident-console-stats-react">
                    <span className="meta-badge">Попыток: {props.attempts.length}</span>
                    <span className="meta-badge">Шагов: {totalSteps}</span>
                    <span className="meta-badge">Артефактов: {totalAttachments}</span>
                    <span className="meta-badge">Нестабильных попыток: {unstableAttempts}</span>
                </div>
            </div>
            {props.incidentSummary ? (
                <div className="incident-console-alert-react">
                    <div className="incident-console-alert-label-react">Основная точка расследования</div>
                    <strong>{primaryFailureTitle ?? 'Точка падения не зафиксирована явно'}</strong>
                    <div className="incident-console-alert-meta-react">
                        <span className="meta-badge">{ru.testHistory.incident.categoryLabel}: {ru.testHistory.incident.category[props.incidentSummary.category]}</span>
                        <span className="meta-badge">{ru.testHistory.incident.confidenceLabel}: {ru.testHistory.incident.confidence[props.incidentSummary.confidence]}</span>
                        <span className="meta-badge">{ru.testHistory.incident.severityLabel}: {ru.testHistory.incident.severity[props.incidentSummary.severity]}</span>
                        {typeof props.incidentSummary.failureStepAttempt === 'number' ? <span className="meta-badge">Попытка: #{props.incidentSummary.failureStepAttempt}</span> : null}
                    </div>
                </div>
            ) : null}
            <div className="inline-note is-info incident-console-note-react">{HISTORY_TEXT.diagnostics.retriesHint}</div>
            {props.attempts.map((attempt) => (
                <details key={attempt.attempt} className="attempt-card incident-console-card-react" data-attempt-status={attempt.status} open={attempt.attempt === props.attempts[0]?.attempt}>
                    <summary>
                        <div className="incident-console-attempt-head-react">
                            <span className="incident-console-attempt-kicker-react">ATTEMPT {attempt.attempt}</span>
                            <strong>{HISTORY_TEXT.diagnostics.attemptTitle.replace('{attempt}', String(attempt.attempt))}</strong>
                            <div className="subtle-copy incident-console-attempt-meta-react">{formatDuration(attempt.durationMs)} • {attempt.steps.length} steps • {attempt.attachments.length} attachments</div>
                        </div>
                        <StatusBadge label={formatStatusLabel(attempt.status, false)} tone={getStatusTone(attempt.status, false)} />
                    </summary>
                    <div className="attempt-card-body">
                        <div className="meta-badge-row">
                            <span className="meta-badge">{HISTORY_TEXT.diagnostics.startTime}: {formatOptionalDate(attempt.startTime)}</span>
                            <span className="meta-badge">{HISTORY_TEXT.diagnostics.steps}: {attempt.steps.length}</span>
                            <span className="meta-badge">{HISTORY_TEXT.diagnostics.attachments}: {attempt.attachments.length}</span>
                        </div>
                        {attempt.errorMessage ? <TraceDisclosure text={attempt.errorMessage} badgeLabel="attempt" /> : null}
                        <AttemptStepTree
                            steps={attempt.steps}
                            runId={props.runId}
                            attemptNumber={attempt.attempt}
                            initiallyOpen={Boolean(attempt.errorMessage)}
                            primaryFailure={props.incidentSummary ? {
                                runId: props.incidentSummary.failureStepRunId,
                                attemptNumber: props.incidentSummary.failureStepAttempt,
                                offsetMs: props.incidentSummary.failureStepOffsetMs,
                                title: props.incidentSummary.failureStepTitle,
                                errorMessage: props.incidentSummary.failureStepErrorMessage,
                            } : null}
                        />
                        <AttemptAttachmentGrid runId={props.runId} attachments={attempt.attachments} artifactBasePath={props.artifactBasePath} isStaticMode={props.isStaticMode} />
                        {!attempt.errorMessage && attempt.steps.length === 0 && attempt.attachments.length === 0 ? <div className="subtle-copy">{HISTORY_TEXT.diagnostics.emptyAttempt}</div> : null}
                    </div>
                </details>
            ))}
        </div>
    )
}

function formatOptionalDate(value: string | null): string {
    return value ? formatDate(value) : '—'
}
