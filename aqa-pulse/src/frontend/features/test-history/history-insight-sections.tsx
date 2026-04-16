import React from 'react'
import type { TestHistoryResponse } from '../../../api-store'
import { ru } from '../../../shared/i18n/ru'
import { TEST_HISTORY_METRIC_DESCRIPTIONS } from '../../../shared/test-history-metric-info'
import {
    findCurrentStabilityStreak,
    findLatestStableRecovery,
    findUnstableStreakBeforeRecovery,
    getUnstableHistoryItems,
} from '../../../shared/test-history-helpers'
import { EmptyState, Panel } from '../../shared/ui'
import { AttemptDiagnostics } from './attempt-diagnostics'
import { HistoryTimelinePanel } from './history-overview'
import {
    EventSnapshot,
    PreviousUnstableEventsList,
    RecoverySnapshot,
    StabilityStreakSnapshot,
    UnstableStreakSnapshot,
} from './history-snapshots'

const HISTORY_TEXT = ru.testHistory

export function HistorySnapshotPanels(props: { payload: TestHistoryResponse }): React.JSX.Element {
    const latestRun = props.payload.latestRun
    const unstableRuns = getUnstableHistoryItems(props.payload.history)
    const latestUnstableRun = unstableRuns[0] ?? null
    const previousUnstableRuns = unstableRuns.slice(1, 4)
    const latestRecovery = findLatestStableRecovery(props.payload.history)
    const currentStabilityStreak = findCurrentStabilityStreak(props.payload.history)
    const unstableStreakBeforeRecovery = findUnstableStreakBeforeRecovery(props.payload.history)

    return (
        <>
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
                <StabilityStreakSnapshot history={props.payload.history} streak={currentStabilityStreak} />
            </Panel>
            <Panel title={HISTORY_TEXT.metrics.unstableStreakBeforeRecovery} titleMetricKey="unstableStreakBeforeRecovery" titleTooltip={TEST_HISTORY_METRIC_DESCRIPTIONS.unstableStreakBeforeRecovery}>
                {unstableStreakBeforeRecovery ? (
                    <UnstableStreakSnapshot streak={unstableStreakBeforeRecovery} />
                ) : (
                    <EmptyState title="Серия перед восстановлением не найдена" message="Либо восстановление ещё не наступило, либо перед ним не было сплошной нестабильной серии." />
                )}
            </Panel>
            <HistoryTimelinePanel history={props.payload.history} />
        </>
    )
}

export function HistoryDiagnosticsPanels(props: {
    payload: TestHistoryResponse
    artifactBasePath: string
    isStaticMode: boolean
}): React.JSX.Element {
    const latestRun = props.payload.latestRun
    const latestUnstableRun = getUnstableHistoryItems(props.payload.history)[0] ?? null

    return (
        <>
            {latestRun ? (
                <Panel title={HISTORY_TEXT.diagnostics.latestRunTitle} description={HISTORY_TEXT.diagnostics.latestRunDescription} className="span-2">
                    <AttemptDiagnostics runId={latestRun.runId} attempts={latestRun.attemptDetails} artifactBasePath={props.artifactBasePath} isStaticMode={props.isStaticMode} />
                </Panel>
            ) : null}
            {latestUnstableRun && (!latestRun || latestUnstableRun.runId !== latestRun.runId) ? (
                <Panel title={HISTORY_TEXT.diagnostics.latestUnstableTitle} description={HISTORY_TEXT.diagnostics.latestUnstableDescription} className="span-2">
                    <AttemptDiagnostics runId={latestUnstableRun.runId} attempts={latestUnstableRun.attemptDetails} artifactBasePath={props.artifactBasePath} isStaticMode={props.isStaticMode} />
                </Panel>
            ) : null}
        </>
    )
}