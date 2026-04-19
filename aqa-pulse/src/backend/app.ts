/**
 * Назначение: поднимает self-hosted/saas HTTP-приложение с React shell, JSON API, auth и ingestion-маршрутами.
 */
import * as path from 'node:path'
import express, { type Request, type Response } from 'express'
import { ApiStore } from '../api-store'
import {
    createAdminGuard,
    createWorkspaceApiKeyGuard,
    createWorkspaceResolver,
    createWorkspaceUserGuard,
} from './auth'
import { ensureWorkspaceReadModelInitialized as initializeWorkspaceReadModel } from './application'
import { type SaasAppConfig, resolveSaasAppConfig } from './config'
import { createFrontendShellRenderer } from './frontend-shell'
import {
    registerAdminRoutes,
    registerCommonHttpErrorHandlers,
    registerRuntimeRoutes,
} from './infrastructure/http'
import { applyServerSettingsToConfig, buildServerSettingsDefaults } from './infrastructure/server-settings'
import { createBackendStorage } from './storage'
import { WorkspaceRegistry } from './workspace-registry'

type SaasServiceMode = 'all' | 'admin' | 'runtime'

/**
 * Собирает единый Express app для admin/workspace сценариев: React shell отдаётся из одного места, а bootstrap/session данные заполняются на основе текущего запроса.
 */
export function createSaasApp(options: Partial<SaasAppConfig> = {}): express.Express {
    return createConfiguredSaasApp(options, 'all')
}

export function createAdminApp(options: Partial<SaasAppConfig> = {}): express.Express {
    return createConfiguredSaasApp(options, 'admin')
}

export function createRuntimeApp(options: Partial<SaasAppConfig> = {}): express.Express {
    return createConfiguredSaasApp(options, 'runtime')
}

function createConfiguredSaasApp(options: Partial<SaasAppConfig>, mode: SaasServiceMode): express.Express {
    const app = express()
    const config = resolveSaasAppConfig(options)
    const backendStorage = createBackendStorage(config)
    const registry = new WorkspaceRegistry(backendStorage.registry)
    applyServerSettingsToConfig(config, registry.getServerSettings(buildServerSettingsDefaults(config)))
    const adminShellGuard = createAdminGuard(registry, config, { unauthorizedResponseMode: 'redirect' })
    const adminApiGuard = createAdminGuard(registry, config, { unauthorizedResponseMode: 'json' })
    const workspaceResolver = createWorkspaceResolver(registry)
    const workspaceApiKeyGuard = createWorkspaceApiKeyGuard(registry, config)
    const workspaceShellGuard = createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'redirect' })
    const workspaceApiGuard = createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'json' })
    let defaultApiStore: ApiStore | null = null
    const workspaceApiStores = new Map<string, ApiStore>()
    const createDefaultApiStore = () => {
        if (!defaultApiStore) {
            defaultApiStore = new ApiStore({
                storage: backendStorage.createDashboardReadStorage({
                    summaryPath: path.join(config.distPath, 'dashboard-data.json'),
                    historyPath: path.join(config.distPath, 'history.json'),
                    archiveRootPath: config.archiveRootPath,
                }),
                businessAssumptions: config.businessAssumptions,
            })
        }

        return defaultApiStore
    }
    const invalidateDefaultApiStore = () => {
        defaultApiStore?.invalidateCaches()
        defaultApiStore = null
    }
    const createWorkspaceApiStore = (slug: string) => {
        initializeWorkspaceReadModel(slug, backendStorage, config)

        const cachedStore = workspaceApiStores.get(slug)

        if (cachedStore) {
            return cachedStore
        }

        const store = new ApiStore({
            storage: backendStorage.getWorkspaceStorage(slug),
            businessAssumptions: config.businessAssumptions,
        })

        workspaceApiStores.set(slug, store)
        return store
    }
    const invalidateWorkspaceApiStore = (slug: string) => {
        const store = workspaceApiStores.get(slug)

        store?.invalidateCaches()
        workspaceApiStores.delete(slug)
    }
    const distPath = config.distPath
    const distAssetsPath = path.resolve(distPath, './assets')
    const frontendDistPath = path.resolve(distPath, './web')
    const frontendShell = createFrontendShellRenderer(frontendDistPath)

    app.use(express.json({ limit: config.requestBodyLimit }))
    app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }))
    app.use('/assets', express.static(distAssetsPath))
    app.use('/ui-assets', express.static(frontendDistPath))
    app.use('/static', express.static(distPath))
    app.use('/w/:slug/assets', express.static(distAssetsPath))

    app.get('/api/health', (_request: Request, response: Response) => {
        response.json({ status: 'ok', service: mode })
    })

    if (mode !== 'runtime') {
        registerAdminRoutes(app, {
            config,
            registry,
            backendStorage,
            frontendShell,
            adminShellGuard,
            adminApiGuard,
            workspaceResolver,
            invalidateWorkspaceApiStore,
            redirectRootToAdmin: mode === 'admin',
        })
    }

    if (mode !== 'admin') {
        registerRuntimeRoutes(app, {
            config,
            registry,
            backendStorage,
            frontendShell,
            workspaceResolver,
            workspaceApiKeyGuard,
            workspaceShellGuard,
            workspaceApiGuard,
            createDefaultApiStore,
            createWorkspaceApiStore,
            invalidateDefaultApiStore,
            invalidateWorkspaceApiStore,
        })
    }

    registerCommonHttpErrorHandlers(app)

    return app
}



