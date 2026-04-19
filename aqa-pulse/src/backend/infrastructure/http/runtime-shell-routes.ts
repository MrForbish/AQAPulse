import type express from 'express'
import { registerRuntimePublicShellRoutes } from './runtime-public-shell-routes'
import type { RuntimeRoutesContext } from './runtime-routes'
import { registerRuntimeWorkspaceShellRoutes } from './runtime-workspace-shell-routes'

export function registerRuntimeShellRoutes(app: express.Express, context: RuntimeRoutesContext): void {
	registerRuntimePublicShellRoutes(app, context)
	registerRuntimeWorkspaceShellRoutes(app, context)
}