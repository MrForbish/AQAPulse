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
    primaryFailure?: {
        runId: string | null
        attemptNumber: number | null
        offsetMs: number | null
        title: string | null
        errorMessage: string | null
    } | null
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
                        <DiagnosticStepCard key={`${props.attemptNumber}-${node.stepIndex}-${node.step.title}`} node={node} runId={props.runId} attemptNumber={props.attemptNumber} primaryFailure={props.primaryFailure ?? null} />
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
    primaryFailure: {
        runId: string | null
        attemptNumber: number | null
        offsetMs: number | null
        title: string | null
        errorMessage: string | null
    } | null
}): React.JSX.Element {
    const { node } = props
    const hasChildren = node.children.length > 0
    const isPrimaryFailure = isPrimaryFailureStep(node.step, props.runId, props.attemptNumber, props.primaryFailure)
    const hasFailureInSubtree = node.step.isFailurePoint
        || isPrimaryFailure
        || isUnstableDiagnosticStatus(node.step.status)
        || node.children.some((childNode) => nodeHasFailure(childNode, props.runId, props.attemptNumber, props.primaryFailure))
    const metaBadges = [
        node.step.category ?? HISTORY_TEXT.diagnostics.noCategory,
        formatDuration(node.step.durationMs),
        node.step.offsetMs !== null ? `+${formatDuration(node.step.offsetMs)}` : null,
    ].filter((value): value is string => Boolean(value))
    const title = <OverflowText as="strong" text={node.step.title} className="step-title-react" lines={2} />
    const statusBadge = node.step.status ? <StatusBadge label={formatStatusLabel(node.step.status, false)} tone={getStatusTone(node.step.status, false)} /> : null

    if (hasChildren) {
        return (
            <details id={buildStepAnchor(props.runId, props.attemptNumber, node.stepIndex)} className={`step-node-branch-react${isPrimaryFailure ? ' is-primary-failure' : hasFailureInSubtree ? ' is-failure' : ''}`} open={hasFailureInSubtree || node.step.depth === 0}>
                <summary className="step-node-summary-react">
                    <div className="step-node-summary-main-react">
                        <div className="step-node-title-row-react">
                            <span className="step-node-toggle-react" aria-hidden="true" />
                            {title}
                        </div>
                        <div className="step-node-meta-react">
                            {metaBadges.map((badge) => <span key={badge} className="meta-badge">{badge}</span>)}
                            <span className="meta-badge">{node.children.length}</span>
                        </div>
                    </div>
                    {statusBadge}
                </summary>
                <div className="step-node-panel-react">
                    {isPrimaryFailure ? (
                        <div className="step-meta-row-react">
                            <span className="meta-badge is-primary">Основная причина</span>
                        </div>
                    ) : node.step.isFailurePoint ? (
                        <div className="step-meta-row-react">
                            <span className="meta-badge">{HISTORY_TEXT.diagnostics.failedStepBadge}</span>
                        </div>
                    ) : null}
                    {node.step.errorMessage ? <TraceDisclosure previewText={node.step.errorMessage} text={node.step.errorMessage} badgeLabel="step" /> : null}
                    <div className="step-tree-children-react">
                        {node.children.map((childNode) => (
                            <DiagnosticStepCard key={`${props.attemptNumber}-${childNode.stepIndex}-${childNode.step.title}`} node={childNode} runId={props.runId} attemptNumber={props.attemptNumber} primaryFailure={props.primaryFailure} />
                        ))}
                    </div>
                </div>
            </details>
        )
    }

    return (
        <article id={buildStepAnchor(props.runId, props.attemptNumber, node.stepIndex)} className={`step-card step-node-leaf-react${isPrimaryFailure ? ' is-primary-failure' : node.step.isFailurePoint ? ' is-failure' : ''}`} data-step-depth={node.step.depth}>
            <div className="step-tree-body-react">
                <div className="stack-item-header">
                    {title}
                    {statusBadge}
                </div>
                <div className="step-node-meta-react">
                    {metaBadges.map((badge) => <span key={badge} className="meta-badge">{badge}</span>)}
                </div>
                {isPrimaryFailure ? (
                    <div className="step-meta-row-react compact-top">
                        <span className="meta-badge is-primary">Основная причина</span>
                    </div>
                ) : node.step.isFailurePoint ? (
                    <div className="step-meta-row-react compact-top">
                        <span className="meta-badge">{HISTORY_TEXT.diagnostics.failedStepBadge}</span>
                    </div>
                ) : null}
                {node.step.errorMessage ? <TraceDisclosure previewText={node.step.errorMessage} text={node.step.errorMessage} badgeLabel="step" /> : null}
            </div>
        </article>
    )
}

function nodeHasFailure(
    node: ReturnType<typeof buildDiagnosticStepTree>[number],
    runId: string,
    attemptNumber: number,
    primaryFailure: {
        runId: string | null
        attemptNumber: number | null
        offsetMs: number | null
        title: string | null
        errorMessage: string | null
    } | null,
): boolean {
    return isPrimaryFailureStep(node.step, runId, attemptNumber, primaryFailure)
        || node.step.isFailurePoint
        || isUnstableDiagnosticStatus(node.step.status)
        || node.children.some((childNode) => nodeHasFailure(childNode, runId, attemptNumber, primaryFailure))
}

function isPrimaryFailureStep(
    step: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'][number],
    runId: string,
    attemptNumber: number,
    primaryFailure: {
        runId: string | null
        attemptNumber: number | null
        offsetMs: number | null
        title: string | null
        errorMessage: string | null
    } | null,
): boolean {
    if (!primaryFailure) {
        return false
    }

    if (primaryFailure.runId !== null && primaryFailure.runId !== runId) {
        return false
    }

    if (primaryFailure.attemptNumber !== null && primaryFailure.attemptNumber !== attemptNumber) {
        return false
    }

    if (primaryFailure.offsetMs !== null && step.offsetMs !== primaryFailure.offsetMs) {
        return false
    }

    if (primaryFailure.title && step.title !== primaryFailure.title) {
        return false
    }

    if (primaryFailure.errorMessage && step.errorMessage && step.errorMessage !== primaryFailure.errorMessage) {
        return false
    }

    return true
}

function isUnstableDiagnosticStatus(status: string | null): boolean {
    return status === 'failed' || status === 'timedout' || status === 'interrupted'
}