/**
 * Назначение: smoke для embedded React public surface с SSR-проверками и DOM-проверкой recovery в error boundary.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as React from 'react'
import { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot, type Root } from 'react-dom/client'
import { HashRouter, MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { ApiStore, selectPrimaryFailureStepForDiagnostics, type TestHistoryResponse } from './api-store'
import type { WorkspaceDescriptor } from './backend/contracts'
import { FileSystemBackendStorage } from './backend/storage'
import { buildDashboardSummary, loadReporterReport, type ReporterRoot } from './dashboard-utils'
import type { DashboardHistoryEntry } from './history-utils'
import { buildStepAnchor, findIncidentStepAnchor } from './shared/test-history-helpers'
import {
    createEmptyFrontendBootstrap,
    type FrontendBootstrapData,
    type FrontendRouteDescriptor,
} from './frontend-bootstrap'
import { ingestReporterRun } from './backend/run-ingestion.service'
import { loadStaticTestHistoryPayload, resetStaticTestHistoryIndexCache } from './frontend/shared/static-test-history'
import { RuntimeProvider as FrontendRuntimeProvider } from './frontend/runtime'
import { DashboardPage as FrontendDashboardPage } from './frontend/features/dashboard/dashboard-page'
import { TestHistoryPage as FrontendTestHistoryPage } from './frontend/features/test-history/test-history-page'
import { IncidentSummaryPanel } from './frontend/features/test-history/history-incident-panels'
import { AttemptStepTree } from './frontend/features/test-history/attempt-diagnostic-steps'
import { WorkspaceLoginPage as FrontendWorkspaceLoginPage } from './frontend/features/admin/workspace-login-page'

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

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    writable: true,
    value: true,
})

/**
 * Сначала подготавливает реальные workspace summary/history данные, чтобы экспортируемые страницы тестировались на тех же контрактах, что и production runtime.
 */
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
    const attachmentTestTitle = 'Checkout > retries after payment gateway timeout'
    const attachmentTestHistoryPayload = store.getTestHistory(attachmentTestTitle, {})
    const navigationBaseTest = summary.currentRunTests.all[0] ?? null

    assert(testHistoryPayload && !('candidates' in testHistoryPayload), 'React smoke expects a concrete test history payload.')
    assert(attachmentTestHistoryPayload && !('candidates' in attachmentTestHistoryPayload), 'React smoke expects an attachment-rich concrete test history payload.')
    assert(navigationBaseTest, 'React smoke expects at least one current-run test for navigation smoke.')

    const navigationSyntheticTest = {
        ...navigationBaseTest,
        title: '__react-static-navigation__',
        project: 'static-nav-project',
        file: 'tests/static/navigation.spec.ts',
        errorMessage: 'Error: synthetic navigation failure\n    at staticNavStep (tests/static/navigation.spec.ts:10:5)\n    at dashboardSmoke (tests/static/navigation.spec.ts:14:3)',
        errorDetails: 'Error: synthetic navigation failure\n    at staticNavStep (tests/static/navigation.spec.ts:10:5)\n    at dashboardSmoke (tests/static/navigation.spec.ts:14:3)',
    }
    const navigationSummary = {
        ...summary,
        currentRunTests: {
            all: [navigationSyntheticTest],
            passed: [navigationSyntheticTest],
            failed: [],
            flaky: [],
            skipped: [],
            timedOut: [],
            interrupted: [],
        },
    }
    const navigationTestHistoryPayload = createStaticHistoryPayload(
        navigationSyntheticTest.title,
        navigationSyntheticTest.project,
        navigationSyntheticTest.file,
    )

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
    ), ['TestOps', summary.sourceFile, 'metric-info-button-react'])

    renderMarkup('dashboard transition tab', renderWithRouter(
        React.createElement(
            reactModule.RuntimeProvider,
            {
                bootstrap: createBootstrap({ route: { kind: 'dashboard', workspaceSlug: null }, initialRequestUrl: '/?tab=codeQuality', initialDashboardSummary: summary }),
                children: React.createElement(reactModule.DashboardPage, { workspaceSlug: null }),
            },
        ),
        '/?tab=codeQuality',
    ), ['Качество кода тестов', 'metric-info-button-react'])

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
    ), ['Test History', 'MTBF', 'Диагностика последнего запуска', 'metric-info-button-react'])

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

    await verifyStaticHashDeepLinkRoute(reactModule)
    await verifyStaticDashboardNavigation(navigationSummary, navigationTestHistoryPayload)
    await verifyDashboardTraceDisclosure(navigationSummary)
    await verifyTestHistoryNestedDiagnosticsStructure(reactModule, attachmentTestTitle, attachmentTestHistoryPayload)
    await verifyTestHistoryAttachmentLightbox(reactModule, attachmentTestTitle, attachmentTestHistoryPayload)
    await verifyTestHistoryAttachmentMarkdownPreview(reactModule, attachmentTestTitle, attachmentTestHistoryPayload)
    verifyIncidentEvidenceRendering()
    verifyDiagnosticPrimaryFailureHighlight()
    verifyDiagnosticTreeSuppressesDuplicatedTeardownError()
    verifyPrimaryFailureStepSelectionPrefersNestedErroredAction()
    verifyPrimaryFailureStepSelectionIgnoresTeardownCloseNoise()
    verifyIncidentAnchorUsesFailureMetadata()
    verifyDashboardComparisonUsesPreviousComparableRun()
    await verifyWorkspaceLoginBootstrapRedirect(workspaceSlug)
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

function verifyIncidentEvidenceRendering(): void {
    const markup = renderToStaticMarkup(
        React.createElement(IncidentSummaryPanel, {
            incidentSummary: {
                severity: 'active',
                category: 'timeout',
                confidence: 'high',
                summary: 'Сбой активен. Повторялся 3 раза. Точка падения: Wait for selector.',
                evidence: [
                    { label: 'Проблемные попытки', value: '1 из 2 в последнем нестабильном запуске', tone: 'supporting' },
                    { label: 'Артефакты', value: 'error-context.md, trace.zip', tone: 'supporting' },
                ],
                unstableRuns: 3,
                matchingRuns: 3,
                affectedAttempts: 1,
                firstSeenAt: '2026-04-13T12:10:00.000Z',
                latestSeenAt: '2026-04-14T15:34:00.000Z',
                latestRecoveryAt: null,
                latestErrorMessage: 'TimeoutError: locator.waitFor: Timeout 10000ms exceeded.',
                failureStepRunId: 'run-1',
                failureStepAttempt: 1,
                failureStepOffsetMs: 14694,
                failureStepTitle: 'Wait for selector',
                failureStepCategory: 'pw:api',
                failureStepErrorMessage: 'TimeoutError: locator.waitFor: Timeout 10000ms exceeded.',
            },
            history: [
                {
                    runId: 'run-1',
                    reportTimestamp: '2026-04-14T15:34:00.000Z',
                    generatedAt: '2026-04-14T15:34:00.000Z',
                    branch: 'main',
                    commit: 'abc1234',
                    author: 'Smoke Bot',
                    status: 'failed',
                    flaky: false,
                    durationMs: 1000,
                    retries: 1,
                    attempts: 2,
                    errorMessage: 'TimeoutError: locator.waitFor: Timeout 10000ms exceeded.',
                    attemptDetails: [
                        {
                            attempt: 1,
                            status: 'failed',
                            durationMs: 1000,
                            startTime: null,
                            errorMessage: 'TimeoutError: locator.waitFor: Timeout 10000ms exceeded.',
                            attachments: [],
                            steps: [
                                {
                                    title: 'Wait for selector',
                                    category: 'pw:api',
                                    depth: 2,
                                    offsetMs: 14694,
                                    durationMs: 800,
                                    status: 'failed',
                                    errorMessage: 'TimeoutError: locator.waitFor: Timeout 10000ms exceeded.',
                                    isFailurePoint: true,
                                },
                            ],
                        },
                    ],
                },
            ],
        }),
    )

    renderMarkup('incident evidence panel', markup, ['Проблемные попытки', 'Артефакты'])
    assert(!markup.includes('Факты и подтверждения'), 'Incident evidence panel should not render the removed evidence heading.')
}

