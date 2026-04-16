/**
 * Назначение: полноценные React-модули dashboard для business/code quality/team/ai. Здесь собирается feature-level UI поверх уже рассчитанных summary-метрик без возврата к legacy string renderer.
 */
import React from 'react'
import { Link } from 'react-router-dom'
import type { DashboardErrorCluster, DashboardSummary } from '../../../dashboard-utils'
import { formatDate, formatDuration, formatPercent } from '../../../shared/formatting'
import {
    averageDashboardNumber,
    buildBusinessMetricReadiness,
    buildReleaseConfidenceBreakdown,
    formatAssumptionValue,
    formatCommit,
    formatCostShare,
    formatCostShareWidth,
    formatCurrency,
    formatDailyRatio,
    formatMinutes,
    formatNullableDays,
    formatNullableMinutes,
    formatNullablePercent,
    formatScore,
    formatStatusLabel,
    getBusinessDriverInsightBody,
    getBusinessDriverInsightTitle,
    getBusinessImpactLabel,
    getBusinessScenarioStatusHint,
    getBusinessScenarioStatusLabel,
    getManagerChangeLabel,
    getScoreTone,
    getStatusTone,
    roundOne,
} from '../../../shared/dashboard-helpers'
import { DASHBOARD_METRIC_DESCRIPTIONS } from '../../../shared/dashboard-metric-info'
import { ru } from '../../../shared/i18n/ru'
import { buildTestHistoryHref } from '../../runtime'
import { EmptyState, MetricCard, NarrativeList, Panel, StatusBadge } from '../../shared/ui'

const DASHBOARD_TEXT = ru.dashboard

