/**
 * Назначение: сквозная smoke-проверка сценариев входа для admin и workspace,
 * а также начальных данных интерфейса в self-hosted режиме.
 */
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'
import { loadReporterReport, type PrecomputedCodeQualitySourceFacts, type ReporterRoot } from '../dashboard-utils'
import { parseFrontendBootstrap, type FrontendBootstrapData, type FrontendSessionStatus } from '../frontend-bootstrap'
import { getErrorMessage } from '../shared/error-utils'
import { createSaasApp } from './app'
import { type WorkspaceProvisioningResult, type WorkspaceUserProvisioningResult } from './contracts'
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

interface SessionResponse {
    authenticated: boolean
    authRequired: boolean
    scope: string
    workspace?: string
}

interface JsonErrorResponse {
    error: string
}

interface JsonResponse<T> {
    response: Response
    payload: T | null
}

/**
 * Прогоняет основной успешный сценарий и ключевые проверки защиты:
 * вход администратора, создание workspace, вход пользователя, загрузку отчёта
 * и доступ к интерфейсу и API с корректными начальными данными.
 */
export async function runAuthFlowSmoke(options: AuthFlowSmokeOptions = {}): Promise<void> {
    const scenarioName = options.scenarioName ?? 'auth-flow'
    const scenarioId = `${scenarioName}-${Date.now()}`
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `aqa-pulse-${scenarioName}-`))
    const adminToken = options.configOverrides?.adminToken ?? 'smoke-admin-token'
    const distPath = options.configOverrides?.distPath ?? path.resolve(__dirname, '../../dist')
    const config = resolveSaasAppConfig({
        adminToken,
        jwtSecret: 'smoke-jwt-secret',
        accessTokenTtlSeconds: 60 * 10,
        allowDevBootstrap: false,
        requireWorkspaceAuth: true,
        dataRoot: options.configOverrides?.dataRoot ?? path.join(tempRoot, 'data'),
        distPath,
        archiveRootPath: options.configOverrides?.archiveRootPath ?? path.join(tempRoot, 'history'),
        ...options.configOverrides,
    })
    const fixturePath = path.resolve(__dirname, '../../fixtures/sample-llm-report.json')
    const report = loadReporterReport(fixturePath)
    const sampleTestTitle = requireFirstTestTitle(report)
    const workspaceSlug = normalizeSlug(`smoke-${scenarioId}`)
    const workspaceName = `Smoke ${scenarioId}`

    assert(fs.existsSync(path.resolve(config.distPath, 'web', 'index.html')), 'Для auth smoke нужен собранный frontend template в dist/web/index.html.')

    fs.mkdirSync(config.dataRoot, { recursive: true })
    fs.mkdirSync(config.archiveRootPath, { recursive: true })

    const app = createSaasApp(config)
    const server = await listen(app)
    const address = server.address()

    if (!address || typeof address === 'string') {
        throw new Error('Не удалось определить адрес временного smoke-сервера.')
    }

    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
        const adminLoginPage = await fetchText(`${baseUrl}/admin/login`)
        const adminLoginBootstrap = extractBootstrapFromHtml(adminLoginPage)
        assert(adminLoginBootstrap.route.kind === 'admin-login', 'admin login shell должен содержать route.kind=admin-login.')
        assertBootstrapSession(adminLoginBootstrap.initialSessionStatus, {
            scope: 'admin',
            authenticated: false,
            authRequired: true,
            workspaceSlug: null,
        }, 'admin login bootstrap')

        const adminDashboardBeforeLogin = await fetch(`${baseUrl}/admin`, {
            headers: { accept: 'application/json' },
            redirect: 'manual',
        })
        assertStatus(adminDashboardBeforeLogin, 302, 'admin dashboard before login')
        assertHeader(adminDashboardBeforeLogin, 'location', '/admin/login', 'admin dashboard redirect before login')

        const adminSessionBeforeLogin = await fetchJsonResponse<JsonErrorResponse>(`${baseUrl}/auth/admin/session`, {
            headers: { accept: 'application/json' },
        })
        assertStatus(adminSessionBeforeLogin.response, 401, 'admin session before login')
        assertIncludes(requirePayload(adminSessionBeforeLogin, 'admin session before login').error, 'admin session', 'admin session unauthorized error')

        const adminSessionHtmlAcceptBeforeLogin = await fetchJsonResponse<JsonErrorResponse>(`${baseUrl}/auth/admin/session`, {
            headers: { accept: 'text/html' },
        })
        assertStatus(adminSessionHtmlAcceptBeforeLogin.response, 401, 'admin session before login with html accept')
        assertIncludes(requirePayload(adminSessionHtmlAcceptBeforeLogin, 'admin session before login with html accept').error, 'admin session', 'admin session unauthorized error with html accept')

        const adminLoginResult = await fetchJsonResponse<JsonLoginResponse>(`${baseUrl}/auth/admin/login`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ token: adminToken }),
        })
        assertStatus(adminLoginResult.response, 200, 'admin json login')
        const adminJsonLogin = requirePayload(adminLoginResult, 'admin json login')
        assertTokenLooksLikeJwt(adminJsonLogin.accessToken, 'admin json jwt')
        const adminCookie = extractCookieHeader(adminLoginResult.response, config.adminSessionCookieName)

        const adminSessionViaCookie = await fetchJson<SessionResponse>(`${baseUrl}/auth/admin/session`, {
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
            },
        })
        assertSessionPayload(adminSessionViaCookie, {
            authenticated: true,
            authRequired: true,
            scope: 'admin',
        }, 'admin session via cookie')

        const adminDashboardHtml = await fetchText(`${baseUrl}/admin`, {
            headers: { accept: 'text/html', cookie: adminCookie },
        })
        const adminDashboardBootstrap = extractBootstrapFromHtml(adminDashboardHtml)
        assert(adminDashboardBootstrap.route.kind === 'admin-dashboard', 'admin dashboard shell должен содержать route.kind=admin-dashboard.')
        assertBootstrapSession(adminDashboardBootstrap.initialSessionStatus, {
            scope: 'admin',
            authenticated: true,
            authRequired: true,
            workspaceSlug: null,
        }, 'admin dashboard bootstrap')
        assert(Array.isArray(adminDashboardBootstrap.initialAdminWorkspaces), 'admin dashboard shell должен содержать initialAdminWorkspaces.')

        const createWorkspaceResult = await fetchJsonResponse<WorkspaceProvisioningResult>(`${baseUrl}/admin/workspaces`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                name: workspaceName,
                slug: workspaceSlug,
                apiKeyLabel: 'Smoke ingestion key',
            }),
        })
        assertStatus(createWorkspaceResult.response, 201, 'create workspace')
        const createdWorkspace = requirePayload(createWorkspaceResult, 'create workspace')
        const workspaceApiKeyToken = createdWorkspace.apiKey.token
        assert(workspaceApiKeyToken.startsWith('aqp_'), 'create workspace должен вернуть plaintext API key.')

        const createApiKeyResult = await fetchJsonResponse<WorkspaceProvisioningResult>(`${baseUrl}/admin/workspaces/${workspaceSlug}/api-keys`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ label: 'Secondary smoke ingestion key' }),
        })
        assertStatus(createApiKeyResult.response, 201, 'create workspace api key')
        const secondaryApiKey = requirePayload(createApiKeyResult, 'create workspace api key')
        assert(secondaryApiKey.apiKey.token.startsWith('aqp_'), 'create api key должен вернуть plaintext API key.')

        const createUserResult = await fetchJsonResponse<WorkspaceUserProvisioningResult>(`${baseUrl}/admin/workspaces/${workspaceSlug}/users`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                label: 'Smoke workspace owner',
                role: 'owner',
            }),
        })
        assertStatus(createUserResult.response, 201, 'create workspace user')
        const createdUser = requirePayload(createUserResult, 'create workspace user')
        const workspaceUserToken = createdUser.user.token
        assert(workspaceUserToken.startsWith('aqu_'), 'create user должен вернуть plaintext workspace user token.')

        const workspaceDescriptor = await fetchJson<{ workspace: { slug: string } }>(`${baseUrl}/api/workspaces/${workspaceSlug}`, {
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${adminJsonLogin.accessToken}`,
            },
        })
        assert(workspaceDescriptor.workspace.slug === workspaceSlug, 'admin JWT должен открывать admin API routes.')

        const workspaceLoginPage = await fetchText(`${baseUrl}/w/${workspaceSlug}/login`)
        const workspaceLoginBootstrap = extractBootstrapFromHtml(workspaceLoginPage)
        assert(workspaceLoginBootstrap.route.kind === 'workspace-login', 'workspace login shell должен содержать route.kind=workspace-login.')
        assert(workspaceLoginBootstrap.route.workspaceSlug === workspaceSlug, 'workspace login shell должен содержать корректный workspaceSlug.')
        assert(workspaceLoginBootstrap.route.workspaceName === createdWorkspace.workspace.name, 'workspace login shell должен содержать имя workspace для login страницы.')
        assertBootstrapSession(workspaceLoginBootstrap.initialSessionStatus, {
            scope: 'workspace',
            authenticated: false,
            authRequired: true,
            workspaceSlug,
        }, 'workspace login bootstrap')

        const apiKeyExchangePage = await fetchText(`${baseUrl}/auth/workspaces/${workspaceSlug}/api-keys/login`)
        const apiKeyExchangeBootstrap = extractBootstrapFromHtml(apiKeyExchangePage)
        assert(apiKeyExchangeBootstrap.route.kind === 'workspace-api-key-exchange', 'api key exchange shell должен содержать route.kind=workspace-api-key-exchange.')
        assert(apiKeyExchangeBootstrap.route.workspaceSlug === workspaceSlug, 'api key exchange shell должен содержать корректный workspaceSlug.')
        assertBootstrapSession(apiKeyExchangeBootstrap.initialSessionStatus, {
            scope: 'workspace',
            authenticated: false,
            authRequired: true,
            workspaceSlug,
        }, 'workspace api key exchange bootstrap')

        const workspaceDashboardBeforeLogin = await fetch(`${baseUrl}/w/${workspaceSlug}`, {
            headers: { accept: 'application/json' },
            redirect: 'manual',
        })
        assertStatus(workspaceDashboardBeforeLogin, 302, 'workspace dashboard before login')
        assertHeader(workspaceDashboardBeforeLogin, 'location', `/w/${workspaceSlug}/login`, 'workspace dashboard redirect before login')

        const workspaceSessionBeforeLogin = await fetchJsonResponse<JsonErrorResponse>(`${baseUrl}/auth/workspaces/${workspaceSlug}/session`, {
            headers: { accept: 'application/json' },
        })
        assertStatus(workspaceSessionBeforeLogin.response, 401, 'workspace session before login')
        assertIncludes(requirePayload(workspaceSessionBeforeLogin, 'workspace session before login').error, 'workspace session', 'workspace session unauthorized error')

        const workspaceSummaryBeforeLogin = await fetchJsonResponse<JsonErrorResponse>(`${baseUrl}/api/workspaces/${workspaceSlug}/summary`, {
            headers: { accept: 'application/json' },
        })
        assertStatus(workspaceSummaryBeforeLogin.response, 401, 'workspace summary before login')
        assertIncludes(requirePayload(workspaceSummaryBeforeLogin, 'workspace summary before login').error, 'workspace session', 'workspace summary unauthorized error')

        const workspaceSummaryHtmlAcceptBeforeLogin = await fetchJsonResponse<JsonErrorResponse>(`${baseUrl}/api/workspaces/${workspaceSlug}/summary`, {
            headers: { accept: 'text/html' },
        })
        assertStatus(workspaceSummaryHtmlAcceptBeforeLogin.response, 401, 'workspace summary before login with html accept')
        assertIncludes(requirePayload(workspaceSummaryHtmlAcceptBeforeLogin, 'workspace summary before login with html accept').error, 'workspace session', 'workspace summary unauthorized error with html accept')

        const workspaceHistoryBeforeLogin = await fetchJsonResponse<JsonErrorResponse>(`${baseUrl}/api/workspaces/${workspaceSlug}/test/${encodeURIComponent(sampleTestTitle)}`, {
            headers: { accept: 'application/json' },
        })
        assertStatus(workspaceHistoryBeforeLogin.response, 401, 'workspace test history before login')
        assertIncludes(requirePayload(workspaceHistoryBeforeLogin, 'workspace test history before login').error, 'workspace session', 'workspace history unauthorized error')

        const workspaceSessionViaAdmin = await fetchJson<SessionResponse>(`${baseUrl}/auth/workspaces/${workspaceSlug}/session`, {
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
            },
        })
        assertSessionPayload(workspaceSessionViaAdmin, {
            authenticated: true,
            authRequired: true,
            scope: 'workspace:read',
            workspace: workspaceSlug,
        }, 'workspace session via admin cookie')

        const workspaceHtmlViaAdmin = await fetchText(`${baseUrl}/w/${workspaceSlug}`, {
            headers: {
                accept: 'text/html',
                cookie: adminCookie,
            },
        })
        const workspaceAdminBootstrap = extractBootstrapFromHtml(workspaceHtmlViaAdmin)
        assert(workspaceAdminBootstrap.route.kind === 'dashboard', 'workspace dashboard shell via admin cookie должен содержать route.kind=dashboard.')
        assert(workspaceAdminBootstrap.route.workspaceSlug === workspaceSlug, 'workspace dashboard shell via admin cookie должен содержать workspaceSlug.')
        assertBootstrapSession(workspaceAdminBootstrap.initialSessionStatus, {
            scope: 'workspace',
            authenticated: true,
            authRequired: true,
            workspaceSlug,
        }, 'workspace dashboard bootstrap via admin cookie')

        const ingestionLoginResult = await fetchJsonResponse<JsonLoginResponse>(`${baseUrl}/auth/workspaces/${workspaceSlug}/api-keys/login`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ token: workspaceApiKeyToken }),
        })
        assertStatus(ingestionLoginResult.response, 200, 'workspace api key login')
        const ingestionJsonLogin = requirePayload(ingestionLoginResult, 'workspace api key login')
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
                precomputedSourceFacts: buildSmokeSourceFacts(report),
            }),
        })
        assert(ingestionResult.workspace.slug === workspaceSlug, 'ingestion должен сохраняться в целевой workspace.')
        assert(Boolean(ingestionResult.runId), 'ingestion должен вернуть runId.')

        const workspaceLoginResult = await fetchJsonResponse<JsonLoginResponse>(`${baseUrl}/auth/workspaces/${workspaceSlug}/users/login`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ token: workspaceUserToken }),
        })
        assertStatus(workspaceLoginResult.response, 200, 'workspace user login')
        const workspaceJsonLogin = requirePayload(workspaceLoginResult, 'workspace user login')
        assertTokenLooksLikeJwt(workspaceJsonLogin.accessToken, 'json workspace read jwt')
        const workspaceCookie = extractCookieHeader(workspaceLoginResult.response, `${config.workspaceSessionCookiePrefix}_${workspaceSlug}`)

        const workspaceSessionViaCookie = await fetchJson<SessionResponse>(`${baseUrl}/auth/workspaces/${workspaceSlug}/session`, {
            headers: {
                accept: 'application/json',
                cookie: workspaceCookie,
            },
        })
        assertSessionPayload(workspaceSessionViaCookie, {
            authenticated: true,
            authRequired: true,
            scope: 'workspace:read',
            workspace: workspaceSlug,
        }, 'workspace session via cookie')

        const summaryPayload = await fetchJson<Record<string, unknown>>(`${baseUrl}/api/workspaces/${workspaceSlug}/summary`, {
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${workspaceJsonLogin.accessToken}`,
            },
        })
        assert(typeof summaryPayload === 'object' && summaryPayload !== null, 'workspace summary должен возвращать JSON payload.')
        const codeQualityPayload = summaryPayload.codeQuality as Record<string, unknown> | undefined
        assert(codeQualityPayload && typeof codeQualityPayload === 'object', 'workspace summary должен содержать codeQuality payload.')
        assert(typeof codeQualityPayload.matchedTests === 'number' && codeQualityPayload.matchedTests > 0, 'precomputed source facts должны давать matchedTests > 0 в codeQuality.')
        assert(typeof codeQualityPayload.sourceCoveragePercent === 'number' && codeQualityPayload.sourceCoveragePercent > 0, 'precomputed source facts должны давать sourceCoveragePercent > 0.')

        const historyPayload = await fetchJson<Record<string, unknown>>(`${baseUrl}/api/workspaces/${workspaceSlug}/test/${encodeURIComponent(sampleTestTitle)}`, {
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${workspaceJsonLogin.accessToken}`,
            },
        })
        assert(typeof historyPayload === 'object' && historyPayload !== null, 'workspace test history должен возвращать JSON payload.')

        const workspaceHistoryHtml = await fetchText(`${baseUrl}/w/${workspaceSlug}/test/${encodeURIComponent(sampleTestTitle)}`, {
            headers: {
                accept: 'text/html',
                authorization: `Bearer ${workspaceJsonLogin.accessToken}`,
            },
        })
        const workspaceHistoryBootstrap = extractBootstrapFromHtml(workspaceHistoryHtml)
        assert(workspaceHistoryBootstrap.route.kind === 'test-history', 'workspace history shell должен содержать route.kind=test-history.')
        assert(workspaceHistoryBootstrap.route.workspaceSlug === workspaceSlug, 'workspace history shell должен содержать workspaceSlug.')
        assert(workspaceHistoryBootstrap.route.testName === sampleTestTitle, 'workspace history shell должен содержать testName.')
        assertBootstrapSession(workspaceHistoryBootstrap.initialSessionStatus, {
            scope: 'workspace',
            authenticated: true,
            authRequired: true,
            workspaceSlug,
        }, 'workspace history bootstrap')
        assert(workspaceHistoryBootstrap.initialTestHistoryPayload !== null, 'workspace history shell должен содержать initialTestHistoryPayload.')

        const workspaceHtmlViaJwt = await fetchText(`${baseUrl}/w/${workspaceSlug}`, {
            headers: {
                accept: 'text/html',
                authorization: `Bearer ${workspaceJsonLogin.accessToken}`,
            },
        })
        const workspaceDashboardBootstrap = extractBootstrapFromHtml(workspaceHtmlViaJwt)
        assert(workspaceDashboardBootstrap.route.kind === 'dashboard', 'workspace dashboard shell должен содержать route.kind=dashboard.')
        assert(workspaceDashboardBootstrap.route.workspaceSlug === workspaceSlug, 'workspace dashboard shell должен содержать workspaceSlug.')
        assertBootstrapSession(workspaceDashboardBootstrap.initialSessionStatus, {
            scope: 'workspace',
            authenticated: true,
            authRequired: true,
            workspaceSlug,
        }, 'workspace dashboard bootstrap via jwt')
        assert(workspaceDashboardBootstrap.initialDashboardSummary !== null, 'workspace dashboard shell должен содержать initialDashboardSummary.')

        const workspaceLogoutResult = await fetchJsonResponse<{ status: string }>(`${baseUrl}/auth/workspaces/${workspaceSlug}/users/logout`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                cookie: workspaceCookie,
            },
        })
        assertStatus(workspaceLogoutResult.response, 200, 'workspace logout')
        assert(requirePayload(workspaceLogoutResult, 'workspace logout').status === 'ok', 'workspace logout должен вернуть status=ok.')

        const workspaceSessionAfterLogout = await fetchJsonResponse<JsonErrorResponse>(`${baseUrl}/auth/workspaces/${workspaceSlug}/session`, {
            headers: { accept: 'application/json' },
        })
        assertStatus(workspaceSessionAfterLogout.response, 401, 'workspace session after logout')

        const workspaceSummaryAfterLogout = await fetchJsonResponse<JsonErrorResponse>(`${baseUrl}/api/workspaces/${workspaceSlug}/summary`, {
            headers: { accept: 'application/json' },
        })
        assertStatus(workspaceSummaryAfterLogout.response, 401, 'workspace summary after logout')

        const workspaceDashboardAfterLogout = await fetch(`${baseUrl}/w/${workspaceSlug}`, {
            headers: { accept: 'text/html' },
            redirect: 'manual',
        })
        assertStatus(workspaceDashboardAfterLogout, 302, 'workspace dashboard after logout')
        assertHeader(workspaceDashboardAfterLogout, 'location', `/w/${workspaceSlug}/login`, 'workspace dashboard redirect after logout')

        const adminLogoutResult = await fetchJsonResponse<{ status: string }>(`${baseUrl}/auth/admin/logout`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                cookie: adminCookie,
            },
        })
        assertStatus(adminLogoutResult.response, 200, 'admin logout')
        assert(requirePayload(adminLogoutResult, 'admin logout').status === 'ok', 'admin logout должен вернуть status=ok.')

        const adminSessionAfterLogout = await fetchJsonResponse<JsonErrorResponse>(`${baseUrl}/auth/admin/session`, {
            headers: { accept: 'application/json' },
        })
        assertStatus(adminSessionAfterLogout.response, 401, 'admin session after logout')

        const adminDashboardAfterLogout = await fetch(`${baseUrl}/admin`, {
            headers: { accept: 'text/html' },
            redirect: 'manual',
        })
        assertStatus(adminDashboardAfterLogout, 302, 'admin dashboard after logout')
        assertHeader(adminDashboardAfterLogout, 'location', '/admin/login', 'admin dashboard redirect after logout')

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

/**
 * React shell передаёт bootstrap через inline script, поэтому smoke читает HTML как есть и валидирует именно тот контракт, который увидит браузер до гидрации.
 */
function extractBootstrapFromHtml(html: string): FrontendBootstrapData {
    const scriptMatch = html.match(/<script[^>]*id=(['"])aqa-pulse-bootstrap\1[^>]*>([\s\S]*?)<\/script>/i)

    if (!scriptMatch) {
        throw new Error('Не удалось найти <script id="aqa-pulse-bootstrap"> в HTML shell.')
    }

    return parseFrontendBootstrap(scriptMatch[2])
}

/**
 * Сверяет initialSessionStatus из bootstrap отдельно от JSON session endpoint, чтобы не пропустить рассинхрон между SSR-shell и последующими API-вызовами клиента.
 */
function assertBootstrapSession(actual: FrontendSessionStatus | null, expected: FrontendSessionStatus, label: string): void {
    assert(actual !== null, `${label}: initialSessionStatus должен присутствовать.`)
    assert(actual.scope === expected.scope, `${label}: ожидался scope=${expected.scope}, получен ${actual.scope}.`)
    assert(actual.authenticated === expected.authenticated, `${label}: ожидался authenticated=${expected.authenticated}, получен ${actual.authenticated}.`)
    assert(actual.authRequired === expected.authRequired, `${label}: ожидался authRequired=${expected.authRequired}, получен ${actual.authRequired}.`)
    assert(actual.workspaceSlug === expected.workspaceSlug, `${label}: ожидался workspaceSlug=${expected.workspaceSlug}, получен ${actual.workspaceSlug}.`)
}

function assertSessionPayload(
    actual: SessionResponse,
    expected: { authenticated: boolean; authRequired: boolean; scope: string; workspace?: string },
    label: string,
): void {
    assert(actual.authenticated === expected.authenticated, `${label}: ожидался authenticated=${expected.authenticated}, получен ${actual.authenticated}.`)
    assert(actual.authRequired === expected.authRequired, `${label}: ожидался authRequired=${expected.authRequired}, получен ${actual.authRequired}.`)
    assert(actual.scope === expected.scope, `${label}: ожидался scope=${expected.scope}, получен ${actual.scope}.`)

    if ('workspace' in expected) {
        assert(actual.workspace === expected.workspace, `${label}: ожидался workspace=${expected.workspace}, получен ${actual.workspace}.`)
    }
}

function requireFirstTestTitle(report: ReporterRoot): string {
    const title = report.tests?.[0]?.title
    assert(typeof title === 'string' && title.length > 0, 'fixture report должен содержать хотя бы один тест с title.')
    return title
}

function buildSmokeSourceFacts(report: ReporterRoot): PrecomputedCodeQualitySourceFacts {
    const fileFacts = new Map<string, PrecomputedCodeQualitySourceFacts['files'][number]>()

    for (const [index, test] of (report.tests ?? []).entries()) {
        const filePath = typeof test.location?.file === 'string' ? test.location.file.trim() : ''

        if (!filePath) {
            continue
        }

        const existingFileFacts = fileFacts.get(filePath) ?? {
            file: filePath,
            tests: [],
            hasPomImports: true,
            beforeAllCount: 0,
            beforeEachCount: 1,
            serialModeCount: 0,
            topLevelMutableStateCount: 0,
        }
        const startLine = typeof test.location?.line === 'number' && Number.isFinite(test.location.line)
            ? Math.max(1, Math.trunc(test.location.line))
            : (index + 1) * 10

        existingFileFacts.tests.push({
            startLine,
            endLine: startLine + 4,
            title: typeof test.title === 'string' ? test.title : null,
            assertionCount: 2,
            smartWaitCount: 1,
            hardWaitCount: 0,
            stepCount: 2,
            directLocatorCount: 0,
            directPageActionCount: 1,
            stableSelectorCount: 1,
            textSelectorCount: 0,
            fragileSelectorCount: 0,
            pomReferenceCount: 1,
            pomFixtureReferenceCount: 0,
            sharedStateMutationCount: 0,
            usesPom: true,
        })

        fileFacts.set(filePath, existingFileFacts)
    }

    return {
        schemaVersion: 1,
        analyzerVersion: 'auth-flow-smoke',
        files: [...fileFacts.values()],
    }
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

/**
 * Некоторые платформы могут склеивать несколько Set-Cookie значений в один header, поэтому smoke извлекает нужный cookie по имени, а не полагается на позицию в строке.
 */
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


