/**
 * Назначение: React-страница истории теста с conflict-state, diagnostics и timeline для standalone и server маршрутов.
 */
import React from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import type { TestHistoryAttachment, TestHistoryConflict, TestHistoryResponse } from '../../../api-store'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { formatCommit, formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import {
    buildAttachmentHref,
    buildHistoryRowAnchor,
    buildStepAnchor,
    canInlineMarkdownPreview,
    findCurrentStabilityStreak,
    findIncidentStepAnchor,
    findLatestStableRecovery,
    findUnstableStreakBeforeRecovery,
    formatCurrentStabilityDescription,
    formatRunsLabel,
    formatTemplate,
    getUnstableEventLabel,
    getUnstableHistoryItems,
    isImageAttachment,
    isMarkdownAttachment,
} from '../../../shared/test-history-helpers'
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

/**
 * Страница принимает `requestedTitle` из router-слоя, а дальше сама решает, можно ли переиспользовать bootstrap payload или нужен повторный fetch/static resolve для нового URL.
 */
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
    const unstableRuns = getUnstableHistoryItems(payload.history)
    const latestUnstableRun = unstableRuns[0] ?? null
    const previousUnstableRuns = unstableRuns.slice(1, 4)
    const latestRecovery = findLatestStableRecovery(payload.history)
    const currentStabilityStreak = findCurrentStabilityStreak(payload.history)
    const unstableStreakBeforeRecovery = findUnstableStreakBeforeRecovery(payload.history)
    const incidentLead = payload.incidentSummary ? extractIncidentLead(payload.incidentSummary.summary) : null
    const incidentPrimarySignal = payload.incidentSummary?.failureStepErrorMessage ?? payload.incidentSummary?.latestErrorMessage ?? null
    const failureStepAnchor = payload.incidentSummary ? findIncidentStepAnchor(payload.history, payload.incidentSummary.failureStepTitle) : null

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

            {payload.missingRuns.length > 0 ? (
                <div className="inline-note is-warning">
                    <strong>{HISTORY_TEXT.metrics.archiveGaps}</strong>
                    <div className="mono-cell compact-top">{payload.missingRuns.join(', ')}</div>
                </div>
            ) : null}

            {payload.incidentSummary ? (
                <Panel
                    title={HISTORY_TEXT.incident.title}
                    description={HISTORY_TEXT.incident.severityDescription[payload.incidentSummary.severity]}
                    className={`incident-panel is-${payload.incidentSummary.severity}`}
                >
                    <div className="module-pills compact-top">
                        <span className={`module-pill is-${getIncidentSeverityTone(payload.incidentSummary.severity)}`}>
                            {HISTORY_TEXT.incident.severity[payload.incidentSummary.severity]}
                        </span>
                    </div>
                    {incidentLead ? <div className="incident-summary-lead-react compact-top">{incidentLead}</div> : null}
                    <div className="signal-grid compact-top">
                        <div className="detail-card-react">
                            <span className="metric-label">{HISTORY_TEXT.incident.categoryLabel}</span>
                            <strong>{HISTORY_TEXT.incident.category[payload.incidentSummary.category]}</strong>
                        </div>
                        <div className="detail-card-react">
                            <span className="metric-label">{HISTORY_TEXT.incident.failureStepLabel}</span>
                            <strong>{payload.incidentSummary.failureStepTitle ?? payload.incidentSummary.failureStepCategory ?? HISTORY_TEXT.incident.notCaptured}</strong>
                            {failureStepAnchor ? (
                                <div className="anchor-link-row compact-top">
                                    <a className="ghost-link" href={`#${failureStepAnchor}`}>{HISTORY_TEXT.incident.jumpToFailureStep}</a>
                                </div>
                            ) : null}
                        </div>
                        <div className="detail-card-react">
                            <span className="metric-label">{HISTORY_TEXT.incident.primarySignalLabel}</span>
                            <strong className="mono-cell">{incidentPrimarySignal ?? HISTORY_TEXT.incident.notCaptured}</strong>
                        </div>
                    </div>
                    <div className="incident-grid-react">
                        <MetricCard label={HISTORY_TEXT.incident.categoryLabel} value={HISTORY_TEXT.incident.category[payload.incidentSummary.category]} tone="warn" />
                        <MetricCard label={HISTORY_TEXT.incident.confidenceLabel} value={HISTORY_TEXT.incident.confidence[payload.incidentSummary.confidence]} />
                        <MetricCard label={HISTORY_TEXT.incident.unstableRunsLabel} value={String(payload.incidentSummary.unstableRuns)} tone="danger" />
                        <MetricCard label={HISTORY_TEXT.incident.matchingRunsLabel} value={String(payload.incidentSummary.matchingRuns)} />
                    </div>
                    <div className="meta-badge-row compact-top">
                        <span className="meta-badge">{HISTORY_TEXT.incident.firstSeenLabel}: {formatOptionalDate(payload.incidentSummary.firstSeenAt)}</span>
                        <span className="meta-badge">{HISTORY_TEXT.incident.latestSeenLabel}: {formatOptionalDate(payload.incidentSummary.latestSeenAt)}</span>
                        <span className="meta-badge">{HISTORY_TEXT.incident.recoveryLabel}: {formatOptionalDate(payload.incidentSummary.latestRecoveryAt)}</span>
                        <span className="meta-badge">{HISTORY_TEXT.incident.attemptsLabel}: {payload.incidentSummary.affectedAttempts}</span>
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
                <Panel title={HISTORY_TEXT.metrics.previousUnstableEvents}>
                    {previousUnstableRuns.length > 0 ? (
                        <PreviousUnstableEventsList runs={previousUnstableRuns} />
                    ) : (
                        <EmptyState title="Предыдущих инцидентов нет" message="Кроме самого свежего нестабильного события дополнительных эпизодов пока не видно." />
                    )}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.latestStableRecovery}>
                    {latestRecovery ? (
                        <RecoverySnapshot recovery={latestRecovery.recovery} previousUnstable={latestRecovery.previousUnstable} />
                    ) : (
                        <EmptyState title="Восстановление не найдено" message="После нестабильной серии пока нет чистого стабильного прогона." />
                    )}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.currentStabilityStreak}>
                    <StabilityStreakSnapshot history={payload.history} streak={currentStabilityStreak} />
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.unstableStreakBeforeRecovery}>
                    {unstableStreakBeforeRecovery ? (
                        <UnstableStreakSnapshot streak={unstableStreakBeforeRecovery} />
                    ) : (
                        <EmptyState title="Серия перед восстановлением не найдена" message="Либо восстановление ещё не наступило, либо перед ним не было сплошной нестабильной серии." />
                    )}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.timeline} className="span-2">
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>{DASHBOARD_TEXT.tables.time}</th>
                                    <th>{DASHBOARD_TEXT.tables.branch}</th>
                                    <th>{DASHBOARD_TEXT.tables.commit}</th>
                                    <th>{HISTORY_TEXT.tables.author}</th>
                                    <th>{DASHBOARD_TEXT.tables.status}</th>
                                    <th>{DASHBOARD_TEXT.tables.duration}</th>
                                    <th>{HISTORY_TEXT.meta.retries}</th>
                                    <th>{HISTORY_TEXT.meta.attempts}</th>
                                    <th>{DASHBOARD_TEXT.tables.lastError}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payload.history.map((item) => (
                                    <tr key={item.runId} id={buildHistoryRowAnchor(item.runId)}>
                                        <td>{formatDate(item.reportTimestamp ?? item.generatedAt)}</td>
                                        <td>{item.branch ?? '—'}</td>
                                        <td>{formatCommit(item.commit)}</td>
                                        <td>{item.author ?? '—'}</td>
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
                {latestUnstableRun && (!latestRun || latestUnstableRun.runId !== latestRun.runId) ? (
                    <Panel title={HISTORY_TEXT.diagnostics.latestUnstableTitle} description={HISTORY_TEXT.diagnostics.latestUnstableDescription} className="span-2">
                        <AttemptDiagnostics runId={latestUnstableRun.runId} attempts={latestUnstableRun.attemptDetails} artifactBasePath={artifactBasePath} isStaticMode={isStaticMode} />
                    </Panel>
                ) : null}
            </div>
        </PageFrame>
    )
}