export function BusinessModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props
    const releaseConfidenceBreakdown = buildReleaseConfidenceBreakdown(summary)
    const readinessItems = buildBusinessMetricReadiness(summary)
    const costMetrics = summary.businessMetrics.costOfFlakiness

    return (
        <div className="page-grid">
            <MetricCard label={DASHBOARD_TEXT.metrics.timeToDetect} labelMetricKey="timeToDetect" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.timeToDetect} value={formatNullableMinutes(summary.businessMetrics.timeToDetect.minutes)} hint={DASHBOARD_TEXT.business.timeToDetectHint} />
            <MetricCard label={DASHBOARD_TEXT.metrics.timeToFixFlaky} labelMetricKey="timeToFixFlaky" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.timeToFixFlaky} value={formatNullableDays(summary.businessMetrics.timeToFixFlaky.averageDays)} hint={`${DASHBOARD_TEXT.business.timeToFixHintPrefix}: ${summary.businessMetrics.timeToFixFlaky.resolvedIncidents}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.costOfFlakiness} labelMetricKey="costOfFlakiness" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.costOfFlakiness} value={formatCurrency(costMetrics.totalRub)} tone={getCostTone(costMetrics.totalRub)} hint={`${DASHBOARD_TEXT.business.costPerActiveDay}: ${formatCurrency(costMetrics.costPerActiveDayRub)}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.developerFriction} labelMetricKey="developerFriction" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.developerFriction} value={formatDailyRatio(summary.businessMetrics.developerFriction.rerunProxyPerActiveDay)} tone={summary.businessMetrics.developerFriction.rerunProxyPerActiveDay > 1 ? 'warn' : 'good'} hint={`${DASHBOARD_TEXT.business.extraRetries}: ${summary.businessMetrics.developerFriction.extraRetries}`} />
            <MetricCard label={DASHBOARD_TEXT.metrics.releaseConfidenceScore} labelMetricKey="releaseConfidenceScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore} value={formatScore(summary.businessMetrics.releaseConfidenceScore)} tone={getScoreTone(summary.businessMetrics.releaseConfidenceScore)} hint={DASHBOARD_TEXT.business.releaseConfidenceHint} />
            <MetricCard label={DASHBOARD_TEXT.metrics.automationRoi} labelMetricKey="automationRoi" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.automationRoi} value={formatNullablePercent(summary.businessMetrics.automationRoi.percent)} hint={DASHBOARD_TEXT.business.automationRoiHint} />

            <Panel title={DASHBOARD_TEXT.business.summaryTitle} titleMetricKey="costOfFlakiness" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.costOfFlakiness} description={DASHBOARD_TEXT.business.summaryDescription} className="span-2">
                <div className="module-header-row">
                    <div className="module-pills">
                        <span className={`module-pill is-${mapScenarioTone(summary)}`}>{getBusinessScenarioStatusLabel(costMetrics.assumptions)}</span>
                        <span className={`module-pill is-${mapCostImpactTone(costMetrics.totalRub, costMetrics.costPerActiveDayRub)}`}>{getBusinessImpactLabel(costMetrics.totalRub, costMetrics.costPerActiveDayRub)}</span>
                    </div>
                    <div className="subtle-copy">{getBusinessScenarioStatusHint(costMetrics.assumptions)}</div>
                </div>
                <div className="signal-grid compact-top">
                    <SignalSummaryCard label={DASHBOARD_TEXT.metrics.timeToDetect} value={formatNullableMinutes(summary.businessMetrics.timeToDetect.minutes)} hint={DASHBOARD_TEXT.business.timeToDetectPending} />
                    <SignalSummaryCard label={DASHBOARD_TEXT.metrics.timeToFixFlaky} value={formatNullableDays(summary.businessMetrics.timeToFixFlaky.averageDays)} hint={summary.businessMetrics.timeToFixFlaky.averageDays === null ? DASHBOARD_TEXT.business.timeToFixPending : 'Среднее по восстановленным flaky-инцидентам из истории.'} />
                    <SignalSummaryCard label={DASHBOARD_TEXT.metrics.releaseConfidenceScore} value={formatScore(summary.businessMetrics.releaseConfidenceScore)} hint={DASHBOARD_TEXT.business.releaseConfidenceDetails} />
                    <SignalSummaryCard label={DASHBOARD_TEXT.business.costPerActiveDay} value={formatCurrency(costMetrics.costPerActiveDayRub)} hint={DASHBOARD_TEXT.business.costScenarioDescription} />
                </div>
                <div className={`callout-card compact-top is-${mapCostImpactTone(costMetrics.totalRub, costMetrics.costPerActiveDayRub)}`}>
                    <strong>{getBusinessDriverInsightTitle(costMetrics.ciCostRub, costMetrics.developerCostRub, costMetrics.totalRub)}</strong>
                    <p>{getBusinessDriverInsightBody(costMetrics.ciCostRub, costMetrics.developerCostRub, costMetrics.totalRub)}</p>
                </div>
            </Panel>

            <Panel title={DASHBOARD_TEXT.business.releaseConfidenceBreakdownTitle} titleMetricKey="releaseConfidenceScore" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceBreakdownTitle} description={DASHBOARD_TEXT.business.releaseConfidenceBreakdownDescription}>
                <div className="stacked-bars compact-top">
                    {releaseConfidenceBreakdown.components.map((component) => (
                        <div key={component.label} className="stacked-bar-item">
                            <div className="stacked-bar-copy stacked-bar-copy-spread">
                                <span>{component.label}</span>
                                <strong>{component.formula}</strong>
                            </div>
                            <div className="stacked-bar-track">
                                <div className={`stacked-bar-fill is-${component.tone || 'good'}`} style={{ width: component.width }} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="summary-line compact-top">
                    <span>{DASHBOARD_TEXT.business.releaseConfidenceTotal}</span>
                    <strong>{formatScore(releaseConfidenceBreakdown.total)}</strong>
                </div>
            </Panel>

            <Panel title={DASHBOARD_TEXT.business.readinessTitle} titleMetricKey="releaseConfidenceScore" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore} description={DASHBOARD_TEXT.business.readinessDescription}>
                <div className="readiness-list compact-top">
                    {readinessItems.map((item) => (
                        <article key={item.label} className="readiness-item">
                            <div className="readiness-item-header">
                                <strong>{item.label}</strong>
                                <span className={`module-pill is-${mapReadinessTone(item.status)}`}>{item.statusLabel}</span>
                            </div>
                            <p>{item.hint}</p>
                        </article>
                    ))}
                </div>
            </Panel>

            <Panel title={DASHBOARD_TEXT.metrics.costSection} titleMetricKey="costSection" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.costOfFlakiness} description={DASHBOARD_TEXT.business.costScenarioDescription} className="span-2">
                <div className="split-grid compact-top">
                    <div className="stack-list">
                        <FormulaCard title={DASHBOARD_TEXT.business.ciCost} body={DASHBOARD_TEXT.business.ciFormula} />
                        <FormulaCard title={DASHBOARD_TEXT.business.developmentCost} body={DASHBOARD_TEXT.business.developerFormula} />
                        <FormulaCard title={DASHBOARD_TEXT.business.overallCost} body={DASHBOARD_TEXT.business.totalFormula} />
                    </div>
                    <div className="stack-list">
                        <DetailRow label={DASHBOARD_TEXT.business.overallCost} value={formatCurrency(costMetrics.totalRub)} hint={DASHBOARD_TEXT.business.totalCostHint} />
                        <DetailRow label={DASHBOARD_TEXT.business.ciCost} value={formatCurrency(costMetrics.ciCostRub)} hint={`${DASHBOARD_TEXT.business.ciCostHintPrefix}: ${formatMinutes(costMetrics.extraRetryMinutes)}`} />
                        <DetailRow label={DASHBOARD_TEXT.business.developmentCost} value={formatCurrency(costMetrics.developerCostRub)} hint={`${DASHBOARD_TEXT.business.developmentCostHintPrefix}: ${costMetrics.unstableRuns}`} />
                        <DetailRow label={DASHBOARD_TEXT.business.costPerActiveDay} value={formatCurrency(costMetrics.costPerActiveDayRub)} hint={DASHBOARD_TEXT.business.costPerActiveDayHint} />
                    </div>
                </div>
                <div className="cost-breakdown-stack compact-top">
                    <CostBreakdownItem label={DASHBOARD_TEXT.business.ciShare} value={formatCostShare(costMetrics.ciCostRub, costMetrics.totalRub)} width={formatCostShareWidth(costMetrics.ciCostRub, costMetrics.totalRub)} />
                    <CostBreakdownItem label={DASHBOARD_TEXT.business.developmentShare} value={formatCostShare(costMetrics.developerCostRub, costMetrics.totalRub)} width={formatCostShareWidth(costMetrics.developerCostRub, costMetrics.totalRub)} />
                </div>
            </Panel>

            <Panel title={DASHBOARD_TEXT.metrics.configAssumptions} titleMetricKey="configAssumptions" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.configAssumptions} description={DASHBOARD_TEXT.business.editorHint}>
                <div className="stack-list compact-top">
                    <DetailRow label={DASHBOARD_TEXT.business.ciMinuteCost} value={formatAssumptionValue(costMetrics.assumptions.ciMinuteCostRub, '₽/мин')} />
                    <DetailRow label={DASHBOARD_TEXT.business.devHourCost} value={formatAssumptionValue(costMetrics.assumptions.developerHourlyCostRub, '₽/час')} />
                    <DetailRow label={DASHBOARD_TEXT.business.analysisMinutes} value={formatAssumptionValue(costMetrics.assumptions.analysisMinutesPerUnstable, 'мин/инцидент')} />
                </div>
            </Panel>

            <Panel title={DASHBOARD_TEXT.manager.summaryTitle} titleMetricKey="managerSummary" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.managerSummary} description={DASHBOARD_TEXT.manager.summaryDescription}>
                <div className="signal-grid compact-top">
                    <SignalSummaryCard label={DASHBOARD_TEXT.manager.releaseReadiness} value={formatScore(summary.managerSummary.releaseReadiness.score)} hint={summary.managerSummary.releaseReadiness.level} tone={mapManagerTone(summary.managerSummary.releaseReadiness.level)} />
                    <SignalSummaryCard label={DASHBOARD_TEXT.manager.qualityRisk} value={formatScore(summary.managerSummary.qualityRisk.score)} hint={summary.managerSummary.qualityRisk.level} tone={mapManagerTone(summary.managerSummary.qualityRisk.level)} />
                    <SignalSummaryCard label={DASHBOARD_TEXT.manager.deliveryRisk} value={formatScore(summary.managerSummary.deliveryRisk.score)} hint={summary.managerSummary.deliveryRisk.level} tone={mapManagerTone(summary.managerSummary.deliveryRisk.level)} />
                </div>
            </Panel>

            <Panel title={DASHBOARD_TEXT.manager.blockersTitle} className="span-2">
                <NarrativeList
                    className="compact-top"
                    items={summary.managerSummary.blockers.map((blocker, index) => ({
                        id: `${blocker.kind}-${index}`,
                        title: blocker.title,
                        pillLabel: blocker.value,
                        pillTone: blocker.severity === 'critical' ? 'danger' : blocker.severity === 'warning' ? 'warn' : 'accent',
                        body: blocker.details,
                    }))}
                    emptyState={{ title: 'Блокеров нет', message: DASHBOARD_TEXT.manager.noBlockers }}
                />
            </Panel>

            <Panel title={DASHBOARD_TEXT.manager.changesTitle} className="span-2">
                <NarrativeList
                    className="compact-top"
                    items={summary.managerSummary.changes.map((change) => ({
                        id: `${change.label}-${change.value}`,
                        title: change.label,
                        pillLabel: `${getManagerChangeLabel(change.direction)} ${change.value}`,
                        pillTone: mapChangeTone(change.direction),
                        pillStyle: 'module-pill',
                        body: change.details,
                    }))}
                    emptyState={{ title: 'Изменений нет', message: DASHBOARD_TEXT.states.noChanges }}
                />
            </Panel>
        </div>
    )
}

