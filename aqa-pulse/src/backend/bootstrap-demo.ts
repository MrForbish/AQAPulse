/**
 * Назначение файла: создаёт демонстрационный workspace и начальные данные
 * для локального запуска сервера.
 */
import { bootstrapDemoWorkspace } from './bootstrap-demo-runtime'

try {
    const result = bootstrapDemoWorkspace()

    console.log('SaaS demo workspace готов.')
    console.log(`Workspace: ${result.workspaceSlug}`)
    console.log(`API key: ${result.apiKeyToken}`)
    console.log(`Storage driver: ${result.storageDriver}`)
    console.log(`Data root: ${result.dataRoot}`)
    console.log(`SQLite path: ${result.sqlitePath ?? 'not configured'}`)
    console.log(`Dashboard URL: ${result.dashboardUrl}`)
    console.log(`Summary API: ${result.summaryApiUrl}`)
    console.log(`Архивный прогон: ${result.archivedRunDirectory}`)
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка подготовки demo workspace: ${errorMessage}`)
    process.exitCode = 1
}

