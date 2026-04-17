import React from 'react'
import type { AdminAuditRecord, AdminIngestionHealthReport, ServerSettingsRecord, WorkspaceIngestionHealthStatus } from '../../../backend/contracts'
import { LoadingView, Panel } from '../../shared/ui'

export function AdminServerSettingsSection(props: {
    settings: ServerSettingsRecord | null
    busyKey: string | null
    onUpdateSettings: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
}): React.JSX.Element {
    if (!props.settings) {
        return (
            <section className="admin-grid">
                <Panel className="span-2" title="Server settings">
                    <LoadingView label="Загружаем server settings..." />
                </Panel>
            </section>
        )
    }

    return (
        <section className="admin-grid">
            <Panel className="span-2" title="Server settings" description="Эти настройки живут на сервере и применяются к текущему runtime без ручного редактирования .env.">
                <form className="stack admin-form" onSubmit={props.onUpdateSettings}>
                    <div className="admin-grid server-settings-grid">
                        <label><span>Admin base URL</span><input type="text" name="adminBaseUrl" defaultValue={props.settings.adminBaseUrl ?? ''} placeholder="https://admin.example.com" /></label>
                        <label><span>Runtime base URL</span><input type="text" name="runtimeBaseUrl" defaultValue={props.settings.runtimeBaseUrl ?? ''} placeholder="https://runtime.example.com" /></label>
                        <label><span>Admin token</span><input type="text" name="adminToken" defaultValue={props.settings.adminToken ?? ''} placeholder="Пусто = admin auth отключён" /></label>
                        <label><span>JWT/session TTL, сек</span><input type="number" min="1" name="accessTokenTtlSeconds" defaultValue={String(props.settings.accessTokenTtlSeconds)} required /></label>
                        <label><span>CI minute cost</span><input type="number" min="0" step="0.01" name="ciMinuteCostRub" defaultValue={stringifyNullableNumber(props.settings.businessAssumptions.ciMinuteCostRub)} /></label>
                        <label><span>Developer hourly cost</span><input type="number" min="0" step="0.01" name="developerHourlyCostRub" defaultValue={stringifyNullableNumber(props.settings.businessAssumptions.developerHourlyCostRub)} /></label>
                        <label><span>Analysis minutes per unstable</span><input type="number" min="0" step="0.01" name="analysisMinutesPerUnstable" defaultValue={stringifyNullableNumber(props.settings.businessAssumptions.analysisMinutesPerUnstable)} /></label>
                    </div>
                    <div className="checkbox-row-group">
                        <label className="checkbox-row"><input type="checkbox" name="requireWorkspaceAuth" defaultChecked={props.settings.requireWorkspaceAuth} /><span>Требовать workspace login для чтения dashboard/API</span></label>
                        <label className="checkbox-row"><input type="checkbox" name="allowDevBootstrap" defaultChecked={props.settings.allowDevBootstrap} /><span>Разрешить dev bootstrap route</span></label>
                    </div>
                    <button type="submit" className="primary-link auth-submit" disabled={props.busyKey === 'settings:update'}>
                        {props.busyKey === 'settings:update' ? 'Сохраняем...' : 'Сохранить server settings'}
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
        <Panel className="span-2" title="Ingestion / job health" description="Сводка по последним ingestion-циклам по каждому workspace.">
            {!props.health ? <LoadingView label="Собираем ingestion health..." /> : (
                <>
                    <div className="detail-pairs compact-pairs admin-health-summary-grid">
                        <div className="detail-row"><span>Total workspaces</span><code>{String(props.health.totals.total)}</code></div>
                        <div className="detail-row"><span>Healthy</span><code>{String(props.health.totals.healthy)}</code></div>
                        <div className="detail-row"><span>Warning</span><code>{String(props.health.totals.warning)}</code></div>
                        <div className="detail-row"><span>Critical</span><code>{String(props.health.totals.critical)}</code></div>
                        <div className="detail-row"><span>Stale</span><code>{String(props.health.totals.stale)}</code></div>
                        <div className="detail-row"><span>Idle</span><code>{String(props.health.totals.idle)}</code></div>
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
                                    <span>Runs: {String(item.runCount)}</span>
                                    <span>Последний ingestion: {formatDateTime(item.lastIngestionAt)}</span>
                                    <span>Stale, ч: {item.staleHours === null ? 'n/a' : String(item.staleHours)}</span>
                                    <span>Pass rate: {formatPercent(item.latestPassRate)}</span>
                                    <span>Failed: {formatNullableNumber(item.latestFailedTests)}</span>
                                    <span>Flaky: {formatNullableNumber(item.latestFlakyTests)}</span>
                                    <span>Duration: {formatDuration(item.latestDurationMs)}</span>
                                    <span>Source: {item.latestSourceFile ?? 'n/a'}</span>
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
    entries: AdminAuditRecord[]
}): React.JSX.Element {
    return (
        <Panel className="span-2" title="Admin audit" description="Последние админские действия по доступам, настройкам и workspace lifecycle.">
            <ul className="admin-compact-list admin-audit-list">
                {props.entries.length > 0 ? props.entries.map((entry) => (
                    <li key={entry.id} className="access-list-item">
                        <div className="access-item-head">
                            <strong>{entry.summary}</strong>
                            <span className="access-state-pill is-active">{entry.action}</span>
                        </div>
                        <div className="access-item-meta access-item-meta-compact">
                            <span>Когда: {formatDateTime(entry.createdAt)}</span>
                            <span>Кто: {entry.actorLabel}</span>
                            <span>Session: {entry.actorSessionId ?? 'n/a'}</span>
                            <span>Workspace: {entry.workspaceSlug ?? 'n/a'}</span>
                            <span>Target: {entry.targetType}{entry.targetId ? `:${entry.targetId}` : ''}</span>
                        </div>
                        {Object.keys(entry.details).length > 0 ? (
                            <div className="detail-pairs compact-pairs admin-audit-details">
                                {Object.entries(entry.details).map(([key, value]) => (
                                    <div key={key} className="detail-row">
                                        <span>{key}</span>
                                        <code>{value}</code>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </li>
                )) : <li className="is-empty">Аудит-записей пока нет.</li>}
            </ul>
        </Panel>
    )
}

function labelHealthStatus(status: WorkspaceIngestionHealthStatus): string {
    switch (status) {
        case 'healthy':
            return 'Healthy'
        case 'warning':
            return 'Warning'
        case 'critical':
            return 'Critical'
        case 'stale':
            return 'Stale'
        default:
            return 'Idle'
    }
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

function formatPercent(value: number | null): string {
    return typeof value === 'number' ? `${value.toFixed(1)}%` : 'n/a'
}

function formatDuration(value: number | null): string {
    if (typeof value !== 'number') {
        return 'n/a'
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
    return typeof value === 'number' ? String(value) : 'n/a'
}

function stringifyNullableNumber(value: number | null): string {
    return typeof value === 'number' ? String(value) : ''
}
