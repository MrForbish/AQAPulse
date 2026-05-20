import React from 'react'
import type { WorkspaceDescriptor } from '../../../backend/contracts'
import { useRuntimeBaseUrl } from '../../runtime-hooks'
import { EmptyState, LoadingView, Panel } from '../../shared/ui'

export function AdminWorkspaceRegistry(props: {
    workspaces: WorkspaceDescriptor[]
    isLoading: boolean
    busyKey: string | null
    onUpdateWorkspace: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onDeleteWorkspace: (slug: string) => Promise<void>
    onResetWorkspaceData: (slug: string) => Promise<void>
    onCreateApiKey: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onCreateShareLink: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onCreateUser: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onUpdateUserRole: (event: React.FormEvent<HTMLFormElement>, slug: string, userId: string) => Promise<void>
    onDisableApiKey: (slug: string, apiKeyId: string) => Promise<void>
    onDeleteApiKey: (slug: string, apiKeyId: string) => Promise<void>
    onDisableUser: (slug: string, userId: string) => Promise<void>
    onDeleteUser: (slug: string, userId: string) => Promise<void>
    onRevokeSession: (slug: string, sessionId: string) => Promise<void>
}): React.JSX.Element {
    const runtimeBaseUrl = useRuntimeBaseUrl()
    const [selectedSlug, setSelectedSlug] = React.useState<string | null>(props.workspaces[0]?.slug ?? null)
    const [searchQuery, setSearchQuery] = React.useState('')

    React.useEffect(() => {
        if (props.workspaces.length === 0) {
            setSelectedSlug(null)
            return
        }

        if (!selectedSlug || !props.workspaces.some((workspace) => workspace.slug === selectedSlug)) {
            setSelectedSlug(props.workspaces[0].slug)
        }
    }, [props.workspaces, selectedSlug])

    if (props.isLoading) {
        return <LoadingView label="Загружаем список workspace..." />
    }

    if (props.workspaces.length === 0) {
        return (
            <Panel>
                <EmptyState title="Workspace пока нет" message="Создай первый workspace, чтобы принимать отчеты автотестов и выдавать доступ к дашборду." />
            </Panel>
        )
    }

    const normalizedQuery = searchQuery.trim().toLowerCase()
    const filteredWorkspaces = normalizedQuery
        ? props.workspaces.filter((workspace) => `${workspace.name} ${workspace.slug}`.toLowerCase().includes(normalizedQuery))
        : props.workspaces
    const selectedWorkspace = props.workspaces.find((workspace) => workspace.slug === selectedSlug) ?? filteredWorkspaces[0] ?? props.workspaces[0]

    return (
        <section className="workspace-admin-layout">
            <Panel className="workspace-admin-sidebar">
                <div className="workspace-admin-sidebar-header">
                    <div>
                        <h2>Workspace</h2>
                        <p className="subtle-copy">Всего: {props.workspaces.length}</p>
                    </div>
                </div>
                <label className="workspace-search-field">
                    <span>Поиск</span>
                    <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.currentTarget.value)} placeholder="Название или slug" />
                </label>
                <div className="workspace-admin-nav" role="listbox" aria-label="Workspace">
                    {filteredWorkspaces.length > 0 ? filteredWorkspaces.map((workspace) => {
                        const isSelected = workspace.slug === selectedWorkspace.slug
                        const activeKeys = workspace.apiKeys.filter((apiKey) => !apiKey.disabledAt).length

                        return (
                            <button key={workspace.slug} type="button" className={`workspace-nav-item${isSelected ? ' is-selected' : ''}`} onClick={() => setSelectedSlug(workspace.slug)}>
                                <span className="workspace-nav-title">{workspace.name}</span>
                                <span className="workspace-nav-slug">{workspace.slug}</span>
                                <span className="workspace-nav-meta">Активных ключей: {activeKeys}; пользователей: {workspace.users.length}</span>
                            </button>
                        )
                    }) : (
                        <div className="workspace-nav-empty">Ничего не найдено</div>
                    )}
                </div>
            </Panel>
            <div className="workspace-admin-detail">
                <WorkspaceCard key={selectedWorkspace.slug} workspace={selectedWorkspace} runtimeBaseUrl={runtimeBaseUrl} {...props} />
            </div>
        </section>
    )
}

