/**
 * Назначение файла: регистрирует runtime auth API endpoints для workspace/admin login flows.
 */
import type express from 'express'
import type { Request, Response } from 'express'
import {
	loginWorkspaceApiKey as executeWorkspaceApiKeyLogin,
	loginWorkspaceUser as executeWorkspaceUserLogin,
	logoutWorkspaceReadSession as executeWorkspaceLogout,
} from '../../application/runtime'
import { getWorkspaceSessionCookieName, requireWorkspaceFromLocals } from '../security'
import { buildCookieHeader, buildExpiredCookieHeader } from '../security'
import { readCookieValue } from './cookies'
import { pickOptionalString } from './request-inputs'
import type { RuntimeRoutesContext } from './runtime-routes'

export function registerRuntimeAuthApiRoutes(app: express.Express, context: RuntimeRoutesContext): void {
	const {
		config,
		registry,
		workspaceResolver,
		workspaceApiGuard,
	} = context

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
}