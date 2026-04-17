import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { formatDate } from '../../../shared/formatting'
import {
    formatCommit,
    formatScore,
    getManagerChangeLabel,
    getManagerReadinessLabel,
    getManagerRiskLabel,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { MetricCard, NarrativeList, OverflowText, Panel, SummaryStrip } from '../../shared/ui'
import { mapChangeTone, mapManagerTone } from './dashboard-manager-helpers'
import {
    DashboardCurrentRunTestRow,
    DashboardEmptyTableRow,
    DashboardRecentRunSummaryRow,
    DashboardTable,
} from './dashboard-test-table-parts'

const DASHBOARD_TEXT = ru.dashboard

export function DashboardManagerOverviewSection(props: { summary: DashboardSummary }): React.JSX.Element {
    return (
        <Panel title={DASHBOARD_TEXT.manager.summaryTitle} titleMetricKey="managerSummary" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.managerSummary} description={DASHBOARD_TEXT.manager.summaryDescription} className="span-2">
            <div className="signal-grid compact-top overview-signals-grid">
                <MetricCard label={DASHBOARD_TEXT.manager.releaseReadiness} labelMetricKey="releaseReadiness" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseReadiness} value={formatScore(props.summary.managerSummary.releaseReadiness.score)} tone={mapManagerTone(props.summary.managerSummary.releaseReadiness.level)} hint={getManagerReadinessLabel(props.summary.managerSummary.releaseReadiness.level)} />
                <MetricCard label={DASHBOARD_TEXT.manager.qualityRisk} labelMetricKey="qualityRisk" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.qualityRisk} value={formatScore(props.summary.managerSummary.qualityRisk.score)} tone={mapManagerTone(props.summary.managerSummary.qualityRisk.level)} hint={getManagerRiskLabel(props.summary.managerSummary.qualityRisk.level)} />
                <MetricCard label={DASHBOARD_TEXT.manager.deliveryRisk} labelMetricKey="deliveryRisk" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.deliveryRisk} value={formatScore(props.summary.managerSummary.deliveryRisk.score)} tone={mapManagerTone(props.summary.managerSummary.deliveryRisk.level)} hint={getManagerRiskLabel(props.summary.managerSummary.deliveryRisk.level)} />
            </div>
            <div className="split-grid compact-top">
                <NarrativeList
                    items={props.summary.managerSummary.blockers.map((blocker, index) => ({
                        id: `${blocker.kind}-${index}`,
                        title: blocker.title,
                        pillLabel: blocker.value,
                        pillTone: blocker.severity === 'critical' ? 'danger' : blocker.severity === 'warning' ? 'warn' : 'accent',
                        body: blocker.details,
                        meta: blocker.testTitle,
                    }))}
                    emptyState={{ title: 'Блокеров нет', message: DASHBOARD_TEXT.manager.noBlockers }}
                />
                <NarrativeList
                    items={props.summary.managerSummary.changes.map((change) => ({
                        id: `${change.label}-${change.value}`,
                        title: change.label,
                        pillLabel: getManagerChangeLabel(change.direction),
                        pillTone: mapChangeTone(change.direction),
                        pillStyle: 'module-pill' as const,
                        value: change.value,
                        body: change.details,
                    }))}
                    emptyState={{ title: 'Изменений нет', message: DASHBOARD_TEXT.manager.noChanges }}
                />
            </div>
        </Panel>
    )
}

