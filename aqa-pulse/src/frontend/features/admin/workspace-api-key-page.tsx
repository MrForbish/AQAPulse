/**
 * Назначение: страница обмена raw workspace API key на ingestion JWT для self-hosted и client onboarding сценариев.
 */
import React from 'react'
import { ErrorView, Panel } from '../../shared/ui'
import { AuthShell } from './auth-shell'
import { useWorkspaceApiKeyExchangeAction } from './admin-hooks'

/**
 * После exchange страница сразу показывает готовые operational details, чтобы оператор мог без ручной сборки составить Authorization header и ingestion endpoint.
 */
export function WorkspaceApiKeyExchangePage(props: { workspaceSlug: string }): React.JSX.Element {
    const { errorMessage, exchangeResult, isSubmitting, submit } = useWorkspaceApiKeyExchangeAction(props.workspaceSlug)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const token = String(formData.get('token') ?? '').trim()

        if (!token) {
            return
        }

        await submit(token)
    }

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
            <form className="stack auth-form" onSubmit={handleSubmit}>
                <label>
                    <span>Workspace API key</span>
                    <input type="password" name="token" autoComplete="current-password" required />
                </label>
                <button type="submit" className="primary-link auth-submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Выпускаем JWT...' : 'Получить ingestion JWT'}
                </button>
            </form>
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
