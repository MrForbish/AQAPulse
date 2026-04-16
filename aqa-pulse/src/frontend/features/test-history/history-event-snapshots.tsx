import React from 'react'
import type { TestHistoryResponse } from '../../../api-store'
import { formatDate, formatDuration } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { formatCommit, formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import {
    buildHistoryRowAnchor,
    formatTemplate,
    getUnstableEventLabel,
} from '../../../shared/test-history-helpers'
import { StatusBadge, TraceDisclosure } from '../../shared/ui'
import { getEventToneClass } from './history-snapshot-helpers'

const HISTORY_TEXT = ru.testHistory

export function EventSnapshot(props: { run: TestHistoryResponse['history'][number] }): React.JSX.Element {
    return (
        <div className="stack-list">
            <div className={`stack-item event-panel-card ${getEventToneClass(props.run)}`}>
                <div className="stack-item-header">
                    <strong>{formatDate(props.run.reportTimestamp ?? props.run.generatedAt)}</strong>
                    <StatusBadge label={formatStatusLabel(props.run.status, props.run.flaky)} tone={getStatusTone(props.run.status, props.run.flaky)} />
                </div>
                <div className="subtle-copy">{props.run.branch ?? '—'} • {formatCommit(props.run.commit)} • {formatDuration(props.run.durationMs)} • {props.run.author ?? '—'}</div>
                {props.run.errorMessage ? (
                    <TraceDisclosure previewText={props.run.errorMessage} text={props.run.errorMessage} badgeLabel="event" />
                ) : (
                    <div className="event-description compact-top">
                        {props.run.flaky ? HISTORY_TEXT.texts.latestFlakyDescription : 'Ошибок не зафиксировано.'}
                    </div>
                )}
                <div className="anchor-link-row compact-top">
                    <a className="ghost-link" href={`#${buildHistoryRowAnchor(props.run.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                </div>
            </div>
        </div>
    )
}

export function PreviousUnstableEventsList(props: { runs: TestHistoryResponse['history'] }): React.JSX.Element {
    return (
        <div className="stack-list">
            {props.runs.map((run) => (
                <div key={run.runId} className={`stack-item event-panel-card ${getEventToneClass(run)}`}>
                    <div className="stack-item-header">
                        <strong>{formatDate(run.reportTimestamp ?? run.generatedAt)}</strong>
                        <StatusBadge label={getUnstableEventLabel(run)} tone={getStatusTone(run.status, run.flaky)} />
                    </div>
                    <div className="subtle-copy">{run.branch ?? '—'} • {formatCommit(run.commit)} • {formatDuration(run.durationMs)}</div>
                    {run.errorMessage ? (
                        <TraceDisclosure previewText={run.errorMessage} text={run.errorMessage} badgeLabel="event" />
                    ) : (
                        <div className="event-description compact-top">
                            {run.flaky ? HISTORY_TEXT.texts.retryFlakyDescription : formatTemplate(HISTORY_TEXT.texts.statusPrefix, { status: formatStatusLabel(run.status, false) })}
                        </div>
                    )}
                    <div className="anchor-link-row compact-top">
                        <a className="ghost-link" href={`#${buildHistoryRowAnchor(run.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                    </div>
                </div>
            ))}
        </div>
    )
}

export function RecoverySnapshot(props: {
    recovery: TestHistoryResponse['history'][number]
    previousUnstable: TestHistoryResponse['history'][number]
}): React.JSX.Element {
    const sourceLabel = props.previousUnstable.errorMessage
        ? HISTORY_TEXT.texts.recoveryFromError
        : (props.previousUnstable.flaky
            ? HISTORY_TEXT.texts.recoveryFromFlaky
            : formatTemplate(HISTORY_TEXT.texts.statusPrefix, { status: formatStatusLabel(props.previousUnstable.status, false) }))

    return (
        <div className="stack-list">
            <div className="stack-item event-panel-card is-good">
                <div className="stack-item-header">
                    <strong>{formatDate(props.recovery.reportTimestamp ?? props.recovery.generatedAt)}</strong>
                    <StatusBadge label={formatStatusLabel(props.recovery.status, props.recovery.flaky)} tone={getStatusTone(props.recovery.status, props.recovery.flaky)} />
                </div>
                <div className="subtle-copy">{props.recovery.branch ?? '—'} • {formatCommit(props.recovery.commit)} • {formatDuration(props.recovery.durationMs)}</div>
                <div className="event-description compact-top">
                    {formatTemplate(HISTORY_TEXT.texts.recoveryAfter, {
                        source: sourceLabel,
                        date: formatDate(props.previousUnstable.reportTimestamp ?? props.previousUnstable.generatedAt),
                    })}
                </div>
                <div className="anchor-link-row compact-top">
                    <a className="ghost-link" href={`#${buildHistoryRowAnchor(props.recovery.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                </div>
            </div>
        </div>
    )
}