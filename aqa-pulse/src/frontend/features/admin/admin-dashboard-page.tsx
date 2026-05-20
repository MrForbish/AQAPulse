/**
 * Назначение: главная страница админки со списком workspace и управлением доступами.
 */
import React from 'react'
import { useInitialAdminWorkspaces } from '../../runtime-hooks'
import { ErrorView, PageFrame } from '../../shared/ui'
import { useAdminDashboardState } from './admin-hooks'
import {
    AdminDashboardActionResult,
    AdminDashboardHero,
    AdminIngestionHealthSection,
    AdminWorkspaceRegistry,
} from './admin-dashboard-sections'

/**
 * Страница использует workspace из начальной загрузки, а действия с данными держит в отдельном hook.
 */
export function AdminDashboardPage(): React.JSX.Element {
    const initialWorkspaces = useInitialAdminWorkspaces()
    const {
        workspaces,
        ingestionHealth,
        isLoading,
        errorMessage,
        actionResult,
        dismissActionResult,
        busyKey,
        updateWorkspace,
        deleteWorkspace,
        resetWorkspaceData,
        createApiKey,
        createShareLink,
        createUser,
        updateUserRole,
        disableApiKey,
        deleteApiKey,
        disableUser,
        deleteUser,
        revokeSession,
        logout,
    } = useAdminDashboardState(initialWorkspaces)

    return (
        <PageFrame>
            <AdminDashboardHero workspaceCount={workspaces.length} isLoggingOut={busyKey === 'logout'} onLogout={logout} />

            {actionResult ? <AdminDashboardActionResult actionResult={actionResult} onClose={dismissActionResult} /> : null}
            {errorMessage ? <ErrorView title="Admin API недоступен" message={errorMessage} /> : null}

            <AdminIngestionHealthSection health={ingestionHealth} />
            <AdminWorkspaceRegistry
                workspaces={workspaces}
                isLoading={isLoading}
                busyKey={busyKey}
                onUpdateWorkspace={updateWorkspace}
                onDeleteWorkspace={deleteWorkspace}
                onResetWorkspaceData={resetWorkspaceData}
                onCreateApiKey={createApiKey}
                onCreateShareLink={createShareLink}
                onCreateUser={createUser}
                onUpdateUserRole={updateUserRole}
                onDisableApiKey={disableApiKey}
                onDeleteApiKey={deleteApiKey}
                onDisableUser={disableUser}
                onDeleteUser={deleteUser}
                onRevokeSession={revokeSession}
            />
        </PageFrame>
    )
}
