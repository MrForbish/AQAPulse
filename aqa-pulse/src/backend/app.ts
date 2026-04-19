/**
 * Назначение: поднимает self-hosted/saas HTTP-приложение с React shell, JSON API, auth и ingestion-маршрутами.
 */
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import { ApiStore } from '../api-store'
import { getErrorMessage } from '../shared/error-utils'
import {
    createAdminGuard,
    createWorkspaceApiKeyGuard,
    createWorkspaceResolver,
    createWorkspaceUserGuard,
    getAuthClaimsFromLocals,
    getWorkspaceSessionCookieName,
    requireWorkspaceFromLocals,
} from './auth'
import {
    bootstrapWorkspaceForDev,
    buildAdminIngestionHealthReport as createAdminIngestionHealthReport,
    createWorkspaceApiKeyCommand,
    createWorkspaceCommand,
    createWorkspaceShareLinkCommand,
    createWorkspaceUserCommand,
    deleteWorkspaceApiKeyCommand,
    deleteWorkspaceCommand,
    deleteWorkspaceUserCommand,
    disableWorkspaceApiKeyCommand,
    disableWorkspaceUserCommand,
    ensureWorkspaceReadModelInitialized as initializeWorkspaceReadModel,
    loginAdmin as executeAdminLogin,
    loginWorkspaceApiKey as executeWorkspaceApiKeyLogin,
    loginWorkspaceUser as executeWorkspaceUserLogin,
    logoutAdmin as executeAdminLogout,
    logoutWorkspaceReadSession as executeWorkspaceLogout,
    queryDashboardCostMetricsPayload,
    queryDashboardErrorClustersPayload,
    queryDashboardFlakyPayload,
    queryDashboardRunById,
    queryDashboardRuns,
    queryDashboardSummary,
    queryTestHistoryForApi,
    queryTestHistoryForShell,
    loginViaWorkspaceShareLinkToken,
    openWorkspaceShareLink,
    revokeWorkspaceSessionCommand,
    updateServerSettingsCommand,
    updateWorkspaceCommand,
    updateWorkspaceUserRoleCommand,
} from './application'
import { type SaasAppConfig, resolveSaasAppConfig } from './config'
import type { ServerSettingsRecord } from './contracts'
import { normalizeShareLinkTtlMinutes } from './domain/share-link-rules'
import { createFrontendShellRenderer } from './frontend-shell'
import { buildCookieHeader, buildExpiredCookieHeader } from './jwt'
import {
    buildFrontendServiceUrls,
    buildWorkspaceShareLinkUrl,
    ensureDevBootstrapEnabled,
    getFiltersFromRequest,
    getRouteParam,
    normalizeIngestionPayload,
    normalizePaginationQueryValue,
    pickOptionalString,
    readCookieValue,
    readAdminBootstrapSession,
    readWorkspaceBootstrapSession,
    sendArtifactFile,
    sendUnknownWorkspaceShareLinkErrorHtml,
    sendWorkspaceShareLinkErrorShell,
} from './infrastructure/http'
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
    applyServerSettingsToConfig(config, registry.getServerSettings(buildServerSettingsDefaults(config)))
    const adminShellGuard = createAdminGuard(registry, config, { unauthorizedResponseMode: 'redirect' })
    const adminApiGuard = createAdminGuard(registry, config, { unauthorizedResponseMode: 'json' })
    const workspaceResolver = createWorkspaceResolver(registry)
    const workspaceApiKeyGuard = createWorkspaceApiKeyGuard(registry, config)
    const workspaceShellGuard = createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'redirect' })
    const workspaceApiGuard = createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'json' })
    let defaultApiStore: ApiStore | null = null
    const workspaceApiStores = new Map<string, ApiStore>()
    const createDefaultApiStore = () => {
        if (!defaultApiStore) {
            defaultApiStore = new ApiStore({
                storage: backendStorage.createDashboardReadStorage({
                    summaryPath: path.join(config.distPath, 'dashboard-data.json'),
                    historyPath: path.join(config.distPath, 'history.json'),
                    archiveRootPath: config.archiveRootPath,
                }),
                businessAssumptions: config.businessAssumptions,
            })
        }

        return defaultApiStore
    }
    const invalidateDefaultApiStore = () => {
        defaultApiStore?.invalidateCaches()
        defaultApiStore = null
    }
    const createWorkspaceApiStore = (slug: string) => {
        initializeWorkspaceReadModel(slug, backendStorage, config)

        const cachedStore = workspaceApiStores.get(slug)

        if (cachedStore) {
            return cachedStore
        }

        const store = new ApiStore({
            storage: backendStorage.getWorkspaceStorage(slug),
            businessAssumptions: config.businessAssumptions,
        })

        workspaceApiStores.set(slug, store)
        return store
    }
    const invalidateWorkspaceApiStore = (slug: string) => {
        const store = workspaceApiStores.get(slug)

        store?.invalidateCaches()
        workspaceApiStores.delete(slug)
    }
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
            const result = executeAdminLogin(registry, config, pickOptionalString(request.body?.token))

            if (!result.ok) {
                response.status(result.statusCode).json({ error: result.error })
                return
            }

            response.setHeader('Set-Cookie', buildCookieHeader({
                name: config.adminSessionCookieName,
                value: result.sessionToken,
                maxAgeSeconds: result.maxAgeSeconds,
            }))

            response.json(result.body)
        })

        app.post('/auth/admin/logout', (request: Request, response: Response) => {
            executeAdminLogout(registry, config, readCookieValue(request, config.adminSessionCookieName))

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
            try {
                const createdWorkspace = createWorkspaceCommand(registry, {
                    ensureWorkspaceReadModelInitialized: (slug) => initializeWorkspaceReadModel(slug, backendStorage, config),
                }, {
                    name: pickOptionalString(request.body?.name),
                    slug: pickOptionalString(request.body?.slug),
                    apiKeyLabel: pickOptionalString(request.body?.apiKeyLabel),
                })

                response.status(201).json(createdWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error) })
            }
        })

        app.post('/admin/workspaces/:slug/api-keys', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const createdApiKey = createWorkspaceApiKeyCommand(registry, {
                    workspaceSlug: workspace.slug,
                    label: pickOptionalString(request.body?.label),
                })

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

            try {
                const createdUser = createWorkspaceUserCommand(registry, {
                    workspaceSlug: workspace.slug,
                    label: pickOptionalString(request.body?.label),
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

        app.post('/api/dev/bootstrap', ensureDevBootstrapEnabled(config.allowDevBootstrap), adminApiGuard, (request: Request, response: Response) => {
            try {
                const result = bootstrapWorkspaceForDev(registry, {
                    name: pickOptionalString(request.body?.name),
                    slug: pickOptionalString(request.body?.slug),
                })

                if (result.statusCode === 201) {
                    initializeWorkspaceReadModel(result.body.workspace.slug, backendStorage, config)
                }

                response.status(result.statusCode).json(result.body)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error) })
            }
        })

        app.get('/api/workspaces', adminApiGuard, (_request: Request, response: Response) => {
            response.json({ workspaces: registry.listWorkspaces() })
        })

        app.get('/api/admin/settings', adminApiGuard, (_request: Request, response: Response) => {
            response.json({ settings: buildServerSettingsDefaults(config) })
        })

        app.put('/api/admin/settings', adminApiGuard, (request: Request, response: Response) => {
            try {
                const result = updateServerSettingsCommand(registry, {
                    applyServerSettings: (settings) => applyServerSettingsToConfig(config, settings),
                    buildServerSettingsDefaults: () => buildServerSettingsDefaults(config),
                }, {
                    actor: resolveAdminActor(response, registry),
                    settings: {
                        adminBaseUrl: pickOptionalString(request.body?.adminBaseUrl),
                        runtimeBaseUrl: pickOptionalString(request.body?.runtimeBaseUrl),
                        allowDevBootstrap: typeof request.body?.allowDevBootstrap === 'boolean' ? request.body.allowDevBootstrap : undefined,
                        requireWorkspaceAuth: typeof request.body?.requireWorkspaceAuth === 'boolean' ? request.body.requireWorkspaceAuth : undefined,
                        accessTokenTtlSeconds: typeof request.body?.accessTokenTtlSeconds === 'number' ? request.body.accessTokenTtlSeconds : undefined,
                        adminToken: typeof request.body?.adminToken === 'string' || request.body?.adminToken === null
                            ? pickOptionalString(request.body.adminToken)
                            : undefined,
                        businessAssumptions: request.body?.businessAssumptions,
                    },
                })

                response.json(result)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error) })
            }
        })

        app.get('/api/admin/audit', adminApiGuard, (request: Request, response: Response) => {
            const page = normalizePaginationQueryValue(request.query.page, 1, 10_000)
            const pageSize = normalizePaginationQueryValue(request.query.pageSize, 20, 100)

            response.json(registry.listAdminAuditPage(page, pageSize))
        })

        app.get('/api/admin/ingestion-health', adminApiGuard, (_request: Request, response: Response) => {
            response.json(createAdminIngestionHealthReport(registry, backendStorage, config))
        })

        app.get('/api/workspaces/:slug', adminApiGuard, workspaceResolver, (_request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            response.json({ workspace })
        })

        app.post('/api/workspaces', adminApiGuard, (request: Request, response: Response) => {
            try {
                const createdWorkspace = createWorkspaceCommand(registry, {
                    ensureWorkspaceReadModelInitialized: (slug) => initializeWorkspaceReadModel(slug, backendStorage, config),
                }, {
                    actor: resolveAdminActor(response, registry),
                    name: pickOptionalString(request.body?.name),
                    slug: pickOptionalString(request.body?.slug),
                    apiKeyLabel: pickOptionalString(request.body?.apiKeyLabel),
                })

                response.status(201).json(createdWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error) })
            }
        })

        app.put('/api/workspaces/:slug', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const updatedWorkspace = updateWorkspaceCommand(registry, {
                    renameWorkspaceData: (previousSlug, nextSlug) => backendStorage.renameWorkspaceData(previousSlug, nextSlug),
                    invalidateWorkspaceApiStore,
                    ensureWorkspaceReadModelInitialized: (slug) => initializeWorkspaceReadModel(slug, backendStorage, config),
                }, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    name: pickOptionalString(request.body?.name),
                    nextSlug: pickOptionalString(request.body?.slug) ?? workspace.slug,
                })

                response.json(updatedWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.delete('/api/workspaces/:slug', adminApiGuard, workspaceResolver, (_request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const deletedWorkspace = deleteWorkspaceCommand(registry, {
                    deleteWorkspaceData: (slug) => backendStorage.deleteWorkspaceData(slug),
                    invalidateWorkspaceApiStore,
                }, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                })

                response.json(deletedWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/api-keys', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const createdApiKey = createWorkspaceApiKeyCommand(registry, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    label: pickOptionalString(request.body?.label),
                })

                response.status(201).json(createdApiKey)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/users', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const createdUser = createWorkspaceUserCommand(registry, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    label: pickOptionalString(request.body?.label),
                    role: request.body?.role === 'owner' ? 'owner' : 'viewer',
                })

                response.status(201).json(createdUser)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/share-links', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const ttlMinutes = normalizeShareLinkTtlMinutes(request.body?.ttlMinutes)

            try {
                const shareLink = createWorkspaceShareLinkCommand(registry, {
                    buildWorkspaceShareLinkUrl: (workspaceSlug, sessionId) => buildWorkspaceShareLinkUrl(request, config.runtimeBaseUrl, workspaceSlug, '', sessionId),
                    createShareLinkSubjectId: () => `share-link:${randomUUID()}`,
                }, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    ttlMinutes,
                })

                response.status(201).json(shareLink)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.put('/api/workspaces/:slug/users/:userId/role', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const result = updateWorkspaceUserRoleCommand(registry, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    userId: getRouteParam(request, 'userId'),
                    role: request.body?.role === 'owner' ? 'owner' : 'viewer',
                })

                response.json(result)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/api-keys/:apiKeyId/disable', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const nextWorkspace = disableWorkspaceApiKeyCommand(registry, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    apiKeyId: getRouteParam(request, 'apiKeyId'),
                })

                response.json(nextWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.delete('/api/workspaces/:slug/api-keys/:apiKeyId', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const nextWorkspace = deleteWorkspaceApiKeyCommand(registry, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    apiKeyId: getRouteParam(request, 'apiKeyId'),
                })

                response.json(nextWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/users/:userId/disable', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const nextWorkspace = disableWorkspaceUserCommand(registry, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    userId: getRouteParam(request, 'userId'),
                })

                response.json(nextWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.delete('/api/workspaces/:slug/users/:userId', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const nextWorkspace = deleteWorkspaceUserCommand(registry, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    userId: getRouteParam(request, 'userId'),
                })

                response.json(nextWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/sessions/:sessionId/revoke', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)

            try {
                const nextWorkspace = revokeWorkspaceSessionCommand(registry, {
                    actor: resolveAdminActor(response, registry),
                    workspaceSlug: workspace.slug,
                    sessionId: getRouteParam(request, 'sessionId'),
                })

                response.json(nextWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })
    }

    if (mode !== 'admin') {
        app.get('/', (request: Request, response: Response) => {
            const store = createDefaultApiStore()
            frontendShell.send(response, {
                route: { kind: 'dashboard', workspaceSlug: null },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: store.getFilteredSummary(getFiltersFromRequest(request)),
                initialTestHistoryPayload: null,
                initialAdminWorkspaces: null,
                initialSessionStatus: { scope: 'public', authenticated: true, authRequired: false, workspaceSlug: null },
            })
        })

        app.get('/w/:slug/login', workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            frontendShell.send(response, {
                route: { kind: 'workspace-login', workspaceSlug: workspace.slug, workspaceName: workspace.name },
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

        app.get('/s/:shareId', (request: Request, response: Response) => {
            const result = openWorkspaceShareLink(registry, config, getRouteParam(request, 'shareId'))

            if (!result.ok && result.kind === 'unknown') {
                sendUnknownWorkspaceShareLinkErrorHtml(response)
                return
            }

            if (!result.ok) {
                sendWorkspaceShareLinkErrorShell(response, frontendShell, {
                    statusCode: result.statusCode,
                    initialRequestUrl: request.originalUrl,
                    workspaceSlug: result.workspaceSlug,
                    title: result.title,
                    message: result.message,
                    serviceUrls: buildFrontendServiceUrls(config),
                    initialSessionStatus: readWorkspaceBootstrapSession(request, result.workspaceSlug, registry, config),
                })
                return
            }

            response.setHeader('Set-Cookie', buildCookieHeader({
                name: getWorkspaceSessionCookieName(config, result.workspaceSlug),
                value: result.sessionToken,
                maxAgeSeconds: result.maxAgeSeconds,
                path: '/',
            }))
            response.redirect(result.redirectPath)
        })

        app.get('/auth/workspaces/:slug/share-links/login', workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const result = loginViaWorkspaceShareLinkToken(registry, config, workspace.slug, pickOptionalString(request.query.token))

            if (!result.ok) {
                sendWorkspaceShareLinkErrorShell(response, frontendShell, {
                    statusCode: result.statusCode,
                    initialRequestUrl: request.originalUrl,
                    workspaceSlug: result.workspaceSlug,
                    title: result.title,
                    message: result.message,
                    serviceUrls: buildFrontendServiceUrls(config),
                    initialSessionStatus: readWorkspaceBootstrapSession(request, result.workspaceSlug, registry, config),
                })
                return
            }

            response.setHeader('Set-Cookie', buildCookieHeader({
                name: getWorkspaceSessionCookieName(config, workspace.slug),
                value: result.sessionToken,
                maxAgeSeconds: result.maxAgeSeconds,
                path: '/',
            }))
            response.redirect(result.redirectPath)
        })

        app.post('/auth/workspaces/:slug/users/login', workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const result = executeWorkspaceUserLogin(registry, config, workspace.slug, pickOptionalString(request.body?.token))

            if (!result.ok) {
                response.status(result.statusCode).json({ error: result.error })
                return
            }

            response.setHeader('Set-Cookie', buildCookieHeader({
                name: getWorkspaceSessionCookieName(config, workspace.slug),
                value: result.sessionToken,
                maxAgeSeconds: result.maxAgeSeconds,
                path: '/',
            }))

            response.json(result.body)
        })

        app.post('/auth/workspaces/:slug/api-keys/login', workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const result = executeWorkspaceApiKeyLogin(registry, config, workspace.slug, pickOptionalString(request.body?.token))

            if (!result.ok) {
                response.status(result.statusCode).json({ error: result.error })
                return
            }

            response.json(result.body)
        })

        app.post('/auth/workspaces/:slug/users/logout', workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            executeWorkspaceLogout(registry, config, workspace.slug, readCookieValue(request, getWorkspaceSessionCookieName(config, workspace.slug)))

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
            response.json(queryDashboardSummary(createDefaultApiStore(), getFiltersFromRequest(request)))
        })

        app.get('/api/runs', (request: Request, response: Response) => {
            response.json(queryDashboardRuns(createDefaultApiStore(), getFiltersFromRequest(request)))
        })

        app.get('/api/run/:id', (request: Request, response: Response) => {
            const result = queryDashboardRunById(createDefaultApiStore(), getRouteParam(request, 'id'))
            response.status(result.statusCode).json(result.body)
        })

        app.get('/api/flaky', (request: Request, response: Response) => {
            response.json(queryDashboardFlakyPayload(createDefaultApiStore(), getFiltersFromRequest(request)))
        })

        app.get('/api/errors/clusters', (request: Request, response: Response) => {
            response.json(queryDashboardErrorClustersPayload(createDefaultApiStore(), getFiltersFromRequest(request)))
        })

        app.get('/api/metrics/cost', (request: Request, response: Response) => {
            response.json(queryDashboardCostMetricsPayload(createDefaultApiStore(), getFiltersFromRequest(request)))
        })

        app.get('/api/artifacts/:runId', (request: Request, response: Response) => {
            sendArtifactFile(response, path.join(config.archiveRootPath, '_artifacts'), getRouteParam(request, 'runId'), pickOptionalString(request.query.path) ?? undefined)
        })

        app.get('/test/:name', (request: Request, response: Response) => {
            const testName = getRouteParam(request, 'name')
            const result = queryTestHistoryForShell(createDefaultApiStore(), testName, getFiltersFromRequest(request))

            frontendShell.send(response, {
                route: { kind: 'test-history', workspaceSlug: null, testName },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: null,
                initialTestHistoryPayload: result.payload,
                initialAdminWorkspaces: null,
                initialSessionStatus: { scope: 'public', authenticated: true, authRequired: false, workspaceSlug: null },
            }, result.statusCode)
        })

        app.get('/api/test/:name', (request: Request, response: Response) => {
            const testName = getRouteParam(request, 'name')
            const result = queryTestHistoryForApi(createDefaultApiStore(), testName, getFiltersFromRequest(request))
            response.status(result.statusCode).json(result.body)
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

            invalidateWorkspaceApiStore(workspace.slug)
            invalidateDefaultApiStore()

            response.status(202).json(result)
        })

        app.get('/w/:slug', workspaceResolver, workspaceShellGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            frontendShell.send(response, {
                route: { kind: 'dashboard', workspaceSlug: workspace.slug },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: queryDashboardSummary(store, getFiltersFromRequest(request)),
                initialTestHistoryPayload: null,
                initialAdminWorkspaces: null,
                initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, registry, config),
            })
        })

        app.get('/w/:slug/test/:name', workspaceResolver, workspaceShellGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            const testName = getRouteParam(request, 'name')
            const result = queryTestHistoryForShell(store, testName, getFiltersFromRequest(request))

            frontendShell.send(response, {
                route: { kind: 'test-history', workspaceSlug: workspace.slug, testName },
                initialRequestUrl: request.originalUrl,
                serviceUrls: buildFrontendServiceUrls(config),
                initialDashboardSummary: null,
                initialTestHistoryPayload: result.payload,
                initialAdminWorkspaces: null,
                initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, registry, config),
            }, result.statusCode)
        })

        app.get('/api/workspaces/:slug/artifacts/:runId', workspaceResolver, workspaceApiGuard, (_request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const storage = backendStorage.getWorkspaceStorage(workspace.slug)
            sendArtifactFile(response, storage.paths.artifactsPath, getRouteParam(_request, 'runId'), pickOptionalString(_request.query.path) ?? undefined)
        })

        app.get('/api/workspaces/:slug/summary', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            response.json(queryDashboardSummary(store, getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/runs', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            response.json(queryDashboardRuns(store, getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/run/:id', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            const result = queryDashboardRunById(store, getRouteParam(request, 'id'))
            response.status(result.statusCode).json(result.body)
        })

        app.get('/api/workspaces/:slug/flaky', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            response.json(queryDashboardFlakyPayload(store, getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/errors/clusters', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            response.json(queryDashboardErrorClustersPayload(store, getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/metrics/cost', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            response.json(queryDashboardCostMetricsPayload(store, getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/test/:name', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            const result = queryTestHistoryForApi(store, getRouteParam(request, 'name'), getFiltersFromRequest(request))
            response.status(result.statusCode).json(result.body)
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

function buildServerSettingsDefaults(config: SaasAppConfig): ServerSettingsRecord {
    return {
        adminBaseUrl: config.adminBaseUrl,
        runtimeBaseUrl: config.runtimeBaseUrl,
        allowDevBootstrap: config.allowDevBootstrap,
        requireWorkspaceAuth: config.requireWorkspaceAuth,
        accessTokenTtlSeconds: config.accessTokenTtlSeconds,
        adminToken: config.adminToken,
        businessAssumptions: {
            ciMinuteCostRub: config.businessAssumptions.ciMinuteCostRub,
            developerHourlyCostRub: config.businessAssumptions.developerHourlyCostRub,
            analysisMinutesPerUnstable: config.businessAssumptions.analysisMinutesPerUnstable,
        },
    }
}

function applyServerSettingsToConfig(config: SaasAppConfig, settings: ServerSettingsRecord): void {
    config.adminBaseUrl = settings.adminBaseUrl
    config.runtimeBaseUrl = settings.runtimeBaseUrl
    config.allowDevBootstrap = settings.allowDevBootstrap
    config.requireWorkspaceAuth = settings.requireWorkspaceAuth
    config.accessTokenTtlSeconds = settings.accessTokenTtlSeconds
    config.adminToken = settings.adminToken
    config.businessAssumptions = {
        ciMinuteCostRub: settings.businessAssumptions.ciMinuteCostRub,
        developerHourlyCostRub: settings.businessAssumptions.developerHourlyCostRub,
        analysisMinutesPerUnstable: settings.businessAssumptions.analysisMinutesPerUnstable,
    }
}

function resolveAdminActor(response: Response, registry: WorkspaceRegistry): { label: string; sessionId: string | null } {
    const claims = getAuthClaimsFromLocals(response)

    if (claims?.kind === 'admin' && claims.scope === 'admin') {
        const session = registry.getAdminSession(claims.sessionId ?? '')

        return {
            label: session?.label ?? 'Admin session',
            sessionId: claims.sessionId ?? null,
        }
    }

    return {
        label: 'Admin session',
        sessionId: null,
    }
}