function verifyDiagnosticPrimaryFailureHighlight(): void {
    const markup = renderToStaticMarkup(
        React.createElement(AttemptStepTree, {
            runId: 'run-1',
            attemptNumber: 1,
            initiallyOpen: true,
            primaryFailure: {
                runId: 'run-1',
                attemptNumber: 1,
                offsetMs: 14694,
                title: 'Wait for selector',
                errorMessage: 'TimeoutError: locator.waitFor: Timeout 10000ms exceeded.',
            },
            steps: [
                {
                    title: 'Checkout flow',
                    category: 'test.step',
                    depth: 0,
                    offsetMs: 0,
                    durationMs: 5000,
                    status: 'failed',
                    errorMessage: null,
                    isFailurePoint: true,
                },
                {
                    title: 'Wait for selector',
                    category: 'pw:api',
                    depth: 1,
                    offsetMs: 14694,
                    durationMs: 800,
                    status: 'failed',
                    errorMessage: 'TimeoutError: locator.waitFor: Timeout 10000ms exceeded.',
                    isFailurePoint: true,
                },
                {
                    title: 'Cleanup: close browser',
                    category: 'hook',
                    depth: 1,
                    offsetMs: 15200,
                    durationMs: 300,
                    status: 'failed',
                    errorMessage: 'Error: browser.close: Target page, context or browser has been closed',
                    isFailurePoint: true,
                },
            ],
        }),
    )

    renderMarkup('diagnostic primary failure highlight', markup, ['is-primary-failure', 'Основная причина', 'is-failure'])
}

function verifyDiagnosticTreeSuppressesDuplicatedTeardownError(): void {
    const duplicatedError = 'Error: expect(locator).toBeVisible() failed Locator: getByRole(\'tablist\').getByRole(\'tab\', { name: /^(Security|Безопасность)$/ })'
    const markup = renderToStaticMarkup(
        React.createElement(AttemptStepTree, {
            runId: 'run-duplicate-cleanup',
            attemptNumber: 1,
            initiallyOpen: true,
            primaryFailure: {
                runId: 'run-duplicate-cleanup',
                attemptNumber: 1,
                offsetMs: 5010,
                title: 'Expect "toBeVisible"',
                errorMessage: duplicatedError,
            },
            steps: [
                {
                    title: 'Open security tab',
                    category: 'test.step',
                    depth: 0,
                    offsetMs: 0,
                    durationMs: 5400,
                    status: 'failed',
                    errorMessage: null,
                    isFailurePoint: true,
                },
                {
                    title: 'Expect "toBeVisible"',
                    category: 'expect',
                    depth: 1,
                    offsetMs: 5010,
                    durationMs: 5000,
                    status: 'failed',
                    errorMessage: duplicatedError,
                    isFailurePoint: true,
                },
                {
                    title: 'Worker Cleanup',
                    category: 'hook',
                    depth: 0,
                    offsetMs: 10020,
                    durationMs: 40,
                    status: 'failed',
                    errorMessage: duplicatedError,
                    isFailurePoint: true,
                },
            ],
        }),
    )

    const traceDisclosureOccurrences = markup.split('data-trace-disclosure-trigger').length - 1
    assert(traceDisclosureOccurrences === 1, `Duplicated teardown assertion error should produce only one rendered step trace disclosure. Actual disclosures: ${traceDisclosureOccurrences}`)
    assert(markup.includes('Worker Cleanup'), 'Worker Cleanup step should still be rendered in diagnostics.')
}

/**
 * Проверяет реальный static deep-link через `HashRouter`: bootstrap остаётся static-dashboard, а открытие конкретного test-history route происходит уже на клиенте по hash URL.
 */
