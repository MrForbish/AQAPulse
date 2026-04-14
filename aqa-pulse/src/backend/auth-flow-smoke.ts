import * as fs from 'node:fs'
import * as http from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'
import { loadReporterReport } from '../dashboard-utils'
import { createSaasApp } from './app'
import { type SaasAppConfig, resolveSaasAppConfig } from './config'

interface AuthFlowSmokeOptions {
    scenarioName?: string
    configOverrides?: Partial<SaasAppConfig>
}

interface JsonLoginResponse {
    accessToken: string
    expiresAt: string
    scope: string
    workspace?: string
}

interface IngestionResponse {
    workspace: {
        slug: string
    }
    runId: string
    archivedRunDirectory: string
}

export async function runAuthFlowSmoke(options: AuthFlowSmokeOptions = {}): Promise<void> {
    const scenarioName = options.scenarioName ?? 'auth-flow'
    const scenarioId = `${scenarioName}-${Date.now()}`
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `aqa-pulse-${scenarioName}-`))
    const adminToken = options.configOverrides?.adminToken ?? 'smoke-admin-token'
    const config = resolveSaasAppConfig({
        adminToken,
        jwtSecret: 'smoke-jwt-secret',
        accessTokenTtlSeconds: 60 * 10,
        allowDevBootstrap: false,
        requireWorkspaceAuth: true,
        dataRoot: options.configOverrides?.dataRoot ?? path.join(tempRoot, 'data'),
        distPath: options.configOverrides?.distPath ?? path.join(tempRoot, 'dist'),
        legacyArchiveRootPath: options.configOverrides?.legacyArchiveRootPath ?? path.join(tempRoot, 'history'),
        ...options.configOverrides,
    })
    const fixturePath = path.resolve(__dirname, '../../fixtures/sample-llm-report.json')
    const report = loadReporterReport(fixturePath)
    const workspaceSlug = normalizeSlug(`smoke-${scenarioId}`)
    const workspaceName = `Smoke ${scenarioId}`

    fs.mkdirSync(config.dataRoot, { recursive: true })
    fs.mkdirSync(config.distPath, { recursive: true })
    fs.mkdirSync(config.legacyArchiveRootPath, { recursive: true })

    const app = createSaasApp(config)
    const server = await listen(app)
    const address = server.address()

    if (!address || typeof address === 'string') {
        throw new Error('Не удалось определить адрес временного smoke-сервера.')
    }

    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
        const adminLoginPage = await fetchText(`${baseUrl}/admin/login`)
        assertIncludes(adminLoginPage, 'AQA Pulse Admin', 'admin login page')

        const adminLoginResponse = await fetch(`${baseUrl}/auth/admin/login`, {
            method: 'POST',
            headers: {
                accept: 'text/html',
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ token: adminToken }),
            redirect: 'manual',
        })
        assertStatus(adminLoginResponse, 302, 'admin form login')
        assertHeader(adminLoginResponse, 'location', '/admin', 'admin form login redirect')
        const adminCookie = extractCookieHeader(adminLoginResponse, config.adminSessionCookieName)

        const adminDashboardHtml = await fetchText(`${baseUrl}/admin`, {
            headers: { cookie: adminCookie },
        })
        assertIncludes(adminDashboardHtml, 'Создать workspace', 'admin dashboard')

        const createWorkspaceHtml = await fetchText(`${baseUrl}/admin/workspaces`, {
            method: 'POST',
            headers: {
                accept: 'text/html',
                cookie: adminCookie,
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                name: workspaceName,
                slug: workspaceSlug,
                apiKeyLabel: 'Smoke ingestion key',
            }),
        })
        const workspaceApiKeyToken = extractProvisioningToken(createWorkspaceHtml, 'aqp_')
        assertIncludes(createWorkspaceHtml, `/auth/workspaces/${workspaceSlug}/api-keys/login`, 'workspace create action result')

        const createUserHtml = await fetchText(`${baseUrl}/admin/workspaces/${workspaceSlug}/users`, {
            method: 'POST',
            headers: {
                accept: 'text/html',
                cookie: adminCookie,
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                label: 'Smoke workspace owner',
                role: 'owner',
            }),
        })
        const workspaceUserToken = extractProvisioningToken(createUserHtml, 'aqu_')
        assertIncludes(createUserHtml, `/w/${workspaceSlug}/login`, 'workspace user create action result')

        const apiKeyExchangePage = await fetchText(`${baseUrl}/auth/workspaces/${workspaceSlug}/api-keys/login`)
        assertIncludes(apiKeyExchangePage, 'API key → ingestion JWT', 'api key exchange page')

        const apiKeyExchangeHtml = await fetchText(`${baseUrl}/auth/workspaces/${workspaceSlug}/api-keys/login`, {
            method: 'POST',
            headers: {
                accept: 'text/html',
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ token: workspaceApiKeyToken }),
        })
        const ingestionJwtFromHtml = extractJwtToken(apiKeyExchangeHtml)
        assertIncludes(apiKeyExchangeHtml, `/api/workspaces/${workspaceSlug}/ingestions`, 'api key html exchange result')
        assertTokenLooksLikeJwt(ingestionJwtFromHtml, 'html ingestion jwt')

        const workspaceLoginPage = await fetchText(`${baseUrl}/w/${workspaceSlug}/login`)
        assertIncludes(workspaceLoginPage, `Workspace: <strong>${workspaceSlug}</strong>`, 'workspace login page')

        const workspaceLoginResponse = await fetch(`${baseUrl}/auth/workspaces/${workspaceSlug}/users/login`, {
            method: 'POST',
            headers: {
                accept: 'text/html',
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ token: workspaceUserToken }),
            redirect: 'manual',
        })
        assertStatus(workspaceLoginResponse, 302, 'workspace form login')
        assertHeader(workspaceLoginResponse, 'location', `/w/${workspaceSlug}`, 'workspace form login redirect')
        const workspaceCookie = extractCookieHeader(workspaceLoginResponse, `${config.workspaceSessionCookiePrefix}_${workspaceSlug}`)

        const workspaceDashboardHtml = await fetchText(`${baseUrl}/w/${workspaceSlug}`, {
            headers: { cookie: workspaceCookie },
        })
        assertIncludes(workspaceDashboardHtml, 'AQA Pulse', 'workspace dashboard html via cookie')

        const adminJsonLogin = await fetchJson<JsonLoginResponse>(`${baseUrl}/auth/admin/login`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ token: adminToken }),
        })
        assertTokenLooksLikeJwt(adminJsonLogin.accessToken, 'admin json jwt')

        const workspaceDescriptor = await fetchJson<{ workspace: { slug: string } }>(`${baseUrl}/api/workspaces/${workspaceSlug}`, {
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${adminJsonLogin.accessToken}`,
            },
        })
        assert(workspaceDescriptor.workspace.slug === workspaceSlug, 'admin JWT должен открывать admin API routes.')

        const ingestionJsonLogin = await fetchJson<JsonLoginResponse>(`${baseUrl}/auth/workspaces/${workspaceSlug}/api-keys/login`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ token: workspaceApiKeyToken }),
        })
        assertTokenLooksLikeJwt(ingestionJsonLogin.accessToken, 'json ingestion jwt')

        const ingestionResult = await fetchJson<IngestionResponse>(`${baseUrl}/api/workspaces/${workspaceSlug}/ingestions`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${ingestionJsonLogin.accessToken}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                report,
                metadata: {
                    branch: 'main',
                    commit: scenarioId,
                    author: 'aqa-pulse smoke',
                },
                sourceFile: fixturePath,
            }),
        })
        assert(ingestionResult.workspace.slug === workspaceSlug, 'ingestion должен сохраняться в целевой workspace.')
        assert(Boolean(ingestionResult.runId), 'ingestion должен вернуть runId.')

        const workspaceJsonLogin = await fetchJson<JsonLoginResponse>(`${baseUrl}/auth/workspaces/${workspaceSlug}/users/login`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ token: workspaceUserToken }),
        })
        assertTokenLooksLikeJwt(workspaceJsonLogin.accessToken, 'json workspace read jwt')

        const summaryPayload = await fetchJson<Record<string, unknown>>(`${baseUrl}/api/workspaces/${workspaceSlug}/summary`, {
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${workspaceJsonLogin.accessToken}`,
            },
        })
        assert(typeof summaryPayload === 'object' && summaryPayload !== null, 'workspace summary должен возвращать JSON payload.')

        const workspaceHtmlViaJwt = await fetchText(`${baseUrl}/w/${workspaceSlug}`, {
            headers: {
                accept: 'text/html',
                authorization: `Bearer ${workspaceJsonLogin.accessToken}`,
            },
        })
        assertIncludes(workspaceHtmlViaJwt, 'AQA Pulse', 'workspace dashboard html via JWT')

        const workspaceLogoutResponse = await fetch(`${baseUrl}/auth/workspaces/${workspaceSlug}/users/logout`, {
            method: 'POST',
            headers: {
                accept: 'text/html',
                cookie: workspaceCookie,
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(),
            redirect: 'manual',
        })
        assertStatus(workspaceLogoutResponse, 302, 'workspace form logout')
        assertHeader(workspaceLogoutResponse, 'location', `/w/${workspaceSlug}/login`, 'workspace logout redirect')

        const adminLogoutResponse = await fetch(`${baseUrl}/auth/admin/logout`, {
            method: 'POST',
            headers: {
                accept: 'text/html',
                cookie: adminCookie,
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(),
            redirect: 'manual',
        })
        assertStatus(adminLogoutResponse, 302, 'admin form logout')
        assertHeader(adminLogoutResponse, 'location', '/admin/login', 'admin logout redirect')

        console.log(`Smoke auth/UI flow завершён успешно (${scenarioName}).`)
        console.log(`Storage driver: ${config.storageDriver}`)
        console.log(`Workspace slug: ${workspaceSlug}`)
        console.log(`Run id: ${ingestionResult.runId}`)
    } finally {
        await closeServer(server)

        if (process.env.AQA_PULSE_KEEP_SMOKE_DATA !== '1') {
            fs.rmSync(tempRoot, { recursive: true, force: true })
        }
    }
}

