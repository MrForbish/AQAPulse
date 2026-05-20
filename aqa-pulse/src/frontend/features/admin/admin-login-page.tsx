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
        return <AuthCheckingSessionState label="Проверяем сессию администратора..." />
    }

    return (
        <AuthShell
            eyebrow="Доступ администратора"
            title="Админка AQA Pulse"
            description="Войди через admin token, чтобы управлять workspace, пользователями и ключами загрузки отчетов."
        >
            <AuthTokenForm fieldLabel="Admin token" submitLabel="Войти" submittingLabel="Входим..." onSubmitToken={submit} isSubmitting={isSubmitting} />
            {errorMessage ? <ErrorView title="Войти не удалось" message={errorMessage} /> : null}
        </AuthShell>
    )
}
