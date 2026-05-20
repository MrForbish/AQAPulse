import React from 'react'
import { Link } from 'react-router-dom'
import { Panel } from '../../shared/ui'
import type { DashboardActionResult, DashboardCopyItem } from './admin-hooks'

export function AdminDashboardHero(props: {
    workspaceCount: number
    isLoggingOut: boolean
    onLogout: () => Promise<void>
}): React.JSX.Element {
    return (
        <section className="hero-block admin-hero-block">
            <div className="panel admin-hero-copy">
                <div className="eyebrow">Admin workspace control</div>
                <h1>AQA Pulse Admin</h1>
                <p>Единый React shell для provisioning, workspace access и ingestion flow без отдельного legacy delivery слоя для admin-страниц.</p>
            </div>
            <div className="hero-meta-card admin-toolbar-card">
                <div className="hero-meta-row">
                    <span>Workspace count</span>
                    <strong>{props.workspaceCount}</strong>
                </div>
                <div className="hero-meta-row">
                    <span>Auth mode</span>
                    <strong>Session cookie + JWT exchange</strong>
                </div>
                <div className="hero-actions">
                    <Link to="/admin/workspaces/new" className="primary-link">New workspace</Link>
                    <Link to="/admin/settings" className="secondary-button">Server settings</Link>
                    <button type="button" className="secondary-button" onClick={() => void props.onLogout()} disabled={props.isLoggingOut}>
                        {props.isLoggingOut ? 'Выходим...' : 'Выйти'}
                    </button>
                </div>
            </div>
        </section>
    )
}

export function AdminDashboardActionResult(props: { actionResult: DashboardActionResult; onClose: () => void }): React.JSX.Element {
    if (props.actionResult.copyItems && props.actionResult.copyItems.length > 0) {
        return <AdminDashboardCredentialsModal actionResult={props.actionResult} onClose={props.onClose} />
    }

    const toneClass = props.actionResult.tone === 'error'
        ? 'panel-error'
        : props.actionResult.tone === 'info'
            ? 'panel-info'
            : 'panel-success'

    return (
        <div className="admin-action-modal" role="dialog" aria-modal="true" aria-label={props.actionResult.title}>
            <div className="admin-action-modal-backdrop" onClick={props.onClose} />
            <Panel title={props.actionResult.title} className={`admin-action-dialog ${toneClass}`}>
                <div className="detail-pairs compact-pairs admin-action-result-grid">
                    {Object.entries(props.actionResult.details).map(([key, value]) => (
                        <div key={key} className="detail-row">
                            <span>{key}</span>
                            <code>{value}</code>
                            {renderActionValueLink(value)}
                        </div>
                    ))}
                </div>
                <div className="admin-action-dialog-actions">
                    <button type="button" className="secondary-button" onClick={props.onClose}>Закрыть</button>
                </div>
            </Panel>
        </div>
    )
}

function AdminDashboardCredentialsModal(props: { actionResult: DashboardActionResult; onClose: () => void }): React.JSX.Element {
    const [copyStatus, setCopyStatus] = React.useState<string | null>(null)

    async function handleCopy(item: DashboardCopyItem): Promise<void> {
        const copied = await copyToClipboard(item.value)
        setCopyStatus(copied ? item.value : `error:${item.label}`)
    }

    return (
        <div className="admin-action-modal" role="dialog" aria-modal="true" aria-label={props.actionResult.title}>
            <div className="admin-action-modal-backdrop" onClick={props.onClose} />
            <Panel title={props.actionResult.title} className="admin-action-dialog admin-credential-dialog panel-success">
                <div className="detail-pairs compact-pairs admin-action-result-grid">
                    {Object.entries(props.actionResult.details).map(([key, value]) => (
                        <div key={key} className="detail-row">
                            <span>{key}</span>
                            <code>{value}</code>
                            {renderActionValueLink(value)}
                        </div>
                    ))}
                </div>
                <div className="admin-credential-list">
                    {props.actionResult.copyItems?.map((item) => {
                        const isCopied = copyStatus === item.value
                        const isCopyFailed = copyStatus === `error:${item.label}`

                        return (
                            <div key={`${item.label}:${item.value}`} className="admin-credential-card">
                                <div className="admin-credential-copy">
                                    <span>{item.label}</span>
                                    <code>{item.value}</code>
                                </div>
                                <div className="admin-credential-actions">
                                    <button type="button" className="secondary-button" onClick={() => void handleCopy(item)}>
                                        {isCopyFailed ? 'Не удалось скопировать' : isCopied ? 'Скопировано' : 'Скопировать'}
                                    </button>
                                    {renderActionValueLink(item.value, true)}
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="admin-action-dialog-actions">
                    <button type="button" className="secondary-button" onClick={props.onClose}>Закрыть</button>
                </div>
            </Panel>
        </div>
    )
}

function renderActionValueLink(value: string, asButton = false): React.JSX.Element | null {
    const className = asButton ? 'secondary-button' : 'ghost-link'

    if (/^https?:\/\//i.test(value)) {
        return <a href={value} target="_blank" rel="noreferrer" className={className}>Открыть ссылку</a>
    }

    if (value.startsWith('/')) {
        return <a href={value} className={className}>Открыть путь</a>
    }

    return null
}

async function copyToClipboard(value: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value)
            return true
        } catch {
            return false
        }
    }

    if (typeof document === 'undefined') {
        return false
    }

    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    try {
        return document.execCommand('copy')
    } finally {
        document.body.removeChild(textarea)
    }
}
