import React from 'react'
import { Panel } from '../../shared/ui'
import type { DashboardActionResult } from './admin-hooks'

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
                    <button type="button" className="secondary-button" onClick={() => void props.onLogout()} disabled={props.isLoggingOut}>
                        {props.isLoggingOut ? 'Выходим...' : 'Выйти'}
                    </button>
                </div>
            </div>
        </section>
    )
}

export function AdminDashboardActionResult(props: { actionResult: DashboardActionResult }): React.JSX.Element {
    const toneClass = props.actionResult.tone === 'error'
        ? 'panel-error'
        : props.actionResult.tone === 'info'
            ? 'panel-info'
            : 'panel-success'

    return (
        <Panel title={props.actionResult.title} className={toneClass}>
            <div className="detail-pairs">
                {Object.entries(props.actionResult.details).map(([key, value]) => (
                    <div key={key} className="detail-row">
                        <span>{key}</span>
                        <code>{value}</code>
                    </div>
                ))}
            </div>
        </Panel>
    )
}