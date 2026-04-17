import React from 'react'
import type { WorkspaceDescriptor } from '../../../backend/contracts'
import { useRuntimeBaseUrl } from '../../runtime-hooks'
import { EmptyState, LoadingView, Panel } from '../../shared/ui'

export function AdminWorkspaceRegistry(props: {
    workspaces: WorkspaceDescriptor[]
    isLoading: boolean
    busyKey: string | null
    onCreateApiKey: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onCreateUser: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onDisableApiKey: (slug: string, apiKeyId: string) => Promise<void>
    onDisableUser: (slug: string, userId: string) => Promise<void>
    onRevokeSession: (slug: string, sessionId: string) => Promise<void>
}): React.JSX.Element {
    const runtimeBaseUrl = useRuntimeBaseUrl()

    if (props.isLoading) {
        return <LoadingView label="Загружаем панель доступа..." />
    }

    if (props.workspaces.length === 0) {
        return (
            <Panel>
                <EmptyState title="Workspace пока нет" message="Создай первый workspace, чтобы начать выдавать доступ к dashboard и загрузке отчётов." />
            </Panel>
        )
    }

    return (
        <section className="workspace-admin-list">
            {props.workspaces.map((workspace) => (
                <WorkspaceCard key={workspace.slug} workspace={workspace} runtimeBaseUrl={runtimeBaseUrl} {...props} />
            ))}
        </section>
    )
}

