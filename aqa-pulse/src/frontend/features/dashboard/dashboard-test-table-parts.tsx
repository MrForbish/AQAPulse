import React from 'react'
import { Link } from 'react-router-dom'
import type {
    DashboardCurrentRunTest,
    DashboardErrorCluster,
    DashboardFlakyTestMetric,
    DashboardProblematicTest,
    DashboardSlowTest,
    DashboardSummary,
} from '../../../dashboard-utils'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import { formatCommit, formatScore, formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import { buildTestHistoryHref } from '../../navigation'
import { EmptyState, OverflowText, Panel, StatusBadge, TraceDisclosure } from '../../shared/ui'

export function DashboardTable(props: {
    headers: React.ReactNode[]
    children: React.ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <div className={['table-wrap', 'compact-top', props.className].filter(Boolean).join(' ')}>
            <table>
                <thead>
                    <tr>
                        {props.headers.map((header, index) => <th key={`${String(header)}-${index}`}>{header}</th>)}
                    </tr>
                </thead>
                <tbody>{props.children}</tbody>
            </table>
        </div>
    )
}

export function DashboardEmptyTableRow(props: { colSpan: number; message: string }): React.JSX.Element {
    return (
        <tr>
            <td colSpan={props.colSpan}>{props.message}</td>
        </tr>
    )
}

export function DashboardTablePanel(props: {
    title: string
    titleMetricKey?: string
    titleTooltip?: string
    description?: string
    intro?: React.ReactNode
    className?: string
    headers: React.ReactNode[]
    rowCount: number
    emptyTitle: string
    emptyMessage: string
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <Panel
            title={props.title}
            titleMetricKey={props.titleMetricKey}
            titleTooltip={props.titleTooltip}
            description={props.description}
            className={props.className}
        >
            {props.intro ? <div className="compact-top">{props.intro}</div> : null}
            {props.rowCount > 0 ? (
                <DashboardTable headers={props.headers}>{props.children}</DashboardTable>
            ) : (
                <EmptyState title={props.emptyTitle} message={props.emptyMessage} />
            )}
        </Panel>
    )
}

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
            <td className="dashboard-current-run-title-cell"><DashboardTestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={props.test.title} project={props.test.project} file={props.test.file} /></td>
            <td className="dashboard-current-run-file-cell">
                <OverflowText as="span" text={props.test.file} className="dashboard-current-run-file-copy" lines={2} />
            </td>
            <td className="dashboard-current-run-project-cell">
                <OverflowText as="span" text={props.test.project} className="dashboard-current-run-project-copy" />
            </td>
            <td className="dashboard-current-run-status-cell"><StatusBadge label={formatStatusLabel(props.test.status, props.test.flaky)} tone={getStatusTone(props.test.status, props.test.flaky)} /></td>
            <td className="dashboard-current-run-flaky-cell">{props.test.flaky ? props.yesLabel : props.noLabel}</td>
            <td className="dashboard-current-run-duration-cell">{formatDuration(props.test.durationMs)}</td>
            <DashboardTraceTableCell className="dashboard-current-run-trace-cell" preview={props.test.errorMessage} details={props.test.errorDetails ?? props.test.errorMessage} wide />
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
            <DashboardTraceTableCell preview={props.cluster.message} details={props.cluster.sampleMessage ?? props.cluster.message} dialogTitle="Пример ошибки из кластера" />
            <td>{props.cluster.count}</td>
            <td className="cluster-tests-cell-react">
                <div className="cluster-tests-list-react">
                    {props.cluster.tests.map((testTitle, index) => (
                        <div key={`${testTitle}-${index}`} className="cluster-test-item-react" title={testTitle}>
                            <span className="cluster-test-index-react">{index + 1}.</span>
                            <span className="cluster-test-title-react">{testTitle}</span>
                        </div>
                    ))}
                </div>
            </td>
        </tr>
    )
}

export function DashboardFlakyTestRow(props: {
    test: DashboardFlakyTestMetric
    summary: DashboardSummary
    workspaceSlug: string | null
    showRunCounts?: boolean
}): React.JSX.Element {
    return (
        <tr>
            <td><DashboardTestHistoryLink workspaceSlug={props.workspaceSlug} summary={props.summary} title={props.test.title} project={props.test.project} file={props.test.file} /></td>
            <td>{props.test.file}</td>
            <td>{formatScore(props.test.flakyScore)}</td>
            <td>{formatPercent(props.test.failRate)}</td>
            <td>{props.test.mtbfDays === null ? '—' : `${props.test.mtbfDays.toFixed(2)} дн`}</td>
            {props.showRunCounts ? <td>{props.test.unstableRuns} / {props.test.totalRuns}</td> : null}
            <td><StatusBadge label={formatStatusLabel(props.test.latestStatus, false)} tone={getStatusTone(props.test.latestStatus, false)} /></td>
        </tr>
    )
}

export function DashboardRecentRunSummaryRow(props: { run: DashboardSummary['history']['recentRuns'][number] }): React.JSX.Element {
    return (
        <tr>
            <td>{formatDate(props.run.reportTimestamp ?? props.run.generatedAt)}</td>
            <td>{formatPercent(props.run.passRate)}</td>
            <td>{props.run.failedTests}</td>
            <td>{props.run.flakyTests}</td>
            <td>{formatDuration(props.run.totalDurationMs)}</td>
            <td>{props.run.branch ?? '—'}</td>
            <td>{formatCommit(props.run.commit)}</td>
            <td>{props.run.author ?? '—'}</td>
            <td>{props.run.sourceFile}</td>
        </tr>
    )
}

export function DashboardRecentRunCompactRow(props: { run: DashboardSummary['history']['recentRuns'][number] }): React.JSX.Element {
    return (
        <tr>
            <td>{formatDate(props.run.reportTimestamp ?? props.run.generatedAt)}</td>
            <td>{props.run.branch ?? '—'}</td>
            <td>{formatCommit(props.run.commit)}</td>
            <td>{formatPercent(props.run.passRate)}</td>
            <td>{props.run.failedTests}</td>
            <td>{props.run.flakyTests}</td>
            <td>{formatDuration(props.run.totalDurationMs)}</td>
            <td>{props.run.author ?? '—'}</td>
        </tr>
    )
}

function DashboardTraceTableCell(props: { preview: string | null | undefined; details: string | null | undefined; dialogTitle?: string; wide?: boolean; className?: string }): React.JSX.Element {
    const className = [
        props.className,
        'dashboard-trace-cell',
        props.wide ? 'is-wide' : '',
    ].filter(Boolean).join(' ')

    return (
        <td className={className}>
            <TraceDisclosure
                previewText={props.preview}
                text={props.details}
                dialogTitle={props.dialogTitle ?? 'Последняя ошибка'}
                compact
                compactSize="comfortable"
                variant="table"
            />
        </td>
    )
}