export function CodeQualityModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <MetricCard label="Problem hotspots" labelMetricKey="problematicTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.problematicTests} value={String(summary.topProblematicTests.length)} tone={summary.topProblematicTests.length > 0 ? 'warn' : 'good'} hint="Текущий backlog по тестам с максимальным риском" />
            <MetricCard label={DASHBOARD_TEXT.metrics.flakyScore} labelMetricKey="flakyScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.flakyScore} value={summary.flakyAnalytics.averageFlakyScore === null ? '—' : formatScore(summary.flakyAnalytics.averageFlakyScore)} tone={summary.flakyAnalytics.averageFlakyScore === null ? 'default' : getScoreTone(summary.flakyAnalytics.averageFlakyScore)} hint="Средний исторический сигнал нестабильности" />
            <MetricCard label={DASHBOARD_TEXT.metrics.errorClusters} labelMetricKey="errorClusters" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.errorClusters} value={String(summary.errorClusters.length)} tone={summary.errorClusters.length > 0 ? 'warn' : 'good'} hint="Повторяемые patterns падений" />
            <MetricCard label={DASHBOARD_TEXT.metrics.leadingPhase} labelMetricKey="leadingPhase" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} value={summary.performance.phaseBreakdown[0]?.label ?? '—'} hint={summary.performance.phaseBreakdown[0] ? formatPercent(summary.performance.phaseBreakdown[0].sharePercent) : DASHBOARD_TEXT.states.noChanges} />

            <Panel title="Failure hotspots" titleMetricKey="problematicTests" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.problematicTests} description="Проблемные сценарии, которые прямо сейчас формируют основной backlog по качеству тестового кода." className="span-2">
                {summary.topProblematicTests.length > 0 ? (
                    <div className="table-wrap compact-top">
                        <table>
                            <thead>
                                <tr>
                                    <th>{DASHBOARD_TEXT.tables.test}</th>
                                    <th>{DASHBOARD_TEXT.tables.file}</th>
                                    <th>{DASHBOARD_TEXT.tables.status}</th>
                                    <th>{DASHBOARD_TEXT.tables.flaky}</th>
                                    <th>Failure Rate</th>
                                    <th>{DASHBOARD_TEXT.tables.duration}</th>
                                    <th>{DASHBOARD_TEXT.tables.lastError}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.topProblematicTests.map((test) => (
                                    <tr key={`${test.project}-${test.file}-${test.title}`}>
                                        <td><TestHistoryLink workspaceSlug={props.workspaceSlug} summary={summary} title={test.title} project={test.project} file={test.file} /></td>
                                        <td>{test.file}</td>
                                        <td><StatusBadge label={formatStatusLabel(test.status, test.flaky)} tone={getStatusTone(test.status, test.flaky)} /></td>
                                        <td>{test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no}</td>
                                        <td>{formatPercent(test.failureRate)} ({test.attempts})</td>
                                        <td>{formatDuration(test.durationMs)}</td>
                                        <td className="mono-cell">{test.errorMessage}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="Problem hotspots отсутствуют" message={DASHBOARD_TEXT.states.problematicTestsEmpty} />
                )}
            </Panel>

            <Panel title={DASHBOARD_TEXT.metrics.phaseBreakdown} titleMetricKey="phaseBreakdown" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.phaseBreakdown} description={DASHBOARD_TEXT.performance.phaseBreakdownDescription}>
                <div className="stacked-bars compact-top">
                    {summary.performance.phaseBreakdown.map((item) => (
                        <div key={item.label} className="stacked-bar-item">
                            <div className="stacked-bar-copy stacked-bar-copy-spread">
                                <span>{item.label}</span>
                                <strong>{formatDuration(item.durationMs)} • {formatPercent(item.sharePercent)}</strong>
                            </div>
                            <div className="stacked-bar-track">
                                <div className="stacked-bar-fill" style={{ width: `${Math.max(8, item.sharePercent)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>

            <Panel title={DASHBOARD_TEXT.metrics.suiteDuration} titleMetricKey="suiteDuration" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.suiteDuration} description={DASHBOARD_TEXT.performance.suiteDurationDescription}>
                <div className="stacked-bars compact-top">
                    {summary.performance.suiteDuration.map((item) => (
                        <div key={item.label} className="stacked-bar-item">
                            <div className="stacked-bar-copy stacked-bar-copy-spread">
                                <span>{item.label}</span>
                                <strong>{formatDuration(item.durationMs)} • {item.tests}</strong>
                            </div>
                            <div className="stacked-bar-track">
                                <div className="stacked-bar-fill is-warn" style={{ width: `${Math.max(8, item.sharePercent)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>

            <Panel title={DASHBOARD_TEXT.metrics.topSlowestTests} titleMetricKey="topSlowestTests" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topSlowestTests} className="span-2">
                <div className="table-wrap compact-top">
                    <table>
                        <thead>
                            <tr>
                                <th>{DASHBOARD_TEXT.tables.test}</th>
                                <th>{DASHBOARD_TEXT.tables.file}</th>
                                <th>{DASHBOARD_TEXT.tables.status}</th>
                                <th>{DASHBOARD_TEXT.tables.flaky}</th>
                                <th>{DASHBOARD_TEXT.tables.duration}</th>
                                <th>{DASHBOARD_TEXT.tables.lastError}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.performance.slowestTests.map((test) => (
                                <tr key={`${test.project}-${test.file}-${test.title}`}>
                                    <td><TestHistoryLink workspaceSlug={props.workspaceSlug} summary={summary} title={test.title} project={test.project} file={test.file} /></td>
                                    <td>{test.file}</td>
                                    <td><StatusBadge label={formatStatusLabel(test.status, test.flaky)} tone={getStatusTone(test.status, test.flaky)} /></td>
                                    <td>{test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no}</td>
                                    <td>{formatDuration(test.durationMs)}</td>
                                    <td className="mono-cell">{test.errorMessage ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </div>
    )
}

export function TeamModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <MetricCard label={DASHBOARD_TEXT.metrics.developerFriction} labelMetricKey="developerFriction" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.developerFriction} value={formatDailyRatio(summary.businessMetrics.developerFriction.rerunProxyPerActiveDay)} tone={summary.businessMetrics.developerFriction.rerunProxyPerActiveDay > 1 ? 'warn' : 'good'} hint={`${DASHBOARD_TEXT.business.unstableRuns}: ${summary.businessMetrics.developerFriction.unstableRuns}`} />
            <MetricCard label="Активные блокеры" labelMetricKey="problematicTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.problematicTests} value={String(summary.managerSummary.blockers.length)} tone={summary.managerSummary.blockers.length > 0 ? 'danger' : 'good'} hint="Критичные сигналы для команды" />
            <MetricCard label={DASHBOARD_TEXT.metrics.releaseConfidenceScore} labelMetricKey="releaseConfidenceScore" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore} value={formatScore(summary.businessMetrics.releaseConfidenceScore)} tone={getScoreTone(summary.businessMetrics.releaseConfidenceScore)} hint={summary.managerSummary.releaseReadiness.level} />
            <MetricCard label={DASHBOARD_TEXT.manager.deliveryRisk} labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.deliveryRisk} value={formatScore(summary.managerSummary.deliveryRisk.score)} tone={mapManagerTone(summary.managerSummary.deliveryRisk.level)} hint={summary.managerSummary.deliveryRisk.level} />

            <Panel title={DASHBOARD_TEXT.manager.summaryTitle} titleMetricKey="managerSummary" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.managerSummary} description={DASHBOARD_TEXT.manager.summaryDescription}>
                <div className="signal-grid compact-top">
                    <SignalSummaryCard label={DASHBOARD_TEXT.manager.releaseReadiness} value={formatScore(summary.managerSummary.releaseReadiness.score)} hint={summary.managerSummary.releaseReadiness.level} tone={mapManagerTone(summary.managerSummary.releaseReadiness.level)} />
                    <SignalSummaryCard label={DASHBOARD_TEXT.manager.qualityRisk} value={formatScore(summary.managerSummary.qualityRisk.score)} hint={summary.managerSummary.qualityRisk.level} tone={mapManagerTone(summary.managerSummary.qualityRisk.level)} />
                    <SignalSummaryCard label={DASHBOARD_TEXT.manager.deliveryRisk} value={formatScore(summary.managerSummary.deliveryRisk.score)} hint={summary.managerSummary.deliveryRisk.level} tone={mapManagerTone(summary.managerSummary.deliveryRisk.level)} />
                </div>
            </Panel>

            <Panel title={DASHBOARD_TEXT.manager.blockersTitle} className="span-2">
                <NarrativeList
                    className="compact-top"
                    items={summary.managerSummary.blockers.map((blocker, index) => ({
                        id: `${blocker.kind}-${index}`,
                        title: blocker.title,
                        pillLabel: blocker.value,
                        pillTone: blocker.severity === 'critical' ? 'danger' : blocker.severity === 'warning' ? 'warn' : 'accent',
                        body: blocker.details,
                        meta: blocker.testTitle,
                    }))}
                    emptyState={{ title: 'Блокеров нет', message: DASHBOARD_TEXT.manager.noBlockers }}
                />
            </Panel>

            <Panel title={DASHBOARD_TEXT.manager.changesTitle} className="span-2">
                <NarrativeList
                    className="compact-top"
                    items={summary.managerSummary.changes.map((change) => ({
                        id: `${change.label}-${change.value}`,
                        title: change.label,
                        pillLabel: getManagerChangeLabel(change.direction),
                        pillTone: mapChangeTone(change.direction),
                        pillStyle: 'module-pill',
                        value: change.value,
                        body: change.details,
                    }))}
                    emptyState={{ title: 'Изменений нет', message: DASHBOARD_TEXT.states.noChanges }}
                />
            </Panel>

            <Panel title={DASHBOARD_TEXT.metrics.recentRuns} titleMetricKey="recentRuns" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.recentRuns} className="span-2">
                <div className="table-wrap compact-top">
                    <table>
                        <thead>
                            <tr>
                                <th>{DASHBOARD_TEXT.tables.time}</th>
                                <th>{DASHBOARD_TEXT.tables.branch}</th>
                                <th>{DASHBOARD_TEXT.tables.commit}</th>
                                <th>{DASHBOARD_TEXT.metrics.passRate}</th>
                                <th>{DASHBOARD_TEXT.metrics.failedTests}</th>
                                <th>{DASHBOARD_TEXT.metrics.flakyTests}</th>
                                <th>{DASHBOARD_TEXT.tables.duration}</th>
                                <th>Author</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.history.recentRuns.map((run) => (
                                <tr key={run.id}>
                                    <td>{formatDate(run.reportTimestamp ?? run.generatedAt)}</td>
                                    <td>{run.branch ?? '—'}</td>
                                    <td>{formatCommit(run.commit)}</td>
                                    <td>{formatPercent(run.passRate)}</td>
                                    <td>{run.failedTests}</td>
                                    <td>{run.flakyTests}</td>
                                    <td>{formatDuration(run.totalDurationMs)}</td>
                                    <td>{run.author ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </div>
    )
}

export function AiModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props
    const signalCoverage = buildAiSignalCoverage(summary)

    return (
        <div className="page-grid">
            <MetricCard label={DASHBOARD_TEXT.metrics.topFlakyTests} labelMetricKey="topFlakyTests" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topFlakyTests} value={String(summary.flakyAnalytics.topFlakyTests.length)} tone={summary.flakyAnalytics.topFlakyTests.length > 0 ? 'warn' : 'default'} hint="Risk ranking candidates" />
            <MetricCard label={DASHBOARD_TEXT.metrics.errorClusters} labelMetricKey="errorClusters" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.clusterList} value={String(summary.errorClusters.length)} tone={summary.errorClusters.length > 0 ? 'warn' : 'good'} hint="Root-cause clusters available" />
            <MetricCard label="Signal coverage" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.signalCoverage} value={`${signalCoverage}%`} tone={signalCoverage >= 75 ? 'good' : signalCoverage >= 45 ? 'warn' : 'danger'} hint="Готовность данных для heuristics/ML" />
            <MetricCard label="First flake to fix" labelMetricKey="timeToFixFlaky" labelTooltip={DASHBOARD_METRIC_DESCRIPTIONS.timeToFixFlaky} value={summary.flakyAnalytics.firstFlakeToFix ? `${summary.flakyAnalytics.firstFlakeToFix.days.toFixed(1)} дн` : '—'} hint="Исторический feedback loop" />

            <Panel title="Risk ranking" titleMetricKey="topFlakyTests" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.topFlakyTests} description="Текущий React-модуль уже может ранжировать тесты для последующего root-cause и next-run risk scoring." className="span-2">
                {summary.flakyAnalytics.topFlakyTests.length > 0 ? (
                    <div className="table-wrap compact-top">
                        <table>
                            <thead>
                                <tr>
                                    <th>{DASHBOARD_TEXT.tables.test}</th>
                                    <th>{DASHBOARD_TEXT.tables.file}</th>
                                    <th>{DASHBOARD_TEXT.metrics.flakyScore}</th>
                                    <th>Fail Rate</th>
                                    <th>MTBF</th>
                                    <th>{DASHBOARD_TEXT.metrics.lastStatus}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.flakyAnalytics.topFlakyTests.map((test) => (
                                    <tr key={`${test.project}-${test.file}-${test.title}`}>
                                        <td><TestHistoryLink workspaceSlug={props.workspaceSlug} summary={summary} title={test.title} project={test.project} file={test.file} /></td>
                                        <td>{test.file}</td>
                                        <td>{formatScore(test.flakyScore)}</td>
                                        <td>{formatPercent(test.failRate)}</td>
                                        <td>{test.mtbfDays === null ? '—' : `${test.mtbfDays.toFixed(2)} дн`}</td>
                                        <td><StatusBadge label={formatStatusLabel(test.latestStatus, false)} tone={getStatusTone(test.latestStatus, false)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="Исторических сигналов мало" message={DASHBOARD_TEXT.states.flakyTestsEmpty} />
                )}
            </Panel>

            <Panel title="Root-cause clusters" titleMetricKey="errorClusters" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.clusterList} description="Повторяемые ошибки уже можно использовать как базу для кластеризации, объяснений и рекомендаций." className="span-2">
                <div className="cluster-list compact-top">
                    {summary.errorClusters.length > 0 ? summary.errorClusters.map((cluster) => (
                        <ClusterCard key={cluster.message} cluster={cluster} />
                    )) : <EmptyState title="Кластеры не обнаружены" message={DASHBOARD_TEXT.states.failuresEmpty} />}
                </div>
            </Panel>

            <Panel title="Model readiness" titleTooltip={DASHBOARD_METRIC_DESCRIPTIONS.modelReadiness} description="Эта секция показывает, насколько текущий ingestion уже даёт сигналы для heuristic/AI слоя.">
                <div className="readiness-list compact-top">
                    <ReadinessCard label="История запусков" value={`${summary.history.totalRuns}`} hint="База для аномалий, risk ranking и trend моделей" tone={summary.history.totalRuns >= 5 ? 'good' : 'warn'} />
                    <ReadinessCard label="Error clusters" value={`${summary.errorClusters.length}`} hint="База для группировки root cause и retrieval" tone={summary.errorClusters.length > 0 ? 'good' : 'warn'} />
                    <ReadinessCard label="Resolved flaky incidents" value={summary.businessMetrics.timeToFixFlaky.resolvedIncidents.toString()} hint="Нужны для обучения recovery/fix feedback loop" tone={summary.businessMetrics.timeToFixFlaky.resolvedIncidents > 0 ? 'good' : 'warn'} />
                </div>
            </Panel>
        </div>
    )
}

