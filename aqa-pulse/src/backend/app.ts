import * as fs from 'node:fs'
import * as path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { ApiStore, type ApiFilters } from '../api-store'
import { buildDashboardSummary, type ReporterRoot } from '../dashboard-utils'
import { injectFrontendBootstrap, type FrontendBootstrapData } from '../frontend-bootstrap'
import { createEmptyHistory } from '../history-utils'
import { getErrorMessage } from '../shared/error-utils'
import {
    createAdminGuard,
    createWorkspaceApiKeyGuard,
    createWorkspaceResolver,
    createWorkspaceUserGuard,
    extractAccessToken,
    getWorkspaceSessionCookieName,
    requireWorkspaceFromLocals,
} from './auth'
import { type SaasAppConfig, resolveSaasAppConfig } from './config'
import type { IngestionRequestPayload } from './contracts'
import { buildCookieHeader, buildExpiredCookieHeader, issueJwtToken, verifyJwtToken } from './jwt'
import { ingestReporterRun } from './run-ingestion.service'
import { createBackendStorage, type BackendStorage } from './storage'
import { WorkspaceRegistry } from './workspace-registry'

export function createSaasApp(options: Partial<SaasAppConfig> = {}): express.Express {
    const app = express()
    const config = resolveSaasAppConfig(options)
    const backendStorage = createBackendStorage(config)
    const registry = new WorkspaceRegistry(backendStorage.registry)
    const adminOnly = createAdminGuard(config)
    const workspaceResolver = createWorkspaceResolver(registry)
    const workspaceApiKeyGuard = createWorkspaceApiKeyGuard(registry, config)
    const workspaceUserGuard = createWorkspaceUserGuard(registry, config)
    const defaultStore = new ApiStore({
        storage: backendStorage.createDashboardReadStorage({
            summaryPath: path.join(config.distPath, 'dashboard-data.json'),
            historyPath: path.join(config.distPath, 'history.json'),
            archiveRootPath: config.legacyArchiveRootPath,
        }),
    })
    const distPath = config.distPath
    const distAssetsPath = path.resolve(distPath, './assets')
    const frontendDistPath = path.resolve(distPath, './web')
    const frontendTemplatePath = path.resolve(frontendDistPath, './index.html')
    const frontendTemplate = fs.existsSync(frontendTemplatePath)
        ? fs.readFileSync(frontendTemplatePath, 'utf8')
        : null

    app.use(express.json({ limit: config.requestBodyLimit }))
    app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }))
    app.use('/assets', express.static(distAssetsPath))
    app.use('/ui-assets', express.static(frontendDistPath))
    app.use('/static', express.static(distPath))
    app.use('/w/:slug/assets', express.static(distAssetsPath))

    app.get('/admin/login', (request: Request, response: Response) => {
        sendFrontendShell(response, frontendTemplate, {
            route: { kind: 'admin-login' },
            initialRequestUrl: request.originalUrl,
            initialDashboardSummary: null,
            initialTestHistoryPayload: null,
            initialAdminWorkspaces: null,
            initialSessionStatus: readAdminBootstrapSession(request, config),
        })
    })

    app.post('/auth/admin/login', (request: Request, response: Response) => {
        if (!config.adminToken) {
            response.status(400).json({ error: 'Admin token не настроен в конфигурации сервера.' })
            return
        }

        const providedToken = pickOptionalString(request.body?.token)

        if (!providedToken || providedToken !== config.adminToken) {
            response.status(401).json({ error: 'Неверный admin token.' })
            return
        }

        const issuedToken = issueJwtToken({
            subject: 'admin',
            kind: 'admin',
            scope: 'admin',
            secret: config.jwtSecret,
            ttlSeconds: config.accessTokenTtlSeconds,
        })

        response.setHeader('Set-Cookie', buildCookieHeader({
            name: config.adminSessionCookieName,
            value: issuedToken.token,
            maxAgeSeconds: config.accessTokenTtlSeconds,
        }))

        response.json({
            accessToken: issuedToken.token,
            expiresAt: new Date(issuedToken.claims.exp * 1000).toISOString(),
            scope: issuedToken.claims.scope,
        })
    })

    app.post('/auth/admin/logout', (_request: Request, response: Response) => {
        response.setHeader('Set-Cookie', buildExpiredCookieHeader(config.adminSessionCookieName))

        response.json({ status: 'ok' })
    })

    app.get('/auth/admin/session', (request: Request, response: Response, next: NextFunction) => {
        if (!config.adminToken) {
            response.json({ authenticated: true, authRequired: false, scope: 'admin' })
            return
        }

        next()
    }, adminOnly, (_request: Request, response: Response) => {
        response.json({ authenticated: true, authRequired: true, scope: 'admin' })
    })

    app.get('/admin', adminOnly, (request: Request, response: Response) => {
        sendFrontendShell(response, frontendTemplate, {
            route: { kind: 'admin-dashboard' },
            initialRequestUrl: request.originalUrl,
            initialDashboardSummary: null,
            initialTestHistoryPayload: null,
            initialAdminWorkspaces: registry.listWorkspaces(),
            initialSessionStatus: readAdminBootstrapSession(request, config),
        })
    })

    app.post('/admin/workspaces', adminOnly, (request: Request, response: Response) => {
        const name = pickOptionalString(request.body?.name)

        if (!name) {
            response.status(400).json({ error: 'Поле "name" обязательно.' })
            return
        }

        try {
            const createdWorkspace = registry.createWorkspace({
                name,
                slug: pickOptionalString(request.body?.slug) ?? undefined,
                apiKeyLabel: pickOptionalString(request.body?.apiKeyLabel) ?? undefined,
            })
            ensureWorkspaceReadModelInitialized(createdWorkspace.workspace.slug, backendStorage)

            response.status(201).json(createdWorkspace)
        } catch (error) {
            response.status(400).json({ error: getErrorMessage(error) })
        }
    })

    app.post('/admin/workspaces/:slug/api-keys', adminOnly, workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)

        try {
            const createdApiKey = registry.createApiKey(workspace.slug, pickOptionalString(request.body?.label) ?? 'Generated key')

            response.status(201).json(createdApiKey)
        } catch (error) {
            response.status(400).json({
                error: getErrorMessage(error),
                workspace: workspace.slug,
            })
        }
    })

    app.post('/admin/workspaces/:slug/users', adminOnly, workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const label = pickOptionalString(request.body?.label)

        if (!label) {
            response.status(400).json({ error: 'Поле "label" обязательно.' })
            return
        }

        try {
            const createdUser = registry.createUser(workspace.slug, {
                label,
                role: request.body?.role === 'owner' ? 'owner' : 'viewer',
            })

            response.status(201).json(createdUser)
        } catch (error) {
            response.status(400).json({
                error: getErrorMessage(error),
                workspace: workspace.slug,
            })
        }
    })

    app.get('/w/:slug/login', workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        sendFrontendShell(response, frontendTemplate, {
            route: { kind: 'workspace-login', workspaceSlug: workspace.slug },
            initialRequestUrl: request.originalUrl,
            initialDashboardSummary: null,
            initialTestHistoryPayload: null,
            initialAdminWorkspaces: null,
            initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, config),
        })
    })

    app.get('/auth/workspaces/:slug/api-keys/login', workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        sendFrontendShell(response, frontendTemplate, {
            route: { kind: 'workspace-api-key-exchange', workspaceSlug: workspace.slug },
            initialRequestUrl: request.originalUrl,
            initialDashboardSummary: null,
            initialTestHistoryPayload: null,
            initialAdminWorkspaces: null,
            initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, config),
        })
    })

    app.post('/auth/workspaces/:slug/users/login', workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const rawToken = pickOptionalString(request.body?.token)

        if (!rawToken) {
            response.status(401).json({ error: 'Нужно передать workspace user token.' })
            return
        }

        const authResult = registry.authenticateWorkspaceUser(rawToken)

        if (!authResult || authResult.workspace.slug !== workspace.slug) {
            response.status(401).json({ error: 'Неверный workspace user token.' })
            return
        }

        const issuedToken = issueJwtToken({
            subject: authResult.user.id,
            kind: 'workspace-user',
            scope: 'workspace:read',
            secret: config.jwtSecret,
            ttlSeconds: config.accessTokenTtlSeconds,
            workspaceSlug: workspace.slug,
            role: authResult.user.role,
        })

        response.setHeader('Set-Cookie', buildCookieHeader({
            name: getWorkspaceSessionCookieName(config, workspace.slug),
            value: issuedToken.token,
            maxAgeSeconds: config.accessTokenTtlSeconds,
            path: '/',
        }))

        response.json({
            accessToken: issuedToken.token,
            expiresAt: new Date(issuedToken.claims.exp * 1000).toISOString(),
            scope: issuedToken.claims.scope,
            workspace: workspace.slug,
        })
    })

    app.post('/auth/workspaces/:slug/api-keys/login', workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const rawToken = pickOptionalString(request.body?.token)

        if (!rawToken) {
            response.status(401).json({ error: 'Нужно передать workspace API key.' })
            return
        }

        const authResult = registry.authenticate(rawToken)

        if (!authResult || authResult.workspace.slug !== workspace.slug) {
            response.status(401).json({ error: 'Неверный workspace API key.' })
            return
        }

        const issuedToken = issueJwtToken({
            subject: authResult.apiKey.id,
            kind: 'workspace-api-key',
            scope: 'workspace:ingest',
            secret: config.jwtSecret,
            ttlSeconds: config.accessTokenTtlSeconds,
            workspaceSlug: workspace.slug,
        })

        response.json({
            accessToken: issuedToken.token,
            expiresAt: new Date(issuedToken.claims.exp * 1000).toISOString(),
            scope: issuedToken.claims.scope,
            workspace: workspace.slug,
        })
    })

    app.post('/auth/workspaces/:slug/users/logout', workspaceResolver, (_request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)

        response.setHeader('Set-Cookie', buildExpiredCookieHeader(getWorkspaceSessionCookieName(config, workspace.slug)))

        response.json({ status: 'ok' })
    })

    app.get('/auth/workspaces/:slug/session', workspaceResolver, (request: Request, response: Response, next: NextFunction) => {
        const workspace = requireWorkspaceFromLocals(response)

        if (!config.requireWorkspaceAuth) {
            response.json({
                authenticated: true,
                authRequired: false,
                scope: 'workspace:read',
                workspace: workspace.slug,
            })
            return
        }

        next()
    }, workspaceUserGuard, (_request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)

        response.json({
            authenticated: true,
            authRequired: true,
            scope: 'workspace:read',
            workspace: workspace.slug,
        })
    })

    app.get('/', (request: Request, response: Response) => {
        sendFrontendShell(response, frontendTemplate, {
            route: { kind: 'dashboard', workspaceSlug: null },
            initialRequestUrl: request.originalUrl,
            initialDashboardSummary: defaultStore.getFilteredSummary(getFiltersFromRequest(request)),
            initialTestHistoryPayload: null,
            initialAdminWorkspaces: null,
            initialSessionStatus: { scope: 'public', authenticated: true, authRequired: false, workspaceSlug: null },
        })
    })

    app.get('/api/health', (_request: Request, response: Response) => {
        response.json({ status: 'ok' })
    })

    app.get('/api/summary', (request: Request, response: Response) => {
        response.json(defaultStore.getFilteredSummary(getFiltersFromRequest(request)))
    })

    app.get('/api/runs', (request: Request, response: Response) => {
        response.json({ runs: defaultStore.getRuns(getFiltersFromRequest(request)) })
    })

    app.get('/api/run/:id', (request: Request, response: Response) => {
        const runId = getRouteParam(request, 'id')
        const run = defaultStore.getRunById(runId)

        if (!run) {
            response.status(404).json({ error: `Прогон с id "${runId}" не найден.` })
            return
        }

        response.json(run)
    })

    app.get('/api/flaky', (request: Request, response: Response) => {
        response.json(defaultStore.getFlakyPayload(getFiltersFromRequest(request)))
    })

    app.get('/api/errors/clusters', (request: Request, response: Response) => {
        response.json(defaultStore.getErrorClustersPayload(getFiltersFromRequest(request)))
    })

    app.get('/api/metrics/cost', (request: Request, response: Response) => {
        response.json(defaultStore.getCostMetricsPayload(getFiltersFromRequest(request)))
    })

    app.get('/api/artifacts/:runId', (request: Request, response: Response) => {
        sendArtifactFile(response, path.join(config.legacyArchiveRootPath, '_artifacts'), getRouteParam(request, 'runId'), pickOptionalString(request.query.path) ?? undefined)
    })

    app.get('/test/:name', (request: Request, response: Response) => {
        const testName = getRouteParam(request, 'name')
        const filters = getTestHistoryFiltersFromRequest(request)
        const payload = defaultStore.getTestHistory(testName, filters)

        sendFrontendShell(response, frontendTemplate, {
            route: { kind: 'test-history', workspaceSlug: null, testName },
            initialRequestUrl: request.originalUrl,
            initialDashboardSummary: null,
            initialTestHistoryPayload: payload,
            initialAdminWorkspaces: null,
            initialSessionStatus: { scope: 'public', authenticated: true, authRequired: false, workspaceSlug: null },
        }, getTestHistoryHtmlStatusCode(payload))
    })

    app.get('/api/test/:name', (request: Request, response: Response) => {
        const testName = getRouteParam(request, 'name')
        const payload = defaultStore.getTestHistory(testName, getTestHistoryFiltersFromRequest(request))

        if (!payload) {
            response.status(404).json({ error: `Тест с именем "${testName}" не найден в архивной истории.` })
            return
        }

        if ('candidates' in payload) {
            response.status(409).json(payload)
            return
        }

        response.json(payload)
    })

    app.post('/api/dev/bootstrap', ensureDevBootstrapEnabled(config), adminOnly, (request: Request, response: Response) => {
        const requestedName = pickOptionalString(request.body?.name) ?? 'Demo Workspace'
        const requestedSlug = pickOptionalString(request.body?.slug) ?? 'demo'
        const existingWorkspace = registry.getWorkspace(requestedSlug)

        if (!existingWorkspace) {
            const createdWorkspace = registry.createWorkspace({
                name: requestedName,
                slug: requestedSlug,
                apiKeyLabel: 'Bootstrap key',
            })
            response.status(201).json(createdWorkspace)
            return
        }

        response.json(registry.createApiKey(requestedSlug, 'Bootstrap key'))
    })

    app.get('/api/workspaces', adminOnly, (_request: Request, response: Response) => {
        response.json({ workspaces: registry.listWorkspaces() })
    })

    app.get('/api/workspaces/:slug', adminOnly, workspaceResolver, (_request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        response.json({ workspace })
    })

    app.post('/api/workspaces', adminOnly, (request: Request, response: Response) => {
        const name = pickOptionalString(request.body?.name)

        if (!name) {
            response.status(400).json({ error: 'Поле "name" обязательно.' })
            return
        }

        const createdWorkspace = registry.createWorkspace({
            name,
            slug: pickOptionalString(request.body?.slug) ?? undefined,
            apiKeyLabel: pickOptionalString(request.body?.apiKeyLabel) ?? undefined,
        })

        ensureWorkspaceReadModelInitialized(createdWorkspace.workspace.slug, backendStorage)

        response.status(201).json(createdWorkspace)
    })

    app.post('/api/workspaces/:slug/api-keys', adminOnly, workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        response.status(201).json(registry.createApiKey(workspace.slug, pickOptionalString(request.body?.label) ?? 'Generated key'))
    })

    app.post('/api/workspaces/:slug/users', adminOnly, workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const label = pickOptionalString(request.body?.label)

        if (!label) {
            response.status(400).json({ error: 'Поле "label" обязательно.' })
            return
        }

        response.status(201).json(registry.createUser(workspace.slug, {
            label,
            role: request.body?.role === 'owner' ? 'owner' : 'viewer',
        }))
    })

    app.post('/api/workspaces/:slug/ingestions', workspaceResolver, workspaceApiKeyGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)

        const payload = normalizeIngestionPayload(request.body)

        if (!payload) {
            response.status(400).json({ error: 'Ожидалось тело запроса вида { report, metadata?, sourceFile? } или сам Playwright JSON-репорт.' })
            return
        }

        const result = ingestReporterRun({
            workspace,
            storage: backendStorage.getWorkspaceStorage(workspace.slug),
            report: payload.report,
            metadata: payload.metadata,
            sourceFile: payload.sourceFile,
        })

        response.status(202).json(result)
    })

    app.get('/w/:slug', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)
        sendFrontendShell(response, frontendTemplate, {
            route: { kind: 'dashboard', workspaceSlug: workspace.slug },
            initialRequestUrl: request.originalUrl,
            initialDashboardSummary: store.getFilteredSummary(getFiltersFromRequest(request)),
            initialTestHistoryPayload: null,
            initialAdminWorkspaces: null,
            initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, config),
        })
    })

    app.get('/w/:slug/test/:name', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)
        const testName = getRouteParam(request, 'name')
        const filters = getTestHistoryFiltersFromRequest(request)
        const payload = store.getTestHistory(testName, filters)

        sendFrontendShell(response, frontendTemplate, {
            route: { kind: 'test-history', workspaceSlug: workspace.slug, testName },
            initialRequestUrl: request.originalUrl,
            initialDashboardSummary: null,
            initialTestHistoryPayload: payload,
            initialAdminWorkspaces: null,
            initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, config),
        }, getTestHistoryHtmlStatusCode(payload))
    })

    app.get('/api/workspaces/:slug/artifacts/:runId', workspaceResolver, workspaceUserGuard, (_request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const storage = backendStorage.getWorkspaceStorage(workspace.slug)
        sendArtifactFile(response, storage.paths.artifactsPath, getRouteParam(_request, 'runId'), pickOptionalString(_request.query.path) ?? undefined)
    })

    app.get('/api/workspaces/:slug/summary', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)
        response.json(store.getFilteredSummary(getFiltersFromRequest(request)))
    })

    app.get('/api/workspaces/:slug/runs', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)
        response.json({ runs: store.getRuns(getFiltersFromRequest(request)) })
    })

    app.get('/api/workspaces/:slug/run/:id', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)

        const runId = getRouteParam(request, 'id')
        const run = store.getRunById(runId)

        if (!run) {
            response.status(404).json({ error: `Прогон с id "${runId}" не найден.` })
            return
        }

        response.json(run)
    })

    app.get('/api/workspaces/:slug/flaky', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)
        response.json(store.getFlakyPayload(getFiltersFromRequest(request)))
    })

    app.get('/api/workspaces/:slug/errors/clusters', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)
        response.json(store.getErrorClustersPayload(getFiltersFromRequest(request)))
    })

    app.get('/api/workspaces/:slug/metrics/cost', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)
        response.json(store.getCostMetricsPayload(getFiltersFromRequest(request)))
    })

    app.get('/api/workspaces/:slug/test/:name', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)

        const testName = getRouteParam(request, 'name')
        const payload = store.getTestHistory(testName, getTestHistoryFiltersFromRequest(request))

        if (!payload) {
            response.status(404).json({ error: `Тест с именем "${testName}" не найден в архивной истории.` })
            return
        }

        if ('candidates' in payload) {
            response.status(409).json(payload)
            return
        }

        response.json(payload)
    })

    app.use((_request: Request, response: Response) => {
        response.status(404).json({ error: 'Endpoint не найден.' })
    })

    app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
        const message = error instanceof Error ? error.message : String(error)

        if (isPayloadTooLargeError(error)) {
            response.status(413).json({ error: 'request entity too large' })
            return
        }

        response.status(500).json({ error: message })
    })

    return app
}

