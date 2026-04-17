import * as fs from 'node:fs'
import * as http from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'
import { loadReporterReport } from '../dashboard-utils'
import { getErrorMessage } from '../shared/error-utils'
import { createSaasApp } from './app'
import { type AdminAuditRecord, type AdminIngestionHealthReport, type ServerSettingsRecord, type WorkspaceDescriptor, type WorkspaceProvisioningResult, type WorkspaceShareLinkProvisioningResult, type WorkspaceUpdateResult, type WorkspaceUserProvisioningResult } from './contracts'
import { type SaasAppConfig, resolveSaasAppConfig } from './config'

interface JsonLoginResponse {
    accessToken: string
    expiresAt: string
    scope: string
    workspace?: string
}

interface JsonResponse<T> {
    response: Response
    payload: T | null
}

interface IngestionResponse {
    runId: string
    workspace: {
        slug: string
    }
}

interface SessionResponse {
    authenticated: boolean
    authRequired: boolean
    scope: string
    workspace?: string
}

export async function runAdminControlPlaneSmoke(configOverrides: Partial<SaasAppConfig> = {}): Promise<void> {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aqa-pulse-admin-smoke-'))
    const distPath = configOverrides.distPath ?? path.resolve(__dirname, '../../dist')
    const config = resolveSaasAppConfig({
        adminToken: configOverrides.adminToken ?? 'smoke-admin-token',
        jwtSecret: 'smoke-jwt-secret',
        accessTokenTtlSeconds: 60 * 10,
        allowDevBootstrap: false,
        requireWorkspaceAuth: true,
        dataRoot: configOverrides.dataRoot ?? path.join(tempRoot, 'data'),
        archiveRootPath: configOverrides.archiveRootPath ?? path.join(tempRoot, 'history'),
        distPath,
        ...configOverrides,
    })
    const fixturePath = path.resolve(__dirname, '../../fixtures/sample-llm-report.json')
    const report = loadReporterReport(fixturePath)

    assert(fs.existsSync(path.resolve(config.distPath, 'web', 'index.html')), 'Для admin smoke нужен собранный frontend template в dist/web/index.html.')
    fs.mkdirSync(config.dataRoot, { recursive: true })
    fs.mkdirSync(config.archiveRootPath, { recursive: true })

    const app = createSaasApp(config)
    const server = await listen(app)
    const address = server.address()

    if (!address || typeof address === 'string') {
        throw new Error('Не удалось определить адрес временного smoke-сервера.')
    }

    const baseUrl = `http://127.0.0.1:${address.port}`
    const initialSlug = normalizeSlug(`admin-smoke-${Date.now()}`)
    const renamedSlug = `${initialSlug}-renamed`

    try {
        const adminLoginResult = await fetchJsonResponse<JsonLoginResponse>(`${baseUrl}/auth/admin/login`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ token: config.adminToken }),
        })
        assertStatus(adminLoginResult.response, 200, 'admin login')
        const adminCookie = extractCookieHeader(adminLoginResult.response, config.adminSessionCookieName)

        const createdWorkspace = await fetchJson<WorkspaceProvisioningResult>(`${baseUrl}/api/workspaces`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                name: 'Admin Smoke Workspace',
                slug: initialSlug,
                apiKeyLabel: 'Smoke ingestion key',
            }),
        })
        assert(createdWorkspace.workspace.slug === initialSlug, 'Workspace должен создаться с ожидаемым slug.')

        const ingestionLogin = await fetchJson<JsonLoginResponse>(`${baseUrl}/auth/workspaces/${initialSlug}/api-keys/login`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ token: createdWorkspace.apiKey.token }),
        })

        const ingestionResult = await fetchJson<IngestionResponse>(`${baseUrl}/api/workspaces/${initialSlug}/ingestions`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${ingestionLogin.accessToken}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                report,
                metadata: {
                    branch: 'main',
                    commit: 'admin-smoke',
                    author: 'aqa-pulse smoke',
                },
                sourceFile: fixturePath,
            }),
        })
        assert(ingestionResult.workspace.slug === initialSlug, 'Ingestion должен пройти в созданный workspace.')

        const updatedSettings = await fetchJson<{ settings: ServerSettingsRecord }>(`${baseUrl}/api/admin/settings`, {
            method: 'PUT',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                requireWorkspaceAuth: true,
                allowDevBootstrap: false,
                accessTokenTtlSeconds: 600,
                adminBaseUrl: null,
                runtimeBaseUrl: null,
                adminToken: config.adminToken,
                businessAssumptions: {
                    ciMinuteCostRub: 11,
                    developerHourlyCostRub: 5100,
                    analysisMinutesPerUnstable: 17,
                },
            }),
        })
        assert(updatedSettings.settings.accessTokenTtlSeconds === 600, 'Server settings должны обновить TTL.')

        const renamedWorkspace = await fetchJson<WorkspaceUpdateResult>(`${baseUrl}/api/workspaces/${initialSlug}`, {
            method: 'PUT',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ name: 'Admin Smoke Workspace Renamed', slug: renamedSlug }),
        })
        assert(renamedWorkspace.workspace.slug === renamedSlug, 'Workspace rename должен сменить slug.')

        const extraApiKey = await fetchJson<WorkspaceProvisioningResult>(`${baseUrl}/api/workspaces/${renamedSlug}/api-keys`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ label: 'Smoke deletable key' }),
        })
        assert(extraApiKey.apiKey.label === 'Smoke deletable key', 'Дополнительный API key должен создаваться для delete smoke.')

        const createdUser = await fetchJson<WorkspaceUserProvisioningResult>(`${baseUrl}/api/workspaces/${renamedSlug}/users`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ label: 'Smoke viewer', role: 'viewer' }),
        })
        assert(createdUser.user.role === 'viewer', 'Новый user должен создаваться с viewer role.')

        const updatedRole = await fetchJson<{ role: 'owner' | 'viewer'; userId: string; workspace: WorkspaceDescriptor }>(`${baseUrl}/api/workspaces/${renamedSlug}/users/${createdUser.user.id}/role`, {
            method: 'PUT',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ role: 'owner' }),
        })
        assert(updatedRole.role === 'owner', 'User role update должен переключить роль на owner.')

        const shareLinkResult = await fetchJson<WorkspaceShareLinkProvisioningResult>(`${baseUrl}/api/workspaces/${renamedSlug}/share-links`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ ttlMinutes: 5 }),
        })
        assert(shareLinkResult.shareSession.ttlMinutes === 5, 'Share link должен выдаваться на запрошенный TTL.')
        assert(shareLinkResult.shareLinkUrl.startsWith(`${baseUrl}/s/`), 'Share link должна возвращаться как короткий абсолютный URL на основной домен.')
        assert(!shareLinkResult.shareLinkUrl.includes('token='), 'Короткая share link не должна раскрывать длинный JWT в query string.')

        const invalidShareLinkPage = await fetch(`${baseUrl}/auth/workspaces/${renamedSlug}/share-links/login?token=bad-token`, {
            headers: { accept: 'text/html' },
        })
        assertStatus(invalidShareLinkPage, 401, 'invalid share link page')
        const invalidShareLinkHtml = await invalidShareLinkPage.text()
        assert(invalidShareLinkHtml.includes('Ссылка истекла или некорректна'), 'Невалидная share link должна рендерить HTML error shell с явным заголовком.')

        const shareLinkLogin = await fetch(resolveUrl(baseUrl, shareLinkResult.shareLinkUrl), {
            headers: { accept: 'text/html' },
            redirect: 'manual',
        })
        assertStatus(shareLinkLogin, 302, 'share link login')
        assertHeader(shareLinkLogin, 'location', `/w/${renamedSlug}`, 'share link redirect')
        const workspaceCookie = extractCookieHeader(shareLinkLogin, `${config.workspaceSessionCookiePrefix}_${renamedSlug}`)

        const workspaceSession = await fetchJson<SessionResponse>(`${baseUrl}/auth/workspaces/${renamedSlug}/session`, {
            headers: {
                accept: 'application/json',
                cookie: workspaceCookie,
            },
        })
        assert(workspaceSession.authenticated === true, 'Share link должен открывать authenticated workspace session.')

        const workspaceAfterApiKeyDelete = await fetchJson<{ workspace: WorkspaceDescriptor }>(`${baseUrl}/api/workspaces/${renamedSlug}/api-keys/${extraApiKey.apiKey.id}`, {
            method: 'DELETE',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
            },
        })
        assert(!workspaceAfterApiKeyDelete.workspace.apiKeys.some((item) => item.id === extraApiKey.apiKey.id), 'Удалённый API key не должен оставаться в workspace descriptor.')

        const workspaceAfterUserDelete = await fetchJson<{ workspace: WorkspaceDescriptor }>(`${baseUrl}/api/workspaces/${renamedSlug}/users/${createdUser.user.id}`, {
            method: 'DELETE',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
            },
        })
        assert(!workspaceAfterUserDelete.workspace.users.some((item) => item.id === createdUser.user.id), 'Удалённый пользователь не должен оставаться в workspace descriptor.')

        const healthReport = await fetchJson<AdminIngestionHealthReport>(`${baseUrl}/api/admin/ingestion-health`, {
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
            },
        })
        const healthItem = healthReport.items.find((item) => item.slug === renamedSlug)
        assert(Boolean(healthItem), 'Ingestion health должен содержать переименованный workspace.')
        assert((healthItem?.runCount ?? 0) > 0, 'Ingestion health должен отражать загруженный run.')

        const auditLog = await fetchJson<{ entries: AdminAuditRecord[] }>(`${baseUrl}/api/admin/audit`, {
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
            },
        })
        assert(auditLog.entries.some((entry) => entry.action === 'workspace-updated' && entry.workspaceSlug === renamedSlug), 'Audit log должен содержать workspace update.')
        assert(auditLog.entries.some((entry) => entry.action === 'workspace-user-role-updated' && entry.workspaceSlug === renamedSlug), 'Audit log должен содержать user role update.')
        assert(auditLog.entries.some((entry) => entry.action === 'workspace-user-deleted' && entry.workspaceSlug === renamedSlug), 'Audit log должен содержать user delete.')
        assert(auditLog.entries.some((entry) => entry.action === 'workspace-api-key-deleted' && entry.workspaceSlug === renamedSlug), 'Audit log должен содержать api key delete.')
        assert(auditLog.entries.some((entry) => entry.action === 'workspace-share-link-created' && entry.workspaceSlug === renamedSlug), 'Audit log должен содержать share link creation.')
        assert(auditLog.entries.some((entry) => entry.action === 'server-settings-updated'), 'Audit log должен содержать settings update.')

        const deletedWorkspace = await fetchJson<{ workspace: WorkspaceDescriptor }>(`${baseUrl}/api/workspaces/${renamedSlug}`, {
            method: 'DELETE',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
            },
        })
        assert(deletedWorkspace.workspace.slug === renamedSlug, 'Delete должен вернуть удалённый workspace.')

        const workspacesAfterDelete = await fetchJson<{ workspaces: WorkspaceDescriptor[] }>(`${baseUrl}/api/workspaces`, {
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
            },
        })
        assert(!workspacesAfterDelete.workspaces.some((workspace) => workspace.slug === renamedSlug), 'Удалённый workspace не должен оставаться в registry list.')

        console.log('Admin control-plane smoke завершён успешно.')
        console.log(`Workspace slug: ${renamedSlug}`)
        console.log(`Run id: ${ingestionResult.runId}`)
    } finally {
        await closeServer(server)

        if (process.env.AQA_PULSE_KEEP_SMOKE_DATA !== '1') {
            fs.rmSync(tempRoot, { recursive: true, force: true })
        }
    }
}

