import React from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { readBootstrapFromDocument, RuntimeProvider, useRuntime } from './runtime'
import { FrontendErrorBoundary } from './shared/error-boundary'
import { LoadingView, PageFrame } from './shared/ui'

const DashboardPage = React.lazy(async () => ({
    default: (await import('./features/dashboard/dashboard-page')).DashboardPage,
}))

const TestHistoryPage = React.lazy(async () => ({
    default: (await import('./features/test-history/test-history-page')).TestHistoryPage,
}))

const AdminDashboardPage = React.lazy(async () => ({
    default: (await import('./features/admin/admin-dashboard-page')).AdminDashboardPage,
}))

const AdminLoginPage = React.lazy(async () => ({
    default: (await import('./features/admin/admin-login-page')).AdminLoginPage,
}))

const WorkspaceLoginPage = React.lazy(async () => ({
    default: (await import('./features/admin/workspace-login-page')).WorkspaceLoginPage,
}))

const WorkspaceApiKeyExchangePage = React.lazy(async () => ({
    default: (await import('./features/admin/workspace-api-key-page')).WorkspaceApiKeyExchangePage,
}))

export function App(): React.JSX.Element {
    const bootstrap = React.useMemo(() => readBootstrapFromDocument(), [])

    return (
        <RuntimeProvider bootstrap={bootstrap}>
            <AppBody />
        </RuntimeProvider>
    )
}

function AppBody(): React.JSX.Element {
    const runtime = useRuntime()

    if (runtime.route.kind === 'static-dashboard') {
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
                        <Route path="/admin/login" element={<AdminLoginPage />} />
                        <Route path="/test/:name" element={<StandaloneTestHistoryRoute />} />
                        <Route path="/w/:slug" element={<WorkspaceDashboardRoute />} />
                        <Route path="/w/:slug/login" element={<WorkspaceLoginRoute />} />
                        <Route path="/w/:slug/test/:name" element={<WorkspaceTestHistoryRoute />} />
                        <Route path="/auth/workspaces/:slug/api-keys/login" element={<WorkspaceApiKeyExchangeRoute />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </React.Suspense>
            </FrontendErrorBoundary>
        </BrowserRouter>
    )
}

function RouteLoadingFallback(): React.JSX.Element {
    return (
        <PageFrame>
            <LoadingView label="Загружаем интерфейс..." />
        </PageFrame>
    )
}

function WorkspaceDashboardRoute(): React.JSX.Element {
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