function TestHistoryLink(props: { workspaceSlug: string | null; summary: DashboardSummary; title: string; project: string; file: string }): React.JSX.Element {
    return (
        <Link className="entity-link" to={buildTestHistoryHref(props.workspaceSlug, props.title, {
            branch: props.summary.filters.branch,
            project: props.project,
            file: props.file,
        })}>
            {props.title}
        </Link>
    )
}

function ClusterCard(props: { cluster: DashboardErrorCluster }): React.JSX.Element {
    return (
        <article className="stack-item">
            <div className="stack-item-header">
                <strong>{props.cluster.message}</strong>
                <StatusBadge label={`${props.cluster.count}`} tone="warn" />
            </div>
            <div className="subtle-copy">{props.cluster.tests.slice(0, 4).join(' • ')}</div>
        </article>
    )
}

function SignalSummaryCard(props: { label: string; value: string; hint: string; tone?: 'default' | 'good' | 'warn' | 'danger' }): React.JSX.Element {
    return <MetricCard label={props.label} labelTooltip={resolveDashboardMetricDescription(props.label)} value={props.value} hint={props.hint} tone={props.tone} />
}

function ReadinessCard(props: { label: string; value: string; hint: string; tone: 'good' | 'warn' | 'danger' }): React.JSX.Element {
    return (
        <article className="readiness-item">
            <div className="readiness-item-header">
                <strong>{props.label}</strong>
                <span className={`module-pill is-${props.tone}`}>{props.value}</span>
            </div>
            <p>{props.hint}</p>
        </article>
    )
}

