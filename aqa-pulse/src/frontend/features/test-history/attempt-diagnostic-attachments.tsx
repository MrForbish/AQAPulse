import React from 'react'
import { createPortal } from 'react-dom'
import type { TestHistoryAttachment } from '../../../api-store'
import { ru } from '../../../shared/i18n/ru'
import {
    buildAttachmentHref,
    canInlineMarkdownPreview,
    isImageAttachment,
    isMarkdownAttachment,
} from '../../../shared/test-history-helpers'
import { OverflowText } from '../../shared/ui'

const HISTORY_TEXT = ru.testHistory

export function AttemptAttachmentGrid(props: {
    runId: string
    attachments: TestHistoryAttachment[]
    artifactBasePath: string
    isStaticMode: boolean
}): React.JSX.Element | null {
    if (props.attachments.length === 0) {
        return null
    }

    return (
        <>
            <div className="attempt-section-title-react">{HISTORY_TEXT.diagnostics.attachmentsTitle}</div>
            <div className="attachment-grid-react">
                {props.attachments.map((attachment) => (
                    <AttachmentCard key={`${attachment.name}-${attachment.path ?? attachment.url ?? 'inline'}`} runId={props.runId} attachment={attachment} artifactBasePath={props.artifactBasePath} isStaticMode={props.isStaticMode} />
                ))}
            </div>
        </>
    )
}

function AttachmentCard(props: {
    runId: string
    attachment: TestHistoryAttachment
    artifactBasePath: string
    isStaticMode: boolean
}): React.JSX.Element {
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