/**
 * Назначение: workspace login-страница для входа по user token и перехода в dashboard конкретного slug.
 */
import React from 'react'
import { LoadingView, PageFrame, ErrorView } from '../../shared/ui'
import { AuthShell } from './auth-shell'
import { useWorkspaceLoginAction, useWorkspaceLoginRedirect } from './admin-hooks'

/**
 * Страница сначала сверяет bootstrap/session состояние для конкретного workspace slug, а уже потом показывает форму ввода token.
 */
export function WorkspaceLoginPage(props: { workspaceSlug: string }): React.JSX.Element {
    const { isCheckingSession } = useWorkspaceLoginRedirect(props.workspaceSlug)
    const { errorMessage, isSubmitting, submit } = useWorkspaceLoginAction(props.workspaceSlug)

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
                <LoadingView label="Проверяем workspace session..." />
            </PageFrame>
        )
    }

    return (
        <AuthShell
            eyebrow="Workspace access"
            title="Workspace login"
            description={`Workspace: ${props.workspaceSlug}. Введи workspace user token для просмотра dashboard.`}
        >
            <form className="stack auth-form" onSubmit={handleSubmit}>
                <label>
                    <span>Workspace user token</span>
                    <input type="password" name="token" autoComplete="current-password" required />
                </label>
                <button type="submit" className="primary-link auth-submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Открываем...' : 'Открыть dashboard'}
                </button>
            </form>
            {errorMessage ? <ErrorView title="Login не выполнен" message={errorMessage} /> : null}
        </AuthShell>
    )
}
