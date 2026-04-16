import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ApiStore } from './api-store'
import type { WorkspaceDescriptor } from './backend/contracts'
import { ingestReporterRun } from './backend/run-ingestion.service'
import { FileSystemBackendStorage } from './backend/storage'
import { loadReporterReport } from './dashboard-utils'

async function main(): Promise<void> {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aqa-pulse-legacy-html-smoke-'))
    const dataRoot = path.join(tempRoot, 'data')
    const backendStorage = new FileSystemBackendStorage(dataRoot)
    const workspaceSlug = 'legacy-html-smoke'
    const workspace: WorkspaceDescriptor = {
        slug: workspaceSlug,
        name: 'Legacy HTML smoke workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        apiKeys: [],
        users: [],
    }
    const workspaceStorage = backendStorage.createWorkspaceStorage(workspaceSlug)
    const previousFixturePath = path.resolve(__dirname, '../fixtures/sample-llm-report-previous.json')
    const latestFixturePath = path.resolve(__dirname, '../fixtures/sample-llm-report.json')
    const previousReport = loadReporterReport(previousFixturePath)
    const latestReport = loadReporterReport(latestFixturePath)

    ingestReporterRun({
        workspace,
        storage: workspaceStorage,
        report: previousReport,
        metadata: { branch: 'main', commit: 'previous', author: 'Smoke Bot' },
        sourceFile: previousFixturePath,
        artifactsPath: path.join(workspaceStorage.paths.archiveRootPath, '_artifacts'),
    })
    ingestReporterRun({
        workspace,
        storage: workspaceStorage,
        report: latestReport,
        metadata: { branch: 'main', commit: 'latest', author: 'Smoke Bot' },
        sourceFile: latestFixturePath,
        artifactsPath: path.join(workspaceStorage.paths.archiveRootPath, '_artifacts'),
    })

    const store = new ApiStore({
        summaryPath: workspaceStorage.paths.summaryPath,
        historyPath: workspaceStorage.paths.historyPath,
        archiveRootPath: workspaceStorage.paths.archiveRootPath,
    })
    const summary = store.getSummary()
    const firstTest = summary.currentRunTests.all[0] ?? null

    assert(firstTest, 'Legacy HTML smoke expects at least one current-run test.')

    const testHistoryPayload = store.getTestHistory(firstTest.title, {})

    assert(testHistoryPayload && !('candidates' in testHistoryPayload), 'Legacy HTML smoke expects a concrete test history payload.')

    const warnMessages: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
        warnMessages.push(args.map((value) => String(value)).join(' '))
    }

    try {
        const legacyRuntimePath = pathToFileURL(path.join(__dirname, '../dist-ts/legacy-html-runtime.js')).href
        const legacyRuntime = await import(legacyRuntimePath)
        const dashboardHtml = legacyRuntime.renderDashboardHtml(summary, { basePath: '/legacy' })
        const historyHtml = legacyRuntime.renderTestHistoryHtml(testHistoryPayload, firstTest.title, {}, {
            basePath: '/legacy',
            apiBasePath: '/legacy/api',
            artifactBasePath: '/legacy/artifacts',
        })
        const metricHeadingHtml = legacyRuntime.renderMetricHeading('Smoke heading', 'Smoke tooltip')

        assertIncludes(dashboardHtml, 'AQA Pulse — Unified Quality Assurance Platform', 'Legacy dashboard HTML title must be rendered.')
        assertIncludes(dashboardHtml, 'Ключевые сигналы', 'Legacy dashboard HTML should still include manager overview section.')
        assertIncludes(historyHtml, 'История прогонов теста', 'Legacy test history HTML should include the timeline section.')
        assertIncludes(historyHtml, 'Диагностика последнего запуска', 'Legacy test history HTML should include diagnostics section.')
        assertIncludes(metricHeadingHtml, 'Smoke heading', 'Legacy metric heading helper should still render headings.')

        assert.equal(warnMessages.length, 1, `Legacy runtime should warn once, got ${warnMessages.length}: ${warnMessages.join(' | ')}`)
        assertIncludes(warnMessages[0] ?? '', 'legacy HTML renderer compatibility layer', 'Legacy runtime warning text changed unexpectedly.')
    } finally {
        console.warn = originalWarn
        fs.rmSync(tempRoot, { recursive: true, force: true })
    }

    console.log('Legacy HTML smoke passed.')
}

function assertIncludes(haystack: string, needle: string, message: string): void {
    assert(haystack.includes(needle), message)
}

void main()