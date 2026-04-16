import React from 'react'
import { ErrorView, LoadingView, PageFrame, Panel } from './ui'

export function FramedLoadingState(props: { label: string }): React.JSX.Element {
    return (
        <PageFrame>
            <LoadingView label={props.label} />
        </PageFrame>
    )
}

export function FramedErrorState(props: {
    title: string
    message: string
    action?: React.ReactNode
}): React.JSX.Element {
    return (
        <PageFrame>
            <ErrorView title={props.title} message={props.message} action={props.action} />
        </PageFrame>
    )
}

export function FramedPanelState(props: {
    title: string
    description?: string
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <PageFrame>
            <Panel title={props.title} description={props.description}>
                {props.children}
            </Panel>
        </PageFrame>
    )
}