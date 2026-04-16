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
import { ApiStore, type TestHistoryResponse } from './api-store'
import type { WorkspaceDescriptor } from './backend/contracts'
import { FileSystemBackendStorage } from './backend/storage'
import { loadReporterReport } from './dashboard-utils'
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
    ), ['React UI', summary.sourceFile])

    renderMarkup('dashboard transition tab', renderWithRouter(
        React.createElement(
            reactModule.RuntimeProvider,
            {
                bootstrap: createBootstrap({ route: { kind: 'dashboard', workspaceSlug: null }, initialRequestUrl: '/?tab=codeQuality', initialDashboardSummary: summary }),
                children: React.createElement(reactModule.DashboardPage, { workspaceSlug: null }),
            },
        ),
        '/?tab=codeQuality',
    ), ['Problem hotspots', 'Failure hotspots'])

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
    ), ['Test History', 'MTBF', 'Диагностика последнего запуска'])

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
    await verifyTestHistoryAttachmentLightbox(reactModule, attachmentTestTitle, attachmentTestHistoryPayload)
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

        assert(container.textContent?.includes('React UI'), `Static dashboard should render overview page. Actual DOM: ${container.innerHTML}`)

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
        await waitForCondition(() => container.textContent?.includes('React UI') === true, () => container.innerHTML)
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

async function verifyTestHistoryAttachmentLightbox(
    reactModule: typeof import('aqa-pulse/react'),
    requestedTitle: string,
    testHistoryPayload: TestHistoryResponse,
): Promise<void> {
    const previewablePayload = injectImagePreviewUrlForSmoke(testHistoryPayload)
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/test-lightbox' })
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

        await clickElement(imagePreviewTrigger, dom.window)
        await waitForCondition(() => {
            const lightbox = container.querySelector('[data-image-lightbox]') as HTMLElement | null
            return Boolean(lightbox && !lightbox.hidden)
        }, () => container.innerHTML)

        const lightboxTitle = container.querySelector('[data-image-lightbox-title]')
        assert(lightboxTitle?.textContent && lightboxTitle.textContent.length > 0, 'Attachment lightbox smoke expects image title in dialog header.')

        const lightboxClose = container.querySelector('.image-lightbox-close-react')
        assert(lightboxClose, 'Attachment lightbox smoke expects close button.')
        await clickElement(lightboxClose, dom.window)
        await waitForCondition(() => {
            const lightbox = container.querySelector('[data-image-lightbox]') as HTMLElement | null
            return Boolean(lightbox && lightbox.hidden)
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
        dom.window.close()
    }
}

function injectImagePreviewUrlForSmoke(payload: TestHistoryResponse): TestHistoryResponse {
    let hasInjectedPreviewUrl = false

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
                attachments: attempt.attachments.map((attachment) => {
                    if (!hasInjectedPreviewUrl && (attachment.contentType?.toLowerCase() ?? '') === 'image/png') {
                        markInjected()
                        return {
                            ...attachment,
                            url: 'https://example.test/payment-timeout.png',
                        }
                    }

                    return attachment
                }),
            })),
        }
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