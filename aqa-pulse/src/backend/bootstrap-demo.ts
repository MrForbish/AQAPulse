/**
 * Назначение файла: создаёт демонстрационный workspace и начальные данные
 * для локального запуска сервера.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadReporterReport } from '../dashboard-utils'
import { resolveSaasAppConfig } from './config'
import type { BootstrapWorkspaceRegistry } from './infrastructure/persistence'
import { createBackendStorage, WorkspaceRegistry } from './infrastructure/persistence'
import { ingestReporterRun } from './run-ingestion.service'

const config = resolveSaasAppConfig()
const fixturePath = resolveDemoFixturePath()
const backendStorage = createBackendStorage(config)
const registry: BootstrapWorkspaceRegistry = new WorkspaceRegistry(backendStorage.registry)

try {
    const existingWorkspace = registry.getWorkspace('demo')
    const provisioned = existingWorkspace
        ? registry.createApiKey('demo', 'Demo bootstrap key')
        : registry.createWorkspace({
            slug: 'demo',
            name: 'Demo Workspace',
            apiKeyLabel: 'Demo bootstrap key',
        })

    const report = loadReporterReport(fixturePath)
    const result = ingestReporterRun({
        workspace: provisioned.workspace,
        storage: backendStorage.getWorkspaceStorage(provisioned.workspace.slug),
        report,
        metadata: {
            branch: 'main',
            commit: 'demo-bootstrap',
            author: 'AQA Pulse demo',
        },
        sourceFile: fixturePath,
        businessAssumptions: config.businessAssumptions,
    })

    console.log('SaaS demo workspace готов.')
    console.log(`Workspace: ${provisioned.workspace.slug}`)
    console.log(`API key: ${provisioned.apiKey.token}`)
    console.log(`Storage driver: ${config.storageDriver}`)
    console.log(`Data root: ${config.dataRoot}`)
    console.log(`SQLite path: ${config.sqlitePath ?? 'not configured'}`)
    console.log(`Dashboard URL: http://127.0.0.1:3000/w/${provisioned.workspace.slug}`)
    console.log(`Summary API: http://127.0.0.1:3000/api/workspaces/${provisioned.workspace.slug}/summary`)
    console.log(`Архивный прогон: ${result.archivedRunDirectory}`)
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка подготовки demo workspace: ${errorMessage}`)
    process.exitCode = 1
}

function resolveDemoFixturePath(): string {
    const candidatePaths = [
        path.resolve(process.cwd(), './fixtures/sample-llm-report.json'),
        path.resolve(__dirname, '../../fixtures/sample-llm-report.json'),
        path.resolve(__dirname, '../fixtures/sample-llm-report.json'),
    ]

    const fixturePath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath))

    if (!fixturePath) {
        throw new Error(`Не найден demo fixture sample-llm-report.json. Проверены пути: ${candidatePaths.join(', ')}`)
    }

    return fixturePath
}

