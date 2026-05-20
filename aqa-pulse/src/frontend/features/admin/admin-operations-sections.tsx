import React from 'react'
import type { AdminAuditPage, AdminAuditRecord, AdminIngestionHealthReport, ServerSettingsRecord, WorkspaceIngestionHealthStatus } from '../../../backend/contracts'
import { LoadingView, Panel } from '../../shared/ui'

export function AdminServerSettingsSection(props: {
    settings: ServerSettingsRecord | null
    busyKey: string | null
    onUpdateSettings: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
}): React.JSX.Element {
    if (!props.settings) {
        return (
            <section className="admin-grid">
                <Panel className="span-2" title="Настройки сервера">
                    <LoadingView label="Загружаем настройки сервера..." />
                </Panel>
            </section>
        )
    }

    return (
        <section className="admin-grid">
            <Panel className="span-2" title="Настройки сервера" description="Здесь настраивается весь self-hosted сервер: публичные URL, авторизация, срок жизни сессий и базовые значения для бизнес-расчетов.">
                <form className="stack admin-form" onSubmit={props.onUpdateSettings}>
                    <div className="admin-grid server-settings-grid">
                        <label><span>Admin base URL</span><input type="text" name="adminBaseUrl" defaultValue={props.settings.adminBaseUrl ?? ''} placeholder="https://admin.example.com" /></label>
                        <label><span>Runtime base URL</span><input type="text" name="runtimeBaseUrl" defaultValue={props.settings.runtimeBaseUrl ?? ''} placeholder="https://aqa-pulse.example.com" /></label>
                        <label><span>Admin token</span><input type="text" name="adminToken" defaultValue={props.settings.adminToken ?? ''} placeholder="Пусто = вход в админку без токена" /></label>
                        <label><span>TTL сессии, секунд</span><input type="number" min="1" name="accessTokenTtlSeconds" defaultValue={String(props.settings.accessTokenTtlSeconds)} required /></label>
                        <label><span>Стоимость минуты CI</span><input type="number" min="0" step="0.01" name="ciMinuteCostRub" defaultValue={stringifyNullableNumber(props.settings.businessAssumptions.ciMinuteCostRub)} /></label>
                        <label><span>Стоимость часа разработчика</span><input type="number" min="0" step="0.01" name="developerHourlyCostRub" defaultValue={stringifyNullableNumber(props.settings.businessAssumptions.developerHourlyCostRub)} /></label>
                        <label><span>Минут на разбор нестабильного теста</span><input type="number" min="0" step="0.01" name="analysisMinutesPerUnstable" defaultValue={stringifyNullableNumber(props.settings.businessAssumptions.analysisMinutesPerUnstable)} /></label>
                    </div>
                    <div className="checkbox-row-group">
                        <label className="checkbox-row checkbox-card-row">
                            <input type="checkbox" name="requireWorkspaceAuth" defaultChecked={props.settings.requireWorkspaceAuth} />
                            <span className="checkbox-copy">
                                <strong>Требовать вход для просмотра workspace</strong>
                                <small>Если включено, `/w/&lt;slug&gt;` и read-only API доступны только после входа по токену пользователя, сессии администратора или временной ссылке.</small>
                            </span>
                        </label>
                        <label className="checkbox-row checkbox-card-row">
                            <input type="checkbox" name="allowDevBootstrap" defaultChecked={props.settings.allowDevBootstrap} />
                            <span className="checkbox-copy">
                                <strong>Разрешить тестовый bootstrap</strong>
                                <small>Если включено, остается доступным служебный endpoint `/api/dev/bootstrap` для быстрого создания demo workspace и ключей.</small>
                            </span>
                        </label>
                    </div>
                    <button type="submit" className="primary-link auth-submit" disabled={props.busyKey === 'settings:update'}>
                        {props.busyKey === 'settings:update' ? 'Сохраняем...' : 'Сохранить настройки'}
                    </button>
                </form>
            </Panel>
        </section>
    )
}