function FormulaCard(props: { title: string; body: string }): React.JSX.Element {
    return (
        <article className="formula-card-react">
            <strong>{props.title}</strong>
            <p>{props.body}</p>
        </article>
    )
}

function DetailRow(props: { label: string; value: string; hint?: string }): React.JSX.Element {
    return (
        <article className="detail-card-react">
            <div className="summary-line">
                <span>{props.label}</span>
                <strong>{props.value}</strong>
            </div>
            {props.hint ? <div className="subtle-copy compact-top">{props.hint}</div> : null}
        </article>
    )
}

function CostBreakdownItem(props: { label: string; value: string; width: string }): React.JSX.Element {
    return (
        <div className="cost-breakdown-item-react">
            <div className="cost-breakdown-head-react">
                <span>{props.label}</span>
                <strong>{props.value}</strong>
            </div>
            <div className="stacked-bar-track">
                <div className="stacked-bar-fill is-accent" style={{ width: props.width }} />
            </div>
        </div>
    )
}

function mapReadinessTone(status: 'ready' | 'partial' | 'pending'): 'good' | 'warn' | 'danger' {
    if (status === 'ready') {
        return 'good'
    }

    if (status === 'partial') {
        return 'warn'
    }

    return 'danger'
}

function mapScenarioTone(summary: DashboardSummary): 'good' | 'warn' | 'danger' {
    const assumptions = summary.businessMetrics.costOfFlakiness.assumptions
    const hasCi = assumptions.ciMinuteCostRub !== null
    const hasDev = assumptions.developerHourlyCostRub !== null && assumptions.analysisMinutesPerUnstable !== null

    if (hasCi && hasDev) {
        return 'good'
    }

    if (hasCi || assumptions.developerHourlyCostRub !== null || assumptions.analysisMinutesPerUnstable !== null) {
        return 'warn'
    }

    return 'danger'
}

