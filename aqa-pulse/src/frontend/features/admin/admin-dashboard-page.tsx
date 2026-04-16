/**
 * Назначение: admin React-страница для provisioning workspace, API keys и workspace users в едином shell.
 */
import React from 'react'
import { useRuntime } from '../../runtime'
import { ErrorView, PageFrame } from '../../shared/ui'
import { useAdminDashboardState } from './admin-hooks'
import {
    AdminDashboardActionResult,
    AdminDashboardHero,
    AdminProvisioningIntro,
    AdminWorkspaceRegistry,
} from './admin-dashboard-sections'

/**
 * Dashboard reuses bootstrap-loaded workspaces when они уже встроены в HTML shell, но сохраняет живые CRUD-action handlers как отдельный hook-слой.
 */
export function AdminDashboardPage(): React.JSX.Element {
    const runtime = useRuntime()
    const {
        workspaces,
        isLoading,
        errorMessage,
        actionResult,
        busyKey,
        createWorkspace,
        createApiKey,
        createUser,
        logout,
    } = useAdminDashboardState(runtime.initialAdminWorkspaces)

    return (
        <PageFrame>
            <AdminDashboardHero workspaceCount={workspaces.length} isLoggingOut={busyKey === 'logout'} onLogout={logout} />

            {actionResult ? <AdminDashboardActionResult actionResult={actionResult} /> : null}
            {errorMessage ? <ErrorView title="Admin API недоступен" message={errorMessage} /> : null}

            <AdminProvisioningIntro isCreatingWorkspace={busyKey === 'workspace:create'} onCreateWorkspace={createWorkspace} />
            <AdminWorkspaceRegistry workspaces={workspaces} isLoading={isLoading} busyKey={busyKey} onCreateApiKey={createApiKey} onCreateUser={createUser} />
        </PageFrame>
    )
}
