/**
 * Назначение файла: изолирует создание зависимостей для хранилища,
 * чтобы основной runtime-модуль не знал деталей инициализации реестра и настроек сервера.
 */
import type { SaasAppConfig } from '../config'
import { createBackendStorage, type BackendStorage, WorkspaceRegistry } from './persistence'
import { applyServerSettingsToConfig, buildServerSettingsDefaults } from './server-settings'

export interface PersistenceRuntime {
    backendStorage: BackendStorage
    registry: WorkspaceRegistry
}

/**
 * Создаёт зависимости для хранения данных и синхронизирует конфигурацию
 * с сохранёнными настройками сервера до сборки HTTP-маршрутов.
 */
export function createPersistenceRuntime(config: SaasAppConfig): PersistenceRuntime {
    const backendStorage = createBackendStorage(config)
    const registry = new WorkspaceRegistry(backendStorage.registry)

    applyServerSettingsToConfig(config, registry.getServerSettings(buildServerSettingsDefaults(config)))

    return {
        backendStorage,
        registry,
    }
}