function mapCostImpactTone(totalCost: number | null, costPerDay: number | null): 'good' | 'warn' | 'danger' {
    if (totalCost === null) {
        return 'warn'
    }

    if (totalCost >= 50000 || (costPerDay !== null && costPerDay >= 10000)) {
        return 'danger'
    }

    if (totalCost >= 15000 || (costPerDay !== null && costPerDay >= 3000)) {
        return 'warn'
    }

    return 'good'
}

function getCostTone(totalCost: number | null): 'default' | 'good' | 'warn' | 'danger' {
    if (totalCost === null) {
        return 'default'
    }

    if (totalCost >= 50000) {
        return 'danger'
    }

    if (totalCost >= 15000) {
        return 'warn'
    }

    return 'good'
}

function mapManagerTone(level: 'healthy' | 'warning' | 'critical'): 'good' | 'warn' | 'danger' {
    if (level === 'healthy') {
        return 'good'
    }

    if (level === 'warning') {
        return 'warn'
    }

    return 'danger'
}

function mapChangeTone(direction: 'improving' | 'regressing' | 'stable'): 'good' | 'warn' | 'accent' {
    if (direction === 'improving') {
        return 'good'
    }

    if (direction === 'regressing') {
        return 'warn'
    }

    return 'accent'
}

function buildAiSignalCoverage(summary: DashboardSummary): number {
    const signals = [
        summary.history.totalRuns >= 5 ? 100 : summary.history.totalRuns * 20,
        summary.errorClusters.length > 0 ? 100 : 25,
        summary.flakyAnalytics.topFlakyTests.length > 0 ? 100 : 30,
        summary.businessMetrics.timeToFixFlaky.resolvedIncidents > 0 ? 100 : 20,
    ]

    return roundOne(averageDashboardNumber(signals))
}

function resolveDashboardMetricDescription(label: string): string | undefined {
    if (label === DASHBOARD_TEXT.metrics.timeToDetect) {
        return DASHBOARD_METRIC_DESCRIPTIONS.timeToDetect
    }

    if (label === DASHBOARD_TEXT.metrics.timeToFixFlaky) {
        return DASHBOARD_METRIC_DESCRIPTIONS.timeToFixFlaky
    }

    if (label === DASHBOARD_TEXT.metrics.releaseConfidenceScore) {
        return DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore
    }

    if (label === DASHBOARD_TEXT.metrics.developerFriction) {
        return DASHBOARD_METRIC_DESCRIPTIONS.developerFriction
    }

    if (label === DASHBOARD_TEXT.manager.deliveryRisk) {
        return DASHBOARD_METRIC_DESCRIPTIONS.deliveryRisk
    }

    if (label === DASHBOARD_TEXT.manager.releaseReadiness) {
        return DASHBOARD_METRIC_DESCRIPTIONS.releaseReadiness
    }

    if (label === DASHBOARD_TEXT.manager.qualityRisk) {
        return DASHBOARD_METRIC_DESCRIPTIONS.qualityRisk
    }

    return undefined
}