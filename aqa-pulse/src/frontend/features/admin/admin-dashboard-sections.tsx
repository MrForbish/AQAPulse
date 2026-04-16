import React from 'react'
import type { WorkspaceDescriptor } from '../../../backend/contracts'
import { EmptyState, LoadingView, Panel } from '../../shared/ui'
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
                <p>Единый React shell для provisioning, workspace access и ingestion flow без отдельного HTML renderer для admin-страниц.</p>
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

export function AdminProvisioningIntro(props: {
    isCreatingWorkspace: boolean
    onCreateWorkspace: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
}): React.JSX.Element {
    return (
        <section className="admin-grid">
            <Panel title="Создать workspace" description="Workspace создаётся вместе с первичным ingestion key.">
                <form className="stack admin-form" onSubmit={props.onCreateWorkspace}>
                    <label><span>Name</span><input type="text" name="name" required /></label>
                    <label><span>Slug</span><input type="text" name="slug" placeholder="demo-client" /></label>
                    <label><span>Initial API key label</span><input type="text" name="apiKeyLabel" placeholder="Primary ingestion key" /></label>
                    <button type="submit" className="primary-link auth-submit" disabled={props.isCreatingWorkspace}>
                        {props.isCreatingWorkspace ? 'Создаём...' : 'Создать workspace'}
                    </button>
                </form>
            </Panel>
            <Panel title="Как это работает" description="Те же backend контракты, что и раньше, но в одном React shell.">
                <div className="detail-pairs compact-pairs">
                    <div className="detail-row"><span>Admin login</span><code>session cookie</code></div>
                    <div className="detail-row"><span>Workspace API key</span><code>ingestion only</code></div>
                    <div className="detail-row"><span>Workspace user token</span><code>dashboard/API read</code></div>
                    <div className="detail-row"><span>Provisioning tokens</span><code>сохраняются сразу после создания</code></div>
                </div>
            </Panel>
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

export function AdminWorkspaceRegistry(props: {
    workspaces: WorkspaceDescriptor[]
    isLoading: boolean
    busyKey: string | null
    onCreateApiKey: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onCreateUser: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
}): React.JSX.Element {
    if (props.isLoading) {
        return <LoadingView label="Загружаем workspace registry..." />
    }

    if (props.workspaces.length === 0) {
        return (
            <Panel>
                <EmptyState title="Workspace пока нет" message="Создай первый workspace, чтобы получить dashboard login и ingestion flow." />
            </Panel>
        )
    }

    return (
        <section className="workspace-admin-list">
            {props.workspaces.map((workspace) => (
                <WorkspaceCard
                    key={workspace.slug}
                    workspace={workspace}
                    busyKey={props.busyKey}
                    onCreateApiKey={props.onCreateApiKey}
                    onCreateUser={props.onCreateUser}
                />
            ))}
        </section>
    )
}

function WorkspaceCard(props: {
    workspace: WorkspaceDescriptor
    busyKey: string | null
    onCreateApiKey: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onCreateUser: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
}): React.JSX.Element {
    const { workspace } = props

    return (
        <Panel className="workspace-admin-card">
            <div className="workspace-admin-header">
                <div>
                    <h2>{workspace.name}</h2>
                    <p className="subtle-copy">slug: <code>{workspace.slug}</code></p>
                </div>
                <div className="workspace-link-group">
                    <a href={`/w/${encodeURIComponent(workspace.slug)}`} target="_blank" rel="noreferrer" className="ghost-link">Открыть dashboard</a>
                    <a href={`/w/${encodeURIComponent(workspace.slug)}/login`} target="_blank" rel="noreferrer" className="ghost-link">Workspace login</a>
                    <a href={`/auth/workspaces/${encodeURIComponent(workspace.slug)}/api-keys/login`} target="_blank" rel="noreferrer" className="ghost-link">API key exchange</a>
                </div>
            </div>

            <div className="admin-grid workspace-admin-grid">
                <Panel title="API keys">
                    <ul className="admin-compact-list">
                        {workspace.apiKeys.length > 0 ? workspace.apiKeys.map((apiKey) => (
                            <li key={apiKey.id}>
                                <strong>{apiKey.label}</strong>
                                <span>{apiKey.tokenPreview}</span>
                            </li>
                        )) : <li className="is-empty">API keys пока нет.</li>}
                    </ul>
                    <form className="stack admin-form" onSubmit={(event) => void props.onCreateApiKey(event, workspace.slug)}>
                        <label><span>Label</span><input type="text" name="label" placeholder="Upload key" /></label>
                        <button type="submit" className="secondary-button" disabled={props.busyKey === `api-key:${workspace.slug}`}>
                            {props.busyKey === `api-key:${workspace.slug}` ? 'Создаём...' : 'Создать API key'}
                        </button>
                    </form>
                </Panel>
                <Panel title="Workspace users">
                    <ul className="admin-compact-list">
                        {workspace.users.length > 0 ? workspace.users.map((user) => (
                            <li key={user.id}>
                                <strong>{user.label}</strong>
                                <span>{user.role}</span>
                                <span>{user.tokenPreview}</span>
                            </li>
                        )) : <li className="is-empty">Users пока нет.</li>}
                    </ul>
                    <form className="stack admin-form" onSubmit={(event) => void props.onCreateUser(event, workspace.slug)}>
                        <label><span>Label</span><input type="text" name="label" placeholder="Dashboard viewer" required /></label>
                        <label>
                            <span>Role</span>
                            <select name="role" defaultValue="viewer">
                                <option value="viewer">viewer</option>
                                <option value="owner">owner</option>
                            </select>
                        </label>
                        <button type="submit" className="secondary-button" disabled={props.busyKey === `user:${workspace.slug}`}>
                            {props.busyKey === `user:${workspace.slug}` ? 'Создаём...' : 'Создать user token'}
                        </button>
                    </form>
                </Panel>
            </div>
        </Panel>
    )
}