function EventSnapshot(props: { run: TestHistoryResponse['history'][number] }): React.JSX.Element {
    return (
        <div className="stack-list">
            <div className={`stack-item event-panel-card ${getEventToneClass(props.run)}`}>
                <div className="stack-item-header">
                    <strong>{formatDate(props.run.reportTimestamp ?? props.run.generatedAt)}</strong>
                    <StatusBadge label={formatStatusLabel(props.run.status, props.run.flaky)} tone={getStatusTone(props.run.status, props.run.flaky)} />
                </div>
                <div className="subtle-copy">{props.run.branch ?? '—'} • {formatCommit(props.run.commit)} • {formatDuration(props.run.durationMs)} • {props.run.author ?? '—'}</div>
                <div className={props.run.errorMessage ? 'mono-cell compact-top' : 'event-description compact-top'}>
                    {props.run.errorMessage ?? (props.run.flaky ? HISTORY_TEXT.texts.latestFlakyDescription : 'Ошибок не зафиксировано.')}
                </div>
                <div className="anchor-link-row compact-top">
                    <a className="ghost-link" href={`#${buildHistoryRowAnchor(props.run.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                </div>
            </div>
        </div>
    )
}

function PreviousUnstableEventsList(props: { runs: TestHistoryResponse['history'] }): React.JSX.Element {
    return (
        <div className="stack-list">
            {props.runs.map((run) => (
                <div key={run.runId} className={`stack-item event-panel-card ${getEventToneClass(run)}`}>
                    <div className="stack-item-header">
                        <strong>{formatDate(run.reportTimestamp ?? run.generatedAt)}</strong>
                        <StatusBadge label={getUnstableEventLabel(run)} tone={getStatusTone(run.status, run.flaky)} />
                    </div>
                    <div className="subtle-copy">{run.branch ?? '—'} • {formatCommit(run.commit)} • {formatDuration(run.durationMs)}</div>
                    <div className={run.errorMessage ? 'mono-cell compact-top' : 'event-description compact-top'}>
                        {run.errorMessage ?? (run.flaky ? HISTORY_TEXT.texts.retryFlakyDescription : formatTemplate(HISTORY_TEXT.texts.statusPrefix, { status: formatStatusLabel(run.status, false) }))}
                    </div>
                    <div className="anchor-link-row compact-top">
                        <a className="ghost-link" href={`#${buildHistoryRowAnchor(run.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                    </div>
                </div>
            ))}
        </div>
    )
}

