/**
 * Назначение: React-страница истории теста с conflict-state, diagnostics и timeline для standalone и server маршрутов.
 */
import React from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import type { TestHistoryConflict, TestHistoryResponse } from '../../../api-store'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { TEST_HISTORY_METRIC_DESCRIPTIONS } from '../../../shared/test-history-metric-info'
import { formatCommit, formatStatusLabel, getStatusTone } from '../../../shared/dashboard-helpers'
import {
    buildHistoryRowAnchor,
    findCurrentStabilityStreak,
    findIncidentStepAnchor,
    findLatestStableRecovery,
    findUnstableStreakBeforeRecovery,
    formatTemplate,
    getUnstableHistoryItems,
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
import { AttemptDiagnostics } from './attempt-diagnostics'
import {
    EventSnapshot,
    PreviousUnstableEventsList,
    RecoverySnapshot,
    StabilityStreakSnapshot,
    UnstableStreakSnapshot,
} from './history-snapshots'

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
                <MetricCard label={HISTORY_TEXT.metrics.totalRuns} labelMetricKey="totalRuns" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.totalRuns} value={String(payload.summary.totalRuns)} />
                <MetricCard label={HISTORY_TEXT.metrics.failedRuns} labelMetricKey="failedRuns" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.failedRuns} value={String(payload.summary.failedRuns)} tone={payload.summary.failedRuns > 0 ? 'danger' : 'default'} />
                <MetricCard label={HISTORY_TEXT.metrics.flakyRuns} labelMetricKey="flakyRuns" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.flakyRuns} value={String(payload.summary.flakyRuns)} tone={payload.summary.flakyRuns > 0 ? 'warn' : 'default'} />
                <MetricCard label={HISTORY_TEXT.metrics.passRate} labelMetricKey="passRate" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.passRate} value={formatPercent(payload.summary.passRate)} tone="good" />
                <MetricCard label={HISTORY_TEXT.metrics.flakyScore} labelMetricKey="flakyScore" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.flakyScore} value={payload.summary.flakyScore.toFixed(1)} />
                <MetricCard label="MTBF" labelMetricKey="mtbf" labelTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.mtbf} value={payload.summary.mtbfDays === null ? '—' : `${payload.summary.mtbfDays.toFixed(2)} дн`} hint={HISTORY_TEXT.subtitles.mtbf} />
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
                    titleMetricKey="latestEvent"
                    titleTooltip={HISTORY_TEXT.incident.tooltip}
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
                <Panel title={latestUnstableRun?.errorMessage ? HISTORY_TEXT.metrics.latestError : HISTORY_TEXT.metrics.latestFlakyEvent} titleMetricKey={latestUnstableRun?.errorMessage ? 'latestError' : 'latestFlakyEvent'} titleTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.latestEvent}>
                    {latestUnstableRun ? (
                        <EventSnapshot run={latestUnstableRun} />
                    ) : (
                        <EmptyState title="Нестабильных эпизодов нет" message="История теста пока выглядит стабильной." />
                    )}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.latestStatus} titleMetricKey="latestStatus" titleTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.latestStatus}>
                    {latestRun ? <EventSnapshot run={latestRun} /> : <EmptyState title="Данных нет" message="Последний запуск пока не найден." />}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.previousUnstableEvents} titleMetricKey="previousUnstableEvents" titleTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.previousUnstableEvents}>
                    {previousUnstableRuns.length > 0 ? (
                        <PreviousUnstableEventsList runs={previousUnstableRuns} />
                    ) : (
                        <EmptyState title="Предыдущих инцидентов нет" message="Кроме самого свежего нестабильного события дополнительных эпизодов пока не видно." />
                    )}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.latestStableRecovery} titleMetricKey="latestRecovery" titleTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.latestRecovery}>
                    {latestRecovery ? (
                        <RecoverySnapshot recovery={latestRecovery.recovery} previousUnstable={latestRecovery.previousUnstable} />
                    ) : (
                        <EmptyState title="Восстановление не найдено" message="После нестабильной серии пока нет чистого стабильного прогона." />
                    )}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.currentStabilityStreak} titleMetricKey="currentStabilityStreak" titleTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.currentStabilityStreak}>
                    <StabilityStreakSnapshot history={payload.history} streak={currentStabilityStreak} />
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.unstableStreakBeforeRecovery} titleMetricKey="unstableStreakBeforeRecovery" titleTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.unstableStreakBeforeRecovery}>
                    {unstableStreakBeforeRecovery ? (
                        <UnstableStreakSnapshot streak={unstableStreakBeforeRecovery} />
                    ) : (
                        <EmptyState title="Серия перед восстановлением не найдена" message="Либо восстановление ещё не наступило, либо перед ним не было сплошной нестабильной серии." />
                    )}
                </Panel>
                <Panel title={HISTORY_TEXT.metrics.timeline} titleMetricKey="timeline" titleTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.timeline} className="span-2">
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