async function verifyStaticHashDeepLinkRoute(reactModule: typeof import('aqa-pulse/react')): Promise<void> {
    const testTitle = '__react-static-deep-link__'
    const project = 'smoke-project'
    const file = 'tests/react-static.spec.ts'
    const bootstrap = createBootstrap({
        route: { kind: 'static-dashboard', workspaceSlug: null },
        initialRequestUrl: '/',
    })
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
        url: `http://localhost/#/test/${encodeURIComponent(testTitle)}?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`,
    })
    installCanvasContextStub(dom.window)
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousMutationObserver = globalThis.MutationObserver
    const previousEvent = globalThis.Event
    const previousMouseEvent = globalThis.MouseEvent
    const previousLocation = globalThis.location
    const previousFetch = globalThis.fetch

    let root: Root | null = null

    try {
        resetStaticTestHistoryIndexCache()
        setGlobalValue('window', dom.window)
        setGlobalValue('document', dom.window.document)
        setGlobalValue('navigator', dom.window.navigator)
        setGlobalValue('HTMLElement', dom.window.HTMLElement)
        setGlobalValue('Node', dom.window.Node)
        setGlobalValue('MutationObserver', dom.window.MutationObserver)
        setGlobalValue('Event', dom.window.Event)
        setGlobalValue('MouseEvent', dom.window.MouseEvent)
        setGlobalValue('location', dom.window.location)
        setGlobalValue('fetch', (async (input: RequestInfo | URL): Promise<Response> => {
            const requestUrl = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url

            if (requestUrl.endsWith('/static-data/test-history.json')) {
                return new Response(JSON.stringify({
                    generatedAt: new Date().toISOString(),
                    entries: [
                        {
                            title: testTitle,
                            branch: null,
                            project,
                            file,
                            payload: createStaticHistoryPayload(testTitle, project, file),
                        },
                    ],
                }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            return new Response('Not Found', { status: 404 })
        }) as typeof fetch)

        const container = dom.window.document.getElementById('root')
        assert(container, 'Static deep-link smoke needs root container.')

        root = createRoot(container)

        await act(async () => {
            root!.render(
                React.createElement(
                    reactModule.RuntimeProvider,
                    {
                        bootstrap,
                        children: React.createElement(
                            HashRouter,
                            null,
                            React.createElement(
                                Routes,
                                null,
                                React.createElement(Route, { path: '/test/:name', element: React.createElement(StaticDeepLinkRoute, { reactModule }) }),
                            ),
                        ),
                    },
                ),
            )
            await flushMicrotasks()
        })

        await waitForCondition(() => container.textContent?.includes(testTitle) === true, () => container.innerHTML)

        assert(container.textContent?.includes('Test History'), `Static deep-link route should render test history page. Actual DOM: ${container.innerHTML}`)
        assert(container.textContent?.includes(testTitle), 'Static deep-link route should render the requested test title.')
        assert(container.textContent?.includes(project), 'Static deep-link route should keep project-filtered payload in rendered view.')
        assert(container.textContent?.includes(file), 'Static deep-link route should keep file-filtered payload in rendered view.')
    } finally {
        if (root) {
            await act(async () => {
                root!.unmount()
            })
        }

        setGlobalValue('fetch', previousFetch)
        setGlobalValue('window', previousWindow)
        setGlobalValue('document', previousDocument)
        setGlobalValue('navigator', previousNavigator)
        setGlobalValue('HTMLElement', previousHTMLElement)
        setGlobalValue('Node', previousNode)
        setGlobalValue('MutationObserver', previousMutationObserver)
        setGlobalValue('Event', previousEvent)
        setGlobalValue('MouseEvent', previousMouseEvent)
        setGlobalValue('location', previousLocation)
        dom.window.close()
    }
}

/**
 * Проверяет static dashboard navigation целиком: переключение tab через search params, переход по entity link в test history и возврат на dashboard через back link.
 */
async function verifyStaticDashboardNavigation(
    summary: ReturnType<ApiStore['getSummary']>,
    testHistoryPayload: TestHistoryResponse,
): Promise<void> {
    const testTitle = testHistoryPayload.test.title
    const branch = summary.filters.branch ?? null
    const project = testHistoryPayload.test.project
    const file = testHistoryPayload.test.file
    const bootstrap = createBootstrap({
        route: { kind: 'static-dashboard', workspaceSlug: null },
        initialRequestUrl: '/',
        initialDashboardSummary: summary,
    })
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
        url: 'http://localhost/#/',
    })
    installCanvasContextStub(dom.window)
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousMutationObserver = globalThis.MutationObserver
    const previousEvent = globalThis.Event
    const previousMouseEvent = globalThis.MouseEvent
    const previousLocation = globalThis.location
    const previousFetch = globalThis.fetch

    let root: Root | null = null

    try {
        resetStaticTestHistoryIndexCache()
        setGlobalValue('window', dom.window)
        setGlobalValue('document', dom.window.document)
        setGlobalValue('navigator', dom.window.navigator)
        setGlobalValue('HTMLElement', dom.window.HTMLElement)
        setGlobalValue('Node', dom.window.Node)
        setGlobalValue('MutationObserver', dom.window.MutationObserver)
        setGlobalValue('Event', dom.window.Event)
        setGlobalValue('MouseEvent', dom.window.MouseEvent)
        setGlobalValue('location', dom.window.location)
        setGlobalValue('fetch', (async (input: RequestInfo | URL): Promise<Response> => {
            const requestUrl = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url

            if (requestUrl.endsWith('/static-data/test-history.json')) {
                return new Response(JSON.stringify({
                    generatedAt: new Date().toISOString(),
                    entries: [
                        {
                            title: testTitle,
                            branch,
                            project,
                            file,
                            payload: testHistoryPayload,
                        },
                    ],
                }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            return new Response('Not Found', { status: 404 })
        }) as typeof fetch)

        const directStaticPayload = await loadStaticTestHistoryPayload({
            title: testTitle,
            branch,
            project,
            file,
        })
        assert(directStaticPayload !== null && !('candidates' in directStaticPayload), 'Static dashboard navigation smoke expects loader to resolve prepared payload before route render.')

        const container = dom.window.document.getElementById('root')
        assert(container, 'Static dashboard navigation smoke needs root container.')

        root = createRoot(container)

        await act(async () => {
            root!.render(
                React.createElement(
                    FrontendRuntimeProvider,
                    {
                        bootstrap,
                        children: React.createElement(
                            HashRouter,
                            null,
                            React.createElement(
                                Routes,
                                null,
                                React.createElement(Route, { path: '/', element: React.createElement(FrontendDashboardPage, { workspaceSlug: null }) }),
                                React.createElement(Route, {
                                    path: '/test/:name',
                                    element: React.createElement(FrontendTestHistoryPage, {
                                        workspaceSlug: null,
                                        requestedTitle: testTitle,
                                    }),
                                }),
                            ),
                        ),
                    },
                ),
            )
            await flushMicrotasks()
        })

        assert(container.textContent?.includes('TestOps'), `Static dashboard should render overview page. Actual DOM: ${container.innerHTML}`)

        const tabButtons = [...container.querySelectorAll('.segmented-tabs button')]
        assert(tabButtons.length > 1, 'Static dashboard smoke expects segmented tabs to be rendered.')

        await clickElement(tabButtons[1], dom.window)
        await waitForCondition(() => dom.window.location.hash.includes('tab='), () => dom.window.location.hash)
        assert(dom.window.location.hash.includes('tab='), 'Static dashboard tab click should update hash query string.')

        const encodedTestTitle = encodeURIComponent(testTitle)
        const encodedProject = encodeURIComponent(project)
        const encodedFile = encodeURIComponent(file)
        const queryParts = [
            branch ? `branch=${encodeURIComponent(branch)}` : null,
            `project=${encodedProject}`,
            `file=${encodedFile}`,
        ].filter((value): value is string => value !== null)
        const testHistoryHash = `#/test/${encodedTestTitle}?${queryParts.join('&')}`

        await navigateHash(dom.window, testHistoryHash)
        await waitForCondition(() => container.textContent?.includes(testTitle) === true, () => container.innerHTML)
        assert(dom.window.location.hash.includes(`/test/${encodeURIComponent(testTitle)}`), 'Static dashboard test link should navigate to test history route.')
        if (branch) {
            assert(dom.window.location.hash.includes(`branch=${encodeURIComponent(branch)}`), 'Static dashboard test link should preserve branch filter in hash query.')
        }
        assert(dom.window.location.hash.includes(`project=${encodeURIComponent(project)}`), 'Static dashboard test link should preserve project filter in hash query.')
        assert(dom.window.location.hash.includes(`file=${encodeURIComponent(file)}`), 'Static dashboard test link should preserve file filter in hash query.')

        const backLink = [...container.querySelectorAll('a')].find((link) => {
            if (!(link instanceof dom.window.HTMLAnchorElement)) {
                return false
            }

            const href = link.getAttribute('href') ?? ''
            const text = link.textContent?.toLowerCase() ?? ''
            return href.includes('/') && (text.includes('дашбор') || text.includes('dashboard') || text.includes('назад'))
        }) as HTMLAnchorElement | null
        assert(backLink, 'Static test history smoke expects dashboard back link.')
    const backLinkHref = backLink.getAttribute('href') ?? ''
        assert(backLinkHref.includes('/'), 'Back link should target dashboard route.')

    await navigateHash(dom.window, backLinkHref)
        await waitForCondition(() => container.textContent?.includes('TestOps') === true, () => container.innerHTML)
        assert(dom.window.location.hash.startsWith('#/?'), 'Back link should navigate to dashboard hash route.')
        if (branch) {
            assert(dom.window.location.hash.includes(`branch=${encodeURIComponent(branch)}`), 'Back link should preserve branch filter.')
        }
        assert(dom.window.location.hash.includes(`project=${encodeURIComponent(project)}`), 'Back link should preserve project filter.')
        assert(dom.window.location.hash.includes(`file=${encodeURIComponent(file)}`), 'Back link should preserve file filter.')
    } finally {
        if (root) {
            await act(async () => {
                root!.unmount()
            })
        }

        setGlobalValue('fetch', previousFetch)
        setGlobalValue('window', previousWindow)
        setGlobalValue('document', previousDocument)
        setGlobalValue('navigator', previousNavigator)
        setGlobalValue('HTMLElement', previousHTMLElement)
        setGlobalValue('Node', previousNode)
        setGlobalValue('MutationObserver', previousMutationObserver)
        setGlobalValue('Event', previousEvent)
        setGlobalValue('MouseEvent', previousMouseEvent)
        setGlobalValue('location', previousLocation)
        dom.window.close()
    }
}

/**
 * Проверяет workspace auth redirect на уровне DOM: если bootstrap уже говорит, что пользователь аутентифицирован для этого slug, login route должен сразу увести на dashboard без повторного session fetch.
 */
async function verifyWorkspaceLoginBootstrapRedirect(workspaceSlug: string): Promise<void> {
    const bootstrap = createBootstrap({
        route: { kind: 'workspace-login', workspaceSlug },
        initialRequestUrl: `/w/${workspaceSlug}/login`,
        initialSessionStatus: {
            scope: 'workspace',
            authenticated: true,
            authRequired: true,
            workspaceSlug,
        },
    })
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
        url: `http://localhost/w/${workspaceSlug}/login`,
    })
    installCanvasContextStub(dom.window)
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousMutationObserver = globalThis.MutationObserver
    const previousEvent = globalThis.Event
    const previousMouseEvent = globalThis.MouseEvent

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
        assert(container, 'Workspace login redirect smoke needs root container.')

        root = createRoot(container)

        await act(async () => {
            root!.render(
                React.createElement(
                    FrontendRuntimeProvider,
                    {
                        bootstrap,
                        children: React.createElement(
                            MemoryRouter,
                            { initialEntries: [`/w/${workspaceSlug}/login`] },
                            React.createElement(
                                Routes,
                                null,
                                React.createElement(Route, {
                                    path: '/w/:slug/login',
                                    element: React.createElement(FrontendWorkspaceLoginPage, { workspaceSlug }),
                                }),
                                React.createElement(Route, {
                                    path: '/w/:slug',
                                    element: React.createElement('div', null, `workspace dashboard redirect ${workspaceSlug}`),
                                }),
                            ),
                        ),
                    },
                ),
            )
            await flushMicrotasks()
        })

        await waitForCondition(
            () => container.textContent?.includes(`workspace dashboard redirect ${workspaceSlug}`) === true,
            () => container.innerHTML,
        )
    } finally {
        if (root) {
            await act(async () => {
                root!.unmount()
            })
        }

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

async function verifyDashboardTraceDisclosure(summary: ReturnType<ApiStore['getSummary']>): Promise<void> {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
        url: 'http://localhost/trace-disclosure',
    })
    installCanvasContextStub(dom.window)
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousMutationObserver = globalThis.MutationObserver
    const previousEvent = globalThis.Event
    const previousMouseEvent = globalThis.MouseEvent
    const previousLocation = globalThis.location

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
        setGlobalValue('location', dom.window.location)

        const container = dom.window.document.getElementById('root')
        assert(container, 'Trace disclosure smoke needs root container.')

        root = createRoot(container)

        await act(async () => {
            root!.render(
                React.createElement(
                    FrontendRuntimeProvider,
                    {
                        bootstrap: createBootstrap({
                            route: { kind: 'dashboard', workspaceSlug: null },
                            initialRequestUrl: '/',
                            initialDashboardSummary: summary,
                        }),
                        children: React.createElement(
                            MemoryRouter,
                            { initialEntries: ['/'] },
                            React.createElement(FrontendDashboardPage, { workspaceSlug: null }),
                        ),
                    },
                ),
            )
            await flushMicrotasks()
        })

        const getVisibleDisclosureDialog = (): HTMLElement | null => {
            const dialogs = Array.from(dom.window.document.querySelectorAll('[data-trace-disclosure-dialog]')) as HTMLElement[]
            return dialogs.find((dialog) => !dialog.hidden) ?? null
        }

        const metricTrigger = container.querySelector('.metrics-grid [data-trace-disclosure-trigger]')
        assert(!metricTrigger, `Trace disclosure smoke expects no expandable cluster trigger in dashboard metrics. Actual DOM: ${container.innerHTML}`)
        assert(!container.querySelector('.metrics-grid .cluster-message-react'), 'Trace disclosure smoke expects the main cluster metric to keep only the numeric value without a cluster message preview.')

        const trigger = container.querySelector('tbody [data-trace-disclosure-trigger]')
        assert(trigger, `Trace disclosure smoke expects an expandable table error trigger. Actual DOM: ${container.innerHTML}`)

        await clickElement(trigger, dom.window)
        await waitForCondition(() => {
            return Boolean(getVisibleDisclosureDialog())
        }, () => dom.window.document.body.innerHTML)

        const dialogContent = getVisibleDisclosureDialog()?.querySelector('[data-trace-disclosure-content]')
        assert(dialogContent?.textContent?.includes('synthetic navigation failure'), 'Trace disclosure smoke expects the full error content inside the dialog.')
        assert(dialogContent?.textContent?.includes('dashboardSmoke'), 'Trace disclosure smoke expects stack-like lines inside the dialog.')

        const closeButton = getVisibleDisclosureDialog()?.querySelector('[data-trace-disclosure-close]')
        assert(closeButton, 'Trace disclosure smoke expects a close control.')
        await clickElement(closeButton, dom.window)
        await waitForCondition(() => {
            return !getVisibleDisclosureDialog()
        }, () => dom.window.document.body.innerHTML)
    } finally {
        if (root) {
            await act(async () => {
                root!.unmount()
            })
        }

        setGlobalValue('window', previousWindow)
        setGlobalValue('document', previousDocument)
        setGlobalValue('navigator', previousNavigator)
        setGlobalValue('HTMLElement', previousHTMLElement)
        setGlobalValue('Node', previousNode)
        setGlobalValue('MutationObserver', previousMutationObserver)
        setGlobalValue('Event', previousEvent)
        setGlobalValue('MouseEvent', previousMouseEvent)
        setGlobalValue('location', previousLocation)
        dom.window.close()
    }
}