if (require.main === module) {
    runAuthFlowSmoke().catch((error) => {
        console.error(`Smoke auth/UI flow завершился ошибкой: ${getErrorMessage(error)}`)
        process.exitCode = 1
    })
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
    const response = await fetch(url, init)
    assertOk(response, `text response for ${url}`)
    return response.text()
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    assertOk(response, `json response for ${url}`)
    return response.json() as Promise<T>
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

function assertIncludes(value: string, expectedFragment: string, label: string): void {
    if (!value.includes(expectedFragment)) {
        throw new Error(`${label}: не найден обязательный фрагмент "${expectedFragment}".`)
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

function extractProvisioningToken(html: string, prefix: 'aqp_' | 'aqu_'): string {
    const match = html.match(new RegExp(`${prefix}[a-f0-9]+`, 'i'))

    if (!match) {
        throw new Error(`Не удалось найти provisioning token с префиксом ${prefix} в HTML action result.`)
    }

    return match[0]
}

function extractJwtToken(html: string): string {
    const match = html.match(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)

    if (!match) {
        throw new Error('Не удалось найти JWT token в HTML response.')
    }

    return match[0]
}

function assertTokenLooksLikeJwt(token: string, label: string): void {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
        throw new Error(`${label}: строка не похожа на JWT token.`)
    }
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

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

