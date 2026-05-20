/**
 * Назначение: корневой React app, который выбирает BrowserRouter или HashRouter и раскладывает bootstrap route по feature-страницам.
 */
import React from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { readBootstrapFromDocument, RuntimeProvider } from './runtime'
import { useIsStaticDashboardRuntime } from './runtime-hooks'
import { FrontendErrorBoundary } from './shared/error-boundary'
import { FramedLoadingState } from './shared/route-states'

const DashboardPage = React.lazy(async () => ({
    default: (await import('./features/dashboard/dashboard-page.js')).DashboardPage,
}))

const TestHistoryPage = React.lazy(async () => ({
    default: (await import('./features/test-history/test-history-page.js')).TestHistoryPage,
}))

const AdminDashboardPage = React.lazy(async () => ({
    default: (await import('./features/admin/admin-dashboard-page.js')).AdminDashboardPage,
}))

const AdminCreateWorkspacePage = React.lazy(async () => ({
    default: (await import('./features/admin/admin-create-workspace-page.js')).AdminCreateWorkspacePage,
}))

const AdminSettingsPage = React.lazy(async () => ({
    default: (await import('./features/admin/admin-settings-page.js')).AdminSettingsPage,
}))

const AdminAuditPage = React.lazy(async () => ({
    default: (await import('./features/admin/admin-audit-page.js')).AdminAuditPage,
}))

const AdminLoginPage = React.lazy(async () => ({
    default: (await import('./features/admin/admin-login-page.js')).AdminLoginPage,
}))

const WorkspaceLoginPage = React.lazy(async () => ({
    default: (await import('./features/admin/workspace-login-page.js')).WorkspaceLoginPage,
}))

const WorkspaceApiKeyExchangePage = React.lazy(async () => ({
    default: (await import('./features/admin/workspace-api-key-page.js')).WorkspaceApiKeyExchangePage,
}))

const WorkspaceShareLinkErrorPage = React.lazy(async () => ({
    default: (await import('./features/admin/workspace-share-link-error-page.js')).WorkspaceShareLinkErrorPage,
}))

/**
 * Читает bootstrap один раз из DOM и передаёт его во всё приложение через RuntimeProvider, чтобы клиентский роутинг стартовал из того же состояния, которое сервер или static export уже заложили в HTML shell.
 */
export function App(): React.JSX.Element {
    const bootstrap = React.useMemo(() => readBootstrapFromDocument(), [])

    return (
        <RuntimeProvider bootstrap={bootstrap}>
            <AppBody />
        </RuntimeProvider>
    )
}

/**
 * Static export живёт на HashRouter, а server/self-hosted сценарии — на BrowserRouter, поэтому разветвление по `route.kind` централизовано здесь, а не размазано по feature-модулям.
 */
function AppBody(): React.JSX.Element {
    const isStaticMode = useIsStaticDashboardRuntime()

    if (isStaticMode) {
        return (
            <HashRouter>
                <FrontendErrorBoundary>
                    <React.Suspense fallback={<RouteLoadingFallback />}>
                        <Routes>
                            <Route path="/" element={<DashboardPage workspaceSlug={null} />} />
                            <Route path="/test/:name" element={<StandaloneTestHistoryRoute />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </React.Suspense>
                </FrontendErrorBoundary>
            </HashRouter>
        )
    }

    return (
        <BrowserRouter>
            <FrontendErrorBoundary>
                <React.Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                        <Route path="/" element={<DashboardPage workspaceSlug={null} />} />
                        <Route path="/admin" element={<AdminDashboardPage />} />
                        <Route path="/admin/workspaces/new" element={<AdminCreateWorkspacePage />} />
                        <Route path="/admin/settings" element={<AdminSettingsPage />} />
                        <Route path="/admin/audit" element={<AdminAuditPage />} />
                        <Route path="/admin/login" element={<AdminLoginPage />} />
                        <Route path="/test/:name" element={<StandaloneTestHistoryRoute />} />
                        <Route path="/w/:slug" element={<WorkspaceDashboardRoute />} />
                        <Route path="/w/:slug/login" element={<WorkspaceLoginRoute />} />
                        <Route path="/w/:slug/test/:name" element={<WorkspaceTestHistoryRoute />} />
                        <Route path="/auth/workspaces/:slug/api-keys/login" element={<WorkspaceApiKeyExchangeRoute />} />
                        <Route path="/auth/workspaces/:slug/share-links/login" element={<WorkspaceShareLinkErrorRoute />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </React.Suspense>
            </FrontendErrorBoundary>
        </BrowserRouter>
    )
}

/**
 * Route-level fallback скрывает детали lazy-loading и оставляет единое поведение загрузки для всех страниц.
 */
function RouteLoadingFallback(): React.JSX.Element {
    return <FramedLoadingState label="Загружаем интерфейс..." />
}

function WorkspaceDashboardRoute(): React.JSX.Element {
/**
 * Маршрут test-history держит только URL→props mapping, а сам feature-модуль остаётся изолированным от knowledge о router params.
 */
    const params = useParams<{ slug: string }>()
    return <DashboardPage workspaceSlug={params.slug ?? null} />
}

function StandaloneTestHistoryRoute(): React.JSX.Element {
    const params = useParams<{ name: string }>()
    return <TestHistoryPage workspaceSlug={null} requestedTitle={params.name ?? ''} />
}

function WorkspaceTestHistoryRoute(): React.JSX.Element {
    const params = useParams<{ slug: string; name: string }>()
    return <TestHistoryPage workspaceSlug={params.slug ?? null} requestedTitle={params.name ?? ''} />
}

function WorkspaceLoginRoute(): React.JSX.Element {
    const params = useParams<{ slug: string }>()
    return <WorkspaceLoginPage workspaceSlug={params.slug ?? ''} />
}

function WorkspaceApiKeyExchangeRoute(): React.JSX.Element {
    const params = useParams<{ slug: string }>()
    return <WorkspaceApiKeyExchangePage workspaceSlug={params.slug ?? ''} />
}

function WorkspaceShareLinkErrorRoute(): React.JSX.Element {
    const params = useParams<{ slug: string }>()
    return <WorkspaceShareLinkErrorPage workspaceSlug={params.slug ?? ''} />
}