async function verifyTestHistoryAttachmentLightbox(
    reactModule: typeof import('aqa-pulse/react'),
    requestedTitle: string,
    testHistoryPayload: TestHistoryResponse,
): Promise<void> {
    const previewablePayload = injectAttachmentPreviewUrlsForSmoke(testHistoryPayload)
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/test-lightbox' })
    installCanvasContextStub(dom.window)
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousMutationObserver = globalThis.MutationObserver
    const previousEvent = globalThis.Event
    const previousMouseEvent = globalThis.MouseEvent

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
        assert(container, 'Attachment lightbox smoke needs root container.')

        root = createRoot(container)

        await act(async () => {
            root!.render(
                React.createElement(
                    MemoryRouter,
                    { initialEntries: [`/test/${encodeURIComponent(requestedTitle)}`] },
                    React.createElement(
                        reactModule.RuntimeProvider,
                        {
                            bootstrap: createBootstrap({
                                route: { kind: 'test-history', workspaceSlug: null, testName: requestedTitle },
                                initialRequestUrl: `/test/${encodeURIComponent(requestedTitle)}`,
                                initialTestHistoryPayload: previewablePayload,
                            }),
                            children: React.createElement(reactModule.TestHistoryPage, { workspaceSlug: null, requestedTitle }),
                        },
                    ),
                ),
            )
            await flushMicrotasks()
        })

        const imagePreviewTrigger = container.querySelector('[data-image-lightbox-trigger]')
        assert(imagePreviewTrigger, `Attachment lightbox smoke expects at least one image preview trigger. Actual DOM: ${container.innerHTML}`)

        const preloadedLightboxImage = dom.window.document.querySelector('[data-image-lightbox-image]') as HTMLImageElement | null
        assert(preloadedLightboxImage, 'Attachment lightbox smoke expects the lightbox image node to exist before opening the dialog.')
        Object.defineProperty(preloadedLightboxImage, 'complete', { configurable: true, get: () => true })
        Object.defineProperty(preloadedLightboxImage, 'naturalWidth', { configurable: true, get: () => 1440 })

        await clickElement(imagePreviewTrigger, dom.window)
        await waitForCondition(() => {
            const lightbox = dom.window.document.querySelector('[data-image-lightbox]') as HTMLElement | null
            return Boolean(lightbox && !lightbox.hidden)
        }, () => dom.window.document.body.innerHTML)

        const lightboxTitle = dom.window.document.querySelector('[data-image-lightbox-title]')
        assert(lightboxTitle?.textContent && lightboxTitle.textContent.length > 0, 'Attachment lightbox smoke expects image title in dialog header.')

        const lightboxImage = dom.window.document.querySelector('[data-image-lightbox-image]') as HTMLImageElement | null
        assert(lightboxImage?.getAttribute('src') && lightboxImage.getAttribute('src')!.length > 0, 'Attachment lightbox smoke expects image src in dialog body.')

    const loadingStatus = dom.window.document.querySelector('.image-lightbox-status-react')
    assert(!loadingStatus, `Attachment lightbox smoke expects loading text to disappear for an already loaded image. Actual DOM: ${dom.window.document.body.innerHTML}`)

        const lightboxClose = dom.window.document.querySelector('.image-lightbox-close-react')
        assert(lightboxClose, 'Attachment lightbox smoke expects close button.')
        await clickElement(lightboxClose, dom.window)
        await waitForCondition(() => {
            const lightbox = dom.window.document.querySelector('[data-image-lightbox]') as HTMLElement | null
            return Boolean(lightbox && lightbox.hidden)
        }, () => dom.window.document.body.innerHTML)
    } finally {
        if (root) {
            await act(async () => {
                root!.unmount()
            })
        }

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

function verifyPrimaryFailureStepSelectionPrefersNestedErroredAction(): void {
    const selectedStep = selectPrimaryFailureStepForDiagnostics([
        {
            title: 'Checkout flow',
            category: 'test.step',
            depth: 0,
            offsetMs: 0,
            durationMs: 7800,
            status: 'failed',
            errorMessage: 'TimeoutError: locator.waitFor: Timeout 800ms exceeded.',
            isFailurePoint: true,
        },
        {
            title: 'Wait for selector locator(\'mat-snack-bar-container, simple-snack-bar\').getByRole(\'button\', { name: /^close$/i })',
            category: 'pw:api',
            depth: 1,
            offsetMs: 7060,
            durationMs: 802,
            status: 'failed',
            errorMessage: 'TimeoutError: locator.waitFor: Timeout 800ms exceeded.',
            isFailurePoint: false,
        },
        {
            title: 'Worker Cleanup',
            category: 'hook',
            depth: 0,
            offsetMs: 7900,
            durationMs: 140,
            status: 'failed',
            errorMessage: null,
            isFailurePoint: true,
        },
    ])

    assert(selectedStep?.title === 'Wait for selector locator(\'mat-snack-bar-container, simple-snack-bar\').getByRole(\'button\', { name: /^close$/i })', `Primary failure-step selection should prefer the nested pw:api error over wrapper or cleanup steps. Actual step: ${selectedStep?.title ?? 'null'}`)
}

function verifyPrimaryFailureStepSelectionIgnoresTeardownCloseNoise(): void {
    const selectedStep = selectPrimaryFailureStepForDiagnostics([
        {
            title: 'Open configuration page',
            category: 'test.step',
            depth: 0,
            offsetMs: 11202,
            durationMs: 9127,
            status: 'failed',
            errorMessage: 'Error: expect(page).toHaveURL(expected) failed',
            isFailurePoint: true,
        },
        {
            title: 'Verify page opened without auth',
            category: 'test.step',
            depth: 1,
            offsetMs: 13453,
            durationMs: 6626,
            status: 'failed',
            errorMessage: 'Error: expect(page).toHaveURL(expected) failed',
            isFailurePoint: true,
        },
        {
            title: 'Expect "toHaveURL"',
            category: 'expect',
            depth: 2,
            offsetMs: 14070,
            durationMs: 6008,
            status: 'failed',
            errorMessage: 'Error: expect(page).toHaveURL(expected) failed',
            isFailurePoint: true,
        },
        {
            title: 'After Hooks',
            category: 'hook',
            depth: 0,
            offsetMs: 20331,
            durationMs: 22,
            status: 'failed',
            errorMessage: null,
            isFailurePoint: false,
        },
        {
            title: 'Close browser',
            category: 'pw:api',
            depth: 2,
            offsetMs: 20334,
            durationMs: 1,
            status: 'failed',
            errorMessage: 'Error: browser.close: Target page, context or browser has been closed',
            isFailurePoint: true,
        },
        {
            title: 'Worker Cleanup',
            category: 'hook',
            depth: 0,
            offsetMs: 20353,
            durationMs: 3,
            status: 'failed',
            errorMessage: null,
            isFailurePoint: true,
        },
    ])

    assert(selectedStep?.title === 'Expect "toHaveURL"', `Primary failure-step selection should ignore teardown close-noise after a more specific expect failure. Actual step: ${selectedStep?.title ?? 'null'}`)
}

function verifyIncidentAnchorUsesFailureMetadata(): void {
    const history: TestHistoryResponse['history'] = [
        {
            runId: 'run-primary',
            reportTimestamp: '2026-04-16T04:38:37.119Z',
            generatedAt: '2026-04-16T04:38:37.119Z',
            branch: 'main',
            commit: 'abc123',
            author: 'Smoke Bot',
            status: 'failed',
            flaky: false,
            durationMs: 1200,
            retries: 0,
            attempts: 1,
            errorMessage: 'Error: expect(locator).toBeVisible() failed',
            attemptDetails: [
                {
                    attempt: 1,
                    status: 'failed',
                    durationMs: 1200,
                    startTime: '2026-04-16T04:38:37.119Z',
                    errorMessage: 'Error: expect(locator).toBeVisible() failed',
                    attachments: [],
                    steps: [
                        {
                            title: 'Expect "toBeVisible"',
                            category: 'expect',
                            depth: 2,
                            offsetMs: 5010,
                            durationMs: 5000,
                            status: 'failed',
                            errorMessage: 'Error: expect(locator).toBeVisible() failed Locator: getByRole(\'tablist\').getByRole(\'tab\', { name: /^(Security|Безопасность)$/ })',
                            isFailurePoint: true,
                        },
                        {
                            title: 'Expect "toBeVisible"',
                            category: 'expect',
                            depth: 2,
                            offsetMs: 880,
                            durationMs: 200,
                            status: 'passed',
                            errorMessage: null,
                            isFailurePoint: false,
                        },
                    ],
                },
            ],
        },
    ]

    const anchor = findIncidentStepAnchor(history, {
        failureStepTitle: 'Expect "toBeVisible"',
        failureStepCategory: 'expect',
        failureStepErrorMessage: 'Error: expect(locator).toBeVisible() failed Locator: getByRole(\'tablist\').getByRole(\'tab\', { name: /^(Security|Безопасность)$/ })',
        failureStepRunId: 'run-primary',
        failureStepAttempt: 1,
        failureStepOffsetMs: 5010,
    })

    assert(anchor === buildStepAnchor('run-primary', 1, 0), `Incident failure-step anchor should use run/attempt/offset metadata to target the exact duplicate step. Actual anchor: ${anchor ?? 'null'}`)
}

function verifyDashboardComparisonUsesPreviousComparableRun(): void {
    const currentUiReport: ReporterRoot = {
        schemaVersion: 2,
        timestamp: '2026-04-17T10:00:00.000Z',
        durationMs: 60000,
        environment: {
            projects: ['ui'],
        },
        tests: [
            {
                title: 'UI smoke 1',
                status: 'passed',
                flaky: false,
                durationMs: 20000,
                location: { file: 'tests/ui/smoke.spec.ts' },
                project: 'ui',
                retries: 0,
                errors: [],
                attempts: [{ attempt: 1, status: 'passed', durationMs: 20000 }],
            },
            {
                title: 'UI smoke 2',
                status: 'failed',
                flaky: false,
                durationMs: 40000,
                location: { file: 'tests/ui/checkout.spec.ts' },
                project: 'ui',
                retries: 0,
                errors: [{ message: 'Checkout failed' }],
                attempts: [{ attempt: 1, status: 'failed', durationMs: 40000, error: { message: 'Checkout failed' } }],
            },
        ],
    }

    const historyRuns: DashboardHistoryEntry[] = [
        createSmokeHistoryEntry({
            id: 'ui-previous',
            reportTimestamp: '2026-04-17T08:00:00.000Z',
            sourceFile: 'reports/ui-report.json',
            comparisonKey: 'project:ui',
            comparisonLabel: 'ui',
            totalTests: 2,
            passedTests: 2,
            failedTests: 0,
            passRate: 100,
            totalDurationMs: 30000,
        }),
        createSmokeHistoryEntry({
            id: 'api-middle',
            reportTimestamp: '2026-04-17T09:00:00.000Z',
            sourceFile: 'reports/api-report.json',
            comparisonKey: 'project:api',
            comparisonLabel: 'api',
            totalTests: 3,
            passedTests: 3,
            failedTests: 0,
            passRate: 100,
            totalDurationMs: 5000,
        }),
        createSmokeHistoryEntry({
            id: 'ui-current',
            reportTimestamp: '2026-04-17T10:00:00.000Z',
            sourceFile: 'reports/ui-report.json',
            comparisonKey: 'project:ui',
            comparisonLabel: 'ui',
            totalTests: 2,
            passedTests: 1,
            failedTests: 1,
            passRate: 50,
            totalDurationMs: 60000,
        }),
    ]

    const summary = buildDashboardSummary(currentUiReport, 'reports/ui-report.json', historyRuns, { branch: 'main', commit: 'ui-latest', author: 'Smoke Bot' })

    assert(summary.comparison.previousRun?.id === 'ui-previous', 'Dashboard comparison should pick the previous comparable UI run instead of the adjacent API run.')
    assert(summary.comparison.previousOverallRun?.id === 'api-middle', 'Dashboard summary should preserve the adjacent run separately from the comparable baseline.')
    assert(summary.comparison.mode === 'comparable', 'Dashboard summary should mark comparison mode as comparable when streams interleave.')
    assert(summary.trend.failedTestsDelta === 1, 'Dashboard failed delta should be calculated against the previous comparable UI run.')
    assert(summary.trend.durationMsDelta === 30000, 'Dashboard duration delta should be calculated against the previous comparable UI run.')
    assert(summary.performance.durationTrend.deltaPercent === 100, 'Performance duration delta should use the previous comparable UI run.')
}

function createSmokeHistoryEntry(input: {
    id: string
    reportTimestamp: string
    sourceFile: string
    comparisonKey: string
    comparisonLabel: string
    totalTests: number
    passedTests: number
    failedTests: number
    passRate: number
    totalDurationMs: number
}): DashboardHistoryEntry {
    return {
        id: input.id,
        reportTimestamp: input.reportTimestamp,
        generatedAt: input.reportTimestamp,
        sourceFile: input.sourceFile,
        comparisonKey: input.comparisonKey,
        comparisonLabel: input.comparisonLabel,
        branch: 'main',
        commit: input.id,
        author: 'Smoke Bot',
        totalTests: input.totalTests,
        passedTests: input.passedTests,
        failedTests: input.failedTests,
        flakyTests: 0,
        skippedTests: 0,
        timedOutTests: 0,
        interruptedTests: 0,
        passRate: input.passRate,
        flakyRatio: 0,
        totalDurationMs: input.totalDurationMs,
        medianDurationMs: Math.round(input.totalDurationMs / Math.max(input.totalTests, 1)),
        errorClusterCount: input.failedTests > 0 ? 1 : 0,
    }
}

async function verifyTestHistoryAttachmentMarkdownPreview(
    reactModule: typeof import('aqa-pulse/react'),
    requestedTitle: string,
    testHistoryPayload: TestHistoryResponse,
): Promise<void> {
    const previewablePayload = injectAttachmentPreviewUrlsForSmoke(testHistoryPayload)
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/test-markdown-preview' })
    installCanvasContextStub(dom.window)
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousMutationObserver = globalThis.MutationObserver
    const previousEvent = globalThis.Event
    const previousMouseEvent = globalThis.MouseEvent
    const previousFetch = globalThis.fetch

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
        setGlobalValue('fetch', (async (input: RequestInfo | URL): Promise<Response> => {
            const requestUrl = String(input)

            if (requestUrl.includes('error-context.md')) {
                return new Response('# Error context\n\nTimeout at payment gateway.', {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/markdown; charset=utf-8',
                    },
                })
            }

            throw new Error(`Unexpected markdown preview request in react smoke: ${requestUrl}`)
        }) as typeof fetch)

        const container = dom.window.document.getElementById('root')
        assert(container, 'Attachment markdown smoke needs root container.')

        root = createRoot(container)

        await act(async () => {
            root!.render(
                React.createElement(
                    MemoryRouter,
                    { initialEntries: [`/test/${encodeURIComponent(requestedTitle)}`] },
                    React.createElement(
                        reactModule.RuntimeProvider,
                        {
                            bootstrap: createBootstrap({
                                route: { kind: 'test-history', workspaceSlug: null, testName: requestedTitle },
                                initialRequestUrl: `/test/${encodeURIComponent(requestedTitle)}`,
                                initialTestHistoryPayload: previewablePayload,
                            }),
                            children: React.createElement(reactModule.TestHistoryPage, { workspaceSlug: null, requestedTitle }),
                        },
                    ),
                ),
            )
            await flushMicrotasks()
        })

        const markdownPreview = container.querySelector('[data-markdown-preview]') as HTMLDetailsElement | null
        assert(markdownPreview, `Attachment markdown smoke expects markdown preview details. Actual DOM: ${container.innerHTML}`)

        await openDetailsElement(markdownPreview, dom.window)
        await waitForCondition(() => {
            const markdownContent = container.querySelector('[data-markdown-content]')
            return Boolean(markdownContent?.textContent?.includes('Timeout at payment gateway.'))
        }, () => container.innerHTML)
    } finally {
        if (root) {
            await act(async () => {
                root!.unmount()
            })
        }

        setGlobalValue('window', previousWindow)
        setGlobalValue('document', previousDocument)
        setGlobalValue('navigator', previousNavigator)
        setGlobalValue('HTMLElement', previousHTMLElement)
        setGlobalValue('Node', previousNode)
        setGlobalValue('MutationObserver', previousMutationObserver)
        setGlobalValue('Event', previousEvent)
        setGlobalValue('MouseEvent', previousMouseEvent)
        setGlobalValue('fetch', previousFetch)
        dom.window.close()
    }
}