function isPayloadTooLargeError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false
    }

    const maybeError = error as {
        type?: string
        status?: number
        statusCode?: number
        message?: string
    }

    return maybeError.type === 'entity.too.large'
        || maybeError.status === 413
        || maybeError.statusCode === 413
        || maybeError.message === 'request entity too large'
}

function sendFrontendShell(
    response: Response,
    htmlTemplate: string | null,
    bootstrap: FrontendBootstrapData,
    statusCode = 200,
): void {
    if (!htmlTemplate) {
        response.status(503).type('html').send(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>AQA Pulse UI unavailable</title></head><body><h1>React frontend не собран</h1><p>Запусти compile/build для aqa-pulse, чтобы получить dist/web/index.html.</p></body></html>`)
        return
    }

    response.status(statusCode).type('html').send(injectFrontendBootstrap(htmlTemplate, bootstrap))
}

function createWorkspaceApiStore(slug: string, backendStorage: BackendStorage): ApiStore {
    ensureWorkspaceReadModelInitialized(slug, backendStorage)

    return new ApiStore({
        storage: backendStorage.getWorkspaceStorage(slug),
    })
}

function ensureWorkspaceReadModelInitialized(slug: string, backendStorage: BackendStorage): void {
    const workspaceStorage = backendStorage.getWorkspaceStorage(slug)
    const history = workspaceStorage.readHistory()

    try {
        workspaceStorage.readSummary()
    } catch {
        workspaceStorage.writeSummary(buildDashboardSummary(
            {
                tests: [],
                durationMs: 0,
                environment: {
                    projects: [],
                },
            },
            `workspace://${slug}/initial-empty-summary`,
            history.runs,
            { branch: null, commit: null, author: null },
        ))
    }

    if (!Array.isArray(history.runs)) {
        workspaceStorage.writeHistory(createEmptyHistory())
    }
}

