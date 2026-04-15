import type { WorkspaceDescriptor } from './contracts'
import { escapeHtml } from '../shared/text-utils'

export interface AdminDashboardActionResult {
    title: string
    details: Record<string, string>
    tone?: 'success' | 'error' | 'info'
}

export function renderAdminLoginHtml(errorMessage?: string): string {
    return `<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AQA Pulse Admin Login</title>
    <style>${COMMON_STYLES}</style>
</head>
<body>
    <main class="shell shell-narrow">
        <section class="card">
            <h1>AQA Pulse Admin</h1>
            <p class="muted">Войди через admin token, чтобы управлять workspace, users и ingestion keys.</p>
            ${errorMessage ? `<div class="alert alert-error">${escapeHtml(errorMessage)}</div>` : ''}
            <form method="post" action="/auth/admin/login" class="stack">
                <label>
                    <span>Admin token</span>
                    <input type="password" name="token" autocomplete="current-password" required />
                </label>
                <button type="submit">Войти</button>
            </form>
        </section>
    </main>
</body>
</html>`
}

export function renderWorkspaceLoginHtml(slug: string, errorMessage?: string): string {
    return `<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AQA Pulse Workspace Login</title>
    <style>${COMMON_STYLES}</style>
</head>
<body>
    <main class="shell shell-narrow">
        <section class="card">
            <h1>Workspace login</h1>
            <p class="muted">Workspace: <strong>${escapeHtml(slug)}</strong>. Введи workspace user token для просмотра dashboard.</p>
            ${errorMessage ? `<div class="alert alert-error">${escapeHtml(errorMessage)}</div>` : ''}
            <form method="post" action="/auth/workspaces/${encodeURIComponent(slug)}/users/login" class="stack">
                <label>
                    <span>Workspace user token</span>
                    <input type="password" name="token" autocomplete="current-password" required />
                </label>
                <button type="submit">Открыть dashboard</button>
            </form>
        </section>
    </main>
</body>
</html>`
}

