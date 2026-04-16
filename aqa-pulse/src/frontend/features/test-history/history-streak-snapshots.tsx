import React from 'react'
import type { TestHistoryResponse } from '../../../api-store'
import { formatDate } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import {
    buildHistoryRowAnchor,
    findCurrentStabilityStreak,
    findUnstableStreakBeforeRecovery,
    formatCurrentStabilityDescription,
    formatRunsLabel,
    formatTemplate,
    getUnstableEventLabel,
} from '../../../shared/test-history-helpers'
import { getStatusTone } from '../../../shared/dashboard-helpers'
import { StatusBadge } from '../../shared/ui'
import { formatOptionalDate, getEventToneClass } from './history-snapshot-helpers'

const HISTORY_TEXT = ru.testHistory

export function StabilityStreakSnapshot(props: {
    history: TestHistoryResponse['history']
    streak: ReturnType<typeof findCurrentStabilityStreak>
}): React.JSX.Element {
    return (
        <div className="stack-list">
            <div className={`stack-item event-panel-card ${props.streak.count > 0 ? 'is-good' : 'is-warn'}`}>
                <div className="stack-item-header">
                    <strong>{formatRunsLabel(props.streak.count)}</strong>
                    <StatusBadge label={props.streak.count > 0 ? 'stable' : HISTORY_TEXT.states.unknown} tone={props.streak.count > 0 ? 'good' : 'warn'} />
                </div>
                <div className="event-description">{formatCurrentStabilityDescription(props.streak)}</div>
                <div className="meta-badge-row compact-top">
                    <span className="meta-badge">{HISTORY_TEXT.meta.latestStable}: {formatOptionalDate(props.streak.latestStable?.reportTimestamp ?? props.streak.latestStable?.generatedAt ?? null)}</span>
                    <span className="meta-badge">{HISTORY_TEXT.meta.streakStart}: {formatOptionalDate(props.streak.oldestStable?.reportTimestamp ?? props.streak.oldestStable?.generatedAt ?? null)}</span>
                    <span className="meta-badge">{HISTORY_TEXT.meta.currentLatestRun}: {formatOptionalDate(props.history[0]?.reportTimestamp ?? props.history[0]?.generatedAt ?? null)}</span>
                </div>
                {props.streak.latestStable ? (
                    <div className="anchor-link-row compact-top">
                        <a className="ghost-link" href={`#${buildHistoryRowAnchor(props.streak.latestStable.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

export function UnstableStreakSnapshot(props: {
    streak: NonNullable<ReturnType<typeof findUnstableStreakBeforeRecovery>>
}): React.JSX.Element {
    return (
        <div className="stack-list">
            <div className={`stack-item event-panel-card ${getEventToneClass(props.streak.latestUnstable)}`}>
                <div className="stack-item-header">
                    <strong>{formatRunsLabel(props.streak.count)}</strong>
                    <StatusBadge label={getUnstableEventLabel(props.streak.latestUnstable)} tone={getStatusTone(props.streak.latestUnstable.status, props.streak.latestUnstable.flaky)} />
                </div>
                <div className="event-description">
                    {formatTemplate(HISTORY_TEXT.texts.unstableStreakBeforeRecovery, {
                        count: String(props.streak.count),
                        label: getUnstableEventLabel(props.streak.latestUnstable),
                    })}
                </div>
                <div className="meta-badge-row compact-top">
                    <span className="meta-badge">{HISTORY_TEXT.meta.recoveryAt}: {formatDate(props.streak.recovery.reportTimestamp ?? props.streak.recovery.generatedAt)}</span>
                    <span className="meta-badge">{HISTORY_TEXT.meta.latestUnstable}: {formatDate(props.streak.latestUnstable.reportTimestamp ?? props.streak.latestUnstable.generatedAt)}</span>
                    <span className="meta-badge">{HISTORY_TEXT.meta.oldestUnstable}: {formatDate(props.streak.oldestUnstable.reportTimestamp ?? props.streak.oldestUnstable.generatedAt)}</span>
                </div>
                <div className="anchor-link-row compact-top">
                    <a className="ghost-link" href={`#${buildHistoryRowAnchor(props.streak.latestUnstable.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                </div>
            </div>
        </div>
    )
}