function injectAttachmentPreviewUrlsForSmoke(payload: TestHistoryResponse): TestHistoryResponse {
    let hasInjectedPreviewUrl = false
    let hasInjectedMarkdownPreview = false

    return {
        ...payload,
        latestRun: payload.latestRun ? cloneHistoryItemWithPreviewUrl(payload.latestRun, () => {
            hasInjectedPreviewUrl = true
        }) : null,
        history: payload.history.map((item) => cloneHistoryItemWithPreviewUrl(item, () => {
            hasInjectedPreviewUrl = true
        })),
    }

    function cloneHistoryItemWithPreviewUrl(
        item: TestHistoryResponse['history'][number],
        markInjected: () => void,
    ): TestHistoryResponse['history'][number] {
        return {
            ...item,
            attemptDetails: item.attemptDetails.map((attempt) => ({
                ...attempt,
                attachments: [
                    ...attempt.attachments.map((attachment) => {
                        if (!hasInjectedPreviewUrl && (attachment.contentType?.toLowerCase() ?? '') === 'image/png') {
                            markInjected()
                            return {
                                ...attachment,
                                url: 'https://example.test/payment-timeout.png',
                            }
                        }

                        return attachment
                    }),
                    ...(!hasInjectedMarkdownPreview ? [
                        {
                            name: 'error-context.md',
                            contentType: 'text/markdown',
                            path: null,
                            url: '/api/artifacts/smoke-run?path=smoke-run%2Ferror-context.md',
                        },
                    ] : []),
                ].map((attachment, index) => {
                    if (!hasInjectedMarkdownPreview && index === attempt.attachments.length) {
                        hasInjectedMarkdownPreview = true
                    }

                    return attachment
                }),
            })),
        }
    }
}