export function renderWorkspaceApiKeyExchangeHtml(options: {
    slug: string
    errorMessage?: string
    exchangeResult?: {
        accessToken: string
        expiresAt: string
        scope: string
        workspace: string
        authorizationHeader: string
        ingestionEndpoint: string
    }
}): string {
    const detailsRows = options.exchangeResult
        ? Object.entries(options.exchangeResult)
            .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td><code>${escapeHtml(value)}</code></td></tr>`)
            .join('')
        : ''

    return `<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AQA Pulse API Key Exchange</title>
    <style>${COMMON_STYLES}</style>
</head>
<body>
    <main class="shell shell-narrow">
        <section class="card">
            <h1>API key → ingestion JWT</h1>
            <p class="muted">Workspace: <strong>${escapeHtml(options.slug)}</strong>. Введи raw API key, чтобы получить ingestion JWT для маршрута загрузки прогонов.</p>
            ${options.errorMessage ? `<div class="alert alert-error">${escapeHtml(options.errorMessage)}</div>` : ''}
            <form method="post" action="/auth/workspaces/${encodeURIComponent(options.slug)}/api-keys/login" class="stack">
                <label>
                    <span>Workspace API key</span>
                    <input type="password" name="token" autocomplete="current-password" required />
                </label>
                <button type="submit">Получить ingestion JWT</button>
            </form>
        </section>
        ${options.exchangeResult ? `<section class="card card-success form-separator-block">
            <h2>JWT выпущен</h2>
            <table class="details-table"><tbody>${detailsRows}</tbody></table>
        </section>` : ''}
        <section class="card form-separator-block">
            <a href="/admin">← Вернуться в admin dashboard</a>
        </section>
    </main>
</body>
</html>`
}

export function renderAdminDashboardHtml(options: {
    workspaces: WorkspaceDescriptor[]
    actionResult?: AdminDashboardActionResult
}): string {
    const workspaceCards = options.workspaces.length > 0
        ? options.workspaces.map((workspace) => renderWorkspaceCard(workspace)).join('')
        : '<div class="card"><div class="muted">Workspace пока нет.</div></div>'

    return `<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AQA Pulse Admin</title>
    <style>${COMMON_STYLES}</style>
</head>
<body>
    <main class="shell">
        <header class="page-header">
            <div>
                <h1>AQA Pulse Admin</h1>
                <p class="muted">Управление workspace, user tokens и ingestion keys.</p>
            </div>
            <form method="post" action="/auth/admin/logout">
                <button type="submit" class="secondary">Выйти</button>
            </form>
        </header>

        ${options.actionResult ? renderActionResult(options.actionResult) : ''}

        <section class="grid grid-main">
            <article class="card">
                <h2>Создать workspace</h2>
                <form method="post" action="/admin/workspaces" class="stack">
                    <label><span>Name</span><input type="text" name="name" required /></label>
                    <label><span>Slug</span><input type="text" name="slug" placeholder="demo-client" /></label>
                    <label><span>Initial API key label</span><input type="text" name="apiKeyLabel" placeholder="Primary ingestion key" /></label>
                    <button type="submit">Создать workspace</button>
                </form>
            </article>
            <article class="card">
                <h2>Как это работает</h2>
                <ul class="muted compact-list">
                    <li>Admin login создаёт session cookie.</li>
                    <li>Workspace API key используется только для ingestion.</li>
                    <li>Workspace user token используется для чтения dashboard/API.</li>
                    <li>Raw provisioning tokens нужно сохранять сразу после создания.</li>
                </ul>
            </article>
        </section>

        <section class="stack workspace-list">
            ${workspaceCards}
        </section>
    </main>
</body>
</html>`
}

function renderWorkspaceCard(workspace: WorkspaceDescriptor): string {
    const apiKeys = workspace.apiKeys.length > 0
        ? workspace.apiKeys.map((apiKey) => `<li><code>${escapeHtml(apiKey.label)}</code> · ${escapeHtml(apiKey.tokenPreview)}</li>`).join('')
        : '<li class="muted">API keys пока нет.</li>'
    const users = workspace.users.length > 0
        ? workspace.users.map((user) => `<li><code>${escapeHtml(user.label)}</code> · ${escapeHtml(user.role)} · ${escapeHtml(user.tokenPreview)}</li>`).join('')
        : '<li class="muted">Users пока нет.</li>'

    return `<article class="card workspace-card">
        <div class="workspace-card-header">
            <div>
                <h2>${escapeHtml(workspace.name)}</h2>
                <div class="muted">slug: <code>${escapeHtml(workspace.slug)}</code></div>
            </div>
            <div class="workspace-links">
                <a href="/w/${encodeURIComponent(workspace.slug)}" target="_blank" rel="noreferrer">Открыть dashboard</a>
                <a href="/w/${encodeURIComponent(workspace.slug)}/login" target="_blank" rel="noreferrer">Workspace login</a>
            </div>
        </div>

        <div class="grid grid-workspace">
            <section>
                <h3>API keys</h3>
                <ul class="compact-list">${apiKeys}</ul>
                <form method="post" action="/admin/workspaces/${encodeURIComponent(workspace.slug)}/api-keys" class="stack">
                    <label><span>Label</span><input type="text" name="label" placeholder="Upload key" /></label>
                    <button type="submit">Создать API key</button>
                </form>
                <form method="post" action="/auth/workspaces/${encodeURIComponent(workspace.slug)}/api-keys/login" class="stack form-separator">
                    <label><span>Raw API key</span><input type="password" name="token" placeholder="aqp_..." required /></label>
                    <button type="submit" class="secondary">Exchange API key → JWT</button>
                </form>
            </section>
            <section>
                <h3>Workspace users</h3>
                <ul class="compact-list">${users}</ul>
                <form method="post" action="/admin/workspaces/${encodeURIComponent(workspace.slug)}/users" class="stack">
                    <label><span>Label</span><input type="text" name="label" placeholder="Dashboard viewer" required /></label>
                    <label>
                        <span>Role</span>
                        <select name="role">
                            <option value="viewer">viewer</option>
                            <option value="owner">owner</option>
                        </select>
                    </label>
                    <button type="submit">Создать user token</button>
                </form>
            </section>
        </div>
    </article>`
}

function renderActionResult(actionResult: AdminDashboardActionResult): string {
    const rows = Object.entries(actionResult.details)
        .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td><code>${escapeHtml(value)}</code></td></tr>`)
        .join('')

    const toneClass = actionResult.tone === 'error'
        ? 'card-error'
        : actionResult.tone === 'info'
            ? 'card-info'
            : 'card-success'

    return `<section class="card ${toneClass}">
        <h2>${escapeHtml(actionResult.title)}</h2>
        <table class="details-table"><tbody>${rows}</tbody></table>
    </section>`
}