export function DashboardCurrentRunTestsBrowserSection(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const groups = [
        { id: 'all', label: DASHBOARD_TEXT.testsBrowser.all, tests: props.summary.currentRunTests.all },
        { id: 'passed', label: DASHBOARD_TEXT.testsBrowser.passed, tests: props.summary.currentRunTests.passed },
        { id: 'failed', label: DASHBOARD_TEXT.testsBrowser.failed, tests: props.summary.currentRunTests.failed },
        { id: 'flaky', label: DASHBOARD_TEXT.testsBrowser.flaky, tests: props.summary.currentRunTests.flaky },
        { id: 'skipped', label: DASHBOARD_TEXT.testsBrowser.skipped, tests: props.summary.currentRunTests.skipped },
        { id: 'timedOut', label: DASHBOARD_TEXT.testsBrowser.timedOut, tests: props.summary.currentRunTests.timedOut },
        { id: 'interrupted', label: DASHBOARD_TEXT.testsBrowser.interrupted, tests: props.summary.currentRunTests.interrupted },
    ] as const
    const [activeGroupId, setActiveGroupId] = React.useState<(typeof groups)[number]['id']>('all')
    const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0]

    return (
        <Panel title={DASHBOARD_TEXT.testsBrowser.title} titleMetricKey="currentRunTests" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.currentRunTests} description={DASHBOARD_TEXT.testsBrowser.description} className="span-2">
            <div className="status-switcher compact-top">
                {groups.map((group) => (
                    <button key={group.id} type="button" className={`status-switch-button${activeGroup.id === group.id ? ' is-active' : ''}`} onClick={() => setActiveGroupId(group.id)}>
                        <span>{group.label}</span>
                        <strong>{group.tests.length}</strong>
                    </button>
                ))}
            </div>
            <DashboardTable
                className="current-run-tests-table-wrap"
                headers={[
                    DASHBOARD_TEXT.tables.test,
                    DASHBOARD_TEXT.tables.file,
                    DASHBOARD_TEXT.filters.project,
                    DASHBOARD_TEXT.tables.status,
                    DASHBOARD_TEXT.tables.flaky,
                    DASHBOARD_TEXT.tables.duration,
                    DASHBOARD_TEXT.tables.lastError,
                ]}
            >
                {activeGroup.tests.length > 0 ? activeGroup.tests.map((test) => <DashboardCurrentRunTestRow key={`${activeGroup.id}-${test.project}-${test.file}-${test.title}`} test={test} summary={props.summary} workspaceSlug={props.workspaceSlug} yesLabel={DASHBOARD_TEXT.states.yes} noLabel={DASHBOARD_TEXT.states.no} />) : <DashboardEmptyTableRow colSpan={7} message={DASHBOARD_TEXT.testsBrowser.empty} />}
            </DashboardTable>
        </Panel>
    )
}

export function DashboardLatestRunsSection(props: { summary: DashboardSummary }): React.JSX.Element {
    const previousRunLabel = props.summary.comparison.previousRun ? formatDate(props.summary.comparison.previousRun.reportTimestamp ?? props.summary.comparison.previousRun.generatedAt) : DASHBOARD_TEXT.states.noPreviousRunShort
    const previousRunTitle = props.summary.comparison.mode === 'comparable' ? 'Сопоставимый прогон' : DASHBOARD_TEXT.history.previousRun
    const previousRunMeta = props.summary.comparison.previousRun
        ? [
            props.summary.comparison.mode === 'comparable' && props.summary.comparison.scopeLabel ? `Поток: ${props.summary.comparison.scopeLabel}` : null,
            props.summary.comparison.previousRun.branch ?? '—',
            formatCommit(props.summary.comparison.previousRun.commit),
        ].filter(Boolean).join(' • ')
        : DASHBOARD_TEXT.states.noPreviousRun

    return (
        <Panel title={DASHBOARD_TEXT.metrics.latestRuns} titleMetricKey="latestRuns" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.recentRuns} className="span-2">
            <SummaryStrip
                className="compact-top"
                items={[
                    { label: DASHBOARD_TEXT.history.totalRuns, value: String(props.summary.history.totalRuns), meta: 'архивных запусков доступно для сравнения' },
                    { label: previousRunTitle, value: previousRunLabel, meta: previousRunMeta },
                    { label: DASHBOARD_TEXT.history.latestSource, value: <OverflowText as="span" text={props.summary.sourceFile} lines={2} className="summary-strip-text" />, meta: 'источник свежего dashboard snapshot', muted: true },
                    { label: DASHBOARD_TEXT.history.currentBranch, value: props.summary.runMetadata.branch ?? '—', meta: `${DASHBOARD_TEXT.commitMeta}: ${formatCommit(props.summary.runMetadata.commit)} • ${DASHBOARD_TEXT.authorMeta}: ${props.summary.runMetadata.author ?? '—'}` },
                ]}
            />
            <DashboardTable
                headers={[
                    DASHBOARD_TEXT.tables.time,
                    DASHBOARD_TEXT.metrics.passRate,
                    DASHBOARD_TEXT.metrics.failures,
                    DASHBOARD_TEXT.metrics.flakyShort,
                    DASHBOARD_TEXT.tables.duration,
                    DASHBOARD_TEXT.tables.branch,
                    DASHBOARD_TEXT.tables.commit,
                    DASHBOARD_TEXT.tables.author,
                    DASHBOARD_TEXT.tables.source,
                ]}
            >
                {props.summary.history.recentRuns.length > 0 ? props.summary.history.recentRuns.map((run) => <DashboardRecentRunSummaryRow key={run.id} run={run} />) : <DashboardEmptyTableRow colSpan={9} message={DASHBOARD_TEXT.states.historyEmpty} />}
            </DashboardTable>
        </Panel>
    )
}