export function AdminIngestionHealthSection(props: {
    health: AdminIngestionHealthReport | null
}): React.JSX.Element {
    return (
        <Panel className="span-2" title="Состояние загрузок и прогонов" description="Сводка по последним загрузкам отчетов и состоянию прогонов в каждом workspace.">
            {!props.health ? <LoadingView label="Собираем сводку по загрузкам и прогонам..." /> : (
                <>
                    <div className="detail-pairs compact-pairs admin-health-summary-grid">
                        <div className="detail-row"><span>Всего workspace</span><code>{String(props.health.totals.total)}</code></div>
                        <div className="detail-row"><span>Здоровые</span><code>{String(props.health.totals.healthy)}</code></div>
                        <div className="detail-row"><span>С предупреждениями</span><code>{String(props.health.totals.warning)}</code></div>
                        <div className="detail-row"><span>Критичные</span><code>{String(props.health.totals.critical)}</code></div>
                        <div className="detail-row"><span>Устаревшие</span><code>{String(props.health.totals.stale)}</code></div>
                        <div className="detail-row"><span>Без запусков</span><code>{String(props.health.totals.idle)}</code></div>
                    </div>
                    <ul className="admin-compact-list admin-health-list">
                        {props.health.items.map((item) => (
                            <li key={item.slug} className="access-list-item">
                                <div className="access-item-head">
                                    <strong>{item.name}</strong>
                                    <span className={`access-state-pill health-state-pill is-${item.status}`}>{labelHealthStatus(item.status)}</span>
                                </div>
                                <div className="access-item-meta access-item-meta-compact">
                                    <span>Workspace: {item.slug}</span>
                                    <span>Прогонов: {String(item.runCount)}</span>
                                    <span>Последняя загрузка: {formatDateTime(item.lastIngestionAt)}</span>
                                    <span>Устарело, ч: {item.staleHours === null ? 'н/д' : String(item.staleHours)}</span>
                                    <span>Успешность: {formatPercent(item.latestPassRate)}</span>
                                    <span>Упало тестов: {formatNullableNumber(item.latestFailedTests)}</span>
                                    <span>Флаки: {formatNullableNumber(item.latestFlakyTests)}</span>
                                    <span>Длительность: {formatDuration(item.latestDurationMs)}</span>
                                    <span>Источник: {item.latestSourceFile ?? 'н/д'}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </Panel>
    )
}

export function AdminAuditTrailSection(props: {
    auditPage: AdminAuditPage | null
    isLoading: boolean
    onPreviousPage: () => Promise<void>
    onNextPage: () => Promise<void>
}): React.JSX.Element {
    if (!props.auditPage) {
        return (
            <Panel className="span-2" title="Аудит админки" description="История действий с workspace, ключами, пользователями, сессиями и настройками сервера.">
                <LoadingView label="Загружаем журнал действий..." />
            </Panel>
        )
    }

    const rangeStart = props.auditPage.totalEntries === 0 ? 0 : (props.auditPage.page - 1) * props.auditPage.pageSize + 1
    const rangeEnd = props.auditPage.totalEntries === 0 ? 0 : rangeStart + props.auditPage.entries.length - 1

    return (
        <Panel className="span-2" title="Аудит админки" description="История действий с workspace, ключами, пользователями, сессиями и настройками сервера.">
            <div className="admin-audit-toolbar">
                <div className="subtle-copy">Показаны записи {String(rangeStart)}-{String(rangeEnd)} из {String(props.auditPage.totalEntries)}</div>
                <div className="admin-audit-pagination">
                    <button type="button" className="secondary-button" disabled={props.isLoading || !props.auditPage.hasPreviousPage} onClick={() => void props.onPreviousPage()}>
                        Назад
                    </button>
                    <span>Страница {String(props.auditPage.page)} из {String(props.auditPage.totalPages)}</span>
                    <button type="button" className="secondary-button" disabled={props.isLoading || !props.auditPage.hasNextPage} onClick={() => void props.onNextPage()}>
                        Вперед
                    </button>
                </div>
            </div>
            <ul className="admin-compact-list admin-audit-list">
                {props.auditPage.entries.length > 0 ? props.auditPage.entries.map((entry) => (
                    <li key={entry.id} className="access-list-item">
                        <div className="access-item-head">
                            <strong>{formatAuditSummary(entry)}</strong>
                            <span className="access-state-pill is-active">{labelAuditAction(entry.action)}</span>
                        </div>
                        <div className="access-item-meta access-item-meta-compact">
                            <span>Когда: {formatDateTime(entry.createdAt)}</span>
                            <span>Кто: {entry.actorLabel}</span>
                            <span>Сессия: {entry.actorSessionId ?? 'н/д'}</span>
                            <span>Workspace: {entry.workspaceSlug ?? 'н/д'}</span>
                            <span>Объект: {labelAuditTarget(entry.targetType)}{entry.targetId ? `:${entry.targetId}` : ''}</span>
                        </div>
                        {Object.keys(entry.details).length > 0 ? (
                            <div className="detail-pairs compact-pairs admin-audit-details">
                                {Object.entries(entry.details).map(([key, value]) => (
                                    <div key={key} className="detail-row">
                                        <span>{labelAuditDetail(key)}</span>
                                        <code>{value}</code>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </li>
                )) : <li className="is-empty">Записей аудита пока нет.</li>}
            </ul>
        </Panel>
    )
}

function labelHealthStatus(status: WorkspaceIngestionHealthStatus): string {
    switch (status) {
        case 'healthy':
            return 'Здоров'
        case 'warning':
            return 'Предупреждение'
        case 'critical':
            return 'Критично'
        case 'stale':
            return 'Устарело'
        default:
            return 'Нет запусков'
    }
}

function labelAuditAction(action: AdminAuditRecord['action']): string {
    switch (action) {
        case 'admin-login':
            return 'Вход администратора'
        case 'admin-logout':
            return 'Выход администратора'
        case 'workspace-created':
            return 'Workspace создан'
        case 'workspace-updated':
            return 'Workspace обновлен'
        case 'workspace-deleted':
            return 'Workspace удален'
        case 'workspace-data-reset':
            return 'Прогоны очищены'
        case 'workspace-api-key-created':
            return 'Ключ создан'
        case 'workspace-api-key-disabled':
            return 'Ключ отключен'
        case 'workspace-api-key-deleted':
            return 'Ключ удален'
        case 'workspace-user-created':
            return 'Пользователь создан'
        case 'workspace-user-disabled':
            return 'Пользователь отключен'
        case 'workspace-user-deleted':
            return 'Пользователь удален'
        case 'workspace-user-role-updated':
            return 'Роль изменена'
        case 'workspace-share-link-created':
            return 'Временная ссылка создана'
        case 'workspace-session-revoked':
            return 'Сессия отозвана'
        case 'server-settings-updated':
            return 'Настройки обновлены'
        default:
            return action
    }
}

function labelAuditTarget(targetType: AdminAuditRecord['targetType']): string {
    switch (targetType) {
        case 'workspace':
            return 'workspace'
        case 'api-key':
            return 'ключ'
        case 'user':
            return 'пользователь'
        case 'session':
            return 'сессия'
        case 'server-settings':
            return 'настройки сервера'
        default:
            return 'сессия администратора'
    }
}

function labelAuditDetail(key: string): string {
    const labels: Record<string, string> = {
        accessTokenTtlSeconds: 'TTL сессии, секунд',
        allowDevBootstrap: 'Тестовый bootstrap',
        apiKeyId: 'ID ключа',
        name: 'Название',
        previousSlug: 'Предыдущий slug',
        requireWorkspaceAuth: 'Требовать вход',
        role: 'Роль',
        sessionId: 'ID сессии',
        slug: 'Slug',
        userId: 'ID пользователя',
    }

    return labels[key] ?? key
}

function formatAuditSummary(entry: AdminAuditRecord): string {
    if (entry.summary && !/^[a-z\s-]+$/i.test(entry.summary)) {
        return entry.summary
    }

    return labelAuditAction(entry.action)
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

function formatPercent(value: number | null): string {
    return typeof value === 'number' ? `${value.toFixed(1)}%` : 'н/д'
}

function formatDuration(value: number | null): string {
    if (typeof value !== 'number') {
        return 'н/д'
    }

    if (value >= 60_000) {
        return `${(value / 60_000).toFixed(1)} мин`
    }

    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)} c`
    }

    return `${Math.round(value)} мс`
}

function formatNullableNumber(value: number | null): string {
    return typeof value === 'number' ? String(value) : 'н/д'
}

function stringifyNullableNumber(value: number | null): string {
    return typeof value === 'number' ? String(value) : ''
}
