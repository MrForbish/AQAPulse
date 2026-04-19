/**
 * Назначение файла: собирает `AdminRoutesContext` из готовых зависимостей,
 * чтобы основной модуль приложения не создавал вручную контекст admin-маршрутов.
 */
import type { RequestHandler } from 'express'
import type { SaasAppConfig } from '../../config'
import type { FrontendShellRenderer } from '../../frontend-shell'
import type { AdminHttpWorkspaceRegistry, BackendStorage } from '../persistence'
import type { ApiStoreRuntime } from '../api-store-runtime'
import type { AdminRoutesContext } from './admin-routes'

export interface AdminSecurityRuntime {
    adminShellGuard: RequestHandler
    adminApiGuard: RequestHandler
    workspaceResolver: RequestHandler
}

/**
 * Собирает контекст для admin-маршрутов на основе хранилища,
 * HTML-оболочки фронтенда и middleware аутентификации.
 */
export function createAdminRoutesContext(
    config: SaasAppConfig,
    registry: AdminHttpWorkspaceRegistry,
    backendStorage: BackendStorage,
    frontendShell: FrontendShellRenderer,
    security: AdminSecurityRuntime,
    apiStores: Pick<ApiStoreRuntime, 'invalidateWorkspaceApiStore'>,
    redirectRootToAdmin: boolean,
): AdminRoutesContext {
    return {
        config,
        registry,
        backendStorage,
        frontendShell,
        adminShellGuard: security.adminShellGuard,
        adminApiGuard: security.adminApiGuard,
        workspaceResolver: security.workspaceResolver,
        invalidateWorkspaceApiStore: apiStores.invalidateWorkspaceApiStore,
        redirectRootToAdmin,
    }
}