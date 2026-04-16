/**
 * Назначение: страница обмена raw workspace API key на ingestion JWT для self-hosted и client onboarding сценариев.
 */
import React from 'react'
import { ErrorView, Panel } from '../../shared/ui'
import { AuthShell } from './auth-shell'
import { AuthTokenForm } from './auth-token-form'
import { useWorkspaceApiKeyExchangeAction } from './admin-hooks'

/**
 * После exchange страница сразу показывает готовые operational details, чтобы оператор мог без ручной сборки составить Authorization header и ingestion endpoint.
 */
export function WorkspaceApiKeyExchangePage(props: { workspaceSlug: string }): React.JSX.Element {
    const { errorMessage, exchangeResult, isSubmitting, submit } = useWorkspaceApiKeyExchangeAction(props.workspaceSlug)

    const detailEntries = exchangeResult
        ? {
            accessToken: exchangeResult.accessToken,
            expiresAt: exchangeResult.expiresAt,
            scope: exchangeResult.scope,
            workspace: exchangeResult.workspace,
            authorizationHeader: `Bearer ${exchangeResult.accessToken}`,
            ingestionEndpoint: `/api/workspaces/${exchangeResult.workspace}/ingestions`,
        }
        : null

    return (
        <AuthShell
            eyebrow="API key exchange"
            title="API key → ingestion JWT"
            description={`Workspace: ${props.workspaceSlug}. Введи raw API key, чтобы получить ingestion JWT для загрузки прогонов.`}
            footerLink={{ href: '/admin', label: 'Вернуться в admin dashboard' }}
        >
            <AuthTokenForm fieldLabel="Workspace API key" submitLabel="Получить ingestion JWT" submittingLabel="Выпускаем JWT..." onSubmitToken={submit} isSubmitting={isSubmitting} />
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