function RecoverySnapshot(props: {
    recovery: TestHistoryResponse['history'][number]
    previousUnstable: TestHistoryResponse['history'][number]
}): React.JSX.Element {
    const sourceLabel = props.previousUnstable.errorMessage
        ? HISTORY_TEXT.texts.recoveryFromError
        : (props.previousUnstable.flaky
            ? HISTORY_TEXT.texts.recoveryFromFlaky
            : formatTemplate(HISTORY_TEXT.texts.statusPrefix, { status: formatStatusLabel(props.previousUnstable.status, false) }))

    return (
        <div className="stack-list">
            <div className="stack-item event-panel-card is-good">
                <div className="stack-item-header">
                    <strong>{formatDate(props.recovery.reportTimestamp ?? props.recovery.generatedAt)}</strong>
                    <StatusBadge label={formatStatusLabel(props.recovery.status, props.recovery.flaky)} tone={getStatusTone(props.recovery.status, props.recovery.flaky)} />
                </div>
                <div className="subtle-copy">{props.recovery.branch ?? '—'} • {formatCommit(props.recovery.commit)} • {formatDuration(props.recovery.durationMs)}</div>
                <div className="event-description compact-top">
                    {formatTemplate(HISTORY_TEXT.texts.recoveryAfter, {
                        source: sourceLabel,
                        date: formatDate(props.previousUnstable.reportTimestamp ?? props.previousUnstable.generatedAt),
                    })}
                </div>
                <div className="anchor-link-row compact-top">
                    <a className="ghost-link" href={`#${buildHistoryRowAnchor(props.recovery.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                </div>
            </div>
        </div>
    )
}

function StabilityStreakSnapshot(props: {
    history: TestHistoryResponse['history']
    streak: ReturnType<typeof findCurrentStabilityStreak>
}): React.JSX.Element {
    return (
        <div className="stack-list">
            <div className={`stack-item event-panel-card ${props.streak.count > 0 ? 'is-good' : 'is-warn'}`}>
                <div className="stack-item-header">
                    <strong>{formatRunsLabel(props.streak.count)}</strong>
                    <StatusBadge label={props.streak.count > 0 ? 'stable' : HISTORY_TEXT.states.unknown} tone={props.streak.count > 0 ? 'good' : 'warn'} />
                </div>
                <div className="event-description">{formatCurrentStabilityDescription(props.streak)}</div>
                <div className="meta-badge-row compact-top">
                    <span className="meta-badge">{HISTORY_TEXT.meta.latestStable}: {formatOptionalDate(props.streak.latestStable?.reportTimestamp ?? props.streak.latestStable?.generatedAt ?? null)}</span>
                    <span className="meta-badge">{HISTORY_TEXT.meta.streakStart}: {formatOptionalDate(props.streak.oldestStable?.reportTimestamp ?? props.streak.oldestStable?.generatedAt ?? null)}</span>
                    <span className="meta-badge">{HISTORY_TEXT.meta.currentLatestRun}: {formatOptionalDate(props.history[0]?.reportTimestamp ?? props.history[0]?.generatedAt ?? null)}</span>
                </div>
                {props.streak.latestStable ? (
                    <div className="anchor-link-row compact-top">
                        <a className="ghost-link" href={`#${buildHistoryRowAnchor(props.streak.latestStable.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

function UnstableStreakSnapshot(props: {
    streak: NonNullable<ReturnType<typeof findUnstableStreakBeforeRecovery>>
}): React.JSX.Element {
    return (
        <div className="stack-list">
            <div className={`stack-item event-panel-card ${getEventToneClass(props.streak.latestUnstable)}`}>
                <div className="stack-item-header">
                    <strong>{formatRunsLabel(props.streak.count)}</strong>
                    <StatusBadge label={getUnstableEventLabel(props.streak.latestUnstable)} tone={getStatusTone(props.streak.latestUnstable.status, props.streak.latestUnstable.flaky)} />
                </div>
                <div className="event-description">
                    {formatTemplate(HISTORY_TEXT.texts.unstableStreakBeforeRecovery, {
                        count: String(props.streak.count),
                        label: getUnstableEventLabel(props.streak.latestUnstable),
                    })}
                </div>
                <div className="meta-badge-row compact-top">
                    <span className="meta-badge">{HISTORY_TEXT.meta.recoveryAt}: {formatDate(props.streak.recovery.reportTimestamp ?? props.streak.recovery.generatedAt)}</span>
                    <span className="meta-badge">{HISTORY_TEXT.meta.latestUnstable}: {formatDate(props.streak.latestUnstable.reportTimestamp ?? props.streak.latestUnstable.generatedAt)}</span>
                    <span className="meta-badge">{HISTORY_TEXT.meta.oldestUnstable}: {formatDate(props.streak.oldestUnstable.reportTimestamp ?? props.streak.oldestUnstable.generatedAt)}</span>
                </div>
                <div className="anchor-link-row compact-top">
                    <a className="ghost-link" href={`#${buildHistoryRowAnchor(props.streak.latestUnstable.runId)}`}>{HISTORY_TEXT.actions.jumpToRow}</a>
                </div>
            </div>
        </div>
    )
}

/**
 * Attempt diagnostics остаются внутри страницы, потому что им нужно одновременно знать про историю попыток, artifact policy и static/server режим открытия вложений.
 */
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
            <div className="inline-note is-info">{HISTORY_TEXT.diagnostics.retriesHint}</div>
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
                        <div className="meta-badge-row">
                            <span className="meta-badge">{HISTORY_TEXT.diagnostics.startTime}: {formatOptionalDate(attempt.startTime)}</span>
                            <span className="meta-badge">{HISTORY_TEXT.diagnostics.steps}: {attempt.steps.length}</span>
                            <span className="meta-badge">{HISTORY_TEXT.diagnostics.attachments}: {attempt.attachments.length}</span>
                        </div>
                        {attempt.errorMessage ? <div className="mono-cell">{attempt.errorMessage}</div> : null}
                        {attempt.steps.length > 0 ? (
                            <details className="attempt-step-group-react" open={Boolean(attempt.errorMessage)}>
                                <summary className="attachment-preview-summary-react">
                                    <span className="attempt-section-title-react">{HISTORY_TEXT.diagnostics.stepsTitle}</span>
                                    <span className="meta-badge">{attempt.steps.length}</span>
                                </summary>
                                <div className="attachment-preview-body-react">
                                    <div className="step-list-react">
                                        {attempt.steps.map((step, index) => (
                                            <div id={buildStepAnchor(props.runId, attempt.attempt, index)} key={`${attempt.attempt}-${index}-${step.title}`} className={`step-card${step.isFailurePoint ? ' is-failure' : ''}`}>
                                                <div className="stack-item-header">
                                                    <strong>{step.title}</strong>
                                                    {step.status ? <StatusBadge label={formatStatusLabel(step.status, false)} tone={getStatusTone(step.status, false)} /> : null}
                                                </div>
                                                <div className="subtle-copy">{step.category ?? HISTORY_TEXT.diagnostics.noCategory} • {formatDuration(step.durationMs)}</div>
                                                {step.isFailurePoint ? (
                                                    <div className="step-meta-row-react compact-top">
                                                        <span className="meta-badge">{HISTORY_TEXT.diagnostics.failedStepBadge}</span>
                                                    </div>
                                                ) : null}
                                                {step.errorMessage ? <div className="mono-cell compact-top">{step.errorMessage}</div> : null}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </details>
                        ) : null}
                        {attempt.attachments.length > 0 ? (
                            <>
                                <div className="attempt-section-title-react">{HISTORY_TEXT.diagnostics.attachmentsTitle}</div>
                                <div className="attachment-grid-react">
                                    {attempt.attachments.map((attachment) => (
                                        <AttachmentCard key={`${attachment.name}-${attachment.path ?? attachment.url ?? 'inline'}`} runId={props.runId} attachment={attachment} artifactBasePath={props.artifactBasePath} isStaticMode={props.isStaticMode} />
                                    ))}
                                </div>
                            </>
                        ) : null}
                        {!attempt.errorMessage && attempt.steps.length === 0 && attempt.attachments.length === 0 ? <div className="subtle-copy">{HISTORY_TEXT.diagnostics.emptyAttempt}</div> : null}
                    </div>
                </details>
            ))}
        </div>
    )
}

function AttachmentCard(props: { runId: string; attachment: TestHistoryAttachment; artifactBasePath: string; isStaticMode: boolean }): React.JSX.Element {
    const href = resolveAttachmentHref(props.runId, props.attachment, props.artifactBasePath, props.isStaticMode)
    const imagePreviewAvailable = Boolean(href && isImageAttachment(props.attachment))
    const markdownPreviewAvailable = Boolean(href && isMarkdownAttachment(props.attachment) && canInlineMarkdownPreview(href))
    const imagePreviewHref = imagePreviewAvailable ? href : null
    const [isImageLightboxOpen, setIsImageLightboxOpen] = React.useState(false)
    const [isMarkdownOpen, setIsMarkdownOpen] = React.useState(false)
    const [markdownState, setMarkdownState] = React.useState<{ status: 'idle' | 'loading' | 'success' | 'error'; content: string }>({ status: 'idle', content: '' })

    React.useEffect(() => {
        if (!isImageLightboxOpen) {
            return
        }

        const abortLightbox = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setIsImageLightboxOpen(false)
            }
        }

        window.addEventListener('keydown', abortLightbox)

        return () => {
            window.removeEventListener('keydown', abortLightbox)
        }
    }, [isImageLightboxOpen])

    React.useEffect(() => {
        if (!isMarkdownOpen || !markdownPreviewAvailable || !href || markdownState.status !== 'idle') {
            return
        }

        let isDisposed = false
        setMarkdownState({ status: 'loading', content: '' })

        fetch(href)
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Markdown preview request failed with ${response.status}`)
                }

                return response.text()
            })
            .then((content) => {
                if (!isDisposed) {
                    setMarkdownState({ status: 'success', content })
                }
            })
            .catch(() => {
                if (!isDisposed) {
                    setMarkdownState({ status: 'error', content: '' })
                }
            })

        return () => {
            isDisposed = true
        }
    }, [href, isMarkdownOpen, markdownPreviewAvailable, markdownState.status])

    return (
        <article className="attachment-card-react">
            <div className="stack-item-header">
                <strong>{props.attachment.name}</strong>
                {props.attachment.contentType ? <span className="meta-badge">{props.attachment.contentType}</span> : null}
            </div>
            <div className="subtle-copy">{props.attachment.contentType ?? 'unknown'}</div>
            <div className="mono-cell compact-top">{props.attachment.path ?? props.attachment.url ?? HISTORY_TEXT.diagnostics.attachmentLocationMissing}</div>
            {href ? <a className="ghost-link compact-top" href={href} target="_blank" rel="noreferrer">{HISTORY_TEXT.diagnostics.openAttachment}</a> : null}
            {imagePreviewHref ? (
                <details className="attachment-preview-react compact-top">
                    <summary className="attachment-preview-summary-react">{HISTORY_TEXT.diagnostics.inlineImagePreview}</summary>
                    <div className="attachment-preview-body-react">
                        <button
                            type="button"
                            className="attachment-image-trigger-react"
                            data-image-lightbox-trigger
                            aria-label={HISTORY_TEXT.diagnostics.expandImageHint}
                            onClick={() => setIsImageLightboxOpen(true)}
                        >
                            <img className="attachment-image-preview-react" src={imagePreviewHref} alt={props.attachment.name} loading="lazy" />
                        </button>
                        <div className="attachment-image-hint-react">{HISTORY_TEXT.diagnostics.expandImageHint}</div>
                    </div>
                </details>
            ) : null}
            {markdownPreviewAvailable ? (
                <details className="attachment-preview-react compact-top" onToggle={(event) => setIsMarkdownOpen((event.currentTarget as HTMLDetailsElement).open)}>
                    <summary className="attachment-preview-summary-react">{HISTORY_TEXT.diagnostics.inlineMarkdownPreview}</summary>
                    <div className="attachment-preview-body-react">
                        {markdownState.status === 'loading' ? <div className="attachment-preview-loading-react">{HISTORY_TEXT.diagnostics.loadingMarkdownPreview}</div> : null}
                        {markdownState.status === 'error' ? <div className="attachment-preview-error-react">{HISTORY_TEXT.diagnostics.markdownPreviewUnavailable}</div> : null}
                        {markdownState.status === 'success' ? <pre className="attachment-markdown-preview-react">{markdownState.content}</pre> : null}
                    </div>
                </details>
            ) : null}
            {imagePreviewHref ? (
                <div className="image-lightbox-react" hidden={!isImageLightboxOpen} data-image-lightbox>
                    <button
                        type="button"
                        className="image-lightbox-backdrop-react"
                        data-image-lightbox-close
                        aria-label={HISTORY_TEXT.diagnostics.closeImageLightbox}
                        onClick={() => setIsImageLightboxOpen(false)}
                    />
                    <div className="image-lightbox-dialog-react" role="dialog" aria-modal="true" aria-label={HISTORY_TEXT.diagnostics.imageLightboxTitle}>
                        <div className="image-lightbox-header-react">
                            <div className="image-lightbox-title-react" data-image-lightbox-title>{props.attachment.name || HISTORY_TEXT.diagnostics.imageLightboxTitle}</div>
                            <button
                                type="button"
                                className="image-lightbox-close-react"
                                data-image-lightbox-close
                                aria-label={HISTORY_TEXT.diagnostics.closeImageLightbox}
                                onClick={() => setIsImageLightboxOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="image-lightbox-body-react">
                            <img className="image-lightbox-image-react" data-image-lightbox-image src={imagePreviewHref} alt={props.attachment.name} loading="eager" />
                        </div>
                    </div>
                </div>
            ) : null}
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

function resolveAttachmentHref(runId: string, attachment: TestHistoryAttachment, artifactBasePath: string, isStaticMode: boolean): string | null {
    if (attachment.url) {
        return attachment.url
    }

    if (isStaticMode) {
        return null
    }

    return buildAttachmentHref(runId, attachment, artifactBasePath)
}

function formatOptionalDate(value: string | null): string {
    return value ? formatDate(value) : '—'
}

function extractIncidentLead(summary: string): string | null {
    const [lead] = summary
        .split(/\.\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)

    return lead ? (lead.endsWith('.') ? lead : `${lead}.`) : null
}

function getIncidentSeverityTone(severity: NonNullable<TestHistoryResponse['incidentSummary']>['severity']): 'danger' | 'warn' | 'good' {
    if (severity === 'active') {
        return 'danger'
    }

    if (severity === 'monitoring') {
        return 'warn'
    }

    return 'good'
}

function getEventToneClass(run: TestHistoryResponse['history'][number]): 'is-danger' | 'is-warn' | 'is-good' {
    if (run.errorMessage || run.status === 'failed' || run.status === 'timedout' || run.status === 'interrupted') {
        return 'is-danger'
    }

    if (run.flaky) {
        return 'is-warn'
    }

    return 'is-good'
}