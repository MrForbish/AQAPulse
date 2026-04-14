import * as path from 'node:path'
import {
    type DashboardRunMetadata,
    formatDuration,
    formatPercent,
    loadReporterReport,
    readDashboardSummary,
} from './dashboard-utils'
import { ingestReporterRun } from './backend/run-ingestion.service'
import { FileSystemBackendStorage } from './backend/storage'
import { resolveWorkspaceDataRoot } from './backend/workspace-paths'

const parsedCliArgs = parseCliArgs(process.argv.slice(2))
const positionalArgs = parsedCliArgs.positionalArgs
const namedArgs = parsedCliArgs.namedArgs
const hasNamedMetadata = Boolean(namedArgs.branch || namedArgs.commit || namedArgs.author)
const useImplicitMetadataPositionals = !hasNamedMetadata && positionalArgs.length >= 5 && !looksLikePath(positionalArgs[3])
const historyArchiveArg = useImplicitMetadataPositionals ? undefined : positionalArgs[3]
const metadataPositionalArgs = useImplicitMetadataPositionals ? positionalArgs.slice(3) : positionalArgs.slice(4)

const inputPath = path.resolve(process.cwd(), positionalArgs[0] ?? './fixtures/sample-llm-report.json')
const outputPath = path.resolve(process.cwd(), positionalArgs[1] ?? './dist/dashboard-data.json')
const historyPath = path.resolve(process.cwd(), positionalArgs[2] ?? './dist/history.json')
const historyArchivePath = path.resolve(process.cwd(), historyArchiveArg ?? './history')
const runMetadata = getRunMetadata(namedArgs, metadataPositionalArgs)
const dataRoot = resolveWorkspaceDataRoot()
const backendStorage = new FileSystemBackendStorage(dataRoot)

try {
    const report = loadReporterReport(inputPath)
    const ingestionResult = ingestReporterRun({
        workspace: {
            slug: 'local-cli',
            name: 'Local CLI workspace',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            apiKeys: [],
            users: [],
        },
        storage: backendStorage.createWorkspaceStorage('local-cli', {
            summaryPath: outputPath,
            historyPath,
            archiveRootPath: historyArchivePath,
        }),
        report,
        metadata: runMetadata,
        sourceFile: inputPath,
    })
    const dashboardSummary = readDashboardSummary(outputPath)

    console.log('Сводка для AQA Pulse создана.')
    console.log(`Источник: ${inputPath}`)
    console.log(`Выходной файл: ${outputPath}`)
    console.log(`History-файл: ${historyPath}`)
    console.log(`History-архив: ${historyArchivePath}`)
    console.log(`Архивный прогон: ${ingestionResult.archivedRunDirectory}`)
    console.log(`Всего тестов: ${dashboardSummary.kpis.totalTests}`)
    console.log(`Passed: ${dashboardSummary.kpis.passedTests}`)
    console.log(`Failed: ${dashboardSummary.kpis.failedTests}`)
    console.log(`Flaky: ${dashboardSummary.kpis.flakyTests}`)
    console.log(`Pass Rate: ${formatPercent(dashboardSummary.kpis.passRate)}`)
    console.log(`Время прогона: ${formatDuration(dashboardSummary.kpis.totalDurationMs)}`)
    console.log(`Кластеры ошибок: ${dashboardSummary.kpis.errorClusterCount}`)
    console.log(`Прогонов в истории: ${dashboardSummary.history.totalRuns}`)
    console.log(`Branch: ${dashboardSummary.runMetadata.branch ?? '—'}`)
    console.log(`Commit: ${dashboardSummary.runMetadata.commit ?? '—'}`)
    console.log(`Author: ${dashboardSummary.runMetadata.author ?? '—'}`)
    console.log(`Сводка построена: ${ingestionResult.summaryGeneratedAt}`)
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка генерации dashboard-data.json: ${errorMessage}`)
    process.exitCode = 1
}

function parseCliArgs(args: string[]): { positionalArgs: string[]; namedArgs: Record<string, string> } {
    const positionalArgs: string[] = []
    const namedArgs: Record<string, string> = {}

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index]

        if (!argument.startsWith('--')) {
            positionalArgs.push(argument)
            continue
        }

        const key = argument.slice(2)
        const value = args[index + 1]

        if (!key || !value || value.startsWith('--')) {
            continue
        }

        namedArgs[key] = value
        index += 1
    }

    return { positionalArgs, namedArgs }
}

function getRunMetadata(namedArgs: Record<string, string>, positionalMetadataArgs: string[]): DashboardRunMetadata {
    return {
        branch: pickFirstValue(
            namedArgs.branch,
            positionalMetadataArgs[0],
            process.env.AQA_PULSE_BRANCH,
            process.env.CI_COMMIT_REF_NAME,
            process.env.GIT_BRANCH,
        ),
        commit: pickFirstValue(
            namedArgs.commit,
            positionalMetadataArgs[1],
            process.env.AQA_PULSE_COMMIT,
            process.env.CI_COMMIT_SHA,
            process.env.GIT_COMMIT,
        ),
        author: pickFirstValue(
            namedArgs.author,
            positionalMetadataArgs[2],
            process.env.AQA_PULSE_AUTHOR,
            process.env.CI_COMMIT_AUTHOR,
            process.env.GIT_AUTHOR_NAME,
        ),
    }
}

function looksLikePath(value: string | undefined): boolean {
    if (!value) {
        return false
    }

    return value.includes('\\') || value.includes('/') || value.includes('.')
}

function pickFirstValue(...values: Array<string | undefined>): string | null {
    for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim()
        }
    }

    return null
}



