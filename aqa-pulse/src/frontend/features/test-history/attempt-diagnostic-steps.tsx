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
        <details className="attempt-step-group-react diagnostic-step-group-react" open={props.initiallyOpen}>
            <summary className="attachment-preview-summary-react">
                <span className="attempt-section-title-react">{HISTORY_TEXT.diagnostics.stepsTitle}</span>
                <span className="meta-badge">{props.steps.length}</span>
            </summary>
            <div className="attachment-preview-body-react diagnostic-step-scroll-wrap-react">
                <div className="step-tree-react diagnostic-step-tree-react">
                    {buildDiagnosticStepTree(props.steps).map((node) => (
                        <DiagnosticStepCard key={`${props.attemptNumber}-${node.stepIndex}-${node.step.title}`} node={node} runId={props.runId} attemptNumber={props.attemptNumber} allSteps={props.steps} primaryFailure={props.primaryFailure ?? null} />
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
    allSteps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps']
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
    const hasOwnFailureSignal = isPrimaryFailure || node.step.isFailurePoint
    const hasOwnDiagnosticError = Boolean(node.step.errorMessage) || isUnstableDiagnosticStatus(node.step.status)
    const hasFailureInSubtree = hasOwnFailureSignal
        || node.children.some((childNode) => nodeHasFailure(childNode, props.runId, props.attemptNumber, props.allSteps, props.primaryFailure))
    const hasDiagnosticErrorInSubtree = hasOwnDiagnosticError
        || node.children.some((childNode) => nodeHasDiagnosticError(childNode))
    const metaBadges = [
        node.step.category ?? HISTORY_TEXT.diagnostics.noCategory,
        `${HISTORY_TEXT.diagnostics.duration}: ${formatDuration(node.step.durationMs)}`,
        node.step.offsetMs !== null ? `${HISTORY_TEXT.diagnostics.stepOffset}: +${formatDuration(node.step.offsetMs)}` : null,
    ].filter((value): value is string => Boolean(value))
    const title = <OverflowText as="strong" text={node.step.title} className="step-title-react" lines={2} />
    const statusBadge = node.step.status ? <StatusBadge label={formatStatusLabel(node.step.status, false)} tone={getStatusTone(node.step.status, false)} /> : null
    const primaryCauseBadge = <span className="step-primary-cause-badge-react">Основная причина</span>

    if (hasChildren) {
        return (
            <details id={buildStepAnchor(props.runId, props.attemptNumber, node.stepIndex)} className={`step-node-branch-react${isPrimaryFailure ? ' is-primary-failure' : hasFailureInSubtree ? ' is-failure' : ''}`} data-step-depth={node.step.depth} open={hasDiagnosticErrorInSubtree || node.step.depth === 0}>
                <summary className="step-node-summary-react">
                    <div className="step-node-summary-main-react">
                        <div className="step-node-title-row-react">
                            <span className="step-node-rail-react" aria-hidden="true">
                                <span className="step-node-toggle-react" />
                            </span>
                            {title}
                        </div>
                        <div className="step-node-meta-react">
                            {metaBadges.map((badge) => <span key={badge} className="meta-badge">{badge}</span>)}
                            <span className="meta-badge">{node.children.length} дочерних шага</span>
                        </div>
                    </div>
                    {statusBadge}
                </summary>
                <div className="step-node-panel-react">
                    {isPrimaryFailure ? (
                        <div className="step-meta-row-react is-primary-cause-row">
                            {primaryCauseBadge}
                        </div>
                    ) : node.step.isFailurePoint ? (
                        <div className="step-meta-row-react">
                            <span className="meta-badge is-primary-failure-badge">{HISTORY_TEXT.diagnostics.failedStepBadge}</span>
                        </div>
                    ) : node.step.errorMessage ? (
                        <div className="step-meta-row-react">
                            <span className="meta-badge is-secondary-error-badge">{HISTORY_TEXT.diagnostics.stepErrorBadge}</span>
                        </div>
                    ) : null}
                    {node.step.errorMessage ? <TraceDisclosure previewText={node.step.errorMessage} text={node.step.errorMessage} badgeLabel="step" /> : null}
                    <div className="step-tree-children-react" data-step-children-depth={node.step.depth + 1}>
                        {node.children.map((childNode) => (
                            <DiagnosticStepCard key={`${props.attemptNumber}-${childNode.stepIndex}-${childNode.step.title}`} node={childNode} runId={props.runId} attemptNumber={props.attemptNumber} allSteps={props.allSteps} primaryFailure={props.primaryFailure} />
                        ))}
                    </div>
                </div>
            </details>
        )
    }

    return (
        <article id={buildStepAnchor(props.runId, props.attemptNumber, node.stepIndex)} className={`step-card step-node-leaf-react${isPrimaryFailure ? ' is-primary-failure' : node.step.isFailurePoint ? ' is-failure' : ''}`} data-step-depth={node.step.depth}>
            <div className="step-tree-body-react">
                <div className="step-node-summary-react is-leaf">
                    <div className="step-node-summary-main-react">
                        <div className="step-node-title-row-react">
                            <span className="step-node-rail-react is-leaf" aria-hidden="true">
                                <span className="step-node-toggle-react is-leaf" />
                            </span>
                            {title}
                        </div>
                        <div className="step-node-meta-react">
                            {metaBadges.map((badge) => <span key={badge} className="meta-badge">{badge}</span>)}
                        </div>
                    </div>
                    {statusBadge}
                </div>
                {isPrimaryFailure ? (
                    <div className="step-meta-row-react compact-top is-primary-cause-row">
                        {primaryCauseBadge}
                    </div>
                ) : node.step.isFailurePoint ? (
                    <div className="step-meta-row-react compact-top">
                        <span className="meta-badge is-primary-failure-badge">{HISTORY_TEXT.diagnostics.failedStepBadge}</span>
                    </div>
                ) : node.step.errorMessage ? (
                    <div className="step-meta-row-react compact-top">
                        <span className="meta-badge is-secondary-error-badge">{HISTORY_TEXT.diagnostics.stepErrorBadge}</span>
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
    allSteps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'],
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
        || node.children.some((childNode) => nodeHasFailure(childNode, runId, attemptNumber, allSteps, primaryFailure))
}

function nodeHasDiagnosticError(
    node: ReturnType<typeof buildDiagnosticStepTree>[number],
): boolean {
    return Boolean(node.step.errorMessage)
        || isUnstableDiagnosticStatus(node.step.status)
        || node.children.some((childNode) => nodeHasDiagnosticError(childNode))
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