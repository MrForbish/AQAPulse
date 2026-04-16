import React from 'react'
import type { DashboardErrorCluster } from '../../../dashboard-utils'
import { OverflowText, StatusBadge, TraceDisclosure } from '../../shared/ui'

function buildClusterTracePreviewText(cluster: DashboardErrorCluster): string {
    const source = cluster.sampleMessage ?? cluster.message
    const previewLine = source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean)

    if (!previewLine) {
        return 'Открыть пример stack trace'
    }

    return previewLine.length > 110 ? `${previewLine.slice(0, 107)}...` : previewLine
}

export function DashboardClusterMetricHint(props: {
    cluster: DashboardErrorCluster | null | undefined
    emptyLabel: string
    showTrace?: boolean
}): React.JSX.Element {
    if (!props.cluster) {
        return <span>{props.emptyLabel}</span>
    }

    if (props.showTrace === false) {
        return <OverflowText as="span" text={props.cluster.message} className="cluster-message-react" lines={2} />
    }

    return (
        <div className="cluster-preview-react">
            <OverflowText as="span" text={props.cluster.message} className="cluster-message-react" lines={2} />
            <TraceDisclosure
                previewText={buildClusterTracePreviewText(props.cluster)}
                text={props.cluster.sampleMessage ?? props.cluster.message}
                dialogTitle="Пример ошибки из кластера"
                badgeLabel="sample"
                showBadge={false}
                variant="cluster"
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
                    previewText={buildClusterTracePreviewText(props.cluster)}
                    text={props.cluster.sampleMessage ?? props.cluster.message}
                    dialogTitle="Пример ошибки из кластера"
                    badgeLabel="sample"
                    showBadge={false}
                    variant="cluster"
                />
            </div>
        </article>
    )
}