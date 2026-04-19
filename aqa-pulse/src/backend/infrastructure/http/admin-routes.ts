import type express from 'express'
import type { RequestHandler } from 'express'
import type { SaasAppConfig } from '../../config'
import type { FrontendShellRenderer } from '../../frontend-shell'
import type { AdminHttpWorkspaceRegistry, BackendStorage } from '../persistence'
import { registerAdminApiRoutes } from './admin-api-routes'
import { registerAdminShellRoutes } from './admin-shell-routes'

export interface AdminRoutesContext {
    config: SaasAppConfig
    registry: AdminHttpWorkspaceRegistry
    backendStorage: BackendStorage
    frontendShell: FrontendShellRenderer
    adminShellGuard: RequestHandler
    adminApiGuard: RequestHandler
    workspaceResolver: RequestHandler
    invalidateWorkspaceApiStore(slug: string): void
    redirectRootToAdmin: boolean
}

export function registerAdminRoutes(app: express.Express, context: AdminRoutesContext): void {
    registerAdminShellRoutes(app, context)
    registerAdminApiRoutes(app, context)
}
