/**
 * Назначение файла: регистрирует workspace-scoped runtime data API, включая ingestion и dashboard queries.
 */
import type express from 'express'
import type { Request, Response } from 'express'
import {
	queryDashboardCostMetricsPayload,
	queryDashboardErrorClustersPayload,
	queryDashboardFlakyPayload,
	queryDashboardRunById,
	queryDashboardRuns,
	queryDashboardSummary,
	queryTestHistoryForApi,
} from '../../application/runtime'
import { requireWorkspaceFromLocals } from '../security'
import { ingestReporterRun } from '../../run-ingestion.service'
import { sendArtifactFile } from './artifact-file-response'
import { normalizeIngestionPayload } from './ingestion-payload'
import { getFiltersFromRequest, getRouteParam, pickOptionalString } from './request-inputs'
import type { RuntimeRoutesContext } from './runtime-routes'

export function registerRuntimeWorkspaceDataRoutes(app: express.Express, context: RuntimeRoutesContext): void {
	const {
		config,
		backendStorage,
		workspaceResolver,
		workspaceApiKeyGuard,
		workspaceApiGuard,
		createWorkspaceApiStore,
		invalidateDefaultApiStore,
		invalidateWorkspaceApiStore,
	} = context

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