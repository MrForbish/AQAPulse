import React from 'react'
import type { DashboardErrorCluster } from '../../../dashboard-utils'
import { OverflowText, StatusBadge, TraceDisclosure } from '../../shared/ui'

export function DashboardClusterMetricHint(props: {
    cluster: DashboardErrorCluster | null | undefined
    emptyLabel: string
}): React.JSX.Element {
    if (!props.cluster) {
        return <span>{props.emptyLabel}</span>
    }

    return (
        <div className="cluster-preview-react">
            <OverflowText as="span" text={props.cluster.message} className="cluster-message-react" lines={2} />
            <TraceDisclosure
                previewText="Показать пример ошибки"
                text={props.cluster.sampleMessage ?? props.cluster.message}
                dialogTitle="Пример ошибки из кластера"
            />
        </div>
    )
}

export function DashboardClusterCard(props: { cluster: DashboardErrorCluster }): React.JSX.Element {
    return (
        <article className="stack-item">
            <div className="stack-item-header">
                <OverflowText as="strong" text={props.cluster.message} className="mono-cell cluster-message-react" lines={2} />
                <StatusBadge label={`${props.cluster.count}`} tone="warn" />
            </div>
            <OverflowText as="div" text={props.cluster.tests.slice(0, 4).join(' • ')} className="subtle-copy cluster-tests-react" lines={2} />
            <div className="compact-top">
                <TraceDisclosure
                    previewText="Показать пример ошибки"
                    text={props.cluster.sampleMessage ?? props.cluster.message}
                    dialogTitle="Пример ошибки из кластера"
                />
            </div>
        </article>
    )
}