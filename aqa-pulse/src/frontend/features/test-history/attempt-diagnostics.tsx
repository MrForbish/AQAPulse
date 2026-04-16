import React from 'react'
import { createPortal } from 'react-dom'
import type { TestHistoryAttachment, TestHistoryResponse } from '../../../api-store'
import { formatDate, formatDuration } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import {
    buildAttachmentHref,
    buildStepAnchor,
    canInlineMarkdownPreview,
    isImageAttachment,
    isMarkdownAttachment,
} from '../../../shared/test-history-helpers'
import { EmptyState, OverflowText, StatusBadge } from '../../shared/ui'

const HISTORY_TEXT = ru.testHistory

interface DiagnosticStepNode {
    step: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'][number]
    flatIndex: number
    children: DiagnosticStepNode[]
}

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
        <div className="attempt-list-react">
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
                        {attempt.errorMessage ? <div className="mono-cell">{attempt.errorMessage}</div> : null}
                        {attempt.steps.length > 0 ? (
                            <details className="attempt-step-group-react" open={Boolean(attempt.errorMessage)}>
                                <summary className="attachment-preview-summary-react">
                                    <span className="attempt-section-title-react">{HISTORY_TEXT.diagnostics.stepsTitle}</span>
                                    <span className="meta-badge">{attempt.steps.length}</span>
                                </summary>
                                <div className="attachment-preview-body-react">
                                    <div className="step-tree-react">
                                        {buildDiagnosticStepTree(attempt.steps).map((node) => (
                                            <DiagnosticStepCard key={`${attempt.attempt}-${node.flatIndex}-${node.step.title}`} node={node} runId={props.runId} attemptNumber={attempt.attempt} />
                                        ))}
                                    </div>
                                </div>
                            </details>
                        ) : null}
                        {attempt.attachments.length > 0 ? (
                            <>
                                <div className="attempt-section-title-react">{HISTORY_TEXT.diagnostics.attachmentsTitle}</div>
                                <div className="attachment-grid-react">
                                    {attempt.attachments.map((attachment) => (
                                        <AttachmentCard key={`${attachment.name}-${attachment.path ?? attachment.url ?? 'inline'}`} runId={props.runId} attachment={attachment} artifactBasePath={props.artifactBasePath} isStaticMode={props.isStaticMode} />
                                    ))}
                                </div>
                            </>
                        ) : null}
                        {!attempt.errorMessage && attempt.steps.length === 0 && attempt.attachments.length === 0 ? <div className="subtle-copy">{HISTORY_TEXT.diagnostics.emptyAttempt}</div> : null}
                    </div>
                </details>
            ))}
        </div>
    )
}

