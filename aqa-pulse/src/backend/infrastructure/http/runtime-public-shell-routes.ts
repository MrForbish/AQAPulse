import type express from 'express'
import type { Request, Response } from 'express'
import { queryTestHistoryForShell } from '../../application/runtime'
import { buildFrontendServiceUrls } from './frontend-bootstrap'
import { getFiltersFromRequest, getRouteParam } from './request-inputs'
import type { RuntimeRoutesContext } from './runtime-routes'

export function registerRuntimePublicShellRoutes(app: express.Express, context: RuntimeRoutesContext): void {
	const {
		config,
		frontendShell,
		createDefaultApiStore,
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
}