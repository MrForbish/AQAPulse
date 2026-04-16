/**
 * Назначение: workspace login-страница для входа по user token и перехода в dashboard конкретного slug.
 */
import React from 'react'
import { ErrorView } from '../../shared/ui'
import { AuthShell } from './auth-shell'
import { AuthCheckingSessionState, AuthTokenForm } from './auth-token-form'
import { useWorkspaceLoginAction, useWorkspaceLoginRedirect } from './admin-hooks'

/**
 * Страница сначала сверяет bootstrap/session состояние для конкретного workspace slug, а уже потом показывает форму ввода token.
 */
export function WorkspaceLoginPage(props: { workspaceSlug: string }): React.JSX.Element {
    const { isCheckingSession } = useWorkspaceLoginRedirect(props.workspaceSlug)
    const { errorMessage, isSubmitting, submit } = useWorkspaceLoginAction(props.workspaceSlug)

    if (isCheckingSession) {
        return <AuthCheckingSessionState label="Проверяем workspace session..." />
    }

    return (
        <AuthShell
            eyebrow="Workspace access"
            title="Workspace login"
            description={`Workspace: ${props.workspaceSlug}. Введи workspace user token для просмотра dashboard.`}
        >
            <AuthTokenForm fieldLabel="Workspace user token" submitLabel="Открыть dashboard" submittingLabel="Открываем..." onSubmitToken={submit} isSubmitting={isSubmitting} />
            {errorMessage ? <ErrorView title="Login не выполнен" message={errorMessage} /> : null}
        </AuthShell>
    )
}