function WorkspaceCard(props: {
    workspace: WorkspaceDescriptor
    busyKey: string | null
    runtimeBaseUrl: string | null
    onCreateApiKey: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onCreateUser: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onDisableApiKey: (slug: string, apiKeyId: string) => Promise<void>
    onDisableUser: (slug: string, userId: string) => Promise<void>
    onRevokeSession: (slug: string, sessionId: string) => Promise<void>
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
                    <a href={buildServiceUrl(props.runtimeBaseUrl, `/w/${encodeURIComponent(workspace.slug)}`)} target="_blank" rel="noreferrer" className="ghost-link">Открыть dashboard</a>
                    <a href={buildServiceUrl(props.runtimeBaseUrl, `/w/${encodeURIComponent(workspace.slug)}/login`)} target="_blank" rel="noreferrer" className="ghost-link">Вход по токену</a>
                    <a href={buildServiceUrl(props.runtimeBaseUrl, `/auth/workspaces/${encodeURIComponent(workspace.slug)}/api-keys/login`)} target="_blank" rel="noreferrer" className="ghost-link">Обмен ключа загрузки</a>
                </div>
            </div>

            <div className="admin-grid workspace-admin-grid workspace-admin-grid-3">
                <Panel title="Ключи загрузки">
                    <ul className="admin-compact-list access-admin-list">
                        {workspace.apiKeys.length > 0 ? workspace.apiKeys.map((apiKey) => {
                            const isDisabled = Boolean(apiKey.disabledAt)
                            const disableKey = `api-key:disable:${workspace.slug}:${apiKey.id}`

                            return (
                                <li key={apiKey.id} className="access-list-item">
                                    <div className="access-item-head">
                                        <strong>{apiKey.label}</strong>
                                        <span className={`access-state-pill${isDisabled ? ' is-disabled' : ' is-active'}`}>{isDisabled ? 'Отключён' : 'Активен'}</span>
                                    </div>
                                    <span className="access-item-token">{apiKey.tokenPreview}</span>
                                    <div className="access-item-meta">
                                        <span>Создан: {formatDateTime(apiKey.createdAt)}</span>
                                        <span>Последнее использование: {formatDateTime(apiKey.lastUsedAt)}</span>
                                        {apiKey.disabledAt ? <span>Отключён: {formatDateTime(apiKey.disabledAt)}</span> : null}
                                    </div>
                                    <div className="access-item-actions">
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            disabled={isDisabled || props.busyKey === disableKey}
                                            onClick={() => void props.onDisableApiKey(workspace.slug, apiKey.id)}
                                        >
                                            {props.busyKey === disableKey ? 'Отключаем...' : 'Отключить'}
                                        </button>
                                    </div>
                                </li>
                            )
                        }) : <li className="is-empty">Ключей загрузки пока нет.</li>}
                    </ul>
                    <form className="stack admin-form" onSubmit={(event) => void props.onCreateApiKey(event, workspace.slug)}>
                        <label><span>Название</span><input type="text" name="label" placeholder="Новый ключ загрузки" /></label>
                        <button type="submit" className="secondary-button" disabled={props.busyKey === `api-key:${workspace.slug}`}>
                            {props.busyKey === `api-key:${workspace.slug}` ? 'Создаём...' : 'Создать ключ'}
                        </button>
                    </form>
                </Panel>

                <Panel title="Пользователи workspace">
                    <ul className="admin-compact-list access-admin-list">
                        {workspace.users.length > 0 ? workspace.users.map((user) => {
                            const isDisabled = Boolean(user.disabledAt)
                            const disableKey = `user:disable:${workspace.slug}:${user.id}`

                            return (
                                <li key={user.id} className="access-list-item">
                                    <div className="access-item-head">
                                        <strong>{user.label}</strong>
                                        <span className={`access-state-pill${isDisabled ? ' is-disabled' : ' is-active'}`}>{isDisabled ? 'Отключён' : 'Активен'}</span>
                                    </div>
                                    <div className="access-item-meta access-item-meta-compact">
                                        <span>Роль: {user.role === 'owner' ? 'владелец' : 'наблюдатель'}</span>
                                        <span>Токен: {user.tokenPreview}</span>
                                        <span>Последний вход: {formatDateTime(user.lastUsedAt)}</span>
                                        {user.disabledAt ? <span>Отключён: {formatDateTime(user.disabledAt)}</span> : null}
                                    </div>
                                    <div className="access-item-actions">
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            disabled={isDisabled || props.busyKey === disableKey}
                                            onClick={() => void props.onDisableUser(workspace.slug, user.id)}
                                        >
                                            {props.busyKey === disableKey ? 'Отключаем...' : 'Отключить'}
                                        </button>
                                    </div>
                                </li>
                            )
                        }) : <li className="is-empty">Пользователей пока нет.</li>}
                    </ul>
                    <form className="stack admin-form" onSubmit={(event) => void props.onCreateUser(event, workspace.slug)}>
                        <label><span>Имя или описание</span><input type="text" name="label" placeholder="Наблюдатель команды" required /></label>
                        <label>
                            <span>Права</span>
                            <select name="role" defaultValue="viewer">
                                <option value="viewer">Наблюдатель</option>
                                <option value="owner">Владелец</option>
                            </select>
                        </label>
                        <button type="submit" className="secondary-button" disabled={props.busyKey === `user:${workspace.slug}`}>
                            {props.busyKey === `user:${workspace.slug}` ? 'Создаём...' : 'Создать пользователя'}
                        </button>
                    </form>
                </Panel>

                <Panel title="Сессии доступа">
                    <ul className="admin-compact-list access-admin-list">
                        {workspace.sessions.length > 0 ? workspace.sessions.map((session) => {
                            const isRevoked = Boolean(session.revokedAt)
                            const revokeKey = `session:revoke:${workspace.slug}:${session.id}`

                            return (
                                <li key={session.id} className="access-list-item">
                                    <div className="access-item-head">
                                        <strong>{session.label}</strong>
                                        <span className={`access-state-pill${isRevoked ? ' is-disabled' : ' is-active'}`}>{isRevoked ? 'Отозвана' : 'Активна'}</span>
                                    </div>
                                    <div className="access-item-meta access-item-meta-compact">
                                        <span>Тип: {session.kind === 'workspace-api-key' ? 'загрузка отчётов' : 'пользователь dashboard'}</span>
                                        <span>Доступ: {session.scope === 'workspace:ingest' ? 'загрузка' : session.role === 'owner' ? 'владелец' : 'чтение'}</span>
                                        <span>Начало: {formatDateTime(session.createdAt)}</span>
                                        <span>Последняя активность: {formatDateTime(session.lastSeenAt)}</span>
                                        <span>Истекает: {formatDateTime(session.expiresAt)}</span>
                                        {session.revokedAt ? <span>Отозвана: {formatDateTime(session.revokedAt)}</span> : null}
                                    </div>
                                    <div className="access-item-actions">
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            disabled={isRevoked || props.busyKey === revokeKey}
                                            onClick={() => void props.onRevokeSession(workspace.slug, session.id)}
                                        >
                                            {props.busyKey === revokeKey ? 'Отзываем...' : 'Отозвать'}
                                        </button>
                                    </div>
                                </li>
                            )
                        }) : <li className="is-empty">Активных сессий ещё не было.</li>}
                    </ul>
                </Panel>
            </div>
        </Panel>
    )
}

function formatDateTime(value: string | null): string {
    if (!value) {
        return 'ещё не было'
    }

    const parsed = Date.parse(value)

    if (!Number.isFinite(parsed)) {
        return value
    }

    return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(parsed)
}

function buildServiceUrl(baseUrl: string | null, pathname: string): string {
    if (!baseUrl) {
        return pathname
    }

    return `${baseUrl.replace(/\/+$/g, '')}${pathname}`
}