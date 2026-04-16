import React from 'react'
import { FramedErrorState, FramedLoadingState } from '../../shared/route-states'

export function DashboardLoadingState(): React.JSX.Element {
    return <FramedLoadingState label="Снимаем показания с тестов... Пульс ровный." />
}

export function DashboardErrorState(props: { reloadHref: string; errorMessage: string | null }): React.JSX.Element {
    return <FramedErrorState title="Не удалось загрузить dashboard" message={props.errorMessage ?? 'Сводка временно недоступна.'} action={<a className="ghost-link" href={props.reloadHref}>Перезагрузить страницу</a>} />
}