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

const { JSDOM } = require('jsdom') as {
    JSDOM: new (html?: string, options?: { url?: string }) => {
        window: Window & typeof globalThis & {
            document: Document
            close(): void
        }
    }
}

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
    const attachmentTestTitle = 'Checkout > retries after payment gateway timeout'

    assert(firstTest, 'Legacy HTML smoke expects at least one current-run test.')

    const testHistoryPayload = store.getTestHistory(firstTest.title, {})
    const attachmentTestHistoryPayload = store.getTestHistory(attachmentTestTitle, {})

    assert(testHistoryPayload && !('candidates' in testHistoryPayload), 'Legacy HTML smoke expects a concrete test history payload.')
    assert(attachmentTestHistoryPayload && !('candidates' in attachmentTestHistoryPayload), 'Legacy HTML smoke expects an attachment-rich concrete test history payload.')

    const warnMessages: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
        warnMessages.push(args.map((value) => String(value)).join(' '))
    }

    try {
        const legacyRuntimePath = pathToFileURL(path.resolve(__dirname, '../../aqa-pulse-client/dist/index.js')).href
        const legacyRuntime = await import(legacyRuntimePath)
        const dashboardHtml = legacyRuntime.renderDashboardHtml(summary, { basePath: '/legacy' })
        const historyHtml = legacyRuntime.renderTestHistoryHtml(testHistoryPayload, firstTest.title, {}, {
            basePath: '/legacy',
            apiBasePath: '/legacy/api',
            artifactBasePath: '/legacy/artifacts',
        })
        const nestedSteps: typeof attachmentTestHistoryPayload.history[number]['attemptDetails'][number]['steps'] = [
            {
                title: 'Submit payment',
                category: 'test.step',
                depth: 1,
                durationMs: 7200,
                status: 'failed',
                errorMessage: 'Timeout 30000ms while waiting for payment gateway response',
                isFailurePoint: true,
            },
            {
                title: 'Wait for gateway response',
                category: 'pw:api',
                depth: 2,
                durationMs: 3200,
                status: 'failed',
                errorMessage: 'Timeout 30000ms while waiting for payment gateway response',
                isFailurePoint: true,
            },
            {
                title: 'Retry policy applied',
                category: 'test.step',
                depth: 2,
                durationMs: 1800,
                status: 'failed',
                errorMessage: null,
                isFailurePoint: false,
            },
            {
                title: 'Capture timeout diagnostics',
                category: 'pw:api',
                depth: 2,
                durationMs: 900,
                status: 'passed',
                errorMessage: null,
                isFailurePoint: false,
            },
        ]
        const nestedLatestItem = {
            ...attachmentTestHistoryPayload.history[0],
            attemptDetails: attachmentTestHistoryPayload.history[0].attemptDetails.map((attempt, attemptIndex) => attemptIndex === 0
                ? {
                    ...attempt,
                    steps: nestedSteps,
                }
                : attempt),
        }
        const nestedStepsPayload = {
            ...attachmentTestHistoryPayload,
            latestRun: nestedLatestItem,
            history: attachmentTestHistoryPayload.history.map((item, itemIndex) => itemIndex === 0 ? nestedLatestItem : item),
        }
        const nestedHistoryHtml = legacyRuntime.renderTestHistoryHtml(nestedStepsPayload, attachmentTestTitle, {}, {
            basePath: '/legacy',
            apiBasePath: '/legacy/api',
            artifactBasePath: '/legacy/artifacts',
        })
        const nestedHistoryDom = new JSDOM(nestedHistoryHtml)
        const nestedChildrenGroup = nestedHistoryDom.window.document.querySelector('.step-tree-children') as HTMLDivElement | null
        const metricHeadingHtml = legacyRuntime.renderMetricHeading('Smoke heading', 'Smoke tooltip')

        assertIncludes(dashboardHtml, 'AQA Pulse — Unified Quality Assurance Platform', 'Legacy dashboard HTML title must be rendered.')
        assertIncludes(dashboardHtml, 'Ключевые сигналы', 'Legacy dashboard HTML should still include manager overview section.')
        assertIncludes(historyHtml, 'История прогонов теста', 'Legacy test history HTML should include the timeline section.')
        assertIncludes(historyHtml, 'Диагностика последнего запуска', 'Legacy test history HTML should include diagnostics section.')
        assertIncludes(nestedHistoryHtml, 'step-tree-children', 'Legacy test history HTML should preserve nested diagnostics step groups.')
        assertIncludes(nestedHistoryHtml, 'step-item-nested', 'Legacy test history HTML should mark nested diagnostics steps for parity with React UI.')
        assert(nestedChildrenGroup, 'Legacy nested diagnostics should render a nested children group.')
        assert.deepEqual(
            Array.from(nestedChildrenGroup.children)
                .map((child) => child.querySelector('.step-title')?.textContent?.trim() ?? '')
                .filter((title) => title.length > 0),
            ['Wait for gateway response', 'Retry policy applied', 'Capture timeout diagnostics'],
            'Legacy nested diagnostics should keep all depth-2 steps under a single depth-1 test.step parent group.',
        )
        assertIncludes(metricHeadingHtml, 'Smoke heading', 'Legacy metric heading helper should still render headings.')

        assert.equal(warnMessages.length, 1, `Legacy runtime should warn once, got ${warnMessages.length}: ${warnMessages.join(' | ')}`)
        assertIncludes(warnMessages[0] ?? '', 'aqa-pulse-client is a legacy compatibility package', 'Legacy runtime warning text changed unexpectedly.')
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