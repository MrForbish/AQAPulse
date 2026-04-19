/**
 * Назначение файла: регистрирует admin API endpoints для управления workspaces, users, API keys и server settings.
 */
import { randomUUID } from 'node:crypto'
import type express from 'express'
import type { Request, Response } from 'express'
import { normalizeWorkspaceUserRole } from '../../domain/workspace-rules'
import { getErrorMessage } from '../../../shared/error-utils'
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
	revokeWorkspaceSessionCommand,
	updateServerSettingsCommand,
	updateWorkspaceCommand,
	updateWorkspaceUserRoleCommand,
} from '../../application/admin'
import { requireWorkspaceFromLocals } from '../security'
import { normalizeShareLinkTtlMinutes } from '../../domain/share-link-rules'
import { buildServerSettingsDefaults, applyServerSettingsToConfig } from '../server-settings'
import { resolveAdminActor } from './admin-actor'
import { ensureDevBootstrapEnabled } from './dev-bootstrap-middleware'
import { getRouteParam, normalizePaginationQueryValue, pickOptionalString } from './request-inputs'
import { buildWorkspaceShareLinkUrl } from './workspace-share-link-http'
import type { AdminRoutesContext } from './admin-routes'

export function registerAdminApiRoutes(app: express.Express, context: AdminRoutesContext): void {
	const {
		config,
		registry,
		backendStorage,
		adminApiGuard,
		workspaceResolver,
		invalidateWorkspaceApiStore,
	} = context

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
				role: normalizeWorkspaceUserRole(request.body?.role),
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
				role: normalizeWorkspaceUserRole(request.body?.role),
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
				role: normalizeWorkspaceUserRole(request.body?.role),
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