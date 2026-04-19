/**
 * Назначение файла: собирает общий runtime для bootstrap/init CLI-сценариев,
 * чтобы entrypoint-файлы не знали деталей создания persistence-зависимостей.
 */
import { type SaasAppConfig, resolveSaasAppConfig } from './config'
import { createPersistenceRuntime } from './infrastructure/app-persistence-runtime'
import type { BackendStorage, BootstrapWorkspaceRegistry } from './infrastructure/persistence'

export interface BootstrapCliRuntime {
    config: SaasAppConfig
    backendStorage: BackendStorage
    registry: BootstrapWorkspaceRegistry
}

/**
 * Подготавливает единый CLI runtime: нормализованную конфигурацию,
 * хранилище и registry, поверх которых работают bootstrap/init-команды.
 */
export function createBootstrapCliRuntime(configOverrides: Partial<SaasAppConfig> = {}): BootstrapCliRuntime {
    const config = resolveSaasAppConfig(configOverrides)
    const { backendStorage, registry } = createPersistenceRuntime(config)

    return {
        config,
        backendStorage,
        registry,
    }
}