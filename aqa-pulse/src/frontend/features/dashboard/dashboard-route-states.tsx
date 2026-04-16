import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { FramedErrorState, FramedLoadingState } from '../../shared/route-states'

export function DashboardLoadingState(): React.JSX.Element {
    return <FramedLoadingState label="Снимаем показания с тестов... Пульс ровный." />
}

export function DashboardErrorState(props: { reloadHref: string; errorMessage: string | null }): React.JSX.Element {
    return <FramedErrorState title="Не удалось загрузить dashboard" message={props.errorMessage ?? 'Сводка временно недоступна.'} action={<a className="ghost-link" href={props.reloadHref}>Перезагрузить страницу</a>} />
}

export function DashboardRouteStateBoundary(props: {
    summary: DashboardSummary | null
    isLoading: boolean
    errorMessage: string | null
    reloadHref: string
    children: (summary: DashboardSummary) => React.JSX.Element
}): React.JSX.Element {
    if (!props.summary && props.isLoading) {
        return <DashboardLoadingState />
    }

    if (!props.summary) {
        return <DashboardErrorState reloadHref={props.reloadHref} errorMessage={props.errorMessage} />
    }

    return props.children(props.summary)
}