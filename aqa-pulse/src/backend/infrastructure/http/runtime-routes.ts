/**
 * Назначение файла: определяет `RuntimeRoutesContext` и связывает runtime shell/auth/data registrars.
 */
import type express from 'express'
import type { RequestHandler } from 'express'
import { ApiStore } from '../../../api-store'
import type { SaasAppConfig } from '../../config'
import type { FrontendShellRenderer } from '../../frontend-shell'
import type { BackendStorage, RuntimeHttpWorkspaceRegistry } from '../persistence'
import { registerRuntimeAuthApiRoutes } from './runtime-auth-api-routes'
import { registerRuntimeDataRoutes } from './runtime-data-routes'
import { registerRuntimeShellRoutes } from './runtime-shell-routes'

export interface RuntimeRoutesContext {
    config: SaasAppConfig
    registry: RuntimeHttpWorkspaceRegistry
    backendStorage: BackendStorage
    frontendShell: FrontendShellRenderer
    workspaceResolver: RequestHandler
    workspaceApiKeyGuard: RequestHandler
    workspaceShellGuard: RequestHandler
    workspaceApiGuard: RequestHandler
    createDefaultApiStore(): ApiStore
    createWorkspaceApiStore(slug: string): ApiStore
    invalidateDefaultApiStore(): void
    invalidateWorkspaceApiStore(slug: string): void
}

export function registerRuntimeRoutes(app: express.Express, context: RuntimeRoutesContext): void {
    registerRuntimeShellRoutes(app, context)
    registerRuntimeAuthApiRoutes(app, context)
    registerRuntimeDataRoutes(app, context)
}