if (require.main === module) {
    runAdminControlPlaneSmoke().catch((error) => {
        console.error(`Admin control-plane smoke завершился ошибкой: ${getErrorMessage(error)}`)
        process.exitCode = 1
    })
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const result = await fetchJsonResponse<T>(url, init)
    assertOk(result.response, `json response for ${url}`)
    return requirePayload(result, `json response for ${url}`)
}

async function fetchJsonResponse<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
    const response = await fetch(url, init)
    const responseText = await response.text()

    if (!responseText.trim()) {
        return { response, payload: null }
    }

    return {
        response,
        payload: JSON.parse(responseText) as T,
    }
}

function requirePayload<T>(result: JsonResponse<T>, label: string): T {
    if (result.payload === null) {
        throw new Error(`${label}: ожидался JSON payload.`)
    }

    return result.payload
}

function assertOk(response: Response, label: string): void {
    if (!response.ok) {
        throw new Error(`${label}: ожидался успешный HTTP статус, получен ${response.status}.`)
    }
}

function assertStatus(response: Response, expectedStatus: number, label: string): void {
    if (response.status !== expectedStatus) {
        throw new Error(`${label}: ожидался HTTP ${expectedStatus}, получен ${response.status}.`)
    }
}

function assertHeader(response: Response, headerName: string, expectedValue: string, label: string): void {
    const headerValue = response.headers.get(headerName)

    if (headerValue !== expectedValue) {
        throw new Error(`${label}: ожидался header ${headerName}=${expectedValue}, получено ${headerValue ?? '<empty>'}.`)
    }
}

function extractCookieHeader(response: Response, cookieName: string): string {
    const setCookieHeader = response.headers.get('set-cookie')

    if (!setCookieHeader) {
        throw new Error(`В ответе отсутствует Set-Cookie для ${cookieName}.`)
    }

    const cookieValue = setCookieHeader.split(',').find((entry) => entry.trim().startsWith(`${cookieName}=`))
        ?? setCookieHeader.split(';')[0]

    if (!cookieValue.includes(`${cookieName}=`)) {
        throw new Error(`Не найден cookie ${cookieName} в Set-Cookie.`)
    }

    return cookieValue.split(';')[0].trim()
}

function resolveUrl(baseUrl: string, urlOrPath: string): string {
    return new URL(urlOrPath, baseUrl).toString()
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}

function normalizeSlug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function listen(app: ReturnType<typeof createSaasApp>): Promise<http.Server> {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => resolve(server))
        server.on('error', reject)
    })
}

function closeServer(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error)
                return
            }

            resolve()
        })
    })
}