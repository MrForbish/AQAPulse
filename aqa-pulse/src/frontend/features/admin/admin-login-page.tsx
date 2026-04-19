/**
 * Назначение: admin login-страница React shell с bootstrap-aware session redirect и token submit flow.
 */
import React from 'react'
import { ErrorView } from '../../shared/ui'
import { AuthShell } from './auth-shell'
import { AuthCheckingSessionState, AuthTokenForm } from './auth-token-form'
import { useAdminLoginAction, useAdminLoginRedirect } from './admin-hooks'

/**
 * Login page разделяет bootstrap/session redirect и submit-action по разным hooks, чтобы shell мог быстро пропускать уже аутентифицированного админа без лишнего form state.
 */
export function AdminLoginPage(): React.JSX.Element {
    const { isCheckingSession } = useAdminLoginRedirect()
    const { errorMessage, isSubmitting, submit } = useAdminLoginAction()

    if (isCheckingSession) {
        return <AuthCheckingSessionState label="Проверяем admin session..." />
    }

    return (
        <AuthShell
            eyebrow="Admin access"
            title="AQA Pulse Admin"
            description="Войди через admin token, чтобы управлять рабочими пространствами, пользователями и ключами ingestion."
        >
            <AuthTokenForm fieldLabel="Admin token" submitLabel="Войти" submittingLabel="Входим..." onSubmitToken={submit} isSubmitting={isSubmitting} />
            {errorMessage ? <ErrorView title="Login не выполнен" message={errorMessage} /> : null}
        </AuthShell>
    )
}
