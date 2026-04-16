/**
 * Назначение: инициализирует self-hosted storage layout и печатает операционные runtime-пути перед первым запуском сервера.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { resolveSaasAppConfig } from './config'
import { createBackendStorage } from './storage'

const config = resolveSaasAppConfig()
const backendStorage = createBackendStorage(config)

try {
    fs.mkdirSync(config.dataRoot, { recursive: true })
    fs.mkdirSync(path.join(config.dataRoot, 'workspaces'), { recursive: true })
    fs.mkdirSync(config.distPath, { recursive: true })
    fs.mkdirSync(config.archiveRootPath, { recursive: true })

    if (config.sqlitePath) {
        fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true })
    }

    const registry = backendStorage.registry.readRegistry()
    backendStorage.registry.writeRegistry(registry)

    console.log('Self-hosted storage AQA Pulse инициализирован.')
    console.log(`Storage driver: ${config.storageDriver}`)
    console.log(`Data root: ${config.dataRoot}`)
    console.log(`SQLite path: ${config.sqlitePath ?? 'not configured'}`)
    console.log(`Registry: ${backendStorage.registry.registryPath}`)
    console.log(`UI dist path: ${config.distPath}`)
    console.log(`Archive path: ${config.archiveRootPath}`)
    console.log(`Admin token: ${config.adminToken ? 'configured' : 'not configured'}`)
    console.log(`Dev bootstrap: ${config.allowDevBootstrap ? 'enabled' : 'disabled'}`)
    console.log(`Workspace auth: ${config.requireWorkspaceAuth ? 'required' : 'optional'}`)
    console.log('Дальше можно запускать сервер командой: npm run start или aqa-pulse-server start')
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка инициализации self-hosted storage: ${errorMessage}`)
    process.exitCode = 1
}

