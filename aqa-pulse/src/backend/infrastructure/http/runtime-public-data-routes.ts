/**
 * Назначение файла: регистрирует runtime data endpoints, доступные без workspace route prefix.
 */
import * as path from 'node:path'
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
import { sendArtifactFile } from './artifact-file-response'
import { getFiltersFromRequest, getRouteParam, pickOptionalString } from './request-inputs'
import type { RuntimeRoutesContext } from './runtime-routes'

export function registerRuntimePublicDataRoutes(app: express.Express, context: RuntimeRoutesContext): void {
	const {
		config,
		createDefaultApiStore,
	} = context

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

	app.get('/api/test/:name', (request: Request, response: Response) => {
		const testName = getRouteParam(request, 'name')
		const result = queryTestHistoryForApi(createDefaultApiStore(), testName, getFiltersFromRequest(request))
		response.status(result.statusCode).json(result.body)
	})
}