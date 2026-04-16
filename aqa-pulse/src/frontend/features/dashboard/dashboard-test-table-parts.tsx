import React from 'react'
import { Link } from 'react-router-dom'
import type {
    DashboardCurrentRunTest,
    DashboardErrorCluster,
    DashboardProblematicTest,
    DashboardSlowTest,
    DashboardSummary,
} from '../../../dashboard-utils'
import { formatDuration, formatPercent } from '../../../shared/formatting'
import { formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import { buildTestHistoryHref } from '../../runtime'
import { OverflowText, StatusBadge, TraceDisclosure } from '../../shared/ui'

export function DashboardTestHistoryLink(props: {
    workspaceSlug: string | null
    summary: DashboardSummary
    title: string
    project: string
    file: string
}): React.JSX.Element {
    return (
        <Link
            className="entity-link"
            to={buildTestHistoryHref(props.workspaceSlug, props.title, {
                branch: props.summary.filters.branch,
                project: props.project,
                file: props.file,
            })}
            title={props.title}
        >
            {props.title}
        </Link>
    )
}

export function DashboardCurrentRunTestRow(props: {
    test: DashboardCurrentRunTest
    summary: DashboardSummary
    workspaceSlug: string | null
    yesLabel: string
    noLabel: string
}): React.JSX.Element {
    return (
        <tr>
            <td><DashboardTestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={props.test.title} project={props.test.project} file={props.test.file} /></td>
            <td>{props.test.file}</td>
            <td>{props.test.project}</td>
            <td><StatusBadge label={formatStatusLabel(props.test.status, props.test.flaky)} tone={getStatusTone(props.test.status, props.test.flaky)} /></td>
            <td>{props.test.flaky ? props.yesLabel : props.noLabel}</td>
            <td>{formatDuration(props.test.durationMs)}</td>
            <DashboardTraceTableCell preview={props.test.errorMessage} details={props.test.errorDetails ?? props.test.errorMessage} />
        </tr>
    )
}

export function DashboardProblematicTestRow(props: {
    test: DashboardProblematicTest
    summary: DashboardSummary
    workspaceSlug: string | null
    yesLabel: string
    noLabel: string
}): React.JSX.Element {
    return (
        <tr>
            <td><DashboardTestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={props.test.title} project={props.test.project} file={props.test.file} /></td>
            <td>{props.test.file}</td>
            <td><StatusBadge label={formatStatusLabel(props.test.status, props.test.flaky)} tone={getStatusTone(props.test.status, props.test.flaky)} /></td>
            <td>{props.test.flaky ? props.yesLabel : props.noLabel}</td>
            <td>{formatPercent(props.test.failureRate)} ({props.test.attempts})</td>
            <td>{formatDuration(props.test.durationMs)}</td>
            <DashboardTraceTableCell preview={props.test.errorMessage} details={props.test.errorDetails ?? props.test.errorMessage} />
        </tr>
    )
}

export function DashboardSlowTestRow(props: {
    test: DashboardSlowTest
    summary: DashboardSummary
    workspaceSlug: string | null
    yesLabel: string
    noLabel: string
}): React.JSX.Element {
    return (
        <tr>
            <td><DashboardTestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={props.test.title} project={props.test.project} file={props.test.file} /></td>
            <td>{props.test.file}</td>
            <td><StatusBadge label={formatStatusLabel(props.test.status, props.test.flaky)} tone={getStatusTone(props.test.status, props.test.flaky)} /></td>
            <td>{props.test.flaky ? props.yesLabel : props.noLabel}</td>
            <td>{formatDuration(props.test.durationMs)}</td>
            <DashboardTraceTableCell preview={props.test.errorMessage} details={props.test.errorDetails ?? props.test.errorMessage} />
        </tr>
    )
}

export function DashboardErrorClusterRow(props: { cluster: DashboardErrorCluster }): React.JSX.Element {
    return (
        <tr>
            <DashboardTraceTableCell preview={props.cluster.message} details={props.cluster.sampleMessage ?? props.cluster.message} />
            <td>{props.cluster.count}</td>
            <td>
                <OverflowText as="span" text={props.cluster.tests.join(' • ')} className="cluster-tests-react" lines={2} />
            </td>
        </tr>
    )
}

function DashboardTraceTableCell(props: { preview: string | null | undefined; details: string | null | undefined }): React.JSX.Element {
    return (
        <td>
            <TraceDisclosure previewText={props.preview} text={props.details} />
        </td>
    )
}