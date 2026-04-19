/**
 * Назначение: поднимает self-hosted/saas HTTP-приложение с React shell, JSON API, auth и ingestion-маршрутами.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomBytes } from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import { ApiStore, type ApiFilters } from '../api-store'
import { applyBusinessAssumptionsToSummary, buildDashboardSummary, normalizePrecomputedSourceFacts, type ReporterRoot } from '../dashboard-utils'
import { type FrontendBootstrapData } from '../frontend-bootstrap'
import { createEmptyHistory } from '../history-utils'
import { getErrorMessage } from '../shared/error-utils'
import {
    createAdminGuard,
    createWorkspaceApiKeyGuard,
    createWorkspaceResolver,
    createWorkspaceUserGuard,
    extractAccessToken,
    getAuthClaimsFromLocals,
    getWorkspaceSessionCookieName,
    requireWorkspaceFromLocals,
} from './auth'
import { type SaasAppConfig, resolveSaasAppConfig } from './config'
import type { AdminIngestionHealthReport, IngestionRequestPayload, ServerSettingsRecord, WorkspaceIngestionHealthItem } from './contracts'
import { createFrontendShellRenderer, type FrontendShellRenderer } from './frontend-shell'
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
        ensureWorkspaceReadModelInitialized(slug, backendStorage, config)

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

            registry.recordAdminAudit({
                action: 'admin-login',
                actorLabel: adminSession.label,
                actorSessionId: adminSession.id,
                targetType: 'admin-session',
                targetId: adminSession.id,
                summary: 'Admin session started',
                details: {
                    expiresAt: adminSession.expiresAt,
                },
            })

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
                const session = registry.getAdminSession(claims.sessionId ?? '')
                registry.recordAdminAudit({
                    action: 'admin-logout',
                    actorLabel: session?.label ?? 'Admin session',
                    actorSessionId: claims.sessionId ?? null,
                    targetType: 'admin-session',
                    targetId: claims.sessionId ?? null,
                    summary: 'Admin session closed',
                })
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

        app.get('/api/admin/settings', adminApiGuard, (_request: Request, response: Response) => {
            response.json({ settings: buildServerSettingsDefaults(config) })
        })

        app.put('/api/admin/settings', adminApiGuard, (request: Request, response: Response) => {
            const actor = resolveAdminActor(response, registry)
            const settings = registry.updateServerSettings({
                adminBaseUrl: pickOptionalString(request.body?.adminBaseUrl),
                runtimeBaseUrl: pickOptionalString(request.body?.runtimeBaseUrl),
                allowDevBootstrap: typeof request.body?.allowDevBootstrap === 'boolean' ? request.body.allowDevBootstrap : undefined,
                requireWorkspaceAuth: typeof request.body?.requireWorkspaceAuth === 'boolean' ? request.body.requireWorkspaceAuth : undefined,
                accessTokenTtlSeconds: typeof request.body?.accessTokenTtlSeconds === 'number' ? request.body.accessTokenTtlSeconds : undefined,
                adminToken: typeof request.body?.adminToken === 'string' || request.body?.adminToken === null
                    ? pickOptionalString(request.body.adminToken)
                    : undefined,
                businessAssumptions: request.body?.businessAssumptions,
            }, buildServerSettingsDefaults(config))

            applyServerSettingsToConfig(config, settings)
            registry.recordAdminAudit({
                action: 'server-settings-updated',
                actorLabel: actor.label,
                actorSessionId: actor.sessionId,
                targetType: 'server-settings',
                summary: 'Server settings updated',
                details: {
                    requireWorkspaceAuth: settings.requireWorkspaceAuth,
                    allowDevBootstrap: settings.allowDevBootstrap,
                    accessTokenTtlSeconds: settings.accessTokenTtlSeconds,
                    adminBaseUrl: settings.adminBaseUrl ?? '',
                    runtimeBaseUrl: settings.runtimeBaseUrl ?? '',
                },
            })

            response.json({ settings })
        })

        app.get('/api/admin/audit', adminApiGuard, (request: Request, response: Response) => {
            const page = normalizePaginationQueryValue(request.query.page, 1, 10_000)
            const pageSize = normalizePaginationQueryValue(request.query.pageSize, 20, 100)

            response.json(registry.listAdminAuditPage(page, pageSize))
        })

        app.get('/api/admin/ingestion-health', adminApiGuard, (_request: Request, response: Response) => {
            response.json(buildAdminIngestionHealthReport(registry, backendStorage, config))
        })

        app.get('/api/workspaces/:slug', adminApiGuard, workspaceResolver, (_request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            response.json({ workspace })
        })

        app.post('/api/workspaces', adminApiGuard, (request: Request, response: Response) => {
            const name = pickOptionalString(request.body?.name)
            const actor = resolveAdminActor(response, registry)

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
                registry.recordAdminAudit({
                    action: 'workspace-created',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: createdWorkspace.workspace.slug,
                    targetType: 'workspace',
                    targetId: createdWorkspace.workspace.slug,
                    summary: 'Workspace created',
                    details: {
                        name: createdWorkspace.workspace.name,
                        slug: createdWorkspace.workspace.slug,
                        apiKeyId: createdWorkspace.apiKey.id,
                    },
                })

                response.status(201).json(createdWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error) })
            }
        })

        app.put('/api/workspaces/:slug', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)
            const name = pickOptionalString(request.body?.name)

            if (!name) {
                response.status(400).json({ error: 'Поле "name" обязательно.' })
                return
            }

            try {
                const updatedWorkspace = registry.updateWorkspace(workspace.slug, {
                    name,
                    slug: pickOptionalString(request.body?.slug) ?? workspace.slug,
                })

                if (updatedWorkspace.previousSlug !== updatedWorkspace.workspace.slug) {
                    backendStorage.renameWorkspaceData(updatedWorkspace.previousSlug, updatedWorkspace.workspace.slug)
                    invalidateWorkspaceApiStore(updatedWorkspace.previousSlug)
                }

                invalidateWorkspaceApiStore(updatedWorkspace.workspace.slug)
                ensureWorkspaceReadModelInitialized(updatedWorkspace.workspace.slug, backendStorage, config)
                registry.recordAdminAudit({
                    action: 'workspace-updated',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: updatedWorkspace.workspace.slug,
                    targetType: 'workspace',
                    targetId: updatedWorkspace.workspace.slug,
                    summary: 'Workspace updated',
                    details: {
                        previousSlug: updatedWorkspace.previousSlug,
                        slug: updatedWorkspace.workspace.slug,
                        name: updatedWorkspace.workspace.name,
                    },
                })

                response.json(updatedWorkspace)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.delete('/api/workspaces/:slug', adminApiGuard, workspaceResolver, (_request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)

            try {
                const deletedWorkspace = registry.deleteWorkspace(workspace.slug)
                backendStorage.deleteWorkspaceData(workspace.slug)
                invalidateWorkspaceApiStore(workspace.slug)
                registry.recordAdminAudit({
                    action: 'workspace-deleted',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'workspace',
                    targetId: workspace.slug,
                    summary: 'Workspace deleted',
                    details: {
                        slug: workspace.slug,
                        name: deletedWorkspace.name,
                    },
                })

                response.json({ workspace: deletedWorkspace })
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/api-keys', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)

            try {
                const createdApiKey = registry.createApiKey(workspace.slug, pickOptionalString(request.body?.label) ?? 'Generated key')
                registry.recordAdminAudit({
                    action: 'workspace-api-key-created',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'api-key',
                    targetId: createdApiKey.apiKey.id,
                    summary: 'Workspace API key created',
                    details: {
                        workspace: workspace.slug,
                        label: createdApiKey.apiKey.label,
                        apiKeyId: createdApiKey.apiKey.id,
                    },
                })

                response.status(201).json(createdApiKey)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/users', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const label = pickOptionalString(request.body?.label)
            const actor = resolveAdminActor(response, registry)

            if (!label) {
                response.status(400).json({ error: 'Поле "label" обязательно.' })
                return
            }

            try {
                const createdUser = registry.createUser(workspace.slug, {
                    label,
                    role: request.body?.role === 'owner' ? 'owner' : 'viewer',
                })

                registry.recordAdminAudit({
                    action: 'workspace-user-created',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'user',
                    targetId: createdUser.user.id,
                    summary: 'Workspace user created',
                    details: {
                        workspace: workspace.slug,
                        label: createdUser.user.label,
                        role: createdUser.user.role,
                        userId: createdUser.user.id,
                    },
                })

                response.status(201).json(createdUser)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/share-links', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)
            const ttlMinutes = normalizeShareLinkTtlMinutes(request.body?.ttlMinutes)

            try {
                const session = registry.createWorkspaceSession(workspace.slug, {
                    kind: 'workspace-share-link',
                    subjectId: `share-link:${randomTokenId()}`,
                    label: `Share link (${ttlMinutes}m)`,
                    scope: 'workspace:read',
                    activatedAt: null,
                    expiresAt: null,
                    ttlMinutes,
                })
                const shareLinkUrl = buildWorkspaceShareLinkUrl(request, config, workspace.slug, '', session.id)

                registry.recordAdminAudit({
                    action: 'workspace-share-link-created',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'session',
                    targetId: session.id,
                    summary: 'Workspace share link created',
                    details: {
                        workspace: workspace.slug,
                        sessionId: session.id,
                        ttlMinutes,
                        activationMode: 'first-open',
                    },
                })

                response.status(201).json({
                    workspace: registry.getWorkspace(workspace.slug),
                    shareSession: {
                        id: session.id,
                        label: session.label,
                        activatedAt: session.activatedAt,
                        expiresAt: session.expiresAt,
                        ttlMinutes,
                    },
                    shareLinkUrl,
                })
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.put('/api/workspaces/:slug/users/:userId/role', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)

            try {
                const result = registry.updateUserRole(workspace.slug, getRouteParam(request, 'userId'), request.body?.role === 'owner' ? 'owner' : 'viewer')
                registry.recordAdminAudit({
                    action: 'workspace-user-role-updated',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'user',
                    targetId: result.userId,
                    summary: 'Workspace user role updated',
                    details: {
                        workspace: workspace.slug,
                        userId: result.userId,
                        role: result.role,
                    },
                })

                response.json(result)
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/api-keys/:apiKeyId/disable', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)

            try {
                const nextWorkspace = registry.disableApiKey(workspace.slug, getRouteParam(request, 'apiKeyId'))
                registry.recordAdminAudit({
                    action: 'workspace-api-key-disabled',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'api-key',
                    targetId: getRouteParam(request, 'apiKeyId'),
                    summary: 'Workspace API key disabled',
                    details: {
                        workspace: workspace.slug,
                        apiKeyId: getRouteParam(request, 'apiKeyId'),
                    },
                })

                response.json({ workspace: nextWorkspace })
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.delete('/api/workspaces/:slug/api-keys/:apiKeyId', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)

            try {
                const nextWorkspace = registry.deleteApiKey(workspace.slug, getRouteParam(request, 'apiKeyId'))
                registry.recordAdminAudit({
                    action: 'workspace-api-key-deleted',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'api-key',
                    targetId: getRouteParam(request, 'apiKeyId'),
                    summary: 'Workspace API key deleted',
                    details: {
                        workspace: workspace.slug,
                        apiKeyId: getRouteParam(request, 'apiKeyId'),
                    },
                })

                response.json({ workspace: nextWorkspace })
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/users/:userId/disable', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)

            try {
                const nextWorkspace = registry.disableUser(workspace.slug, getRouteParam(request, 'userId'))
                registry.recordAdminAudit({
                    action: 'workspace-user-disabled',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'user',
                    targetId: getRouteParam(request, 'userId'),
                    summary: 'Workspace user disabled',
                    details: {
                        workspace: workspace.slug,
                        userId: getRouteParam(request, 'userId'),
                    },
                })

                response.json({ workspace: nextWorkspace })
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.delete('/api/workspaces/:slug/users/:userId', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)

            try {
                const nextWorkspace = registry.deleteUser(workspace.slug, getRouteParam(request, 'userId'))
                registry.recordAdminAudit({
                    action: 'workspace-user-deleted',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'user',
                    targetId: getRouteParam(request, 'userId'),
                    summary: 'Workspace user deleted',
                    details: {
                        workspace: workspace.slug,
                        userId: getRouteParam(request, 'userId'),
                    },
                })

                response.json({ workspace: nextWorkspace })
            } catch (error) {
                response.status(400).json({ error: getErrorMessage(error), workspace: workspace.slug })
            }
        })

        app.post('/api/workspaces/:slug/sessions/:sessionId/revoke', adminApiGuard, workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const actor = resolveAdminActor(response, registry)

            try {
                const nextWorkspace = registry.revokeWorkspaceSession(workspace.slug, getRouteParam(request, 'sessionId'))
                registry.recordAdminAudit({
                    action: 'workspace-session-revoked',
                    actorLabel: actor.label,
                    actorSessionId: actor.sessionId,
                    workspaceSlug: workspace.slug,
                    targetType: 'session',
                    targetId: getRouteParam(request, 'sessionId'),
                    summary: 'Workspace session revoked',
                    details: {
                        workspace: workspace.slug,
                        sessionId: getRouteParam(request, 'sessionId'),
                    },
                })

                response.json({ workspace: nextWorkspace })
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
            const shareId = getRouteParam(request, 'shareId')
            const resolvedShareSession = registry.findWorkspaceSession(shareId, 'workspace-share-link')

            if (!resolvedShareSession) {
                sendUnknownWorkspaceShareLinkErrorHtml(response)
                return
            }

            const workspaceSlug = resolvedShareSession.workspace.slug
            const shareSession = !resolvedShareSession.session.activatedAt
                ? registry.activateWorkspaceShareLink(workspaceSlug, resolvedShareSession.session.id)
                : resolvedShareSession.session

            if (!registry.isWorkspaceSessionActive(workspaceSlug, shareSession.id, 'workspace-share-link')) {
                sendWorkspaceShareLinkErrorShell(request, response, frontendShell, registry, config, workspaceSlug, {
                    statusCode: 401,
                    title: 'Ссылка отозвана',
                    message: 'Эта временная ссылка уже отозвана или её сессия истекла. Запроси новую share link в админке.',
                })
                return
            }

            const maxAgeSeconds = getSessionRemainingSeconds(shareSession.expiresAt)

            if (maxAgeSeconds <= 0) {
                sendWorkspaceShareLinkErrorShell(request, response, frontendShell, registry, config, workspaceSlug, {
                    statusCode: 401,
                    title: 'Ссылка истекла или некорректна',
                    message: 'Эта временная ссылка больше не даёт доступ к dashboard. Запроси новую share link или войди через workspace user token.',
                })
                return
            }

            const issuedToken = issueJwtToken({
                subject: shareSession.subjectId,
                kind: 'workspace-share-link',
                scope: 'workspace:read',
                secret: config.jwtSecret,
                ttlSeconds: maxAgeSeconds,
                workspaceSlug,
                sessionId: shareSession.id,
            })

            response.setHeader('Set-Cookie', buildCookieHeader({
                name: getWorkspaceSessionCookieName(config, workspaceSlug),
                value: issuedToken.token,
                maxAgeSeconds,
                path: '/',
            }))
            registry.touchWorkspaceSession(workspaceSlug, shareSession.id)
            response.redirect(`/w/${encodeURIComponent(workspaceSlug)}`)
        })

        app.get('/auth/workspaces/:slug/share-links/login', workspaceResolver, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const token = pickOptionalString(request.query.token)

            if (!token) {
                sendWorkspaceShareLinkErrorShell(request, response, frontendShell, registry, config, workspace.slug, {
                    statusCode: 400,
                    title: 'Ссылка неполная',
                    message: 'Во временной ссылке отсутствует token. Запроси новую ссылку в админке или открой обычный workspace login.',
                })
                return
            }

            const claims = verifyJwtToken(token, config.jwtSecret)

            if (!claims || claims.kind !== 'workspace-share-link' || claims.scope !== 'workspace:read' || claims.workspaceSlug !== workspace.slug) {
                sendWorkspaceShareLinkErrorShell(request, response, frontendShell, registry, config, workspace.slug, {
                    statusCode: 401,
                    title: 'Ссылка истекла или некорректна',
                    message: 'Эта временная ссылка больше не даёт доступ к dashboard. Запроси новую share link или войди через workspace user token.',
                })
                return
            }

            if (!registry.isWorkspaceSessionActive(workspace.slug, claims.sessionId ?? '', 'workspace-share-link')) {
                sendWorkspaceShareLinkErrorShell(request, response, frontendShell, registry, config, workspace.slug, {
                    statusCode: 401,
                    title: 'Ссылка отозвана',
                    message: 'Эта временная ссылка уже отозвана или её сессия истекла. Запроси новую share link в админке.',
                })
                return
            }

            const maxAgeSeconds = Math.max(0, claims.exp - Math.floor(Date.now() / 1000))

            response.setHeader('Set-Cookie', buildCookieHeader({
                name: getWorkspaceSessionCookieName(config, workspace.slug),
                value: token,
                maxAgeSeconds,
                path: '/',
            }))
            registry.touchWorkspaceSession(workspace.slug, claims.sessionId ?? '')
            response.redirect(`/w/${encodeURIComponent(workspace.slug)}`)
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

            if ((claims?.kind === 'workspace-user' || claims?.kind === 'workspace-share-link') && claims.workspaceSlug === workspace.slug) {
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
            response.json(createDefaultApiStore().getFilteredSummary(getFiltersFromRequest(request)))
        })

        app.get('/api/runs', (request: Request, response: Response) => {
            response.json({ runs: createDefaultApiStore().getRuns(getFiltersFromRequest(request)) })
        })

        app.get('/api/run/:id', (request: Request, response: Response) => {
            const store = createDefaultApiStore()
            const runId = getRouteParam(request, 'id')
            const run = store.getRunById(runId)

            if (!run) {
                response.status(404).json({ error: `Прогон с id "${runId}" не найден.` })
                return
            }

            response.json(run)
        })

        app.get('/api/flaky', (request: Request, response: Response) => {
            response.json(createDefaultApiStore().getFlakyPayload(getFiltersFromRequest(request)))
        })

        app.get('/api/errors/clusters', (request: Request, response: Response) => {
            response.json(createDefaultApiStore().getErrorClustersPayload(getFiltersFromRequest(request)))
        })

        app.get('/api/metrics/cost', (request: Request, response: Response) => {
            response.json(createDefaultApiStore().getCostMetricsPayload(getFiltersFromRequest(request)))
        })

        app.get('/api/artifacts/:runId', (request: Request, response: Response) => {
            sendArtifactFile(response, path.join(config.archiveRootPath, '_artifacts'), getRouteParam(request, 'runId'), pickOptionalString(request.query.path) ?? undefined)
        })

        app.get('/test/:name', (request: Request, response: Response) => {
            const store = createDefaultApiStore()
            const testName = getRouteParam(request, 'name')
            const filters = getTestHistoryFiltersFromRequest(request)
            const payload = store.getTestHistory(testName, filters)

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
            const store = createDefaultApiStore()
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
                initialDashboardSummary: store.getFilteredSummary(getFiltersFromRequest(request)),
                initialTestHistoryPayload: null,
                initialAdminWorkspaces: null,
                initialSessionStatus: readWorkspaceBootstrapSession(request, workspace.slug, registry, config),
            })
        })

        app.get('/w/:slug/test/:name', workspaceResolver, workspaceShellGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
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
            const store = createWorkspaceApiStore(workspace.slug)
            response.json(store.getFilteredSummary(getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/runs', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            response.json({ runs: store.getRuns(getFiltersFromRequest(request)) })
        })

        app.get('/api/workspaces/:slug/run/:id', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)

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
            const store = createWorkspaceApiStore(workspace.slug)
            response.json(store.getFlakyPayload(getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/errors/clusters', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            response.json(store.getErrorClustersPayload(getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/metrics/cost', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)
            response.json(store.getCostMetricsPayload(getFiltersFromRequest(request)))
        })

        app.get('/api/workspaces/:slug/test/:name', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
            const workspace = requireWorkspaceFromLocals(response)
            const store = createWorkspaceApiStore(workspace.slug)

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

function normalizePaginationQueryValue(value: unknown, fallback: number, maxValue: number): number {
    const normalizedValue = Array.isArray(value) ? value[0] : value

    if (typeof normalizedValue !== 'string' || normalizedValue.trim().length === 0) {
        return fallback
    }

    const parsedValue = Number(normalizedValue)

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        return fallback
    }

    return Math.min(parsedValue, maxValue)
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

function buildAdminIngestionHealthReport(
    registry: WorkspaceRegistry,
    backendStorage: BackendStorage,
    config: SaasAppConfig,
): AdminIngestionHealthReport {
    const items = registry.listWorkspaces()
        .map((workspace) => buildWorkspaceIngestionHealthItem(workspace.slug, workspace.name, backendStorage, config))
        .sort((left, right) => compareWorkspaceHealthItems(left, right))

    return {
        generatedAt: new Date().toISOString(),
        totals: {
            total: items.length,
            healthy: items.filter((item) => item.status === 'healthy').length,
            warning: items.filter((item) => item.status === 'warning').length,
            critical: items.filter((item) => item.status === 'critical').length,
            stale: items.filter((item) => item.status === 'stale').length,
            idle: items.filter((item) => item.status === 'idle').length,
        },
        items,
    }
}

function buildWorkspaceIngestionHealthItem(
    slug: string,
    name: string,
    backendStorage: BackendStorage,
    config: SaasAppConfig,
): WorkspaceIngestionHealthItem {
    ensureWorkspaceReadModelInitialized(slug, backendStorage, config)
    const history = backendStorage.getWorkspaceStorage(slug).readHistory()
    const latestRun = history.runs[history.runs.length - 1] ?? null
    const latestTimestamp = latestRun?.generatedAt ?? latestRun?.reportTimestamp ?? null
    const latestTime = latestTimestamp ? Date.parse(latestTimestamp) : Number.NaN
    const staleHours = Number.isFinite(latestTime)
        ? Math.max(0, Math.floor((Date.now() - latestTime) / (60 * 60 * 1000)))
        : null

    return {
        slug,
        name,
        status: latestRun === null
            ? 'idle'
            : staleHours !== null && staleHours >= 72
                ? 'stale'
                : latestRun.failedTests > 0 || latestRun.timedOutTests > 0 || latestRun.interruptedTests > 0
                    ? 'critical'
                    : latestRun.flakyTests > 0 || latestRun.passRate < 100
                        ? 'warning'
                        : 'healthy',
        runCount: history.runs.length,
        lastIngestionAt: latestTimestamp,
        staleHours,
        latestPassRate: latestRun?.passRate ?? null,
        latestFailedTests: latestRun?.failedTests ?? null,
        latestFlakyTests: latestRun?.flakyTests ?? null,
        latestDurationMs: latestRun?.totalDurationMs ?? null,
        latestSourceFile: latestRun?.sourceFile ?? null,
    }
}

function compareWorkspaceHealthItems(left: WorkspaceIngestionHealthItem, right: WorkspaceIngestionHealthItem): number {
    const statusRank: Record<WorkspaceIngestionHealthItem['status'], number> = {
        critical: 0,
        warning: 1,
        stale: 2,
        idle: 3,
        healthy: 4,
    }

    if (statusRank[left.status] !== statusRank[right.status]) {
        return statusRank[left.status] - statusRank[right.status]
    }

    const leftTime = left.lastIngestionAt ? Date.parse(left.lastIngestionAt) : Number.NEGATIVE_INFINITY
    const rightTime = right.lastIngestionAt ? Date.parse(right.lastIngestionAt) : Number.NEGATIVE_INFINITY

    return rightTime - leftTime
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
        authenticated: (workspaceClaims?.kind === 'workspace-user' || workspaceClaims?.kind === 'workspace-share-link')
            && workspaceClaims.scope === 'workspace:read'
            && workspaceClaims.workspaceSlug === workspaceSlug
            && registry.isWorkspaceSessionActive(workspaceSlug, workspaceClaims.sessionId ?? '', workspaceClaims.kind),
        authRequired: true,
        workspaceSlug,
    }
}

function normalizeShareLinkTtlMinutes(value: unknown): number {
    return value === 5 ? 5 : 10
}

function buildWorkspaceShareLinkUrl(request: Request, config: SaasAppConfig, workspaceSlug: string, token: string, sessionId?: string): string {
    const pathname = sessionId
        ? `/s/${encodeURIComponent(sessionId)}`
        : `/auth/workspaces/${encodeURIComponent(workspaceSlug)}/share-links/login?token=${encodeURIComponent(token)}`

    const serviceBaseUrl = config.runtimeBaseUrl ?? resolveRequestOrigin(request)

    if (!serviceBaseUrl) {
        return pathname
    }

    return `${serviceBaseUrl.replace(/\/+$/g, '')}${pathname}`
}

function resolveRequestOrigin(request: Request): string | null {
    const forwardedProto = pickForwardedValue(request.header('x-forwarded-proto'))
    const forwardedHost = pickForwardedValue(request.header('x-forwarded-host'))
    const host = forwardedHost ?? request.header('host')?.trim() ?? null
    const protocol = forwardedProto ?? request.protocol ?? 'http'

    if (!host) {
        return null
    }

    return `${protocol}://${host}`
}

function pickForwardedValue(value: string | undefined): string | null {
    if (!value) {
        return null
    }

    const normalizedValue = value.split(',')[0]?.trim()
    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null
}

function getSessionRemainingSeconds(expiresAt: string | null): number {
    if (!expiresAt) {
        return 0
    }

    const expiresAtMs = Date.parse(expiresAt)

    if (!Number.isFinite(expiresAtMs)) {
        return 0
    }

    return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
}

function sendWorkspaceShareLinkErrorShell(
    request: Request,
    response: Response,
    frontendShell: FrontendShellRenderer,
    registry: WorkspaceRegistry,
    config: SaasAppConfig,
    workspaceSlug: string,
    options: { statusCode: number; title: string; message: string },
): void {
    frontendShell.send(response, {
        route: {
            kind: 'workspace-share-link-error',
            workspaceSlug,
            title: options.title,
            message: options.message,
        },
        initialRequestUrl: request.originalUrl,
        serviceUrls: buildFrontendServiceUrls(config),
        initialDashboardSummary: null,
        initialTestHistoryPayload: null,
        initialAdminWorkspaces: null,
        initialSessionStatus: readWorkspaceBootstrapSession(request, workspaceSlug, registry, config),
    }, options.statusCode)
}

function sendUnknownWorkspaceShareLinkErrorHtml(response: Response): void {
        response.status(404).type('html').send(`<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Share link не найдена</title>
    <style>
        body { margin: 0; font-family: "Segoe UI", sans-serif; background: #08111f; color: #edf2fb; display: grid; min-height: 100vh; place-items: center; }
        main { width: min(560px, calc(100vw - 32px)); padding: 32px; border: 1px solid rgba(148,163,184,.24); border-radius: 24px; background: rgba(15,23,42,.92); box-shadow: 0 24px 80px rgba(2,6,23,.42); }
        h1 { margin: 0 0 12px; font-size: 28px; }
        p { margin: 0 0 20px; line-height: 1.6; color: #cbd5e1; }
        a { color: #7dd3fc; text-decoration: none; }
    </style>
</head>
<body>
    <main>
        <h1>Share link не найдена</h1>
        <p>Короткая ссылка не существует, уже была удалена или введена с ошибкой. Запроси новую ссылку в админке.</p>
        <a href="/">Открыть главную страницу</a>
    </main>
</body>
</html>`)
}

function randomTokenId(): string {
    return randomBytes(8).toString('hex')
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
            report: attachNormalizedSourceFacts(explicitReport, bodyRecord.precomputedSourceFacts),
            sourceFile: pickOptionalString(bodyRecord.sourceFile) ?? undefined,
            metadata: normalizeMetadata(bodyRecord.metadata),
        }
    }

    if (isReporterRoot(bodyRecord)) {
        return {
            report: attachNormalizedSourceFacts(bodyRecord, undefined),
            metadata: undefined,
        }
    }

    return null
}

function attachNormalizedSourceFacts(report: ReporterRoot, explicitSourceFacts: unknown): ReporterRoot {
    const normalizedSourceFacts = normalizePrecomputedSourceFacts(explicitSourceFacts ?? report.aqaPulseSourceFacts)

    if (!normalizedSourceFacts) {
        const { aqaPulseSourceFacts: _ignoredSourceFacts, ...reportWithoutSourceFacts } = report
        return reportWithoutSourceFacts
    }

    return {
        ...report,
        aqaPulseSourceFacts: normalizedSourceFacts,
    }
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


