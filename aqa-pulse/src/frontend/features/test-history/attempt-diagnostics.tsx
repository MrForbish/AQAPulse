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
}): React.JSX.Element {
    if (props.attempts.length === 0) {
        return <EmptyState title="Attempt details отсутствуют" message={HISTORY_TEXT.diagnostics.emptyAttempt} />
    }

    return (
        <div className="attempt-list-react attempt-list-scroll-react">
            <div className="inline-note is-info">{HISTORY_TEXT.diagnostics.retriesHint}</div>
            {props.attempts.map((attempt) => (
                <details key={attempt.attempt} className="attempt-card" open={attempt.attempt === props.attempts[0]?.attempt}>
                    <summary>
                        <div>
                            <strong>{HISTORY_TEXT.diagnostics.attemptTitle.replace('{attempt}', String(attempt.attempt))}</strong>
                            <div className="subtle-copy">{formatDuration(attempt.durationMs)} • {attempt.steps.length} steps • {attempt.attachments.length} attachments</div>
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
                        <AttemptStepTree steps={attempt.steps} runId={props.runId} attemptNumber={attempt.attempt} initiallyOpen={Boolean(attempt.errorMessage)} />
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
