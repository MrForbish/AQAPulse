// Purpose: smoke-test the embedded React public surface with SSR checks plus DOM-level error-boundary recovery coverage.
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as React from 'react'
import { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ApiStore } from './api-store'
import type { WorkspaceDescriptor } from './backend/contracts'
import { FileSystemBackendStorage } from './backend/storage'
import { loadReporterReport } from './dashboard-utils'
import {
    createEmptyFrontendBootstrap,
    type FrontendBootstrapData,
    type FrontendRouteDescriptor,
} from './frontend-bootstrap'
import { ingestReporterRun } from './backend/run-ingestion.service'

const { JSDOM } = require('jsdom') as {
    JSDOM: new (html?: string, options?: { url?: string }) => {
        window: Window & typeof globalThis & {
            document: Document
            navigator: Navigator
            HTMLElement: typeof HTMLElement
            Node: typeof Node
            MutationObserver: typeof MutationObserver
            Event: typeof Event
            MouseEvent: typeof MouseEvent
            location: Location & { reload: () => void }
            close(): void
        }
    }
}

// This smoke builds real workspace data first so exported pages are exercised against the same summary/history contracts used by production flows.
async function main(): Promise<void> {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aqa-pulse-react-smoke-'))
    const dataRoot = path.join(tempRoot, 'data')
    const backendStorage = new FileSystemBackendStorage(dataRoot)
    const workspaceSlug = 'react-smoke'
    const workspace: WorkspaceDescriptor = {
        slug: workspaceSlug,
        name: 'React smoke workspace',
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
    const firstTestTitle = requireFirstTestTitle(latestReport)
    const testHistoryPayload = store.getTestHistory(firstTestTitle, {})

    assert(testHistoryPayload && !('candidates' in testHistoryPayload), 'React smoke expects a concrete test history payload.')

    const reactModule = await import('aqa-pulse/react')

    renderMarkup('dashboard page', renderWithRouter(
        React.createElement(
            reactModule.RuntimeProvider,
            {
                bootstrap: createBootstrap({ route: { kind: 'dashboard', workspaceSlug: null }, initialRequestUrl: '/', initialDashboardSummary: summary }),
                children: React.createElement(reactModule.DashboardPage, { workspaceSlug: null }),
            },
        ),
        '/',
    ), ['React UI', summary.sourceFile])

    renderMarkup('test history page', renderWithRouter(
        React.createElement(
            reactModule.RuntimeProvider,
            {
                bootstrap: createBootstrap({
                    route: { kind: 'test-history', workspaceSlug: null, testName: firstTestTitle },
                    initialRequestUrl: `/test/${encodeURIComponent(firstTestTitle)}`,
                    initialTestHistoryPayload: testHistoryPayload,
                }),
                children: React.createElement(reactModule.TestHistoryPage, { workspaceSlug: null, requestedTitle: firstTestTitle }),
            },
        ),
        `/test/${encodeURIComponent(firstTestTitle)}`,
    ), ['Test History', 'MTBF'])

    renderMarkup('admin dashboard page', renderWithRouter(
        React.createElement(
            reactModule.RuntimeProvider,
            {
                bootstrap: createBootstrap({
                    route: { kind: 'admin-dashboard' },
                    initialRequestUrl: '/admin',
                    initialAdminWorkspaces: [workspace],
                    initialSessionStatus: { scope: 'admin', authenticated: true, authRequired: true, workspaceSlug: null },
                }),
                children: React.createElement(reactModule.AdminDashboardPage),
            },
        ),
        '/admin',
    ), ['AQA Pulse Admin', workspace.name])

    renderMarkup('admin login page', renderWithRouter(
        React.createElement(
            reactModule.RuntimeProvider,
            {
                bootstrap: createBootstrap({
                    route: { kind: 'admin-login' },
                    initialRequestUrl: '/admin/login',
                    initialSessionStatus: { scope: 'admin', authenticated: false, authRequired: true, workspaceSlug: null },
                }),
                children: React.createElement(reactModule.AdminLoginPage),
            },
        ),
        '/admin/login',
    ), ['Admin token', 'AQA Pulse Admin'])

    renderMarkup('workspace login page', renderWithRouter(
        React.createElement(
            reactModule.RuntimeProvider,
            {
                bootstrap: createBootstrap({
                    route: { kind: 'workspace-login', workspaceSlug },
                    initialRequestUrl: `/w/${workspaceSlug}/login`,
                    initialSessionStatus: { scope: 'workspace', authenticated: false, authRequired: true, workspaceSlug },
                }),
                children: React.createElement(reactModule.WorkspaceLoginPage, { workspaceSlug }),
            },
        ),
        `/w/${workspaceSlug}/login`,
    ), ['Workspace login', workspaceSlug])

    renderMarkup('workspace api key page', renderWithRouter(
        React.createElement(
            reactModule.RuntimeProvider,
            {
                bootstrap: createBootstrap({
                    route: { kind: 'workspace-api-key-exchange', workspaceSlug },
                    initialRequestUrl: `/auth/workspaces/${workspaceSlug}/api-keys/login`,
                    initialSessionStatus: { scope: 'workspace', authenticated: false, authRequired: true, workspaceSlug },
                }),
                children: React.createElement(reactModule.WorkspaceApiKeyExchangePage, { workspaceSlug }),
            },
        ),
        `/auth/workspaces/${workspaceSlug}/api-keys/login`,
    ), ['ingestion JWT', workspaceSlug])

    renderMarkup('auth shell', renderWithRouter(
        React.createElement(
            reactModule.AuthShell,
            {
                eyebrow: 'Embedded auth shell',
                title: 'Auth test',
                description: 'Smoke test for exported AuthShell.',
                footerLink: { href: '/admin', label: 'Back' },
                children: React.createElement('div', null, 'Children rendered'),
            },
        ),
        '/admin/login',
    ), ['Auth test', 'Children rendered'])

    await verifyErrorBoundaryRecovery(reactModule)

    fs.rmSync(tempRoot, { recursive: true, force: true })
    console.log('React surface smoke passed.')
}

function renderWithRouter(element: React.ReactElement, initialEntry: string): string {
    return renderToStaticMarkup(
        React.createElement(MemoryRouter, { initialEntries: [initialEntry] }, element),
    )
}

function renderMarkup(label: string, markup: string, expectedSnippets: string[]): void {
    for (const snippet of expectedSnippets) {
        assert(markup.includes(snippet), `${label} markup must include: ${snippet}`)
    }
}

function createBootstrap(overrides: Partial<FrontendBootstrapData> & { route: FrontendRouteDescriptor; initialRequestUrl: string }): FrontendBootstrapData {
    return {
        ...createEmptyFrontendBootstrap(),
        route: overrides.route,
        initialRequestUrl: overrides.initialRequestUrl,
        initialDashboardSummary: overrides.initialDashboardSummary ?? null,
        initialTestHistoryPayload: overrides.initialTestHistoryPayload ?? null,
        initialAdminWorkspaces: overrides.initialAdminWorkspaces ?? null,
        initialSessionStatus: overrides.initialSessionStatus ?? { scope: 'public', authenticated: true, authRequired: false, workspaceSlug: null },
    }
}

// The DOM phase checks the two behaviors that SSR cannot cover: error fallback rendering and user-triggered retry/reload recovery.
async function verifyErrorBoundaryRecovery(reactModule: typeof import('aqa-pulse/react')): Promise<void> {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousMutationObserver = globalThis.MutationObserver
    const previousEvent = globalThis.Event
    const previousMouseEvent = globalThis.MouseEvent
    const previousConsoleError = console.error

    let root: Root | null = null

    try {
        setGlobalValue('window', dom.window)
        setGlobalValue('document', dom.window.document)
        setGlobalValue('navigator', dom.window.navigator)
        setGlobalValue('HTMLElement', dom.window.HTMLElement)
        setGlobalValue('Node', dom.window.Node)
        setGlobalValue('MutationObserver', dom.window.MutationObserver)
        setGlobalValue('Event', dom.window.Event)
        setGlobalValue('MouseEvent', dom.window.MouseEvent)

        const container = dom.window.document.getElementById('root')
        assert(container, 'Error boundary smoke needs root container.')

        console.error = () => undefined
        root = createRoot(container)

        let shouldThrow = true
        function ThrowOnce(): React.JSX.Element {
            if (shouldThrow) {
                throw new Error('Boundary smoke error')
            }

            return React.createElement('div', { 'data-testid': 'recovered' }, 'Recovered view')
        }

        await act(async () => {
            root!.render(React.createElement(reactModule.FrontendErrorBoundary, null, React.createElement(ThrowOnce)))
        })

        assert(
            container.textContent?.includes('Интерфейс не смог отрисоваться'),
            `FrontendErrorBoundary should render fallback after render error. Actual DOM: ${container.innerHTML}`,
        )
        const retryButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Попробовать снова'))
        assert(retryButton, 'FrontendErrorBoundary fallback should expose retry button.')
        shouldThrow = false

        await act(async () => {
            retryButton!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        })

        assert(container.textContent?.includes('Recovered view'), 'FrontendErrorBoundary retry should recover when child render stops throwing.')

        let reloadCalled = false
        const reloadWindow = Object.create(dom.window) as Window & typeof globalThis
        Object.defineProperty(reloadWindow, 'location', {
            configurable: true,
            value: {
                ...dom.window.location,
                reload: () => {
                    reloadCalled = true
                },
            },
        })
        setGlobalValue('window', reloadWindow)

        await act(async () => {
            root!.render(
                React.createElement(
                    reactModule.FrontendErrorBoundary,
                    null,
                    React.createElement(() => {
                        throw new Error('Reload smoke error')
                    }),
                ),
            )
        })

        const reloadButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Перезагрузить страницу'))
        assert(reloadButton, 'FrontendErrorBoundary fallback should expose reload button.')

        await act(async () => {
            reloadButton!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        })

        assert(reloadCalled, 'FrontendErrorBoundary reload action should call window.location.reload.')
    } finally {
        if (root) {
            await act(async () => {
                root!.unmount()
            })
        }

        console.error = previousConsoleError
        setGlobalValue('window', previousWindow)
        setGlobalValue('document', previousDocument)
        setGlobalValue('navigator', previousNavigator)
        setGlobalValue('HTMLElement', previousHTMLElement)
        setGlobalValue('Node', previousNode)
        setGlobalValue('MutationObserver', previousMutationObserver)
        setGlobalValue('Event', previousEvent)
        setGlobalValue('MouseEvent', previousMouseEvent)
        dom.window.close()
    }
}

// Node and jsdom expose some globals as getter-backed properties, so the smoke swaps them through defineProperty instead of direct assignment.
function setGlobalValue<K extends keyof typeof globalThis>(key: K, value: (typeof globalThis)[K]): void {
    Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value,
    })
}

function requireFirstTestTitle(report: ReturnType<typeof loadReporterReport>): string {
    const title = report.tests?.[0]?.title
    assert(typeof title === 'string' && title.length > 0, 'React surface smoke expects at least one test title in sample fixture.')
    return title
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}

void main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})