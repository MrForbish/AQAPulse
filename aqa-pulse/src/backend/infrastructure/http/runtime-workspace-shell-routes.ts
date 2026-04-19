/**
 * Назначение файла: регистрирует workspace-scoped shell routes, login pages и share-link shells.
 */
import type express from 'express'
import type { Request, Response } from 'express'
import {
	loginViaWorkspaceShareLinkToken,
	openWorkspaceShareLink,
	queryDashboardSummary,
	queryTestHistoryForShell,
} from '../../application/runtime'
import { buildCookieHeader, getWorkspaceSessionCookieName, requireWorkspaceFromLocals } from '../security'
import { readWorkspaceBootstrapSession } from './bootstrap-session-readers'
import { buildFrontendServiceUrls } from './frontend-service-urls'
import { getFiltersFromRequest, getRouteParam, pickOptionalString } from './request-inputs'
import { sendUnknownWorkspaceShareLinkErrorHtml, sendWorkspaceShareLinkErrorShell } from './workspace-share-link-http'
import type { RuntimeRoutesContext } from './runtime-routes'

export function registerRuntimeWorkspaceShellRoutes(app: express.Express, context: RuntimeRoutesContext): void {
	const {
		config,
		registry,
		frontendShell,
		workspaceResolver,
		workspaceShellGuard,
		createWorkspaceApiStore,
	} = context

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
}