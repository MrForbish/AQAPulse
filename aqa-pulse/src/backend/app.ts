/**
 * Назначение: поднимает self-hosted/saas HTTP-приложение с React shell, JSON API, auth и ingestion-маршрутами.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { ApiStore, type ApiFilters } from '../api-store'
import { applyBusinessAssumptionsToSummary, buildDashboardSummary, type ReporterRoot } from '../dashboard-utils'
import { type FrontendBootstrapData } from '../frontend-bootstrap'
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
import { createFrontendShellRenderer } from './frontend-shell'
import { buildCookieHeader, buildExpiredCookieHeader, issueJwtToken, verifyJwtToken } from './jwt'
import { ingestReporterRun } from './run-ingestion.service'
import { createBackendStorage, type BackendStorage } from './storage'
import { WorkspaceRegistry } from './workspace-registry'

type SaasServiceMode = 'all' | 'admin' | 'runtime'

/**
 * Собирает единый Express app для admin/workspace сценариев: React shell отдаётся из одного места, а bootstrap/session данные заполняются на основе текущего запроса.
 */
export function createSaasApp(options: Partial<SaasAppConfig> = {}): express.Express {
    return createConfiguredSaasApp(options, 'all')
}

export function createAdminApp(options: Partial<SaasAppConfig> = {}): express.Express {
    return createConfiguredSaasApp(options, 'admin')
}

export function createRuntimeApp(options: Partial<SaasAppConfig> = {}): express.Express {
    return createConfiguredSaasApp(options, 'runtime')
}