function AttachmentCard(props: { runId: string; attachment: TestHistoryAttachment; artifactBasePath: string; isStaticMode: boolean }): React.JSX.Element {
    const href = resolveAttachmentHref(props.runId, props.attachment, props.artifactBasePath, props.isStaticMode)
    const imagePreviewAvailable = Boolean(href && isImageAttachment(props.attachment))
    const markdownPreviewAvailable = Boolean(href && isMarkdownAttachment(props.attachment) && canInlineMarkdownPreview(href))
    const imagePreviewHref = imagePreviewAvailable ? href : null
    const [isImageLightboxOpen, setIsImageLightboxOpen] = React.useState(false)
    const [imageLightboxStatus, setImageLightboxStatus] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
    const [isMarkdownOpen, setIsMarkdownOpen] = React.useState(false)
    const [markdownState, setMarkdownState] = React.useState<{ status: 'idle' | 'loading' | 'success' | 'error'; content: string }>({ status: 'idle', content: '' })
    const previousActiveElementRef = React.useRef<HTMLElement | null>(null)
    const imageLightboxCloseRef = React.useRef<HTMLButtonElement | null>(null)
    const lightboxHost = typeof document !== 'undefined' ? document.body : null

    React.useEffect(() => {
        setMarkdownState({ status: 'idle', content: '' })
    }, [href])

    React.useEffect(() => {
        if (!isImageLightboxOpen) {
            return
        }

        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return
        }

        previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setImageLightboxStatus('loading')

        const previousBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const abortLightbox = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setIsImageLightboxOpen(false)
            }
        }

        window.addEventListener('keydown', abortLightbox)
        const scheduleFocus = typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame.bind(window)
            : (callback: FrameRequestCallback) => window.setTimeout(callback, 0)

        scheduleFocus(() => {
            imageLightboxCloseRef.current?.focus()
            return 0
        })

        return () => {
            window.removeEventListener('keydown', abortLightbox)
            document.body.style.overflow = previousBodyOverflow

            const previousActiveElement = previousActiveElementRef.current
            previousActiveElementRef.current = null
            previousActiveElement?.focus()
        }
    }, [isImageLightboxOpen])

    React.useEffect(() => {
        if (!isMarkdownOpen || !markdownPreviewAvailable || !href || markdownState.status !== 'idle') {
            return
        }

        const abortController = typeof AbortController === 'function' ? new AbortController() : null
        let isDisposed = false
        const timeoutId = typeof window === 'undefined'
            ? null
            : window.setTimeout(() => abortController?.abort(), 15000)
        setMarkdownState({ status: 'loading', content: '' })

        const requestInit: RequestInit = {
            credentials: 'same-origin',
            signal: abortController?.signal,
        }

        fetch(href, requestInit)
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Markdown preview request failed with ${response.status}`)
                }

                const responseContentType = response.headers.get('content-type')?.toLowerCase() ?? ''

                if (responseContentType.includes('text/html') && !responseContentType.includes('markdown') && !responseContentType.startsWith('text/plain')) {
                    throw new Error('Markdown preview request returned HTML instead of markdown text')
                }

                return response.text()
            })
            .then((content) => {
                if (!isDisposed) {
                    setMarkdownState({ status: 'success', content })
                }
            })
            .catch(() => {
                if (!isDisposed && !abortController?.signal.aborted) {
                    setMarkdownState({ status: 'error', content: '' })
                }
            })

        return () => {
            isDisposed = true
            abortController?.abort()

            if (timeoutId !== null) {
                window.clearTimeout(timeoutId)
            }
        }
    }, [href, isMarkdownOpen, markdownPreviewAvailable])

    const imageLightbox = imagePreviewHref && lightboxHost
        ? createPortal(
            <div className="image-lightbox-react" hidden={!isImageLightboxOpen} data-image-lightbox>
                <button
                    type="button"
                    className="image-lightbox-backdrop-react"
                    data-image-lightbox-close
                    aria-label={HISTORY_TEXT.diagnostics.closeImageLightbox}
                    onClick={() => setIsImageLightboxOpen(false)}
                />
                <div className="image-lightbox-dialog-react" role="dialog" aria-modal="true" aria-label={HISTORY_TEXT.diagnostics.imageLightboxTitle}>
                    <div className="image-lightbox-header-react">
                        <div className="image-lightbox-title-react" data-image-lightbox-title>{props.attachment.name || HISTORY_TEXT.diagnostics.imageLightboxTitle}</div>
                        <button
                            ref={imageLightboxCloseRef}
                            type="button"
                            className="image-lightbox-close-react"
                            data-image-lightbox-close
                            aria-label={HISTORY_TEXT.diagnostics.closeImageLightbox}
                            onClick={() => setIsImageLightboxOpen(false)}
                        >
                            ×
                        </button>
                    </div>
                    <div className="image-lightbox-body-react">
                        {imageLightboxStatus === 'loading' ? <div className="image-lightbox-status-react">{HISTORY_TEXT.diagnostics.loadingImagePreview}</div> : null}
                        <img
                            className="image-lightbox-image-react"
                            data-image-lightbox-image
                            src={imagePreviewHref}
                            alt={props.attachment.name}
                            loading="eager"
                            hidden={imageLightboxStatus === 'error'}
                            onLoad={() => setImageLightboxStatus('loaded')}
                            onError={() => setImageLightboxStatus('error')}
                        />
                        {imageLightboxStatus === 'error' ? (
                            <div className="image-lightbox-fallback-react" data-image-lightbox-error>
                                <div>{HISTORY_TEXT.diagnostics.imagePreviewUnavailable}</div>
                                <a className="ghost-link" href={imagePreviewHref} target="_blank" rel="noreferrer">{HISTORY_TEXT.diagnostics.openAttachment}</a>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>,
            lightboxHost,
        )
        : null

    return (
        <article className="attachment-card-react">
            <div className="stack-item-header">
                <OverflowText as="strong" text={props.attachment.name} className="stack-item-title-react" lines={2} />
                {props.attachment.contentType ? <span className="meta-badge">{props.attachment.contentType}</span> : null}
            </div>
            <div className="subtle-copy" title={props.attachment.contentType ?? 'unknown'}>{props.attachment.contentType ?? 'unknown'}</div>
            <OverflowText as="div" text={props.attachment.path ?? props.attachment.url ?? HISTORY_TEXT.diagnostics.attachmentLocationMissing} className="mono-cell compact-top" lines={2} />
            {href ? <a className="ghost-link compact-top" href={href} target="_blank" rel="noreferrer">{HISTORY_TEXT.diagnostics.openAttachment}</a> : null}
            {imagePreviewHref ? (
                <details className="attachment-preview-react compact-top">
                    <summary className="attachment-preview-summary-react">{HISTORY_TEXT.diagnostics.inlineImagePreview}</summary>
                    <div className="attachment-preview-body-react">
                        <button
                            type="button"
                            className="attachment-image-trigger-react"
                            data-image-lightbox-trigger
                            aria-label={HISTORY_TEXT.diagnostics.expandImageHint}
                            onClick={() => setIsImageLightboxOpen(true)}
                        >
                            <img className="attachment-image-preview-react" src={imagePreviewHref} alt={props.attachment.name} loading="lazy" />
                        </button>
                        <div className="attachment-image-hint-react">{HISTORY_TEXT.diagnostics.expandImageHint}</div>
                    </div>
                </details>
            ) : null}
            {markdownPreviewAvailable ? (
                <details
                    className="attachment-preview-react compact-top"
                    data-markdown-preview
                    onToggle={(event) => {
                        const isOpen = (event.currentTarget as HTMLDetailsElement).open
                        setIsMarkdownOpen(isOpen)

                        if (isOpen && markdownState.status === 'error') {
                            setMarkdownState({ status: 'idle', content: '' })
                        }
                    }}
                >
                    <summary className="attachment-preview-summary-react">{HISTORY_TEXT.diagnostics.inlineMarkdownPreview}</summary>
                    <div className="attachment-preview-body-react">
                        {markdownState.status === 'loading' ? <div className="attachment-preview-loading-react" data-markdown-loading>{HISTORY_TEXT.diagnostics.loadingMarkdownPreview}</div> : null}
                        {markdownState.status === 'error' ? <div className="attachment-preview-error-react" data-markdown-error>{HISTORY_TEXT.diagnostics.markdownPreviewUnavailable}</div> : null}
                        {markdownState.status === 'success' ? <pre className="attachment-markdown-preview-react" data-markdown-content>{markdownState.content}</pre> : null}
                    </div>
                </details>
            ) : null}
            {imageLightbox}
        </article>
    )
}

function resolveAttachmentHref(runId: string, attachment: TestHistoryAttachment, artifactBasePath: string, isStaticMode: boolean): string | null {
    if (attachment.url) {
        return attachment.url
    }

    if (isStaticMode) {
        return null
    }

    return buildAttachmentHref(runId, attachment, artifactBasePath)
}

function formatOptionalDate(value: string | null): string {
    return value ? formatDate(value) : '—'
}

function buildDiagnosticStepTree(steps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps']): DiagnosticStepNode[] {
    const roots: DiagnosticStepNode[] = []
    let currentTopLevelTestStep: DiagnosticStepNode | null = null
    let currentNestedTestStep: DiagnosticStepNode | null = null

    steps.forEach((step, flatIndex) => {
        const node: DiagnosticStepNode = {
            step,
            flatIndex,
            children: [],
        }

        if (step.category === 'test.step') {
            if (step.depth === 2 && currentTopLevelTestStep) {
                currentTopLevelTestStep.children.push(node)
                currentNestedTestStep = node
                return
            }

            roots.push(node)
            currentTopLevelTestStep = node
            currentNestedTestStep = null
            return
        }

        if (step.depth === 2) {
            const parentNode = currentNestedTestStep ?? currentTopLevelTestStep

            if (parentNode) {
                parentNode.children.push(node)
                return
            }
        }

        roots.push(node)
        currentTopLevelTestStep = null
        currentNestedTestStep = null
    })

    return roots
}

function DiagnosticStepCard(props: { node: DiagnosticStepNode; runId: string; attemptNumber: number }): React.JSX.Element {
    const { node } = props
    const meta = `${node.step.category ?? HISTORY_TEXT.diagnostics.noCategory} • depth ${node.step.depth} • ${formatDuration(node.step.durationMs)}`

    return (
        <div className={`step-card step-tree-node-react${node.step.isFailurePoint ? ' is-failure' : ''}${node.step.depth === 2 ? ' is-nested' : ''}`}>
            <div id={buildStepAnchor(props.runId, props.attemptNumber, node.flatIndex)} className="step-tree-body-react">
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
                {node.step.errorMessage ? <OverflowText as="div" text={node.step.errorMessage} className="mono-cell compact-top" lines={2} /> : null}
            </div>
            {node.children.length > 0 ? (
                <div className="step-tree-children-react">
                    {node.children.map((childNode) => (
                        <DiagnosticStepCard key={`${props.attemptNumber}-${childNode.flatIndex}-${childNode.step.title}`} node={childNode} runId={props.runId} attemptNumber={props.attemptNumber} />
                    ))}
                </div>
            ) : null}
        </div>
    )
}