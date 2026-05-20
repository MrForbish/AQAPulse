/**
 * Назначение: страница обмена ключа загрузки workspace на временный JWT.
 */
import React from 'react'
import { ErrorView, Panel } from '../../shared/ui'
import { AuthShell } from './auth-shell'
import { AuthTokenForm } from './auth-token-form'
import { useWorkspaceApiKeyExchangeAction } from './admin-hooks'

/**
 * После обмена страница показывает готовые параметры для отправки отчетов.
 */
export function WorkspaceApiKeyExchangePage(props: { workspaceSlug: string }): React.JSX.Element {
    const { errorMessage, exchangeResult, isSubmitting, submit } = useWorkspaceApiKeyExchangeAction(props.workspaceSlug)

    const detailEntries = exchangeResult
        ? {
            JWT: exchangeResult.accessToken,
            'Истекает': exchangeResult.expiresAt,
            'Права': exchangeResult.scope,
            Workspace: exchangeResult.workspace,
            'Authorization header': `Bearer ${exchangeResult.accessToken}`,
            'Endpoint загрузки': `/api/workspaces/${exchangeResult.workspace}/ingestions`,
        }
        : null

    return (
        <AuthShell
            eyebrow="Проверка ключа загрузки"
            title="Ключ загрузки → JWT"
            description={`Workspace: ${props.workspaceSlug}. Введи ключ загрузки, чтобы получить временный JWT для отправки отчетов.`}
            footerLink={{ href: '/admin', label: 'Вернуться в админку' }}
        >
            <AuthTokenForm fieldLabel="Ключ загрузки workspace" submitLabel="Получить JWT" submittingLabel="Выпускаем JWT..." onSubmitToken={submit} isSubmitting={isSubmitting} />
            {errorMessage ? <ErrorView title="JWT не выпущен" message={errorMessage} /> : null}
            {detailEntries ? (
                <Panel title="JWT выпущен" className="panel-success">
                    <div className="detail-pairs">
                        {Object.entries(detailEntries).map(([key, value]) => (
                            <div key={key} className="detail-row">
                                <span>{key}</span>
                                <code>{value}</code>
                            </div>
                        ))}
                    </div>
                </Panel>
            ) : null}
        </AuthShell>
    )
}