function getFiltersFromRequest(request: Request): ApiFilters {
    const branch = pickQueryParam(request, 'branch')
    const project = pickQueryParam(request, 'project')
    const file = pickQueryParam(request, 'file')

    return {
        branch: branch ?? undefined,
        project: project ?? undefined,
        file: file ?? undefined,
    }
}

function getTestHistoryFiltersFromRequest(request: Request): ApiFilters {
    return getFiltersFromRequest(request)
}

function getRouteParam(request: Request, key: string): string {
    const value = request.params[key]
    return Array.isArray(value) ? value[0] : value
}

function pickQueryParam(request: Request, key: string): string | null {
    const value = request.query[key]
    const normalizedValue = Array.isArray(value) ? value[0] : value
    return typeof normalizedValue === 'string' && normalizedValue.trim().length > 0 ? normalizedValue.trim() : null
}

function getTestHistoryHtmlStatusCode(payload: ReturnType<ApiStore['getTestHistory']>): number {
    if (!payload) {
        return 404
    }

    if ('candidates' in payload) {
        return 409
    }

    return 200
}

function readAdminBootstrapSession(request: Request, config: SaasAppConfig): FrontendBootstrapData['initialSessionStatus'] {
    if (!config.adminToken) {
        return { scope: 'admin', authenticated: true, authRequired: false, workspaceSlug: null }
    }

    const token = extractAccessToken(request, 'x-admin-token')
        ?? readCookieValue(request, config.adminSessionCookieName)
    const claims = token ? verifyJwtToken(token, config.jwtSecret) : null

    return {
        scope: 'admin',
        authenticated: claims?.scope === 'admin' && claims.kind === 'admin',
        authRequired: true,
        workspaceSlug: null,
    }
}

