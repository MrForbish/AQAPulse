import React from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { readBootstrapFromDocument, RuntimeProvider, useRuntime } from './runtime'
import { DashboardPage } from './features/dashboard/dashboard-page'
import { TestHistoryPage } from './features/test-history/test-history-page'

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
        return <DashboardPage workspaceSlug={null} />
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<DashboardPage workspaceSlug={null} />} />
                <Route path="/test/:name" element={<StandaloneTestHistoryRoute />} />
                <Route path="/w/:slug" element={<WorkspaceDashboardRoute />} />
                <Route path="/w/:slug/test/:name" element={<WorkspaceTestHistoryRoute />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
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