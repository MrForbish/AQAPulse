import type express from 'express'
import type { Request, Response } from 'express'
import { loginAdmin as executeAdminLogin, logoutAdmin as executeAdminLogout } from '../../application/admin'
import { buildCookieHeader, buildExpiredCookieHeader } from '../security'
import { buildFrontendServiceUrls, readAdminBootstrapSession } from './frontend-bootstrap'
import { readCookieValue } from './cookies'
import { pickOptionalString } from './request-inputs'
import type { AdminRoutesContext } from './admin-routes'

export function registerAdminShellRoutes(app: express.Express, context: AdminRoutesContext): void {
	const {
		config,
		registry,
		frontendShell,
		adminShellGuard,
		adminApiGuard,
		redirectRootToAdmin,
	} = context

	if (redirectRootToAdmin) {
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

	app.get('/auth/admin/session', (request: Request, response: Response, next) => {
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
}