const COMMON_STYLES = `
    :root {
        color-scheme: light;
        font-family: "Segoe UI", Inter, Arial, sans-serif;
        --bg-top: #f7f4ec;
        --bg-bottom: #eef3fb;
        --surface: rgba(255, 255, 255, 0.88);
        --surface-strong: #ffffff;
        --border: rgba(148, 163, 184, 0.22);
        --border-strong: rgba(59, 130, 246, 0.24);
        --text-main: #172033;
        --text-muted: #5b6475;
        --accent: #0f766e;
        --accent-strong: #0b5d57;
        --accent-soft: rgba(15, 118, 110, 0.08);
        --shadow-lg: 0 22px 60px rgba(15, 23, 42, 0.12);
        --shadow-md: 0 14px 32px rgba(15, 23, 42, 0.08);
    }
    body {
        margin: 0;
        min-height: 100vh;
        background:
            radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 32%),
            radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 26%),
            linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
        color: var(--text-main);
    }
    body::before {
        content: '';
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px);
        background-size: 28px 28px;
        opacity: 0.28;
    }
    .shell {
        position: relative;
        max-width: 1280px;
        margin: 0 auto;
        padding: 36px 20px 56px;
    }
    .shell-narrow {
        max-width: 560px;
    }
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        margin-bottom: 28px;
        padding: 20px 22px;
        border: 1px solid var(--border);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.72) 100%);
        box-shadow: var(--shadow-md);
        backdrop-filter: blur(18px);
    }
    .card {
        background: linear-gradient(180deg, var(--surface-strong) 0%, var(--surface) 100%);
        border: 1px solid var(--border);
        border-radius: 22px;
        padding: 22px;
        box-shadow: var(--shadow-md);
        backdrop-filter: blur(16px);
    }
    .card-success {
        border-color: rgba(34, 197, 94, 0.28);
        background: linear-gradient(180deg, rgba(240, 253, 244, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%);
    }
    .card-error {
        border-color: rgba(239, 68, 68, 0.28);
        background: linear-gradient(180deg, rgba(254, 242, 242, 0.96) 0%, rgba(255, 255, 255, 0.9) 100%);
    }
    .card-info {
        border-color: var(--border-strong);
        background: linear-gradient(180deg, rgba(239, 246, 255, 0.96) 0%, rgba(255, 255, 255, 0.9) 100%);
    }
    .grid {
        display: grid;
        gap: 20px;
    }
    .grid-main {
        grid-template-columns: minmax(320px, 420px) 1fr;
        margin-bottom: 24px;
    }
    .grid-workspace {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        margin-top: 16px;
    }
    .stack {
        display: grid;
        gap: 12px;
    }
    .workspace-list {
        gap: 20px;
    }
    .form-separator {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
    }
    .form-separator-block {
        margin-top: 16px;
    }
    .workspace-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 10px;
    }
    .workspace-links {
        display: flex;
        flex-direction: column;
        gap: 8px;
        text-align: right;
    }
    h1, h2, h3 {
        margin: 0 0 10px;
    }
    h1 {
        font-size: 32px;
        line-height: 1.05;
        letter-spacing: -0.03em;
    }
    h2 {
        font-size: 22px;
        line-height: 1.15;
        letter-spacing: -0.025em;
    }
    h3 {
        font-size: 16px;
        line-height: 1.25;
    }
    label {
        display: grid;
        gap: 6px;
        font-size: 14px;
        font-weight: 600;
    }
    input, select, button {
        font: inherit;
    }
    input, select {
        width: 100%;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.34);
        background: rgba(255, 255, 255, 0.96);
        color: var(--text-main);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
        transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    }
    input:focus,
    select:focus {
        outline: none;
        border-color: rgba(15, 118, 110, 0.44);
        box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
    }
    button {
        border: 0;
        border-radius: 14px;
        background: linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%);
        color: #fff;
        padding: 12px 16px;
        cursor: pointer;
        font-weight: 700;
        box-shadow: 0 12px 24px rgba(15, 118, 110, 0.2);
        transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    }
    button:hover {
        transform: translateY(-1px);
        box-shadow: 0 16px 28px rgba(15, 118, 110, 0.22);
        filter: saturate(1.04);
    }
    button:focus-visible {
        outline: 2px solid rgba(15, 118, 110, 0.35);
        outline-offset: 3px;
    }
    button.secondary {
        background: linear-gradient(135deg, #546179 0%, #394150 100%);
        box-shadow: 0 12px 24px rgba(51, 65, 85, 0.16);
    }
    .muted {
        color: var(--text-muted);
        line-height: 1.55;
    }
    .compact-list {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 8px;
    }
    .alert {
        border-radius: 16px;
        padding: 14px 16px;
        font-size: 14px;
    }
    .alert-error {
        background: rgba(254, 242, 242, 0.96);
        color: #991b1b;
        border: 1px solid rgba(248, 113, 113, 0.3);
    }
    .details-table {
        width: 100%;
        border-collapse: collapse;
    }
    .details-table th,
    .details-table td {
        text-align: left;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        vertical-align: top;
    }
    .details-table th {
        color: var(--text-muted);
        font-weight: 600;
        width: 34%;
    }
    code {
        font-family: Consolas, monospace;
        font-size: 13px;
        white-space: pre-wrap;
        word-break: break-word;
        padding: 2px 6px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.06);
    }
    a {
        color: var(--accent-strong);
        text-decoration: none;
        transition: color 0.18s ease, opacity 0.18s ease;
    }
    a:hover {
        color: #1d4ed8;
    }
    .workspace-links a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(15, 118, 110, 0.16);
        background: var(--accent-soft);
        font-size: 13px;
        font-weight: 600;
    }
    .workspace-links a:hover {
        background: rgba(15, 118, 110, 0.14);
    }
    form {
        margin: 0;
    }
    @media (max-width: 900px) {
        .grid-main,
        .grid-workspace,
        .workspace-card-header {
            grid-template-columns: 1fr;
            display: grid;
        }
        .workspace-links {
            text-align: left;
        }
        h1 {
            font-size: 28px;
        }
    }
`



