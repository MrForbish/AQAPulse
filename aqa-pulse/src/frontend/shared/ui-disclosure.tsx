import React from 'react'
import { createPortal } from 'react-dom'

export interface TraceDisclosureProps {
    text: string | null | undefined
    previewText?: string | null
    emptyLabel?: string
    dialogTitle?: string
    badgeLabel?: string
    showBadge?: boolean
    compact?: boolean
    compactSize?: 'tight' | 'comfortable'
    variant?: 'default' | 'cluster' | 'table'
}

export function TraceDisclosure(props: TraceDisclosureProps): React.JSX.Element {
    const fullText = normalizeDisclosureText(props.text)
    const previewText = buildDisclosurePreview(props.previewText ?? fullText)
    const compactClassName = props.compact ? (props.compactSize === 'comfortable' ? 'is-compact-roomy' : 'is-compact') : ''
    const variantClassName = props.variant === 'cluster' ? 'is-cluster' : props.variant === 'table' ? 'is-table' : ''
    const [isOpen, setIsOpen] = React.useState(false)
    const closeRef = React.useRef<HTMLButtonElement | null>(null)
    const previousActiveElementRef = React.useRef<HTMLElement | null>(null)
    const portalHost = typeof document !== 'undefined' ? document.body : null

    React.useEffect(() => {
        if (!isOpen || typeof window === 'undefined' || typeof document === 'undefined') {
            return
        }

        previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const previousBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const closeOnEscape = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setIsOpen(false)
            }
        }

        window.addEventListener('keydown', closeOnEscape)
        const scheduleFocus = typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame.bind(window)
            : (callback: FrameRequestCallback) => window.setTimeout(callback, 0)

        scheduleFocus(() => {
            closeRef.current?.focus()
            return 0
        })

        return () => {
            window.removeEventListener('keydown', closeOnEscape)
            document.body.style.overflow = previousBodyOverflow
            const previousActiveElement = previousActiveElementRef.current
            previousActiveElementRef.current = null
            previousActiveElement?.focus()
        }
    }, [isOpen])

    if (!fullText) {
        return <span className="trace-disclosure-empty-react">{props.emptyLabel ?? '—'}</span>
    }

    const disclosureDialog = portalHost
        ? createPortal(
            <div className="trace-disclosure-modal-react" hidden={!isOpen} data-trace-disclosure-dialog>
                <button
                    type="button"
                    className="trace-disclosure-backdrop-react"
                    aria-label="Закрыть trace preview"
                    data-trace-disclosure-close
                    onClick={() => setIsOpen(false)}
                />
                <div className="trace-disclosure-dialog-react" role="dialog" aria-modal="true" aria-label={props.dialogTitle ?? 'Трейс ошибки'}>
                    <div className="trace-disclosure-header-react">
                        <strong>{props.dialogTitle ?? 'Трейс ошибки'}</strong>
                        <button
                            ref={closeRef}
                            type="button"
                            className="trace-disclosure-close-react"
                            aria-label="Закрыть trace preview"
                            data-trace-disclosure-close
                            onClick={() => setIsOpen(false)}
                        >
                            ×
                        </button>
                    </div>
                    <pre className="trace-disclosure-content-react" data-trace-disclosure-content>{fullText}</pre>
                </div>
            </div>,
            portalHost,
        )
        : null

    return (
        <>
            <button
                type="button"
                className={['trace-disclosure-trigger-react', compactClassName, variantClassName].filter(Boolean).join(' ')}
                data-trace-disclosure-trigger
                onClick={() => setIsOpen(true)}
            >
                <span className={['trace-disclosure-copy-react', 'mono-cell', compactClassName, variantClassName].filter(Boolean).join(' ')}>{previewText}</span>
                {props.showBadge === false ? null : <span className="trace-disclosure-pill-react">{props.badgeLabel ?? 'trace'}</span>}
            </button>
            {disclosureDialog}
        </>
    )
}

function normalizeDisclosureText(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value.trim()
    return normalized.length > 0 && normalized !== '—' ? normalized : null
}

function buildDisclosurePreview(value: string | null): string {
    if (!value) {
        return '—'
    }

    const compact = value.replace(/\s+/g, ' ').trim()
    return compact.length <= 110 ? compact : `${compact.slice(0, 109).trimEnd()}…`
}