function WorkspaceCard(props: {
    workspace: WorkspaceDescriptor
    busyKey: string | null
    runtimeBaseUrl: string | null
    onUpdateWorkspace: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onDeleteWorkspace: (slug: string) => Promise<void>
    onResetWorkspaceData: (slug: string) => Promise<void>
    onCreateApiKey: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onCreateShareLink: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onCreateUser: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    onUpdateUserRole: (event: React.FormEvent<HTMLFormElement>, slug: string, userId: string) => Promise<void>
    onDisableApiKey: (slug: string, apiKeyId: string) => Promise<void>
    onDeleteApiKey: (slug: string, apiKeyId: string) => Promise<void>
    onDisableUser: (slug: string, userId: string) => Promise<void>
    onDeleteUser: (slug: string, userId: string) => Promise<void>
    onRevokeSession: (slug: string, sessionId: string) => Promise<void>
}): React.JSX.Element {
    const { workspace } = props
    const [isGitLabSettingsOpen, setIsGitLabSettingsOpen] = React.useState(false)
    const updateKey = `workspace:update:${workspace.slug}`
    const deleteKey = `workspace:delete:${workspace.slug}`
    const resetDataKey = `workspace:reset-data:${workspace.slug}`

    return (
        <>
            <Panel className="workspace-admin-card">
                <div className="workspace-admin-header">
                    <div>
                        <h2>{workspace.name}</h2>
                        <p className="subtle-copy">slug: <code>{workspace.slug}</code></p>
                    </div>
                    <div className="workspace-link-group">
                        <a href={buildServiceUrl(props.runtimeBaseUrl, `/w/${encodeURIComponent(workspace.slug)}`)} target="_blank" rel="noreferrer" className="ghost-link">Открыть дашборд</a>
                        <a href={buildServiceUrl(props.runtimeBaseUrl, `/w/${encodeURIComponent(workspace.slug)}/login`)} target="_blank" rel="noreferrer" className="ghost-link">Вход по токену</a>
                        <a href={buildServiceUrl(props.runtimeBaseUrl, `/auth/workspaces/${encodeURIComponent(workspace.slug)}/api-keys/login`)} target="_blank" rel="noreferrer" className="ghost-link">Проверить ключ загрузки</a>
                    </div>
                </div>

                <Panel title="Настройки workspace">
                    <form className="stack admin-form" onSubmit={(event) => void props.onUpdateWorkspace(event, workspace.slug)}>
                        <label><span>Название</span><input type="text" name="name" defaultValue={workspace.name} required /></label>
                        <label><span>Slug</span><input type="text" name="slug" defaultValue={workspace.slug} required /></label>
                        <div className="workspace-settings-actions">
                            <button type="submit" className="secondary-button" disabled={props.busyKey === updateKey}>
                                {props.busyKey === updateKey ? 'Сохраняем...' : 'Сохранить'}
                            </button>
                            <button type="button" className="secondary-button danger-button" disabled={props.busyKey === deleteKey} onClick={() => void props.onDeleteWorkspace(workspace.slug)}>
                                {props.busyKey === deleteKey ? 'Удаляем...' : 'Удалить workspace'}
                            </button>
                            <button type="button" className="secondary-button danger-button" disabled={props.busyKey === resetDataKey} onClick={() => void props.onResetWorkspaceData(workspace.slug)}>
                                {props.busyKey === resetDataKey ? 'Очищаем...' : 'Очистить прогоны'}
                            </button>
                            <button type="button" className="secondary-button" onClick={() => setIsGitLabSettingsOpen(true)}>Настройки GitLab CI</button>
                        </div>
                    </form>
                    <form className="stack admin-form" onSubmit={(event) => void props.onCreateShareLink(event, workspace.slug)}>
                        <label>
                            <span>Временная ссылка на дашборд</span>
                            <select name="ttlMinutes" defaultValue="10">
                                <option value="5">5 минут</option>
                                <option value="10">10 минут</option>
                            </select>
                        </label>
                        <button type="submit" className="secondary-button" disabled={props.busyKey === `share-link:${workspace.slug}`}>
                            {props.busyKey === `share-link:${workspace.slug}` ? 'Создаем...' : 'Создать временную ссылку'}
                        </button>
                    </form>
                </Panel>

                <div className="admin-grid workspace-admin-grid workspace-admin-grid-3">
                    <Panel title="Ключи загрузки отчетов">
                        <ul className="admin-compact-list access-admin-list">
                            {workspace.apiKeys.length > 0 ? workspace.apiKeys.map((apiKey) => {
                                const isDisabled = Boolean(apiKey.disabledAt)
                                const disableKey = `api-key:disable:${workspace.slug}:${apiKey.id}`
                                const deleteApiKey = `api-key:delete:${workspace.slug}:${apiKey.id}`

                                return (
                                    <li key={apiKey.id} className="access-list-item">
                                        <div className="access-item-head">
                                            <strong>{apiKey.label}</strong>
                                            <span className={`access-state-pill${isDisabled ? ' is-disabled' : ' is-active'}`}>{isDisabled ? 'Отключен' : 'Активен'}</span>
                                        </div>
                                        <span className="access-item-token">{apiKey.tokenPreview}</span>
                                        <div className="access-item-meta">
                                            <span>Создан: {formatDateTime(apiKey.createdAt)}</span>
                                            <span>Последнее использование: {formatDateTime(apiKey.lastUsedAt)}</span>
                                            {apiKey.disabledAt ? <span>Отключен: {formatDateTime(apiKey.disabledAt)}</span> : null}
                                        </div>
                                        <div className="access-item-actions">
                                            <button type="button" className="secondary-button" disabled={isDisabled || props.busyKey === disableKey} onClick={() => void props.onDisableApiKey(workspace.slug, apiKey.id)}>
                                                {props.busyKey === disableKey ? 'Отключаем...' : 'Отключить'}
                                            </button>
                                            <button type="button" className="secondary-button danger-button" disabled={props.busyKey === deleteApiKey} onClick={() => void props.onDeleteApiKey(workspace.slug, apiKey.id)}>
                                                {props.busyKey === deleteApiKey ? 'Удаляем...' : 'Удалить'}
                                            </button>
                                        </div>
                                    </li>
                                )
                            }) : <li className="is-empty">Ключей загрузки пока нет.</li>}
                        </ul>
                        <form className="stack admin-form" onSubmit={(event) => void props.onCreateApiKey(event, workspace.slug)}>
                            <label><span>Название ключа</span><input type="text" name="label" placeholder="GitLab CI загрузка отчетов" /></label>
                            <button type="submit" className="secondary-button" disabled={props.busyKey === `api-key:${workspace.slug}`}>
                                {props.busyKey === `api-key:${workspace.slug}` ? 'Создаем...' : 'Создать ключ'}
                            </button>
                        </form>
                    </Panel>

                    <Panel title="Пользователи дашборда">
                        <ul className="admin-compact-list access-admin-list">
                            {workspace.users.length > 0 ? workspace.users.map((user) => {
                                const isDisabled = Boolean(user.disabledAt)
                                const disableKey = `user:disable:${workspace.slug}:${user.id}`
                                const deleteUser = `user:delete:${workspace.slug}:${user.id}`

                                return (
                                    <li key={user.id} className="access-list-item">
                                        <div className="access-item-head">
                                            <strong>{user.label}</strong>
                                            <span className={`access-state-pill${isDisabled ? ' is-disabled' : ' is-active'}`}>{isDisabled ? 'Отключен' : 'Активен'}</span>
                                        </div>
                                        <div className="access-item-meta access-item-meta-compact">
                                            <span>Роль: {user.role === 'owner' ? 'владелец' : 'наблюдатель'}</span>
                                            <span>Токен: {user.tokenPreview}</span>
                                            <span>Последний вход: {formatDateTime(user.lastUsedAt)}</span>
                                            {user.disabledAt ? <span>Отключен: {formatDateTime(user.disabledAt)}</span> : null}
                                        </div>
                                        <div className="access-item-actions">
                                            <form className="access-inline-form" onSubmit={(event) => void props.onUpdateUserRole(event, workspace.slug, user.id)}>
                                                <select className="admin-inline-select" name="role" defaultValue={user.role} disabled={isDisabled || props.busyKey === `user:role:${workspace.slug}:${user.id}`}>
                                                    <option value="viewer">Наблюдатель</option>
                                                    <option value="owner">Владелец</option>
                                                </select>
                                                <button type="submit" className="secondary-button" disabled={isDisabled || props.busyKey === `user:role:${workspace.slug}:${user.id}`}>
                                                    {props.busyKey === `user:role:${workspace.slug}:${user.id}` ? 'Обновляем...' : 'Сменить роль'}
                                                </button>
                                            </form>
                                            <button type="button" className="secondary-button" disabled={isDisabled || props.busyKey === disableKey} onClick={() => void props.onDisableUser(workspace.slug, user.id)}>
                                                {props.busyKey === disableKey ? 'Отключаем...' : 'Отключить'}
                                            </button>
                                            <button type="button" className="secondary-button danger-button" disabled={props.busyKey === deleteUser} onClick={() => void props.onDeleteUser(workspace.slug, user.id)}>
                                                {props.busyKey === deleteUser ? 'Удаляем...' : 'Удалить'}
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
                                <select className="admin-inline-select" name="role" defaultValue="viewer">
                                    <option value="viewer">Наблюдатель</option>
                                    <option value="owner">Владелец</option>
                                </select>
                            </label>
                            <button type="submit" className="secondary-button" disabled={props.busyKey === `user:${workspace.slug}`}>
                                {props.busyKey === `user:${workspace.slug}` ? 'Создаем...' : 'Создать пользователя'}
                            </button>
                        </form>
                    </Panel>

                    <Panel title="Сессии доступа">
                        <ul className="admin-compact-list access-admin-list">
                            {workspace.sessions.length > 0 ? workspace.sessions.map((session) => {
                                const isRevoked = Boolean(session.revokedAt)
                                const revokeKey = `session:revoke:${workspace.slug}:${session.id}`
                                const isPendingShareLink = session.kind === 'workspace-share-link' && !session.activatedAt

                                return (
                                    <li key={session.id} className="access-list-item">
                                        <div className="access-item-head">
                                            <strong>{session.label}</strong>
                                            <span className={`access-state-pill${isRevoked ? ' is-disabled' : ' is-active'}`}>{isRevoked ? 'Отозвана' : isPendingShareLink ? 'Ожидает открытия' : 'Активна'}</span>
                                        </div>
                                        <div className="access-item-meta access-item-meta-compact">
                                            <span>Тип: {formatSessionKind(session.kind)}</span>
                                            <span>Доступ: {session.scope === 'workspace:ingest' ? 'загрузка отчетов' : session.role === 'owner' ? 'владелец' : 'чтение'}</span>
                                            <span>Начало: {formatDateTime(session.createdAt)}</span>
                                            <span>Последняя активность: {isPendingShareLink ? 'еще не было' : formatDateTime(session.lastSeenAt)}</span>
                                            <span>Истекает: {formatSessionExpiry(session)}</span>
                                            {session.revokedAt ? <span>Отозвана: {formatDateTime(session.revokedAt)}</span> : null}
                                        </div>
                                        <div className="access-item-actions">
                                            <button type="button" className="secondary-button" disabled={isRevoked || props.busyKey === revokeKey} onClick={() => void props.onRevokeSession(workspace.slug, session.id)}>
                                                {props.busyKey === revokeKey ? 'Отзываем...' : 'Отозвать'}
                                            </button>
                                        </div>
                                    </li>
                                )
                            }) : <li className="is-empty">Активных сессий пока нет.</li>}
                        </ul>
                    </Panel>
                </div>
            </Panel>
            {isGitLabSettingsOpen ? (
                <GitLabCiSettingsModal workspace={workspace} runtimeBaseUrl={props.runtimeBaseUrl} onClose={() => setIsGitLabSettingsOpen(false)} />
            ) : null}
        </>
    )
}

function GitLabCiSettingsModal(props: {
    workspace: WorkspaceDescriptor
    runtimeBaseUrl: string | null
    onClose: () => void
}): React.JSX.Element {
    const [copiedValue, setCopiedValue] = React.useState<string | null>(null)
    const baseUrl = props.runtimeBaseUrl ?? getCurrentBaseUrl()
    const variables = buildGitLabVariables(props.workspace, baseUrl)
    const jobSnippet = buildGitLabJobSnippet(props.workspace, baseUrl)

    async function copyValue(value: string): Promise<void> {
        const copied = await copyToClipboard(value)
        setCopiedValue(copied ? value : null)
    }

    return (
        <div className="admin-action-modal" role="dialog" aria-modal="true" aria-label="Настройки GitLab CI">
            <div className="admin-action-modal-backdrop" onClick={props.onClose} />
            <Panel title="Настройки GitLab CI" className="admin-action-dialog gitlab-ci-dialog">
                <div className="gitlab-ci-summary">
                    <div>
                        <h3>{props.workspace.name}</h3>
                        <p className="subtle-copy">Эти значения нужно добавить в GitLab CI/CD Variables для workspace <code>{props.workspace.slug}</code>.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => void copyValue(variables)}>
                        {copiedValue === variables ? 'Скопировано' : 'Скопировать переменные'}
                    </button>
                </div>

                <div className="gitlab-ci-variable-list">
                    <GitLabVariableRow
                        name="AQA_PULSE_BASE_URL"
                        value={baseUrl}
                        tooltip="Публичный адрес AQA Pulse. GitLab job отправляет по нему отчет после прогона тестов."
                        onCopy={copyValue}
                        isCopied={copiedValue === baseUrl}
                    />
                    <GitLabVariableRow
                        name="AQA_PULSE_WORKSPACE_SLUG"
                        value={props.workspace.slug}
                        tooltip="Идентификатор workspace. По нему сервер понимает, в какой дашборд положить загруженный отчет."
                        onCopy={copyValue}
                        isCopied={copiedValue === props.workspace.slug}
                    />
                    <GitLabVariableRow
                        name="AQA_PULSE_WORKSPACE_API_KEY"
                        value={props.workspace.apiKeys.length > 0 ? 'Полные значения старых ключей не показываются' : 'Сначала создай ключ загрузки'}
                        tooltip="Секретный ключ для загрузки отчетов. Полное значение показывается только один раз при создании, потом хранится только hash и короткий preview."
                        onCopy={copyValue}
                        isCopied={false}
                        copyDisabled
                    />
                </div>

                <div className="gitlab-ci-section-title">
                    <h3>Ключи загрузки</h3>
                    <InfoTooltip text="Старые полные ключи нельзя посмотреть повторно. Если нужен новый ключ для GitLab, создай его в блоке «Ключи загрузки отчетов»." />
                </div>
                <ul className="admin-compact-list access-admin-list gitlab-key-list">
                    {props.workspace.apiKeys.length > 0 ? props.workspace.apiKeys.map((apiKey) => (
                        <li key={apiKey.id} className="access-list-item">
                            <div className="access-item-head">
                                <strong>{apiKey.label}</strong>
                                <span className={`access-state-pill${apiKey.disabledAt ? ' is-disabled' : ' is-active'}`}>{apiKey.disabledAt ? 'Отключен' : 'Активен'}</span>
                            </div>
                            <div className="gitlab-key-value">
                                <span>
                                    AQA_PULSE_WORKSPACE_API_KEY
                                    <InfoTooltip text="Это только короткий preview, а не полный секрет. В GitLab нужно вставлять полное значение, которое показали при создании ключа." />
                                </span>
                                <code>{apiKey.tokenPreview}</code>
                            </div>
                            <div className="access-item-meta">
                                <span>Создан: {formatDateTime(apiKey.createdAt)}</span>
                                <span>Последнее использование: {formatDateTime(apiKey.lastUsedAt)}</span>
                            </div>
                        </li>
                    )) : <li className="is-empty">Ключей загрузки пока нет.</li>}
                </ul>

                <div className="gitlab-ci-section-title">
                    <h3>Пример .gitlab-ci.yml</h3>
                    <InfoTooltip text="Проверь путь к отчету и команду запуска тестов под свой проект. Главное — передать base URL, slug workspace и API key в uploader." />
                </div>
                <div className="gitlab-ci-code-block">
                    <code>{jobSnippet}</code>
                    <button type="button" className="secondary-button" onClick={() => void copyValue(jobSnippet)}>
                        {copiedValue === jobSnippet ? 'Скопировано' : 'Скопировать job'}
                    </button>
                </div>

                <div className="admin-action-dialog-actions">
                    <button type="button" className="secondary-button" onClick={props.onClose}>Закрыть</button>
                </div>
            </Panel>
        </div>
    )
}

function GitLabVariableRow(props: {
    name: string
    value: string
    tooltip: string
    onCopy: (value: string) => Promise<void>
    isCopied: boolean
    copyDisabled?: boolean
}): React.JSX.Element {
    return (
        <div className="gitlab-variable-row">
            <div className="gitlab-variable-label">
                <strong>
                    {props.name}
                    <InfoTooltip text={props.tooltip} />
                </strong>
            </div>
            <code>{props.value}</code>
            <button type="button" className="secondary-button" disabled={props.copyDisabled} onClick={() => void props.onCopy(props.value)}>
                {props.isCopied ? 'Скопировано' : 'Скопировать'}
            </button>
        </div>
    )
}

function InfoTooltip(props: { text: string }): React.JSX.Element {
    return (
        <span className="info-tooltip" tabIndex={0} aria-label={props.text}>
            i
            <span className="info-tooltip-bubble" role="tooltip">{props.text}</span>
        </span>
    )
}

function buildGitLabVariables(workspace: WorkspaceDescriptor, baseUrl: string): string {
    return [
        `AQA_PULSE_BASE_URL=${baseUrl}`,
        `AQA_PULSE_WORKSPACE_SLUG=${workspace.slug}`,
        'AQA_PULSE_WORKSPACE_API_KEY=<полный-ключ-показывается-при-создании>',
    ].join('\n')
}

function buildGitLabJobSnippet(workspace: WorkspaceDescriptor, baseUrl: string): string {
    return [
        'aqa-pulse-upload:',
        '  image: node:22-bookworm-slim',
        '  variables:',
        `    AQA_PULSE_BASE_URL: "${baseUrl}"`,
        `    AQA_PULSE_WORKSPACE_SLUG: "${workspace.slug}"`,
        '    AQA_PULSE_REPORT_PATH: "Playwright/test-results/dashboard/data.json"',
        '  script:',
        '    - npm ci',
        '    - npm test',
        '    - npx aqa-pulse-server upload-report --report "$AQA_PULSE_REPORT_PATH"',
        '  artifacts:',
        '    when: always',
        '    paths:',
        '      - Playwright/test-results/dashboard',
    ].join('\n')
}

function getCurrentBaseUrl(): string {
    if (typeof window === 'undefined') {
        return ''
    }

    return window.location.origin
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

    return false
}

function formatDateTime(value: string | null): string {
    if (!value) {
        return 'еще не было'
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

function formatSessionKind(kind: WorkspaceDescriptor['sessions'][number]['kind']): string {
    if (kind === 'workspace-api-key') {
        return 'загрузка отчетов'
    }

    if (kind === 'workspace-share-link') {
        return 'временная ссылка'
    }

    return 'пользователь дашборда'
}

function formatSessionExpiry(session: WorkspaceDescriptor['sessions'][number]): string {
    if (session.kind === 'workspace-share-link' && !session.activatedAt) {
        return `через ${String(session.ttlMinutes ?? 10)} минут после первого открытия`
    }

    return formatDateTime(session.expiresAt)
}