async function verifyTestHistoryNestedDiagnosticsStructure(
    reactModule: typeof import('aqa-pulse/react'),
    requestedTitle: string,
    testHistoryPayload: TestHistoryResponse,
): Promise<void> {
    const nestedPayload = injectNestedDiagnosticsStepsForSmoke(testHistoryPayload)
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/test-nested-diagnostics' })
    installCanvasContextStub(dom.window)
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousMutationObserver = globalThis.MutationObserver
    const previousEvent = globalThis.Event
    const previousMouseEvent = globalThis.MouseEvent

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
        assert(container, 'Nested diagnostics smoke needs root container.')

        root = createRoot(container)

        await act(async () => {
            root!.render(
                React.createElement(
                    MemoryRouter,
                    { initialEntries: [`/test/${encodeURIComponent(requestedTitle)}`] },
                    React.createElement(
                        reactModule.RuntimeProvider,
                        {
                            bootstrap: createBootstrap({
                                route: { kind: 'test-history', workspaceSlug: null, testName: requestedTitle },
                                initialRequestUrl: `/test/${encodeURIComponent(requestedTitle)}`,
                                initialTestHistoryPayload: nestedPayload,
                            }),
                            children: React.createElement(reactModule.TestHistoryPage, { workspaceSlug: null, requestedTitle }),
                        },
                    ),
                ),
            )
            await flushMicrotasks()
        })

        const nestedChildrenGroup = container.querySelector('.step-tree-children-react') as HTMLDivElement | null
        assert(nestedChildrenGroup, `Nested diagnostics smoke expects a children container. Actual DOM: ${container.innerHTML}`)

        const nestedTitles = Array.from(nestedChildrenGroup.children)
            .map((child) => child.querySelector('.step-title-react')?.textContent?.trim() ?? '')
            .filter((title) => title.length > 0)

        assert(
            nestedTitles.join(' | ') === 'Wait for gateway response | Retry policy applied',
            `Depth-1 diagnostics steps should stay grouped under the depth-0 parent node. Actual DOM: ${container.innerHTML}`,
        )

        const nestedBranch = Array.from(nestedChildrenGroup.children)
            .find((child) => child.querySelector('.step-title-react')?.textContent?.trim() === 'Retry policy applied') as HTMLElement | undefined
        assert(nestedBranch, `Nested diagnostics smoke expects a nested branch node. Actual DOM: ${container.innerHTML}`)

        const nestedGrandChildrenGroup = nestedBranch.querySelector('.step-tree-children-react') as HTMLDivElement | null
        assert(nestedGrandChildrenGroup, `Nested diagnostics smoke expects a grand-children container. Actual DOM: ${container.innerHTML}`)

        const nestedGrandChildTitles = Array.from(nestedGrandChildrenGroup.children)
            .map((child) => child.querySelector('.step-title-react')?.textContent?.trim() ?? '')
            .filter((title) => title.length > 0)

        assert(
            nestedGrandChildTitles.join(' | ') === 'Capture timeout diagnostics',
            `Depth-2 diagnostics steps should stay nested under the depth-1 parent node. Actual DOM: ${container.innerHTML}`,
        )
    } finally {
        if (root) {
            await act(async () => {
                root!.unmount()
            })
        }

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

function injectNestedDiagnosticsStepsForSmoke(payload: TestHistoryResponse): TestHistoryResponse {
    const nestedSteps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'] = [
        {
            title: 'Submit payment',
            category: 'test.step',
            depth: 0,
            offsetMs: 0,
            durationMs: 7200,
            status: 'failed',
            errorMessage: 'Timeout 30000ms while waiting for payment gateway response',
            isFailurePoint: true,
        },
        {
            title: 'Wait for gateway response',
            category: 'pw:api',
            depth: 1,
            offsetMs: 120,
            durationMs: 3200,
            status: 'failed',
            errorMessage: 'Timeout 30000ms while waiting for payment gateway response',
            isFailurePoint: true,
        },
        {
            title: 'Retry policy applied',
            category: 'test.step',
            depth: 1,
            offsetMs: 3380,
            durationMs: 1800,
            status: 'failed',
            errorMessage: null,
            isFailurePoint: false,
        },
        {
            title: 'Capture timeout diagnostics',
            category: 'pw:api',
            depth: 2,
            offsetMs: 4210,
            durationMs: 900,
            status: 'passed',
            errorMessage: null,
            isFailurePoint: false,
        },
    ]

    const nestedLatestItem = payload.history[0]
        ? {
            ...payload.history[0],
            attemptDetails: payload.history[0].attemptDetails.map((attempt, attemptIndex) => attemptIndex === 0
                ? {
                    ...attempt,
                    steps: nestedSteps,
                }
                : attempt),
        }
        : null

    return {
        ...payload,
        latestRun: nestedLatestItem,
        history: payload.history.map((item, itemIndex) => itemIndex === 0 && nestedLatestItem ? nestedLatestItem : item),
    }
}