function createConfiguredSaasApp(options: Partial<SaasAppConfig>, mode: SaasServiceMode): express.Express {
    const app = express()
    const config = resolveSaasAppConfig(options)
    const backendStorage = createBackendStorage(config)
    const registry = new WorkspaceRegistry(backendStorage.registry)
    const adminShellGuard = createAdminGuard(registry, config, { unauthorizedResponseMode: 'redirect' })
    const adminApiGuard = createAdminGuard(registry, config, { unauthorizedResponseMode: 'json' })
    const workspaceResolver = createWorkspaceResolver(registry)
    const workspaceApiKeyGuard = createWorkspaceApiKeyGuard(registry, config)
    const workspaceShellGuard = createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'redirect' })
    const workspaceApiGuard = createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'json' })
    const defaultStore = new ApiStore({
        storage: backendStorage.createDashboardReadStorage({
            summaryPath: path.join(config.distPath, 'dashboard-data.json'),
            historyPath: path.join(config.distPath, 'history.json'),
            archiveRootPath: config.archiveRootPath,
        }),
        businessAssumptions: config.businessAssumptions,
    })
    const distPath = config.distPath
    const distAssetsPath = path.resolve(distPath, './assets')
    const frontendDistPath = path.resolve(distPath, './web')
    const frontendShell = createFrontendShellRenderer(frontendDistPath)

    app.use(express.json({ limit: config.requestBodyLimit }))
    app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }))
    app.use('/assets', express.static(distAssetsPath))
    app.use('/ui-assets', express.static(frontendDistPath))
    app.use('/static', express.static(distPath))
    app.use('/w/:slug/assets', express.static(distAssetsPath))

    app.get('/api/health', (_request: Request, response: Response) => {
        response.json({ status: 'ok', service: mode })
    })

    if (mode !== 'runtime') {
        if (mode === 'admin') {
            app.get('/', (_request: Request, response: Response) => {
                response.redirect('/admin')
            })
        }

        app.get('/admin/login', (request: Request, response: Response) => {
            frontendShell.send(response, {
                route: { kind: 'admin-login' },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: null,
                initialTestHistoryPayload: null,
                initialAdminWorkspaces: null,
                initialSessionStatus: readAdminBootstrapSession(request, registry, config),
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

            const adminSession = registry.createAdminSession(new Date(Date.now() + config.accessTokenTtlSeconds * 1000).toISOString())
            const issuedToken = issueJwtToken({
                subject: 'admin',
                kind: 'admin',
                scope: 'admin',
                secret: config.jwtSecret,
                ttlSeconds: config.accessTokenTtlSeconds,
                sessionId: adminSession.id,
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

        app.post('/auth/admin/logout', (request: Request, response: Response) => {
            const token = readCookieValue(request, config.adminSessionCookieName)
            const claims = token ? verifyJwtToken(token, config.jwtSecret) : null

            if (claims?.kind === 'admin' && claims.scope === 'admin') {
                registry.revokeAdminSession(claims.sessionId ?? '')
            }

            response.setHeader('Set-Cookie', buildExpiredCookieHeader(config.adminSessionCookieName))

            response.json({ status: 'ok' })
        })

        app.get('/auth/admin/session', (request: Request, response: Response, next: NextFunction) => {
            if (!config.adminToken) {
                response.json({ authenticated: true, authRequired: false, scope: 'admin' })
                return
            }

            next()
        }, adminApiGuard, (_request: Request, response: Response) => {
            response.json({ authenticated: true, authRequired: true, scope: 'admin' })
        })

        app.get('/admin', adminShellGuard, (request: Request, response: Response) => {
            frontendShell.send(response, {
                route: { kind: 'admin-dashboard' },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: null,
                initialTestHistoryPayload: null,
                initialAdminWorkspaces: registry.listWorkspaces(),
                initialSessionStatus: readAdminBootstrapSession(request, registry, config),
            })
        })

        app.post('/admin/workspaces', adminApiGuard, (request: Request, response: Response) => {
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
                ensureWorkspaceReadModelInitialized(createdWorkspace.workspace.slug, backendStorage, config)

                response.status(201).json(createdWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error) })
            }
        })

        app.post('/admin/workspaces/:slug/api-keys', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
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

        app.post('/admin/workspaces/:slug/users', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
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

        app.post('/api/dev/bootstrap', ensureDevBootstrapEnabled(config), adminApiGuard, (request: Request, response: Response) => {
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

        app.get('/api/workspaces', adminApiGuard, (_request: Request, response: Response) => {
            response.json({ workspaces: registry.listWorkspaces() })
        })

        app.get('/api/workspaces/:slug', adminApiGuard, workspaceResolver, (_request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            response.json({ workspace })
        })

        app.post('/api/workspaces', adminApiGuard, (request: Request, response: Response) => {
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

            ensureWorkspaceReadModelInitialized(createdWorkspace.workspace.slug, backendStorage, config)

            response.status(201).json(createdWorkspace)
        })

        app.post('/api/workspaces/:slug/api-keys', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            response.status(201).json(registry.createApiKey(workspace.slug, pickOptionalString(request.body?.label) ?? 'Generated key'))
        })

        app.post('/api/workspaces/:slug/users', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
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

        app.post('/api/workspaces/:slug/api-keys/:apiKeyId/disable', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                response.json({ workspace: registry.disableApiKey(workspace.slug, getRouteParam(request, 'apiKeyId')) })
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/users/:userId/disable', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                response.json({ workspace: registry.disableUser(workspace.slug, getRouteParam(request, 'userId')) })
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/sessions/:sessionId/revoke', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                response.json({ workspace: registry.revokeWorkspaceSession(workspace.slug, getRouteParam(request, 'sessionId')) })
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })
    }

    if (mode !== 'admin') {
        app.get('/', (request: Request, response: Response) => {
            frontendShell.send(response, {
                route: { kind: 'dashboard', workspaceSlug: null },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: defaultStore.getFilteredSummary(getFiltersFromRequest(request)),
                initialTestHistoryPayload: null,
                initialAdminWorkspaces: null,
                initialSessionStatus: { scope: 'public', authenticated: true, authRequired: false, workspaceSlug: null },
            })
        })

        app.get('/w/:slug/login', workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            frontendShell.send(response, {
                route: { kind: 'workspace-login', workspaceSlug: workspace.slug },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: null,
                initialTestHistoryPayload: null,
                initialAdminWorkspaces: null,
                initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, registry, config),
            })
        })

        app.get('/auth/workspaces/:slug/api-keys/login', workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            frontendShell.send(response, {
                route: { kind: 'workspace-api-key-exchange', workspaceSlug: workspace.slug },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: null,
                initialTestHistoryPayload: null,
                initialAdminWorkspaces: null,
                initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, registry, config),
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

            const session = registry.createWorkspaceSession(workspace.slug, {
                kind: 'workspace-user',
                subjectId: authResult.user.id,
                label: authResult.user.label,
                scope: 'workspace:read',
                role: authResult.user.role,
                expiresAt: new Date(Date.now() + config.accessTokenTtlSeconds * 1000).toISOString(),
            })
            const issuedToken = issueJwtToken({
                subject: authResult.user.id,
                kind: 'workspace-user',
                scope: 'workspace:read',
                secret: config.jwtSecret,
                ttlSeconds: config.accessTokenTtlSeconds,
                workspaceSlug: workspace.slug,
                role: authResult.user.role,
                sessionId: session.id,
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

            const session = registry.createWorkspaceSession(workspace.slug, {
                kind: 'workspace-api-key',
                subjectId: authResult.apiKey.id,
                label: authResult.apiKey.label,
                scope: 'workspace:ingest',
                expiresAt: new Date(Date.now() + config.accessTokenTtlSeconds * 1000).toISOString(),
            })
            const issuedToken = issueJwtToken({
                subject: authResult.apiKey.id,
                kind: 'workspace-api-key',
                scope: 'workspace:ingest',
                secret: config.jwtSecret,
                ttlSeconds: config.accessTokenTtlSeconds,
                workspaceSlug: workspace.slug,
                sessionId: session.id,
            })

            response.json({
                accessToken: issuedToken.token,
                expiresAt: new Date(issuedToken.claims.exp * 1000).toISOString(),
                scope: issuedToken.claims.scope,
                workspace: workspace.slug,
            })
        })

        app.post('/auth/workspaces/:slug/users/logout', workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const token = readCookieValue(request, getWorkspaceSessionCookieName(config, workspace.slug))
            const claims = token ? verifyJwtToken(token, config.jwtSecret) : null

            if (claims?.kind === 'workspace-user' && claims.workspaceSlug === workspace.slug) {
                registry.revokeWorkspaceSession(workspace.slug, claims.sessionId ?? '')
            }

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
        }, workspaceApiGuard, (_request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            response.json({
                authenticated: true,
                authRequired: true,
                scope: 'workspace:read',
                workspace: workspace.slug,
            })
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
            sendArtifactFile(response, path.join(config.archiveRootPath, '_artifacts'), getRouteParam(request, 'runId'), pickOptionalString(request.query.path) ?? undefined)
        })

        app.get('/test/:name', (request: Request, response: Response) => {
            const testName = getRouteParam(request, 'name')
            const filters = getTestHistoryFiltersFromRequest(request)
            const payload = defaultStore.getTestHistory(testName, filters)

            frontendShell.send(response, {
                route: { kind: 'test-history', workspaceSlug: null, testName },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
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
                businessAssumptions: config.businessAssumptions,
            })

            response.status(202).json(result)
        })

        app.get('/w/:slug', workspaceResolver, workspaceShellGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug, backendStorage, config)
            frontendShell.send(response, {
                route: { kind: 'dashboard', workspaceSlug: workspace.slug },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: store.getFilteredSummary(getFiltersFromRequest(request)),
                initialTestHistoryPayload: null,
                initialAdminWorkspaces: null,
                initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, registry, config),
            })
        })

        app.get('/w/:slug/test/:name', workspaceResolver, workspaceShellGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug, backendStorage, config)
            const testName = getRouteParam(request, 'name')
            const filters = getTestHistoryFiltersFromRequest(request)
            const payload = store.getTestHistory(testName, filters)

            frontendShell.send(response, {
                route: { kind: 'test-history', workspaceSlug: workspace.slug, testName },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: null,
                initialTestHistoryPayload: payload,
                initialAdminWorkspaces: null,
                initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, registry, config),
            }, getTestHistoryHtmlStatusCode(payload))
        })

        app.get('/api/workspaces/:slug/artifacts/:runId', workspaceResolver, workspaceApiGuard, (_request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const storage = backendStorage.getWorkspaceStorage(workspace.slug)
            sendArtifactFile(response, storage.paths.artifactsPath, getRouteParam(_request, 'runId'), pickOptionalString(_request.query.path) ?? undefined)
        })

        app.get('/api/workspaces/:slug/summary', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug, backendStorage, config)
            response.json(store.getFilteredSummary(getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/runs', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug, backendStorage, config)
            response.json({ runs: store.getRuns(getFiltersFromRequest(request)) })
        })

        app.get('/api/workspaces/:slug/run/:id', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug, backendStorage, config)

            const runId = getRouteParam(request, 'id')
            const run = store.getRunById(runId)

            if (!run) {
                response.status(404).json({ error: `Прогон с id "${runId}" не найден.` })
                return
            }

            response.json(run)
        })

        app.get('/api/workspaces/:slug/flaky', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug, backendStorage, config)
            response.json(store.getFlakyPayload(getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/errors/clusters', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug, backendStorage, config)
            response.json(store.getErrorClustersPayload(getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/metrics/cost', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug, backendStorage, config)
            response.json(store.getCostMetricsPayload(getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/test/:name', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug, backendStorage, config)

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
    }

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

function createWorkspaceApiStore(slug: string, backendStorage: BackendStorage, config: SaasAppConfig): ApiStore {
    ensureWorkspaceReadModelInitialized(slug, backendStorage, config)

    return new ApiStore({
        storage: backendStorage.getWorkspaceStorage(slug),
        businessAssumptions: config.businessAssumptions,
    })
}

/**
 * Workspace read model инициализируется лениво, потому что новый workspace может быть создан до первого ingestion, а React UI уже должен уметь открывать пустой dashboard без падения по отсутствующим summary/history файлам.
 */
function ensureWorkspaceReadModelInitialized(slug: string, backendStorage: BackendStorage, config: SaasAppConfig): void {
    const workspaceStorage = backendStorage.getWorkspaceStorage(slug)
    const history = workspaceStorage.readHistory()

    try {
        workspaceStorage.readSummary()
    } catch {
        workspaceStorage.writeSummary(applyBusinessAssumptionsToSummary(buildDashboardSummary(
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
        ), config.businessAssumptions))
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

function buildFrontendServiceUrls(config: SaasAppConfig): FrontendBootstrapData['serviceUrls'] {
    return {
        adminBaseUrl: config.adminBaseUrl,
        runtimeBaseUrl: config.runtimeBaseUrl,
    }
}

function readAdminBootstrapSession(request: Request, registry: WorkspaceRegistry, config: SaasAppConfig): FrontendBootstrapData['initialSessionStatus'] {
    if (!config.adminToken) {
        return { scope: 'admin', authenticated: true, authRequired: false, workspaceSlug: null }
    }

    const token = extractAccessToken(request, 'x-admin-token')
        ?? readCookieValue(request, config.adminSessionCookieName)
    const claims = token ? verifyJwtToken(token, config.jwtSecret) : null

    return {
        scope: 'admin',
        authenticated: claims?.scope === 'admin'
            && claims.kind === 'admin'
            && registry.isAdminSessionActive(claims.sessionId ?? ''),
        authRequired: true,
        workspaceSlug: null,
    }
}

/**
 * Bootstrap session для workspace учитывает и admin cookie, и workspace user cookie: администратор должен проходить в workspace shell без отдельного логина, а обычный пользователь — только в пределах своего slug.
 */
function readWorkspaceBootstrapSession(request: Request, workspaceSlug: string, registry: WorkspaceRegistry, config: SaasAppConfig): FrontendBootstrapData['initialSessionStatus'] {
    if (!config.requireWorkspaceAuth) {
        return { scope: 'workspace', authenticated: true, authRequired: false, workspaceSlug }
    }

    const adminToken = extractAccessToken(request, 'x-admin-token')
        ?? readCookieValue(request, config.adminSessionCookieName)
    const adminClaims = adminToken ? verifyJwtToken(adminToken, config.jwtSecret) : null

    if (adminClaims?.scope === 'admin' && adminClaims.kind === 'admin' && registry.isAdminSessionActive(adminClaims.sessionId ?? '')) {
        return { scope: 'workspace', authenticated: true, authRequired: true, workspaceSlug }
    }

    const workspaceToken = extractAccessToken(request, 'x-workspace-token')
        ?? readCookieValue(request, getWorkspaceSessionCookieName(config, workspaceSlug))
    const workspaceClaims = workspaceToken ? verifyJwtToken(workspaceToken, config.jwtSecret) : null

    return {
        scope: 'workspace',
        authenticated: workspaceClaims?.kind === 'workspace-user'
            && workspaceClaims.scope === 'workspace:read'
            && workspaceClaims.workspaceSlug === workspaceSlug
            && registry.isWorkspaceSessionActive(workspaceSlug, workspaceClaims.sessionId ?? '', 'workspace-user'),
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

/**
 * Ingestion endpoint принимает либо обёрнутый `{ report, metadata }`, либо сырой reporter root, чтобы CLI/self-hosted интеграции могли эволюционировать без жёсткой привязки к одному payload shape.
 */
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

/**
 * Раздача артефактов жёстко нормализует путь относительно конкретного run directory, чтобы исключить path traversal и не позволить скачивать файлы соседних прогонов.
 */
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


