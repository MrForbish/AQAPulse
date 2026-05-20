import React from 'react'
import type { DashboardManagerBlocker, DashboardSummary } from '../../../dashboard-utils'
import {
    formatCurrency,
    formatMinutes,
    formatScore,
    getManagerChangeLabel,
    getManagerReadinessLabel,
    getManagerRiskLabel,
} from '../../../shared/dashboard-helpers'
import { formatDuration, formatPercent } from '../../../shared/formatting'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { MetricCard, NarrativeList, Panel, StatusBadge, SummaryStrip } from '../../shared/ui'
import { mapChangeTone, mapManagerTone } from './dashboard-manager-helpers'

interface ReleaseTabProps {
    summary: DashboardSummary
    workspaceSlug: string | null
}

type Tone = 'good' | 'warn' | 'danger'

interface ReleaseVerdict {
    label: string
    tone: Tone
    message: string
}

interface ReleaseAction {
    title: string
    label: string
    tone: 'good' | 'warn' | 'danger' | 'accent'
    body: string
    meta?: string | null
}

export function ReleaseTab(props: ReleaseTabProps): React.JSX.Element {
    const verdict = buildReleaseVerdict(props.summary)
    const actions = buildReleaseActions(props.summary)
    const costMetrics = props.summary.businessMetrics.costOfFlakiness

    return (
        <div className="page-grid release-view-grid">
            <Panel className={`span-2 release-verdict-panel is-${verdict.tone}`}>
                <div className="release-verdict-layout">
                    <div className="release-verdict-copy">
                        <div className="module-pills">
                            <span className={`module-pill is-${verdict.tone}`}>{verdict.label}</span>
                            <StatusBadge label={`Workspace: ${props.workspaceSlug ?? 'default'}`} tone="accent" />
                        </div>
                        <h2>Центр решения по релизу</h2>
                        <p>{verdict.message}</p>
                    </div>
                    <div className="release-verdict-score">
                        <span>Риск релиза</span>
                        <strong>{formatScore(props.summary.businessMetrics.releaseConfidenceScore)}</strong>
                    </div>
                </div>
            </Panel>

            <section className="metrics-grid release-metrics-grid span-2">
                <MetricCard label="Готовность к релизу" labelMetricKey="releaseReadiness" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseReadiness} value={formatScore(props.summary.managerSummary.releaseReadiness.score)} tone={mapManagerTone(props.summary.managerSummary.releaseReadiness.level)} hint={getManagerReadinessLabel(props.summary.managerSummary.releaseReadiness.level)} />
                <MetricCard label="Риск качества" labelMetricKey="qualityRisk" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.qualityRisk} value={formatScore(props.summary.managerSummary.qualityRisk.score)} tone={mapManagerTone(props.summary.managerSummary.qualityRisk.level)} hint={getManagerRiskLabel(props.summary.managerSummary.qualityRisk.level)} />
                <MetricCard label="Риск поставки" labelMetricKey="deliveryRisk" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.deliveryRisk} value={formatScore(props.summary.managerSummary.deliveryRisk.score)} tone={mapManagerTone(props.summary.managerSummary.deliveryRisk.level)} hint={getManagerRiskLabel(props.summary.managerSummary.deliveryRisk.level)} />
                <MetricCard label="Упавшие тесты" labelMetricKey="failedTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.failedTests} value={String(props.summary.kpis.failedTests)} tone={props.summary.kpis.failedTests > 0 ? 'danger' : 'good'} hint={`${formatPercent(props.summary.kpis.passRate)} успешных`} />
                <MetricCard label="Flaky тесты" labelMetricKey="flakyTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyTests} value={String(props.summary.kpis.flakyTests)} tone={props.summary.kpis.flakyTests > 0 ? 'warn' : 'good'} hint={`${formatPercent(props.summary.kpis.flakyRatio)} flaky`} />
                <MetricCard label="Длительность прогона" labelMetricKey="runDuration" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.runDuration} value={formatDuration(props.summary.kpis.totalDurationMs)} tone={props.summary.performance.durationTrend.deltaPercent !== null && props.summary.performance.durationTrend.deltaPercent > 15 ? 'warn' : 'default'} hint={formatDuration(props.summary.kpis.medianDurationMs)} />
            </section>

            <Panel title="Что сделать перед релизом" description="Приоритетные действия на основе блокеров, трендов, flaky-истории и стоимости нестабильности." className="span-2">
                <NarrativeList
                    className="compact-top release-action-list"
                    items={actions.map((action, index) => ({
                        id: `release-action-${index}`,
                        title: action.title,
                        pillLabel: action.label,
                        pillTone: action.tone,
                        body: action.body,
                        meta: action.meta,
                    }))}
                    emptyState={{ title: 'Срочных действий нет', message: 'Текущий релизный сигнал достаточно чистый, можно продолжать мониторинг без немедленного вмешательства.' }}
                />
            </Panel>

            <Panel title="Блокеры решения" titleMetricKey="managerSummary" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.managerSummary} description="Конкретные сигналы, которые объясняют вердикт сверху.">
                <NarrativeList
                    className="compact-top"
                    items={props.summary.managerSummary.blockers.map((blocker, index) => ({
                        id: `${blocker.kind}-${index}`,
                        title: blocker.title,
                        pillLabel: blocker.value,
                        pillTone: blocker.severity === 'critical' ? 'danger' : blocker.severity === 'warning' ? 'warn' : 'accent',
                        body: blocker.details,
                        meta: formatBlockerMeta(blocker),
                    }))}
                    emptyState={{ title: 'Блокеров нет', message: 'По доступным сигналам dashboard не нашел текущих блокеров.' }}
                />
            </Panel>

            <Panel title="Что изменилось" description="Короткое сравнение с предыдущим релевантным прогоном.">
                <NarrativeList
                    className="compact-top"
                    items={props.summary.managerSummary.changes.map((change) => ({
                        id: `${change.label}-${change.value}`,
                        title: change.label,
                        pillLabel: getManagerChangeLabel(change.direction),
                        pillTone: mapChangeTone(change.direction),
                        pillStyle: 'module-pill' as const,
                        value: change.value,
                        body: change.details,
                    }))}
                    emptyState={{ title: 'Изменений нет', message: 'Дельты трендов пока недоступны.' }}
                />
            </Panel>

            <Panel title="Бизнес и CI-контекст" className="span-2">
                <SummaryStrip
                    className="compact-top release-context-strip"
                    items={[
                        { label: 'Оценка стоимости нестабильности', value: formatCurrency(costMetrics.totalRub), meta: `За активный день: ${formatCurrency(costMetrics.costPerActiveDayRub)}` },
                        { label: 'Потери CI на retry', value: formatMinutes(costMetrics.extraRetryMinutes), meta: `${costMetrics.extraRetries} лишних повторов` },
                        { label: 'Трение разработки', value: `${props.summary.businessMetrics.developerFriction.rerunBurdenPer100Runs.toFixed(1)} / 100`, meta: `${props.summary.businessMetrics.developerFriction.observedRuns} наблюдаемых прогонов` },
                        { label: 'Самый медленный тест', value: props.summary.performance.slowestTests[0]?.title ?? 'нет', meta: props.summary.performance.slowestTests[0] ? formatDuration(props.summary.performance.slowestTests[0].durationMs) : 'Нет сигнала по медленным тестам' },
                    ]}
                />
            </Panel>
        </div>
    )
}