function StaticDeepLinkRoute(props: { reactModule: typeof import('aqa-pulse/react') }): React.JSX.Element {
    const params = useParams<{ name: string }>()
    return React.createElement(props.reactModule.TestHistoryPage, {
        workspaceSlug: null,
        requestedTitle: params.name ?? '',
    })
}

async function clickElement(element: Element, windowRef: Window & typeof globalThis): Promise<void> {
    await act(async () => {
        element.dispatchEvent(new windowRef.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
        await flushMicrotasks()
    })
}

async function openDetailsElement(element: HTMLDetailsElement, windowRef: Window & typeof globalThis): Promise<void> {
    await act(async () => {
        element.open = true
        element.dispatchEvent(new windowRef.Event('toggle'))
        await flushMicrotasks()
    })
}

async function navigateHash(windowRef: Window & typeof globalThis, hash: string): Promise<void> {
    await act(async () => {
        const normalizedHash = hash.startsWith('#') ? hash : `#${hash}`
        windowRef.location.hash = normalizedHash.slice(1)
        windowRef.dispatchEvent(new windowRef.HashChangeEvent('hashchange'))
        await flushMicrotasks()
    })
}

/**
 * DOM-фаза проверяет два сценария, которые не покрывает SSR: показ fallback после render error и recovery через retry/reload действия пользователя.
 */
async function verifyErrorBoundaryRecovery(reactModule: typeof import('aqa-pulse/react')): Promise<void> {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' })
    installCanvasContextStub(dom.window)
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

/**
 * Node и jsdom держат часть глобалов как getter-backed свойства, поэтому smoke подменяет их через defineProperty, а не через прямое присваивание.
 */
function setGlobalValue<K extends keyof typeof globalThis>(key: K, value: (typeof globalThis)[K]): void {
    Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value,
    })
}