function readWorkspaceBootstrapSession(request: Request, workspaceSlug: string, config: SaasAppConfig): FrontendBootstrapData['initialSessionStatus'] {
    if (!config.requireWorkspaceAuth) {
        return { scope: 'workspace', authenticated: true, authRequired: false, workspaceSlug }
    }

    const adminToken = extractAccessToken(request, 'x-admin-token')
        ?? readCookieValue(request, config.adminSessionCookieName)
    const adminClaims = adminToken ? verifyJwtToken(adminToken, config.jwtSecret) : null

    if (adminClaims?.scope === 'admin' && adminClaims.kind === 'admin') {
        return { scope: 'workspace', authenticated: true, authRequired: true, workspaceSlug }
    }

    const workspaceToken = extractAccessToken(request, 'x-workspace-token')
        ?? readCookieValue(request, getWorkspaceSessionCookieName(config, workspaceSlug))
    const workspaceClaims = workspaceToken ? verifyJwtToken(workspaceToken, config.jwtSecret) : null

    return {
        scope: 'workspace',
        authenticated: workspaceClaims?.kind === 'workspace-user'
            && workspaceClaims.scope === 'workspace:read'
            && workspaceClaims.workspaceSlug === workspaceSlug,
        authRequired: true,
        workspaceSlug,
    }
}

