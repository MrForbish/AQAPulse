import * as path from 'node:path'
import type { RequestHandler } from 'express'
import {
    createAdminGuard,
    createWorkspaceApiKeyGuard,
    createWorkspaceResolver,
    createWorkspaceUserGuard,
} from './security'
import { createFrontendShellRenderer, type FrontendShellRenderer } from '../frontend-shell'
import { createApiStoreRuntime, type ApiStoreRuntime } from './api-store-runtime'
import type { SaasAppConfig } from '../config'
import { applyServerSettingsToConfig, buildServerSettingsDefaults } from './server-settings'
import { createBackendStorage, type BackendStorage, WorkspaceRegistry } from './persistence'
import type { AdminRoutesContext, RuntimeRoutesContext } from './http'

export type SaasServiceMode = 'all' | 'admin' | 'runtime'

interface AppStaticPaths {
    distPath: string
    distAssetsPath: string
    frontendDistPath: string
}

interface SecurityRuntime {
    adminShellGuard: RequestHandler
    adminApiGuard: RequestHandler
    workspaceResolver: RequestHandler
    workspaceApiKeyGuard: RequestHandler
    workspaceShellGuard: RequestHandler
    workspaceApiGuard: RequestHandler
}

export interface AppRuntimeContext {
    config: SaasAppConfig
    staticPaths: AppStaticPaths
    adminRoutesContext: AdminRoutesContext | null
    runtimeRoutesContext: RuntimeRoutesContext | null
}

export function createAppRuntimeContext(config: SaasAppConfig, mode: SaasServiceMode): AppRuntimeContext {
    const backendStorage = createBackendStorage(config)
    const registry = new WorkspaceRegistry(backendStorage.registry)
    applyServerSettingsToConfig(config, registry.getServerSettings(buildServerSettingsDefaults(config)))

    const frontendShell = createFrontendShellRenderer(path.resolve(config.distPath, './web'))
    const security = createSecurityRuntime(registry, config)
    const apiStores = createApiStoreRuntime(backendStorage, config)
    const staticPaths = createStaticPaths(config)

    return {
        config,
        staticPaths,
        adminRoutesContext: mode === 'runtime'
            ? null
            : buildAdminRoutesContext(config, registry, backendStorage, frontendShell, security, apiStores, mode),
        runtimeRoutesContext: mode === 'admin'
            ? null
            : buildRuntimeRoutesContext(config, registry, backendStorage, frontendShell, security, apiStores),
    }
}

function createStaticPaths(config: SaasAppConfig): AppStaticPaths {
    return {
        distPath: config.distPath,
        distAssetsPath: path.resolve(config.distPath, './assets'),
        frontendDistPath: path.resolve(config.distPath, './web'),
    }
}

function createSecurityRuntime(registry: WorkspaceRegistry, config: SaasAppConfig): SecurityRuntime {
    return {
        adminShellGuard: createAdminGuard(registry, config, { unauthorizedResponseMode: 'redirect' }),
        adminApiGuard: createAdminGuard(registry, config, { unauthorizedResponseMode: 'json' }),
        workspaceResolver: createWorkspaceResolver(registry),
        workspaceApiKeyGuard: createWorkspaceApiKeyGuard(registry, config),
        workspaceShellGuard: createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'redirect' }),
        workspaceApiGuard: createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'json' }),
    }
}

function buildAdminRoutesContext(
    config: SaasAppConfig,
    registry: WorkspaceRegistry,
    backendStorage: BackendStorage,
    frontendShell: FrontendShellRenderer,
    security: SecurityRuntime,
    apiStores: ApiStoreRuntime,
    mode: SaasServiceMode,
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
        redirectRootToAdmin: mode === 'admin',
    }
}

function buildRuntimeRoutesContext(
    config: SaasAppConfig,
    registry: WorkspaceRegistry,
    backendStorage: BackendStorage,
    frontendShell: FrontendShellRenderer,
    security: SecurityRuntime,
    apiStores: ApiStoreRuntime,
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