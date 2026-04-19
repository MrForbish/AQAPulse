/**
 * Назначение файла: собирает `RuntimeRoutesContext` из готовых зависимостей,
 * чтобы основной модуль приложения не знал внутреннее устройство runtime-маршрутов.
 */
import type { RequestHandler } from 'express'
import type { SaasAppConfig } from '../../config'
import type { FrontendShellRenderer } from '../../frontend-shell'
import type { BackendStorage, RuntimeHttpWorkspaceRegistry } from '../persistence'
import type { ApiStoreRuntime } from '../api-store-runtime'
import type { RuntimeRoutesContext } from './runtime-routes'

export interface WorkspaceSecurityRuntime {
    workspaceResolver: RequestHandler
    workspaceApiKeyGuard: RequestHandler
    workspaceShellGuard: RequestHandler
    workspaceApiGuard: RequestHandler
}

/**
 * Собирает контекст для runtime-маршрутов с middleware workspace-доступа
 * и фабриками для чтения данных дашборда.
 */
export function createRuntimeRoutesContext(
    config: SaasAppConfig,
    registry: RuntimeHttpWorkspaceRegistry,
    backendStorage: BackendStorage,
    frontendShell: FrontendShellRenderer,
    security: WorkspaceSecurityRuntime,
    apiStores: Pick<ApiStoreRuntime, 'createDefaultApiStore' | 'createWorkspaceApiStore' | 'invalidateDefaultApiStore' | 'invalidateWorkspaceApiStore'>,
): RuntimeRoutesContext {
    return {
        config,
        registry,
        backendStorage,
        frontendShell,
        workspaceResolver: security.workspaceResolver,
        workspaceApiKeyGuard: security.workspaceApiKeyGuard,
        workspaceShellGuard: security.workspaceShellGuard,
        workspaceApiGuard: security.workspaceApiGuard,
        createDefaultApiStore: apiStores.createDefaultApiStore,
        createWorkspaceApiStore: apiStores.createWorkspaceApiStore,
        invalidateDefaultApiStore: apiStores.invalidateDefaultApiStore,
        invalidateWorkspaceApiStore: apiStores.invalidateWorkspaceApiStore,
    }
}