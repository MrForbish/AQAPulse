import React from 'react'
import type { TestHistoryResponse } from '../../../api-store'
import { formatDuration } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import { buildDiagnosticStepTree, buildStepAnchor } from '../../../shared/test-history-helpers'
import { OverflowText, StatusBadge, TraceDisclosure } from '../../shared/ui'

const HISTORY_TEXT = ru.testHistory

export function AttemptStepTree(props: {
    steps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps']
    runId: string
    attemptNumber: number
    initiallyOpen?: boolean
}): React.JSX.Element | null {
    if (props.steps.length === 0) {
        return null
    }

    return (
        <details className="attempt-step-group-react" open={props.initiallyOpen}>
            <summary className="attachment-preview-summary-react">
                <span className="attempt-section-title-react">{HISTORY_TEXT.diagnostics.stepsTitle}</span>
                <span className="meta-badge">{props.steps.length}</span>
            </summary>
            <div className="attachment-preview-body-react">
                <div className="step-tree-react">
                    {buildDiagnosticStepTree(props.steps).map((node) => (
                        <DiagnosticStepCard key={`${props.attemptNumber}-${node.stepIndex}-${node.step.title}`} node={node} runId={props.runId} attemptNumber={props.attemptNumber} />
                    ))}
                </div>
            </div>
        </details>
    )
}

function DiagnosticStepCard(props: {
    node: ReturnType<typeof buildDiagnosticStepTree>[number]
    runId: string
    attemptNumber: number
}): React.JSX.Element {
    const { node } = props
    const meta = `${node.step.category ?? HISTORY_TEXT.diagnostics.noCategory} • depth ${node.step.depth} • ${formatDuration(node.step.durationMs)}`

    return (
        <div className={`step-card step-tree-node-react${node.step.isFailurePoint ? ' is-failure' : ''}${node.step.depth === 2 ? ' is-nested' : ''}`}>
            <div id={buildStepAnchor(props.runId, props.attemptNumber, node.stepIndex)} className="step-tree-body-react">
                <div className="stack-item-header">
                    <OverflowText as="strong" text={node.step.title} className="step-title-react" lines={2} />
                    {node.step.status ? <StatusBadge label={formatStatusLabel(node.step.status, false)} tone={getStatusTone(node.step.status, false)} /> : null}
                </div>
                <div className="subtle-copy" title={meta}>{meta}</div>
                {node.step.isFailurePoint ? (
                    <div className="step-meta-row-react compact-top">
                        <span className="meta-badge">{HISTORY_TEXT.diagnostics.failedStepBadge}</span>
                    </div>
                ) : null}
                {node.step.errorMessage ? <TraceDisclosure previewText={node.step.errorMessage} text={node.step.errorMessage} badgeLabel="step" /> : null}
            </div>
            {node.children.length > 0 ? (
                <div className="step-tree-children-react">
                    {node.children.map((childNode) => (
                        <DiagnosticStepCard key={`${props.attemptNumber}-${childNode.stepIndex}-${childNode.step.title}`} node={childNode} runId={props.runId} attemptNumber={props.attemptNumber} />
                    ))}
                </div>
            ) : null}
        </div>
    )
}