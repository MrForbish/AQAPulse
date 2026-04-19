/**
 * Назначение файла: выполняет инициализацию self-hosted storage layout
 * и возвращает готовые к печати runtime-пути и флаги сервера.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { type SaasAppConfig } from './config'
import { createBootstrapCliRuntime } from './bootstrap-cli-runtime'

export interface SelfHostedInitializationResult {
    storageDriver: SaasAppConfig['storageDriver']
    dataRoot: string
    sqlitePath: string | null
    registryPath: string
    distPath: string
    archiveRootPath: string
    adminTokenConfigured: boolean
    devBootstrapEnabled: boolean
    workspaceAuthRequired: boolean
}

/**
 * Создаёт минимальный self-hosted storage layout и инициализирует registry,
 * чтобы сервер можно было запускать без дополнительных ручных шагов.
 */
export function initializeSelfHostedStorage(configOverrides: Partial<SaasAppConfig> = {}): SelfHostedInitializationResult {
    const { config, backendStorage } = createBootstrapCliRuntime(configOverrides)

    fs.mkdirSync(config.dataRoot, { recursive: true })
    fs.mkdirSync(path.join(config.dataRoot, 'workspaces'), { recursive: true })
    fs.mkdirSync(config.distPath, { recursive: true })
    fs.mkdirSync(config.archiveRootPath, { recursive: true })

    if (config.sqlitePath) {
        fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true })
    }

    const registry = backendStorage.registry.readRegistry()
    backendStorage.registry.writeRegistry(registry)

    return {
        storageDriver: config.storageDriver,
        dataRoot: config.dataRoot,
        sqlitePath: config.sqlitePath,
        registryPath: backendStorage.registry.registryPath,
        distPath: config.distPath,
        archiveRootPath: config.archiveRootPath,
        adminTokenConfigured: Boolean(config.adminToken),
        devBootstrapEnabled: config.allowDevBootstrap,
        workspaceAuthRequired: config.requireWorkspaceAuth,
    }
}