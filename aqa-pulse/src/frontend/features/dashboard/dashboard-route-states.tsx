import React from 'react'
import { ErrorView, LoadingView, PageFrame } from '../../shared/ui'

export function DashboardLoadingState(): React.JSX.Element {
    return (
        <PageFrame>
            <LoadingView label="Собираем React dashboard..." />
        </PageFrame>
    )
}

export function DashboardErrorState(props: { reloadHref: string; errorMessage: string | null }): React.JSX.Element {
    return (
        <PageFrame>
            <ErrorView
                title="Не удалось загрузить dashboard"
                message={props.errorMessage ?? 'Сводка временно недоступна.'}
                action={<a className="ghost-link" href={props.reloadHref}>Перезагрузить страницу</a>}
            />
        </PageFrame>
    )
}