function installCanvasContextStub(windowRef: Window & typeof globalThis): void {
    const prototype = windowRef.HTMLCanvasElement?.prototype as ({ __aqaPulseCanvasStubInstalled?: boolean }) | undefined

    if (!prototype || prototype.__aqaPulseCanvasStubInstalled) {
        return
    }

    Object.defineProperty(prototype, 'getContext', {
        configurable: true,
        writable: true,
        value(this: HTMLCanvasElement) {
            return createCanvasContextStub(this)
        },
    })

    Object.defineProperty(prototype, '__aqaPulseCanvasStubInstalled', {
        configurable: true,
        writable: true,
        value: true,
    })
}

function createCanvasContextStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const state: Record<string, unknown> = {
        canvas,
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        font: '12px sans-serif',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        globalAlpha: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        lineDashOffset: 0,
        miterLimit: 10,
        shadowBlur: 0,
        shadowColor: '#000',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
    }
    const gradientStub = { addColorStop: () => undefined }

    return new Proxy(state, {
        get(target, property) {
            if (typeof property === 'string' && property in target) {
                return target[property]
            }

            if (property === 'measureText') {
                return () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 })
            }

            if (property === 'createLinearGradient' || property === 'createRadialGradient') {
                return () => gradientStub
            }

            if (property === 'createPattern') {
                return () => null
            }

            return () => undefined
        },
        set(target, property, value) {
            target[property as string] = value
            return true
        },
    }) as unknown as CanvasRenderingContext2D
}

function requireFirstTestTitle(report: ReturnType<typeof loadReporterReport>): string {
    const title = report.tests?.[0]?.title
    assert(typeof title === 'string' && title.length > 0, 'React surface smoke expects at least one test title in sample fixture.')
    return title
}

function createStaticHistoryPayload(title: string, project: string, file: string): TestHistoryResponse {
    const latestRun = {
        runId: 'static-react-run',
        reportTimestamp: '2026-04-16T00:00:00.000Z',
        generatedAt: '2026-04-16T00:00:00.000Z',
        branch: null,
        commit: null,
        author: null,
        status: 'passed',
        flaky: false,
        durationMs: 1200,
        retries: 0,
        attempts: 1,
        errorMessage: null,
        attemptDetails: [],
    }

    return {
        test: {
            title,
            project,
            file,
        },
        summary: {
            totalRuns: 1,
            failedRuns: 0,
            flakyRuns: 0,
            passRate: 1,
            latestStatus: 'passed',
            failRate: 0,
            flakyScore: 0,
            mtbfDays: null,
        },
        latestRun,
        history: [latestRun],
        incidentSummary: null,
        missingRuns: [],
    }
}

async function flushMicrotasks(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}

async function waitForCondition(predicate: () => boolean, describeState: () => string, maxAttempts = 30): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (predicate()) {
            return
        }

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
    }

    throw new Error(`Timed out waiting for DOM condition in react surface smoke. Current DOM: ${describeState()}`)
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