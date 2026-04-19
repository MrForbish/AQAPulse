import type express from 'express'
import { registerRuntimePublicDataRoutes } from './runtime-public-data-routes'
import { registerRuntimeWorkspaceDataRoutes } from './runtime-workspace-data-routes'
import type { RuntimeRoutesContext } from './runtime-routes'

export function registerRuntimeDataRoutes(app: express.Express, context: RuntimeRoutesContext): void {
	registerRuntimePublicDataRoutes(app, context)
	registerRuntimeWorkspaceDataRoutes(app, context)
}