import * as path from 'node:path'
import { ApiStore } from '../../api-store'
import { ensureWorkspaceReadModelInitialized } from '../application/admin'
import type { SaasAppConfig } from '../config'
import type { BackendStorage } from './persistence'

export interface ApiStoreRuntime {
    createDefaultApiStore(): ApiStore
    createWorkspaceApiStore(slug: string): ApiStore
    invalidateDefaultApiStore(): void
    invalidateWorkspaceApiStore(slug: string): void
}

export function createApiStoreRuntime(backendStorage: BackendStorage, config: SaasAppConfig): ApiStoreRuntime {
    let defaultApiStore: ApiStore | null = null
    const workspaceApiStores = new Map<string, ApiStore>()

    return {
        createDefaultApiStore(): ApiStore {
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
        },

        createWorkspaceApiStore(slug: string): ApiStore {
            ensureWorkspaceReadModelInitialized(slug, backendStorage, config)

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
        },

        invalidateDefaultApiStore(): void {
            defaultApiStore?.invalidateCaches()
            defaultApiStore = null
        },

        invalidateWorkspaceApiStore(slug: string): void {
            const store = workspaceApiStores.get(slug)

            store?.invalidateCaches()
            workspaceApiStores.delete(slug)
        },
    }
}