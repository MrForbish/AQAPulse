import * as path from 'node:path'
import type express from 'express'
import type { Request, RequestHandler, Response } from 'express'
import { ApiStore } from '../../../api-store'
import {
    loginViaWorkspaceShareLinkToken,
    loginWorkspaceApiKey as executeWorkspaceApiKeyLogin,
    loginWorkspaceUser as executeWorkspaceUserLogin,
    logoutWorkspaceReadSession as executeWorkspaceLogout,
    openWorkspaceShareLink,
    queryDashboardCostMetricsPayload,
    queryDashboardErrorClustersPayload,
    queryDashboardFlakyPayload,
    queryDashboardRunById,
    queryDashboardRuns,
    queryDashboardSummary,
    queryTestHistoryForApi,
    queryTestHistoryForShell,
} from '../../application'
import { getWorkspaceSessionCookieName, requireWorkspaceFromLocals } from '../../auth'
import type { SaasAppConfig } from '../../config'
import type { FrontendShellRenderer } from '../../frontend-shell'
import { buildCookieHeader, buildExpiredCookieHeader } from '../../jwt'
import { ingestReporterRun } from '../../run-ingestion.service'
import type { BackendStorage } from '../../storage'
import { WorkspaceRegistry } from '../../workspace-registry'
import { sendArtifactFile } from './artifact-file-response'
import { readCookieValue } from './cookies'
import { buildFrontendServiceUrls, readWorkspaceBootstrapSession } from './frontend-bootstrap'
import { normalizeIngestionPayload } from './ingestion-payload'
import { getFiltersFromRequest, getRouteParam, pickOptionalString } from './request-inputs'
import { sendUnknownWorkspaceShareLinkErrorHtml, sendWorkspaceShareLinkErrorShell } from './workspace-share-link-http'

export interface RuntimeRoutesContext {
    config: SaasAppConfig
    registry: WorkspaceRegistry
    backendStorage: BackendStorage
    frontendShell: FrontendShellRenderer
    workspaceResolver: RequestHandler
    workspaceApiKeyGuard: RequestHandler
    workspaceShellGuard: RequestHandler
    workspaceApiGuard: RequestHandler
    createDefaultApiStore(): ApiStore
    createWorkspaceApiStore(slug: string): ApiStore
    invalidateDefaultApiStore(): void
    invalidateWorkspaceApiStore(slug: string): void
}

export function registerRuntimeRoutes(app: express.Express, context: RuntimeRoutesContext): void {
    const {
        config,
        registry,
        backendStorage,
        frontendShell,
        workspaceResolver,
        workspaceApiKeyGuard,
        workspaceShellGuard,
        workspaceApiGuard,
        createDefaultApiStore,
        createWorkspaceApiStore,
        invalidateDefaultApiStore,
        invalidateWorkspaceApiStore,
    } = context

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

    app.get('/auth/workspaces/:slug/session', workspaceResolver, (request: Request, response: Response, next) => {
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

    app.get('/api/workspaces/:slug/artifacts/:runId', workspaceResolver, workspaceApiGuard, (request: Request, response: Response) => {
        const workspace = requireWorkspaceFromLocals(response)
        const storage = backendStorage.getWorkspaceStorage(workspace.slug)
        sendArtifactFile(response, storage.paths.artifactsPath, getRouteParam(request, 'runId'), pickOptionalString(request.query.path) ?? undefined)
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