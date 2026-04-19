/**
 * Назначение: workspace login-страница для входа по user token и перехода в dashboard конкретного slug.
 */
import React from 'react'
import { ErrorView } from '../../shared/ui'
import { useRuntime } from '../../runtime'
import { AuthShell } from './auth-shell'
import { AuthCheckingSessionState, AuthTokenForm } from './auth-token-form'
import { useWorkspaceLoginAction, useWorkspaceLoginRedirect } from './admin-hooks'

/**
 * Страница сначала сверяет bootstrap/session состояние для конкретного workspace slug, а уже потом показывает форму ввода token.
 */
export function WorkspaceLoginPage(props: { workspaceSlug: string }): React.JSX.Element {
    const runtime = useRuntime()
    const { isCheckingSession } = useWorkspaceLoginRedirect(props.workspaceSlug)
    const { errorMessage, isSubmitting, submit } = useWorkspaceLoginAction(props.workspaceSlug)
    const workspaceName = runtime.route.kind === 'workspace-login' && runtime.route.workspaceSlug === props.workspaceSlug
        ? (runtime.route.workspaceName ?? props.workspaceSlug)
        : props.workspaceSlug

    if (isCheckingSession) {
        return <AuthCheckingSessionState label="Проверяем сессию workspace..." />
    }

    return (
        <AuthShell
            eyebrow="Доступ к workspace"
            title={workspaceName}
            description={`Введи пользовательский токен workspace, чтобы открыть дашборд «${workspaceName}».`}
        >
            <AuthTokenForm fieldLabel="Пользовательский токен workspace" submitLabel="Войти в дашборд" submittingLabel="Входим..." onSubmitToken={submit} isSubmitting={isSubmitting} />
            {errorMessage ? <ErrorView title="Не удалось войти" message={errorMessage} /> : null}
        </AuthShell>
    )
}
