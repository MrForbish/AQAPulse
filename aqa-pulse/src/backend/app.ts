import * as path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { ApiStore, type ApiFilters } from '../api-store'
import { buildDashboardSummary, type ReporterRoot } from '../dashboard-utils'
import { createEmptyHistory } from '../history-utils'
import { renderDashboardHtml } from '../render-dashboard'
import { renderTestHistoryHtml } from '../render-test-history'
import {
    type AdminDashboardActionResult,
    renderAdminDashboardHtml,
    renderAdminLoginHtml,
    renderWorkspaceApiKeyExchangeHtml,
    renderWorkspaceLoginHtml,
} from './admin-ui'
import {
    createAdminGuard,
    createWorkspaceApiKeyGuard,
    createWorkspaceResolver,
    createWorkspaceUserGuard,
    getWorkspaceSessionCookieName,
    requireWorkspaceFromLocals,
} from './auth'
import { type SaasAppConfig, resolveSaasAppConfig } from './config'
import type { IngestionRequestPayload } from './contracts'
import { buildCookieHeader, buildExpiredCookieHeader, issueJwtToken } from './jwt'
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

    app.use(express.json({ limit: '25mb' }))
    app.use(express.urlencoded({ extended: true }))
    app.use('/assets', express.static(distAssetsPath))
    app.use('/static', express.static(distPath))
    app.use('/w/:slug/assets', express.static(distAssetsPath))

    app.get('/admin/login', (_request: Request, response: Response) => {
        response.type('html').send(renderAdminLoginHtml())
    })

    app.post('/auth/admin/login', (request: Request, response: Response) => {
        if (!config.adminToken) {
            if (expectsFormResponse(request)) {
                response.status(400).type('html').send(renderAdminLoginHtml('Admin token не настроен в конфигурации сервера.'))
                return
            }

            response.status(400).json({ error: 'Admin token не настроен в конфигурации сервера.' })
            return
        }

        const providedToken = pickOptionalString(request.body?.token)

        if (!providedToken || providedToken !== config.adminToken) {
            if (expectsFormResponse(request)) {
                response.status(401).type('html').send(renderAdminLoginHtml('Неверный admin token.'))
                return
            }

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

        if (expectsFormResponse(request)) {
            response.redirect('/admin')
            return
        }

        response.json({
            accessToken: issuedToken.token,
            expiresAt: new Date(issuedToken.claims.exp * 1000).toISOString(),
            scope: issuedToken.claims.scope,
        })
    })

    app.post('/auth/admin/logout', (_request: Request, response: Response) => {
        response.setHeader('Set-Cookie', buildExpiredCookieHeader(config.adminSessionCookieName))

        if (expectsFormResponse(_request)) {
            response.redirect('/admin/login')
            return
        }

        response.json({ status: 'ok' })
    })

    app.get('/admin', adminOnly, (_request: Request, response: Response) => {
        response.type('html').send(renderAdminDashboardHtml({ workspaces: registry.listWorkspaces() }))
    })

    app.post('/admin/workspaces', adminOnly, (request: Request, response: Response) => {
        const name = pickOptionalString(request.body?.name)

        if (!name) {
            sendAdminDashboardHtml(response, registry, {
                statusCode: 400,
                actionResult: {
                    tone: 'error',
                    title: 'Ошибка создания workspace',
                    details: { error: 'Поле name обязательно.' },
                },
            })
            return
        }

        try {
            const createdWorkspace = registry.createWorkspace({
                name,
                slug: pickOptionalString(request.body?.slug) ?? undefined,
                apiKeyLabel: pickOptionalString(request.body?.apiKeyLabel) ?? undefined,
            })
            ensureWorkspaceReadModelInitialized(createdWorkspace.workspace.slug, backendStorage)

            sendAdminDashboardHtml(response, registry, {
                actionResult: {
                    title: 'Workspace создан',
                    details: {
                        workspace: createdWorkspace.workspace.slug,
                        apiKeyLabel: createdWorkspace.apiKey.label,
                        apiKeyToken: createdWorkspace.apiKey.token,
                        workspaceLoginUrl: `/w/${createdWorkspace.workspace.slug}/login`,
                        apiKeyExchangeUrl: `/auth/workspaces/${createdWorkspace.workspace.slug}/api-keys/login`,
                    },
                },
            })
        } catch (error) {
            sendAdminDashboardHtml(response, registry, {
                statusCode: 400,
                actionResult: {
                    tone: 'error',
                    title: 'Ошибка создания workspace',
                    details: { error: getErrorMessage(error) },
                },
            })
        }
    })

    app.post('/admin/workspaces/:slug/api-keys', adminOnly, workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)

        try {
            const createdApiKey = registry.createApiKey(workspace.slug, pickOptionalString(request.body?.label) ?? 'Generated key')

            sendAdminDashboardHtml(response, registry, {
                actionResult: {
                    title: 'API key создан',
                    details: {
                        workspace: workspace.slug,
                        label: createdApiKey.apiKey.label,
                        apiKeyToken: createdApiKey.apiKey.token,
                        apiKeyExchangeUrl: `/auth/workspaces/${workspace.slug}/api-keys/login`,
                    },
                },
            })
        } catch (error) {
            sendAdminDashboardHtml(response, registry, {
                statusCode: 400,
                actionResult: {
                    tone: 'error',
                    title: 'Ошибка создания API key',
                    details: {
                        workspace: workspace.slug,
                        error: getErrorMessage(error),
                    },
                },
            })
        }
    })

    app.post('/admin/workspaces/:slug/users', adminOnly, workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const label = pickOptionalString(request.body?.label)

        if (!label) {
            sendAdminDashboardHtml(response, registry, {
                statusCode: 400,
                actionResult: {
                    tone: 'error',
                    title: 'Ошибка создания user token',
                    details: { error: 'Поле label обязательно.' },
                },
            })
            return
        }

        try {
            const createdUser = registry.createUser(workspace.slug, {
                label,
                role: request.body?.role === 'owner' ? 'owner' : 'viewer',
            })

            sendAdminDashboardHtml(response, registry, {
                actionResult: {
                    title: 'Workspace user token создан',
                    details: {
                        workspace: workspace.slug,
                        label: createdUser.user.label,
                        role: createdUser.user.role,
                        workspaceUserToken: createdUser.user.token,
                        workspaceLoginUrl: `/w/${workspace.slug}/login`,
                    },
                },
            })
        } catch (error) {
            sendAdminDashboardHtml(response, registry, {
                statusCode: 400,
                actionResult: {
                    tone: 'error',
                    title: 'Ошибка создания user token',
                    details: {
                        workspace: workspace.slug,
                        error: getErrorMessage(error),
                    },
                },
            })
        }
    })

    app.get('/w/:slug/login', workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        response.type('html').send(renderWorkspaceLoginHtml(workspace.slug))
    })

    app.get('/auth/workspaces/:slug/api-keys/login', workspaceResolver, (_request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        response.type('html').send(renderWorkspaceApiKeyExchangeHtml({ slug: workspace.slug }))
    })

    app.post('/auth/workspaces/:slug/users/login', workspaceResolver, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const rawToken = pickOptionalString(request.body?.token)

        if (!rawToken) {
            if (expectsFormResponse(request)) {
                response.status(401).type('html').send(renderWorkspaceLoginHtml(workspace.slug, 'Нужно передать workspace user token.'))
                return
            }

            response.status(401).json({ error: 'Нужно передать workspace user token.' })
            return
        }

        const authResult = registry.authenticateWorkspaceUser(rawToken)

        if (!authResult || authResult.workspace.slug !== workspace.slug) {
            if (expectsFormResponse(request)) {
                response.status(401).type('html').send(renderWorkspaceLoginHtml(workspace.slug, 'Неверный workspace user token.'))
                return
            }

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

        if (expectsFormResponse(request)) {
            response.redirect(`/w/${workspace.slug}`)
            return
        }

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
            if (expectsFormResponse(request)) {
                response.status(401).type('html').send(renderWorkspaceApiKeyExchangeHtml({
                    slug: workspace.slug,
                    errorMessage: 'Нужно передать workspace API key.',
                }))
                return
            }

            response.status(401).json({ error: 'Нужно передать workspace API key.' })
            return
        }

        const authResult = registry.authenticate(rawToken)

        if (!authResult || authResult.workspace.slug !== workspace.slug) {
            if (expectsFormResponse(request)) {
                response.status(401).type('html').send(renderWorkspaceApiKeyExchangeHtml({
                    slug: workspace.slug,
                    errorMessage: 'Неверный workspace API key.',
                }))
                return
            }

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

        if (expectsFormResponse(request)) {
            response.type('html').send(renderWorkspaceApiKeyExchangeHtml({
                slug: workspace.slug,
                exchangeResult: {
                    accessToken: issuedToken.token,
                    expiresAt: new Date(issuedToken.claims.exp * 1000).toISOString(),
                    scope: issuedToken.claims.scope,
                    workspace: workspace.slug,
                    authorizationHeader: `Bearer ${issuedToken.token}`,
                    ingestionEndpoint: `/api/workspaces/${workspace.slug}/ingestions`,
                },
            }))
            return
        }

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

        if (expectsFormResponse(_request)) {
            response.redirect(`/w/${workspace.slug}/login`)
            return
        }

        response.json({ status: 'ok' })
    })

    app.get('/', (request: Request, response: Response) => {
        response.type('html').send(renderDashboardHtml(defaultStore.getFilteredSummary(getFiltersFromRequest(request))))
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

    app.get('/test/:name', (request: Request, response: Response) => {
        const testName = getRouteParam(request, 'name')
        const filters = getTestHistoryFiltersFromRequest(request)
        const payload = defaultStore.getTestHistory(testName, filters)

        response
            .status(getTestHistoryHtmlStatusCode(payload))
            .type('html')
            .send(renderTestHistoryHtml(payload, testName, filters))
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
        response.type('html').send(renderDashboardHtml(store.getFilteredSummary(getFiltersFromRequest(request))))
    })

    app.get('/w/:slug/test/:name', workspaceResolver, workspaceUserGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const store = createWorkspaceApiStore(workspace.slug, backendStorage)
        const testName = getRouteParam(request, 'name')
        const filters = getTestHistoryFiltersFromRequest(request)
        const payload = store.getTestHistory(testName, filters)

        response
            .status(getTestHistoryHtmlStatusCode(payload))
            .type('html')
            .send(renderTestHistoryHtml(payload, testName, filters))
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
        response.status(500).json({ error: message })
    })

    return app
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

function sendAdminDashboardHtml(
    response: Response,
    registry: WorkspaceRegistry,
    options: { statusCode?: number; actionResult?: AdminDashboardActionResult } = {},
): void {
    response
        .status(options.statusCode ?? 200)
        .type('html')
        .send(renderAdminDashboardHtml({
            workspaces: registry.listWorkspaces(),
            actionResult: options.actionResult,
        }))
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

function expectsFormResponse(request: Request): boolean {
    const contentType = request.header('content-type') ?? ''
    const acceptHeader = request.header('accept') ?? ''

    return contentType.includes('application/x-www-form-urlencoded')
        || contentType.includes('multipart/form-data')
        || acceptHeader.includes('text/html')
}


