import React from 'react'
import { Link } from 'react-router-dom'
import { useInitialAdminWorkspaces } from '../../runtime-hooks'
import { ErrorView, PageFrame } from '../../shared/ui'
import { useAdminDashboardState } from './admin-hooks'
import { AdminDashboardActionResult, AdminServerSettingsSection } from './admin-dashboard-sections'

export function AdminSettingsPage(): React.JSX.Element {
    const initialWorkspaces = useInitialAdminWorkspaces()
    const {
        serverSettings,
        errorMessage,
        actionResult,
        dismissActionResult,
        busyKey,
        updateServerSettings,
    } = useAdminDashboardState(initialWorkspaces)

    return (
        <PageFrame>
            <section className="admin-subpage-header">
                <div>
                    <div className="eyebrow">Advanced instance settings</div>
                    <h1>Server settings</h1>
                    <p className="subtle-copy">Self-hosted instance URLs, auth policy, session TTL and business calculation defaults.</p>
                </div>
                <Link to="/admin" className="secondary-button">Back to admin</Link>
            </section>

            {actionResult ? <AdminDashboardActionResult actionResult={actionResult} onClose={dismissActionResult} /> : null}
            {errorMessage ? <ErrorView title="Admin API недоступен" message={errorMessage} /> : null}

            <AdminServerSettingsSection settings={serverSettings} busyKey={busyKey} onUpdateSettings={updateServerSettings} />
        </PageFrame>
    )
}
