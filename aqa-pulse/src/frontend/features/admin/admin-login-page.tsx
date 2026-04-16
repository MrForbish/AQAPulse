import React from 'react'
import { LoadingView, PageFrame, ErrorView } from '../../shared/ui'
import { AuthShell } from './auth-shell'
import { useAdminLoginAction, useAdminLoginRedirect } from './admin-hooks'

export function AdminLoginPage(): React.JSX.Element {
    const { isCheckingSession } = useAdminLoginRedirect()
    const { errorMessage, isSubmitting, submit } = useAdminLoginAction()

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const token = String(formData.get('token') ?? '').trim()

        if (!token) {
            return
        }

        await submit(token)
    }

    if (isCheckingSession) {
        return (
            <PageFrame>
                <LoadingView label="Проверяем admin session..." />
            </PageFrame>
        )
    }

    return (
        <AuthShell
            eyebrow="Admin access"
            title="AQA Pulse Admin"
            description="Войди через admin token, чтобы управлять workspace, users и ingestion keys."
        >
            <form className="stack auth-form" onSubmit={handleSubmit}>
                <label>
                    <span>Admin token</span>
                    <input type="password" name="token" autoComplete="current-password" required />
                </label>
                <button type="submit" className="primary-link auth-submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Входим...' : 'Войти'}
                </button>
            </form>
            {errorMessage ? <ErrorView title="Login не выполнен" message={errorMessage} /> : null}
        </AuthShell>
    )
}
