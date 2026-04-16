import React from 'react'
import { Link } from 'react-router-dom'
import type { TestHistoryConflict } from '../../../api-store'
import { ru } from '../../../shared/i18n/ru'
import { ErrorView, PageFrame, Panel } from '../../shared/ui'

const HISTORY_TEXT = ru.testHistory

export function TestHistoryNotFoundState(props: {
    dashboardHref: string
}): React.JSX.Element {
    return (
        <PageFrame>
            <ErrorView
                title={HISTORY_TEXT.statePages.notFound.heading}
                message={HISTORY_TEXT.statePages.notFound.message}
                action={<Link className="ghost-link" to={props.dashboardHref}>{HISTORY_TEXT.backToDashboard}</Link>}
            />
        </PageFrame>
    )
}

export function TestHistoryConflictState(props: {
    payload: TestHistoryConflict
    buildCandidateHref: (candidate: TestHistoryConflict['candidates'][number]) => string
}): React.JSX.Element {
    return (
        <PageFrame>
            <Panel title={HISTORY_TEXT.statePages.conflict.heading} description={props.payload.message}>
                <div className="candidate-list">
                    {props.payload.candidates.map((candidate) => (
                        <Link
                            key={`${candidate.project}-${candidate.file}-${candidate.title}`}
                            className="candidate-card"
                            to={props.buildCandidateHref(candidate)}
                        >
                            <strong>{candidate.title}</strong>
                            <span>{candidate.project}</span>
                            <span>{candidate.file}</span>
                        </Link>
                    ))}
                </div>
            </Panel>
        </PageFrame>
    )
}