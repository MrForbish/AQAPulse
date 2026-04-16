import React from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import type { TestHistoryAttachment, TestHistoryConflict, TestHistoryResponse } from '../../../api-store'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { useTestHistoryData } from '../../hooks/use-test-history'
import {
    buildArtifactBaseUrl,
    buildDashboardHref,
    buildTestHistoryApiUrl,
    readFiltersFromSearchParams,
    useRuntime,
} from '../../runtime'
import { EmptyState, ErrorView, LoadingView, MetricCard, PageFrame, Panel, StatusBadge } from '../../shared/ui'

const HISTORY_TEXT = ru.testHistory
const DASHBOARD_TEXT = ru.dashboard

export function TestHistoryPage(props: { workspaceSlug: string | null; requestedTitle: string }): React.JSX.Element {
    const runtime = useRuntime()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const filters = readFiltersFromSearchParams(searchParams)
    const isStaticMode = runtime.route.kind === 'static-dashboard'
    const currentRequestUrl = `${location.pathname}${location.search}`
    const apiUrl = buildTestHistoryApiUrl(props.workspaceSlug, props.requestedTitle, filters)
    const artifactBasePath = buildArtifactBaseUrl(props.workspaceSlug)
    const bootstrapMatches = runtime.route.kind === 'test-history'
        && runtime.route.workspaceSlug === props.workspaceSlug
        && runtime.route.testName === props.requestedTitle
        && runtime.initialRequestUrl === currentRequestUrl
    const initialPayload = bootstrapMatches ? runtime.initialTestHistoryPayload : null

    const { payload, isLoading, errorMessage } = useTestHistoryData({
        workspaceSlug: props.workspaceSlug,
        apiUrl,
        currentRequestUrl,
        initialPayload,
        isStaticMode,
        branch: filters.branch,
        project: filters.project,
        file: filters.file,
        requestedTitle: props.requestedTitle,
    })

    if (isLoading && !payload && !errorMessage) {
        return (
            <PageFrame>
                <LoadingView label="Открываем историю теста..." />
            </PageFrame>
        )
    }

    if (errorMessage) {
        return (
            <PageFrame>
                <ErrorView title="Не удалось загрузить историю теста" message={errorMessage} />
            </PageFrame>
        )
    }

    if (!payload) {
        return (
            <PageFrame>
                <ErrorView
                    title={HISTORY_TEXT.statePages.notFound.heading}
                    message={HISTORY_TEXT.statePages.notFound.message}
                    action={<Link className="ghost-link" to={buildDashboardHref(props.workspaceSlug, filters)}>{HISTORY_TEXT.backToDashboard}</Link>}
                />
            </PageFrame>
        )
    }

    if ('candidates' in payload) {
        return (
            <PageFrame>
                <Panel title={HISTORY_TEXT.statePages.conflict.heading} description={payload.message}>
                    <div className="candidate-list">
                        {payload.candidates.map((candidate) => (
                            <Link
                                key={`${candidate.project}-${candidate.file}-${candidate.title}`}
                                className="candidate-card"
                                to={buildCandidateHref(props.workspaceSlug, candidate.title, filters, candidate.project, candidate.file)}
                            >
                                <strong>{candidate.title}</strong>
                                <span>{candidate.project}</span>
                                <span>{candidate.file}</span>
                            </Link>
                        ))}
                    </div>
                </Panel>
            </PageFrame>
        )
    }

    const dashboardHref = buildDashboardHref(props.workspaceSlug, filters)
    const latestRun = payload.latestRun
    const latestUnstableRun = payload.history.find((item) => item.errorMessage || item.flaky || item.status === 'failed' || item.status === 'timedout' || item.status === 'interrupted') ?? null

    return (
        <PageFrame>
            <section className="hero-block">
                <div>
                    <div className="eyebrow">Test History</div>
                    <h1>{payload.test.title}</h1>
                    <p>
                        React-страница читает ту же API-модель, но уже без server-generated HTML на каждый сценарий.
                        История, инциденты и attempt diagnostics теперь живут как отдельный feature-модуль.
                    </p>
                </div>
                <div className="hero-meta-card">
                    <div className="hero-meta-row"><span>{DASHBOARD_TEXT.filters.project}</span><strong>{payload.test.project}</strong></div>
                    <div className="hero-meta-row"><span>{DASHBOARD_TEXT.tables.file}</span><strong>{payload.test.file}</strong></div>
                    <div className="hero-meta-row"><span>{HISTORY_TEXT.metrics.totalRuns}</span><strong>{payload.summary.totalRuns}</strong></div>
                    <div className="hero-actions">
                        <Link className="primary-link" to={dashboardHref}>{HISTORY_TEXT.backToDashboard}</Link>
                        <a className="ghost-link" href={apiUrl}>{HISTORY_TEXT.openJson}</a>
                    </div>
                </div>
            </section>

            <section className="metrics-grid">
                <MetricCard label={HISTORY_TEXT.metrics.totalRuns} value={String(payload.summary.totalRuns)} />
                <MetricCard label={HISTORY_TEXT.metrics.failedRuns} value={String(payload.summary.failedRuns)} tone={payload.summary.failedRuns > 0 ? 'danger' : 'default'} />
                <MetricCard label={HISTORY_TEXT.metrics.flakyRuns} value={String(payload.summary.flakyRuns)} tone={payload.summary.flakyRuns > 0 ? 'warn' : 'default'} />
                <MetricCard label={HISTORY_TEXT.metrics.passRate} value={formatPercent(payload.summary.passRate)} tone="good" />
                <MetricCard label={HISTORY_TEXT.metrics.flakyScore} value={payload.summary.flakyScore.toFixed(1)} />
                <MetricCard label="MTBF" value={payload.summary.mtbfDays === null ? '—' : `${payload.summary.mtbfDays.toFixed(2)} дн`} hint={HISTORY_TEXT.subtitles.mtbf} />
            </section>

            {payload.incidentSummary ? (
                <Panel title={HISTORY_TEXT.incident.title} description={payload.incidentSummary.summary} className="incident-panel">
                    <div className="incident-grid-react">
                        <MetricCard label={HISTORY_TEXT.incident.categoryLabel} value={HISTORY_TEXT.incident.category[payload.incidentSummary.category]} tone="warn" />
                        <MetricCard label={HISTORY_TEXT.incident.confidenceLabel} value={HISTORY_TEXT.incident.confidence[payload.incidentSummary.confidence]} />
                        <MetricCard label={HISTORY_TEXT.incident.unstableRunsLabel} value={String(payload.incidentSummary.unstableRuns)} tone="danger" />
                        <MetricCard label={HISTORY_TEXT.incident.matchingRunsLabel} value={String(payload.incidentSummary.matchingRuns)} />
                    </div>
                    {payload.incidentSummary.evidence.length > 0 ? (
                        <div className="evidence-list">
                            {payload.incidentSummary.evidence.map((item) => <div key={item} className="evidence-chip">{item}</div>)}
                        </div>
                    ) : null}
                </Panel>
            ) : null}

            <div className="page-grid">
                <Panel title={latestUnstableRun?.errorMessage ? HISTORY_TEXT.metrics.latestError : HISTORY_TEXT.metrics.latestFlakyEvent}>
                    {latestUnstableRun ? (
                        <EventSnapshot run={latestUnstableRun} />
                    ) : (
                        <EmptyState title="Нестабильных эпизодов нет" message="История теста пока выглядит стабильной." />
                    )}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.latestStatus}>
                    {latestRun ? <EventSnapshot run={latestRun} /> : <EmptyState title="Данных нет" message="Последний запуск пока не найден." />}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.timeline} className="span-2">
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>{DASHBOARD_TEXT.tables.time}</th>
                                    <th>{DASHBOARD_TEXT.tables.branch}</th>
                                    <th>{DASHBOARD_TEXT.tables.commit}</th>
                                    <th>{DASHBOARD_TEXT.tables.status}</th>
                                    <th>{DASHBOARD_TEXT.tables.duration}</th>
                                    <th>{HISTORY_TEXT.meta.retries}</th>
                                    <th>{HISTORY_TEXT.meta.attempts}</th>
                                    <th>{DASHBOARD_TEXT.tables.lastError}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payload.history.map((item) => (
                                    <tr key={item.runId}>
                                        <td>{formatDate(item.reportTimestamp ?? item.generatedAt)}</td>
                                        <td>{item.branch ?? '—'}</td>
                                        <td>{formatCommit(item.commit)}</td>
                                        <td><StatusBadge label={formatStatusLabel(item.status, item.flaky)} tone={getStatusTone(item.status, item.flaky)} /></td>
                                        <td>{formatDuration(item.durationMs)}</td>
                                        <td>{item.retries}</td>
                                        <td>{item.attempts}</td>
                                        <td className="mono-cell">{item.errorMessage ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
                {latestRun ? (
                    <Panel title={HISTORY_TEXT.diagnostics.latestRunTitle} description={HISTORY_TEXT.diagnostics.latestRunDescription} className="span-2">
                        <AttemptDiagnostics runId={latestRun.runId} attempts={latestRun.attemptDetails} artifactBasePath={artifactBasePath} isStaticMode={isStaticMode} />
                    </Panel>
                ) : null}
            </div>
        </PageFrame>
    )
}

function EventSnapshot(props: { run: TestHistoryResponse['history'][number] }): React.JSX.Element {
    return (
        <div className="stack-list">
            <div className="stack-item">
                <div className="stack-item-header">
                    <strong>{formatDate(props.run.reportTimestamp ?? props.run.generatedAt)}</strong>
                    <StatusBadge label={formatStatusLabel(props.run.status, props.run.flaky)} tone={getStatusTone(props.run.status, props.run.flaky)} />
                </div>
                <div className="subtle-copy">{props.run.branch ?? '—'} • {formatCommit(props.run.commit)} • {formatDuration(props.run.durationMs)}</div>
                <div className="mono-cell compact-top">{props.run.errorMessage ?? 'Ошибок не зафиксировано.'}</div>
            </div>
        </div>
    )
}

function AttemptDiagnostics(props: {
    runId: string
    attempts: TestHistoryResponse['history'][number]['attemptDetails']
    artifactBasePath: string
    isStaticMode: boolean
}): React.JSX.Element {
    if (props.attempts.length === 0) {
        return <EmptyState title="Attempt details отсутствуют" message={HISTORY_TEXT.diagnostics.emptyAttempt} />
    }

    return (
        <div className="attempt-list-react">
            {props.attempts.map((attempt) => (
                <details key={attempt.attempt} className="attempt-card" open={attempt.attempt === props.attempts[0]?.attempt}>
                    <summary>
                        <div>
                            <strong>{HISTORY_TEXT.diagnostics.attemptTitle.replace('{attempt}', String(attempt.attempt))}</strong>
                            <div className="subtle-copy">{formatDuration(attempt.durationMs)} • {attempt.steps.length} steps • {attempt.attachments.length} attachments</div>
                        </div>
                        <StatusBadge label={formatStatusLabel(attempt.status, false)} tone={getStatusTone(attempt.status, false)} />
                    </summary>
                    <div className="attempt-card-body">
                        {attempt.errorMessage ? <div className="mono-cell">{attempt.errorMessage}</div> : null}
                        {attempt.steps.length > 0 ? (
                            <div className="step-list-react">
                                {attempt.steps.map((step, index) => (
                                    <div key={`${attempt.attempt}-${index}-${step.title}`} className={`step-card${step.isFailurePoint ? ' is-failure' : ''}`}>
                                        <div className="stack-item-header">
                                            <strong>{step.title}</strong>
                                            {step.status ? <StatusBadge label={formatStatusLabel(step.status, false)} tone={getStatusTone(step.status, false)} /> : null}
                                        </div>
                                        <div className="subtle-copy">{step.category ?? HISTORY_TEXT.diagnostics.noCategory} • {formatDuration(step.durationMs)}</div>
                                        {step.errorMessage ? <div className="mono-cell compact-top">{step.errorMessage}</div> : null}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {attempt.attachments.length > 0 ? (
                            <div className="attachment-grid-react">
                                {attempt.attachments.map((attachment) => (
                                    <AttachmentCard key={`${attachment.name}-${attachment.path ?? attachment.url ?? 'inline'}`} runId={props.runId} attachment={attachment} artifactBasePath={props.artifactBasePath} isStaticMode={props.isStaticMode} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </details>
            ))}
        </div>
    )
}

function AttachmentCard(props: { runId: string; attachment: TestHistoryAttachment; artifactBasePath: string; isStaticMode: boolean }): React.JSX.Element {
    const href = buildAttachmentHref(props.runId, props.attachment, props.artifactBasePath, props.isStaticMode)
    const isImage = isImageAttachment(props.attachment)

    return (
        <article className="attachment-card-react">
            <strong>{props.attachment.name}</strong>
            <div className="subtle-copy">{props.attachment.contentType ?? 'unknown'}</div>
            {href && isImage ? <a href={href} target="_blank" rel="noreferrer"><img className="attachment-thumb" src={href} alt={props.attachment.name} loading="lazy" /></a> : null}
            <div className="mono-cell compact-top">{props.attachment.path ?? props.attachment.url ?? '—'}</div>
            {href ? <a className="ghost-link compact-top" href={href} target="_blank" rel="noreferrer">{HISTORY_TEXT.diagnostics.openAttachment}</a> : null}
        </article>
    )
}

function buildCandidateHref(
    workspaceSlug: string | null,
    title: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    project: string,
    file: string,
): string {
    const searchParams = new URLSearchParams()

    if (filters.branch) {
        searchParams.set('branch', filters.branch)
    }

    searchParams.set('project', project)
    searchParams.set('file', file)

    const pathname = workspaceSlug
        ? `/w/${encodeURIComponent(workspaceSlug)}/test/${encodeURIComponent(title)}`
        : `/test/${encodeURIComponent(title)}`

    return `${pathname}?${searchParams.toString()}`
}

function buildAttachmentHref(runId: string, attachment: TestHistoryAttachment, artifactBasePath: string, isStaticMode: boolean): string | null {
    if (attachment.url) {
        return attachment.url
    }

    if (isStaticMode) {
        return null
    }

    if (!attachment.path) {
        return null
    }

    const normalizedRunId = runId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'run'
    const normalizedPath = attachment.path.replace(/\\/g, '/').replace(/^\/+/, '')

    if (!normalizedPath.startsWith(`${normalizedRunId}/`)) {
        return null
    }

    return `${artifactBasePath}/${encodeURIComponent(runId)}?path=${encodeURIComponent(normalizedPath)}`
}

function isImageAttachment(attachment: TestHistoryAttachment): boolean {
    const contentType = attachment.contentType?.toLowerCase() ?? ''

    if (contentType.startsWith('image/')) {
        return true
    }

    return /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(attachment.path ?? attachment.url ?? attachment.name)
}

function formatCommit(commit: string | null): string {
    return commit ? commit.slice(0, 8) : '—'
}

function formatStatusLabel(status: string, flaky: boolean): string {
    if (flaky) {
        return HISTORY_TEXT.labels.flaky
    }

    return DASHBOARD_TEXT.statusLabels[status as keyof typeof DASHBOARD_TEXT.statusLabels] ?? status
}

function getStatusTone(status: string, flaky: boolean): 'neutral' | 'good' | 'warn' | 'danger' {
    if (flaky) {
        return 'warn'
    }

    const normalized = status.trim().toLowerCase()

    if (normalized === 'passed') {
        return 'good'
    }

    if (normalized === 'failed' || normalized === 'timedout' || normalized === 'interrupted') {
        return 'danger'
    }

    return 'neutral'
}