function buildReleaseVerdict(summary: DashboardSummary): ReleaseVerdict {
    const readiness = summary.managerSummary.releaseReadiness
    const hasCriticalBlocker = summary.managerSummary.blockers.some((blocker) => blocker.severity === 'critical')

    if (readiness.level === 'critical' || hasCriticalBlocker || summary.kpis.failedTests > 0) {
        return {
            label: 'Остановить релиз',
            tone: 'danger',
            message: 'Релизный сигнал не чистый: перед поставкой нужно закрыть критичный блокер или явно принять риск.',
        }
    }

    if (readiness.level === 'warning' || summary.kpis.flakyTests > 0 || summary.managerSummary.blockers.length > 0) {
        return {
            label: 'Релиз с осторожностью',
            tone: 'warn',
            message: 'Жесткого стоп-сигнала нет, но в прогоне есть риски, которые стоит разобрать до решения о релизе.',
        }
    }

    return {
        label: 'Готово к релизу',
        tone: 'good',
        message: 'Текущий прогон выглядит здоровым по доступным сигналам качества, поставки и истории.',
    }
}

function buildReleaseActions(summary: DashboardSummary): ReleaseAction[] {
    const actions: ReleaseAction[] = summary.managerSummary.blockers.map((blocker) => ({
        title: getActionTitleForBlocker(blocker),
        label: blocker.severity === 'critical' ? 'Сначала' : 'Проверить',
        tone: blocker.severity === 'critical' ? 'danger' as const : blocker.severity === 'warning' ? 'warn' as const : 'accent' as const,
        body: blocker.details,
        meta: formatBlockerMeta(blocker),
    }))

    if (summary.kpis.failedTests === 0 && summary.kpis.flakyTests === 0) {
        actions.push({
            title: 'Зафиксировать этот прогон как релизный baseline',
            label: 'Здорово',
            tone: 'good',
            body: 'В текущем прогоне нет упавших и flaky-тестов. Используй его как baseline для следующего релизного решения.',
            meta: null,
        })
    }

    if (summary.businessMetrics.costOfFlakiness.extraRetryMinutes > 0) {
        actions.push({
            title: 'Снизить retry-шум до следующего релизного цикла',
            label: 'Стоимость',
            tone: summary.businessMetrics.costOfFlakiness.extraRetryMinutes >= 60 ? 'warn' : 'accent',
            body: `Зафиксировано ${formatMinutes(summary.businessMetrics.costOfFlakiness.extraRetryMinutes)} лишнего retry-времени. До следующего hardening-цикла стоит приоритизировать тесты с повторными перезапусками.`,
            meta: `${summary.businessMetrics.costOfFlakiness.extraRetries} лишних повторов`,
        })
    }

    if (summary.managerSummary.changes.some((change) => change.direction === 'regressing')) {
        actions.push({
            title: 'Сверить регрессии с предыдущим сопоставимым прогоном',
            label: 'Тренд',
            tone: 'warn',
            body: 'Минимум один релизный сигнал движется в плохую сторону. Проверь изменившиеся метрики, прежде чем считать прогон стабильным.',
            meta: summary.comparison.mode === 'comparable' ? 'Сопоставимый baseline' : 'Соседний baseline',
        })
    }

    return actions.slice(0, 5)
}

function getActionTitleForBlocker(blocker: DashboardManagerBlocker): string {
    if (blocker.kind === 'release-confidence') {
        return 'Решить: остановить релиз или явно принять риск'
    }

    if (blocker.kind === 'problematic-test') {
        return 'Починить или изолировать главный проблемный тест'
    }

    if (blocker.kind === 'flaky') {
        return 'Стабилизировать самый сильный flaky-сигнал'
    }

    if (blocker.kind === 'duration') {
        return 'Разобрать регрессию длительности pipeline'
    }

    if (blocker.kind === 'error-cluster') {
        return 'Закрыть доминирующий кластер повторяющихся ошибок'
    }

    return 'Накопить больше истории перед доверием к тренду'
}

function formatBlockerMeta(blocker: DashboardManagerBlocker): string | null {
    return [blocker.project, blocker.file, blocker.testTitle].filter(Boolean).join(' / ') || null
}