function readCookieValue(request: Request, name: string): string | null {
    const cookieHeader = request.header('cookie')

    if (!cookieHeader) {
        return null
    }

    const cookiePart = cookieHeader
        .split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${name}=`))

    if (!cookiePart) {
        return null
    }

    return decodeURIComponent(cookiePart.slice(name.length + 1))
}

function ensureDevBootstrapEnabled(config: SaasAppConfig) {
    return (_request: Request, response: Response, next: NextFunction) => {
        if (!config.allowDevBootstrap) {
            response.status(404).json({ error: 'Dev bootstrap отключён в конфигурации сервера.' })
            return
        }

        next()
    }
}

function normalizeIngestionPayload(body: unknown): IngestionRequestPayload | null {
    if (!body || typeof body !== 'object') {
        return null
    }

    const bodyRecord = body as Record<string, unknown>
    const explicitReport = bodyRecord.report

    if (explicitReport && isReporterRoot(explicitReport)) {
        return {
            report: explicitReport,
            sourceFile: pickOptionalString(bodyRecord.sourceFile) ?? undefined,
            metadata: normalizeMetadata(bodyRecord.metadata),
        }
    }

    if (isReporterRoot(bodyRecord)) {
        return {
            report: bodyRecord,
            metadata: undefined,
        }
    }

    return null
}

function isReporterRoot(value: unknown): value is ReporterRoot {
    if (!value || typeof value !== 'object') {
        return false
    }

    const maybeReporter = value as Record<string, unknown>
    return Array.isArray(maybeReporter.tests)
}

function normalizeMetadata(value: unknown): IngestionRequestPayload['metadata'] | undefined {
    if (!value || typeof value !== 'object') {
        return undefined
    }

    const metadata = value as Record<string, unknown>
    return {
        branch: pickOptionalString(metadata.branch) ?? undefined,
        commit: pickOptionalString(metadata.commit) ?? undefined,
        author: pickOptionalString(metadata.author) ?? undefined,
    }
}

function pickOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function sendArtifactFile(response: Response, artifactsRootPath: string, runId: string, requestedPath: string | undefined): void {
    if (!requestedPath) {
        response.status(400).json({ error: 'Нужно передать query-параметр path.' })
        return
    }

    const normalizedRunDirectory = normalizeRunDirectory(runId)
    const normalizedRequestedPath = requestedPath.replace(/\\/g, '/').replace(/^\/+/, '')

    if (!normalizedRequestedPath.startsWith(`${normalizedRunDirectory}/`) || normalizedRequestedPath.includes('..')) {
        response.status(400).json({ error: 'Некорректный путь к артефакту.' })
        return
    }

    const resolvedRoot = path.resolve(artifactsRootPath)
    const resolvedPath = path.resolve(resolvedRoot, normalizedRequestedPath)

    if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`) && resolvedPath !== resolvedRoot) {
        response.status(400).json({ error: 'Некорректный путь к артефакту.' })
        return
    }

    if (!fs.existsSync(resolvedPath)) {
        response.status(404).json({ error: 'Артефакт не найден.' })
        return
    }

    response.sendFile(resolvedPath)
}

function normalizeRunDirectory(runId: string): string {
    return runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'run'
}


