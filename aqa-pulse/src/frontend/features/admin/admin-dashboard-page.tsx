/**
 * Назначение: admin React-страница для provisioning workspace, API keys и workspace users в едином shell.
 */
import React from 'react'
import { useInitialAdminWorkspaces } from '../../runtime-hooks'
import { ErrorView, PageFrame } from '../../shared/ui'
import { useAdminDashboardState } from './admin-hooks'
import {
    AdminDashboardActionResult,
    AdminDashboardHero,
    AdminAuditTrailSection,
    AdminIngestionHealthSection,
    AdminProvisioningIntro,
    AdminServerSettingsSection,
    AdminWorkspaceRegistry,
} from './admin-dashboard-sections'

/**
 * Dashboard reuses bootstrap-loaded workspaces when они уже встроены в HTML shell, но сохраняет живые CRUD-action handlers как отдельный hook-слой.
 */
export function AdminDashboardPage(): React.JSX.Element {
    const initialWorkspaces = useInitialAdminWorkspaces()
    const {
        workspaces,
        serverSettings,
        auditPage,
        ingestionHealth,
        isLoading,
        isAuditPageLoading,
        errorMessage,
        actionResult,
        dismissActionResult,
        busyKey,
        createWorkspace,
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
        updateServerSettings,
        goToPreviousAuditPage,
        goToNextAuditPage,
        logout,
    } = useAdminDashboardState(initialWorkspaces)

    return (
        <PageFrame>
            <AdminDashboardHero workspaceCount={workspaces.length} isLoggingOut={busyKey === 'logout'} onLogout={logout} />

            {actionResult ? <AdminDashboardActionResult actionResult={actionResult} onClose={dismissActionResult} /> : null}
            {errorMessage ? <ErrorView title="Admin API недоступен" message={errorMessage} /> : null}

            <AdminServerSettingsSection settings={serverSettings} busyKey={busyKey} onUpdateSettings={updateServerSettings} />
            <AdminProvisioningIntro isCreatingWorkspace={busyKey === 'workspace:create'} onCreateWorkspace={createWorkspace} />
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
            <AdminAuditTrailSection
                auditPage={auditPage}
                isLoading={isAuditPageLoading}
                onPreviousPage={goToPreviousAuditPage}
                onNextPage={goToNextAuditPage}
            />
        </PageFrame>
    )
}
