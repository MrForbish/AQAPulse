import React from 'react'
import { Link } from 'react-router-dom'
import { useRuntime } from '../../runtime'
import { FramedErrorState } from '../../shared/route-states'

/**
 * Отдельная страница показывает понятную ошибку временной ссылки вместо короткого серверного ответа.
 */
export function WorkspaceShareLinkErrorPage(props: { workspaceSlug: string }): React.JSX.Element {
    const runtime = useRuntime()
    const route = runtime.route.kind === 'workspace-share-link-error' && runtime.route.workspaceSlug === props.workspaceSlug
        ? runtime.route
        : null

    return (
        <FramedErrorState
            title={route?.title ?? 'Ссылка больше недоступна'}
            message={route?.message ?? 'Срок действия временной ссылки истёк или она была отозвана.'}
            action={<Link className="ghost-link" to={`/w/${encodeURIComponent(props.workspaceSlug)}/login`}>Открыть обычный вход</Link>}
        />
    )
}
