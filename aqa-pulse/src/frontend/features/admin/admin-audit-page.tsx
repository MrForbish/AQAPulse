import React from 'react'
import { Link } from 'react-router-dom'
import { useInitialAdminWorkspaces } from '../../runtime-hooks'
import { ErrorView, PageFrame } from '../../shared/ui'
import { useAdminDashboardState } from './admin-hooks'
import { AdminAuditTrailSection, AdminDashboardActionResult } from './admin-dashboard-sections'

export function AdminAuditPage(): React.JSX.Element {
    const initialWorkspaces = useInitialAdminWorkspaces()
    const {
        auditPage,
        isAuditPageLoading,
        errorMessage,
        actionResult,
        dismissActionResult,
        goToPreviousAuditPage,
        goToNextAuditPage,
    } = useAdminDashboardState(initialWorkspaces)

    return (
        <PageFrame>
            <section className="admin-subpage-header">
                <div>
                    <div className="eyebrow">Журнал действий</div>
                    <h1>Аудит админки</h1>
                    <p className="subtle-copy">История изменений workspace, ключей, пользователей, сессий и настроек сервера.</p>
                </div>
                <Link to="/admin" className="secondary-button">Вернуться в админку</Link>
            </section>

            {actionResult ? <AdminDashboardActionResult actionResult={actionResult} onClose={dismissActionResult} /> : null}
            {errorMessage ? <ErrorView title="Admin API недоступен" message={errorMessage} /> : null}

            <AdminAuditTrailSection
                auditPage={auditPage}
                isLoading={isAuditPageLoading}
                onPreviousPage={goToPreviousAuditPage}
                onNextPage={goToNextAuditPage}
            />
        </PageFrame>
    )
}
