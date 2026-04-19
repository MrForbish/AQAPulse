/**
 * Назначение: инициализирует self-hosted storage layout и печатает операционные runtime-пути перед первым запуском сервера.
 */
import { initializeSelfHostedStorage } from './init-self-hosted-runtime'

try {
    const result = initializeSelfHostedStorage()

    console.log('Self-hosted storage AQA Pulse инициализирован.')
    console.log(`Storage driver: ${result.storageDriver}`)
    console.log(`Data root: ${result.dataRoot}`)
    console.log(`SQLite path: ${result.sqlitePath ?? 'not configured'}`)
    console.log(`Registry: ${result.registryPath}`)
    console.log(`UI dist path: ${result.distPath}`)
    console.log(`Archive path: ${result.archiveRootPath}`)
    console.log(`Admin token: ${result.adminTokenConfigured ? 'configured' : 'not configured'}`)
    console.log(`Dev bootstrap: ${result.devBootstrapEnabled ? 'enabled' : 'disabled'}`)
    console.log(`Workspace auth: ${result.workspaceAuthRequired ? 'required' : 'optional'}`)
    console.log('Дальше можно запускать сервер командой: npm run start или aqa-pulse-server start')
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка инициализации self-hosted storage: ${errorMessage}`)
    process.exitCode = 1
}

