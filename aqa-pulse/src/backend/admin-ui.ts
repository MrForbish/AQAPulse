import type { WorkspaceDescriptor } from './contracts'

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

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

const COMMON_STYLES = `
    :root {
        color-scheme: light;
        font-family: Inter, Arial, sans-serif;
    }
    body {
        margin: 0;
        background: #f5f7fb;
        color: #1f2937;
    }
    .shell {
        max-width: 1280px;
        margin: 0 auto;
        padding: 32px 20px 48px;
    }
    .shell-narrow {
        max-width: 560px;
    }
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 24px;
    }
    .card {
        background: #fff;
        border: 1px solid #dbe2f0;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
    }
    .card-success {
        border-color: #86efac;
        background: #f0fdf4;
    }
    .card-error {
        border-color: #fca5a5;
        background: #fef2f2;
    }
    .card-info {
        border-color: #93c5fd;
        background: #eff6ff;
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
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        background: #fff;
    }
    button {
        border: 0;
        border-radius: 10px;
        background: #2563eb;
        color: #fff;
        padding: 10px 14px;
        cursor: pointer;
        font-weight: 700;
    }
    button.secondary {
        background: #64748b;
    }
    .muted {
        color: #64748b;
    }
    .compact-list {
        margin: 0;
        padding-left: 18px;
    }
    .alert {
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 14px;
    }
    .alert-error {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
    }
    .details-table {
        width: 100%;
        border-collapse: collapse;
    }
    .details-table th,
    .details-table td {
        text-align: left;
        padding: 8px 10px;
        border-bottom: 1px solid #dcfce7;
        vertical-align: top;
    }
    code {
        font-family: Consolas, monospace;
        font-size: 13px;
        white-space: pre-wrap;
        word-break: break-word;
    }
    a {
        color: #2563eb;
        text-decoration: none;
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
    }
`



