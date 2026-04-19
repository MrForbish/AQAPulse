/**
 * Назначение файла: подготавливает demo workspace и начальный прогон,
 * возвращая готовые данные для CLI-вывода.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadReporterReport } from '../dashboard-utils'
import { type SaasAppConfig } from './config'
import { createBootstrapCliRuntime } from './bootstrap-cli-runtime'
import { ingestReporterRun } from './run-ingestion.service'

export interface DemoBootstrapResult {
    workspaceSlug: string
    apiKeyToken: string
    storageDriver: SaasAppConfig['storageDriver']
    dataRoot: string
    sqlitePath: string | null
    dashboardUrl: string
    summaryApiUrl: string
    archivedRunDirectory: string
}

/**
 * Создаёт или переиспользует demo workspace, добавляет в него демонстрационный прогон
 * и возвращает все ключевые данные для локального запуска.
 */
export function bootstrapDemoWorkspace(configOverrides: Partial<SaasAppConfig> = {}): DemoBootstrapResult {
    const { config, backendStorage, registry } = createBootstrapCliRuntime(configOverrides)
    const fixturePath = resolveDemoFixturePath()
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

    return {
        workspaceSlug: provisioned.workspace.slug,
        apiKeyToken: provisioned.apiKey.token,
        storageDriver: config.storageDriver,
        dataRoot: config.dataRoot,
        sqlitePath: config.sqlitePath,
        dashboardUrl: `http://127.0.0.1:3000/w/${provisioned.workspace.slug}`,
        summaryApiUrl: `http://127.0.0.1:3000/api/workspaces/${provisioned.workspace.slug}/summary`,
        archivedRunDirectory: result.archivedRunDirectory,
    }
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