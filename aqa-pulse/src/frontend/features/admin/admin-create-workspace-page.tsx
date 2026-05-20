import React from 'react'
import { Link } from 'react-router-dom'
import { useInitialAdminWorkspaces } from '../../runtime-hooks'
import { ErrorView, PageFrame } from '../../shared/ui'
import { useAdminDashboardState } from './admin-hooks'
import { AdminDashboardActionResult, AdminProvisioningIntro } from './admin-dashboard-sections'

export function AdminCreateWorkspacePage(): React.JSX.Element {
    const initialWorkspaces = useInitialAdminWorkspaces()
    const {
        errorMessage,
        actionResult,
        dismissActionResult,
        busyKey,
        createWorkspace,
    } = useAdminDashboardState(initialWorkspaces)

    return (
        <PageFrame>
            <section className="admin-subpage-header">
                <div>
                    <div className="eyebrow">Workspace onboarding</div>
                    <h1>Create workspace</h1>
                    <p className="subtle-copy">Create a workspace, initial ingestion key and ready-to-copy GitLab CI settings.</p>
                </div>
                <Link to="/admin" className="secondary-button">Back to admin</Link>
            </section>

            {actionResult ? <AdminDashboardActionResult actionResult={actionResult} onClose={dismissActionResult} /> : null}
            {errorMessage ? <ErrorView title="Admin API недоступен" message={errorMessage} /> : null}

            <AdminProvisioningIntro isCreatingWorkspace={busyKey === 'workspace:create'} onCreateWorkspace={createWorkspace} />
        </PageFrame>
    )
}
