import type { DashboardSummary } from '../dashboard-utils'
import { ru } from './i18n/ru'

const DASHBOARD_TEXT = ru.dashboard

export type DashboardStatusTone = 'neutral' | 'good' | 'warn' | 'danger'
export type DashboardMetricTone = 'default' | 'good' | 'warn' | 'danger'

export function formatCurrency(value: number | null): string {
    if (value === null) {
        return '—'
    }

    return `${value.toFixed(2)} ₽`
}

export function formatMinutes(value: number): string {
    return `${value.toFixed(2)} мин`
}

export function formatNullableMinutes(value: number | null): string {
    return value === null ? '—' : formatMinutes(value)
}

export function formatDailyRatio(value: number): string {
    return `${value.toFixed(2)} / день`
}

export function formatScore(value: number): string {
    return `${roundOne(value)} / 100`
}

export function formatNullableDays(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(2)} дн`
}

export function formatNullablePercent(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)}%`
}

export function formatAssumptionValue(value: number | null, unit: string): string {
    if (value === null) {
        return DASHBOARD_TEXT.states.notSet
    }

    return `${value} ${unit}`
}

export function formatCommit(commit: string | null): string {
    return commit ? commit.slice(0, 8) : '—'
}

export function formatStatusLabel(status: string, flaky: boolean): string {
    if (flaky) {
        return DASHBOARD_TEXT.statusLabels.flaky
    }

    return DASHBOARD_TEXT.statusLabels[status as keyof typeof DASHBOARD_TEXT.statusLabels] ?? status
}

export function getStatusTone(status: string, flaky: boolean): DashboardStatusTone {
    if (flaky) {
        return 'warn'
    }

    const normalized = status.trim().toLowerCase()

    if (normalized === 'passed') {
        return 'good'
    }

    if (normalized === 'failed' || normalized === 'timedout' || normalized === 'timed out' || normalized === 'interrupted') {
        return 'danger'
    }

    return 'neutral'
}

export function getScoreTone(value: number): DashboardMetricTone {
    if (value >= 80) {
        return 'good'
    }

    if (value >= 60) {
        return 'warn'
    }

    return 'danger'
}

export function formatDelta(value: number | null, label: string): string {
    if (value === null) {
        return DASHBOARD_TEXT.states.noPreviousRun
    }

    if (value === 0) {
        return DASHBOARD_TEXT.states.noChanges
    }

    const prefix = value > 0 ? '+' : ''
    return `${prefix}${value} ${label}`
}

export function formatPerformancePhaseLabel(label: string): string {
    if (label === 'Setup') {
        return 'Подготовка'
    }

    if (label === 'Teardown') {
        return 'Завершение'
    }

    return 'Тесты'
}

export function getManagerReadinessLabel(level: DashboardSummary['managerSummary']['releaseReadiness']['level']): string {
    if (level === 'healthy') {
        return DASHBOARD_TEXT.manager.readinessHealthy
    }

    if (level === 'warning') {
        return DASHBOARD_TEXT.manager.readinessWarning
    }

    return DASHBOARD_TEXT.manager.readinessCritical
}

export function getManagerRiskLabel(level: DashboardSummary['managerSummary']['qualityRisk']['level']): string {
    if (level === 'healthy') {
        return DASHBOARD_TEXT.manager.riskHealthy
    }

    if (level === 'warning') {
        return DASHBOARD_TEXT.manager.riskWarning
    }

    return DASHBOARD_TEXT.manager.riskCritical
}

export function getManagerChangeLabel(direction: DashboardSummary['managerSummary']['changes'][number]['direction']): string {
    if (direction === 'improving') {
        return 'Улучшается'
    }

    if (direction === 'regressing') {
        return 'Деградирует'
    }

    return 'Без сдвига'
}

export function buildFlakyHistoryInsight(summary: DashboardSummary): {
    tone: 'default' | 'warn' | 'info'
    title: string
    body: string
} {
    const hasHistoricalRanking = summary.flakyAnalytics.topFlakyTests.length > 0
    const currentRunLine = DASHBOARD_TEXT.flakyInsights.currentRunLine.replace('{count}', String(summary.kpis.flakyTests))
    const finalLine = hasHistoricalRanking
        ? DASHBOARD_TEXT.flakyInsights.historyReady
        : summary.kpis.flakyTests > 0
            ? DASHBOARD_TEXT.flakyInsights.historyMissing
            : DASHBOARD_TEXT.flakyInsights.historyLine

    return {
        tone: hasHistoricalRanking ? 'info' : summary.kpis.flakyTests > 0 ? 'warn' : 'default',
        title: DASHBOARD_TEXT.flakyInsights.title,
        body: `${currentRunLine} ${DASHBOARD_TEXT.flakyInsights.historyLine} ${finalLine}`,
    }
}

export function getFlakyTopTestsEmptyState(summary: DashboardSummary): string {
    if (summary.kpis.flakyTests > 0) {
        return DASHBOARD_TEXT.states.flakyTestsHistoryMissing
    }

    return DASHBOARD_TEXT.states.flakyTestsEmpty
}

export function buildReleaseConfidenceBreakdown(summary: DashboardSummary): {
    total: number
    components: Array<{
        label: string
        formula: string
        width: string
        tone: string
    }>
} {
    const passRateValue = clampDashboardScore(summary.kpis.passRate)
    const inverseFlakyValue = clampDashboardScore(100 - summary.kpis.flakyRatio)
    const errorHealthValue = summary.kpis.totalTests === 0
        ? 100
        : clampDashboardScore(100 - ((summary.errorClusters.length / summary.kpis.totalTests) * 100))
    const recentRuns = summary.history.recentRuns.slice(-5)
    const historyConsistencyValue = recentRuns.length > 0
        ? clampDashboardScore(averageDashboardNumber(recentRuns.map((run) => run.passRate - run.flakyRatio)))
        : clampDashboardScore(summary.kpis.passRate - summary.kpis.flakyRatio)

    const componentDefinitions = [
        {
            label: DASHBOARD_TEXT.business.releaseConfidencePassRate,
            rawValue: passRateValue,
            weight: 0.4,
        },
        {
            label: DASHBOARD_TEXT.business.releaseConfidenceFlakyRatio,
            rawValue: inverseFlakyValue,
            weight: 0.3,
        },
        {
            label: DASHBOARD_TEXT.business.releaseConfidenceErrorHealth,
            rawValue: errorHealthValue,
            weight: 0.15,
        },
        {
            label: DASHBOARD_TEXT.business.releaseConfidenceHistoryConsistency,
            rawValue: historyConsistencyValue,
            weight: 0.15,
        },
    ]

    return {
        total: roundOne(componentDefinitions.reduce((total, component) => total + (component.rawValue * component.weight), 0)),
        components: componentDefinitions.map((component) => ({
            label: component.label,
            formula: `${roundOne(component.rawValue)} × ${component.weight} = ${roundOne(component.rawValue * component.weight)}`,
            width: `${roundOne(component.rawValue)}%`,
            tone: getDashboardScoreTone(component.rawValue),
        })),
    }
}

export function buildBusinessMetricReadiness(summary: DashboardSummary): Array<{
    label: string
    status: 'ready' | 'partial' | 'pending'
    statusLabel: string
    hint: string
}> {
    const costAssumptionsState = getBusinessAssumptionsState(summary.businessMetrics.costOfFlakiness.assumptions)
    const costStatus = costAssumptionsState === 'empty' ? 'pending' : costAssumptionsState
    const timeToFixStatus = summary.businessMetrics.timeToFixFlaky.averageDays === null ? 'pending' : 'ready'

    return [
        {
            label: DASHBOARD_TEXT.metrics.timeToDetect,
            status: 'pending',
            statusLabel: DASHBOARD_TEXT.business.readinessPending,
            hint: DASHBOARD_TEXT.business.readinessTimeToDetectHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.timeToFixFlaky,
            status: timeToFixStatus,
            statusLabel: getBusinessReadinessStatusLabel(timeToFixStatus),
            hint: DASHBOARD_TEXT.business.readinessTimeToFixHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.costOfFlakiness,
            status: costStatus,
            statusLabel: getBusinessReadinessStatusLabel(costStatus),
            hint: DASHBOARD_TEXT.business.readinessCostHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.developerFriction,
            status: 'ready',
            statusLabel: DASHBOARD_TEXT.business.readinessReady,
            hint: DASHBOARD_TEXT.business.readinessDeveloperFrictionHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.releaseConfidenceScore,
            status: 'ready',
            statusLabel: DASHBOARD_TEXT.business.readinessReady,
            hint: DASHBOARD_TEXT.business.readinessReleaseConfidenceHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.automationRoi,
            status: 'pending',
            statusLabel: DASHBOARD_TEXT.business.readinessPending,
            hint: DASHBOARD_TEXT.business.readinessAutomationRoiHint,
        },
    ]
}

export function averageDashboardNumber(values: number[]): number {
    if (values.length === 0) {
        return 0
    }

    return values.reduce((total, value) => total + value, 0) / values.length
}

export function getBusinessReadinessStatusLabel(status: 'ready' | 'partial' | 'pending'): string {
    if (status === 'ready') {
        return DASHBOARD_TEXT.business.readinessReady
    }

    if (status === 'partial') {
        return DASHBOARD_TEXT.business.readinessPartial
    }

    return DASHBOARD_TEXT.business.readinessPending
}

export function getBusinessAssumptionsState(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): 'ready' | 'partial' | 'empty' {
    const isCiConfigured = assumptions.ciMinuteCostRub !== null
    const isDeveloperConfigured = assumptions.developerHourlyCostRub !== null && assumptions.analysisMinutesPerUnstable !== null
    const hasAnyValue = isCiConfigured || assumptions.developerHourlyCostRub !== null || assumptions.analysisMinutesPerUnstable !== null

    if (isCiConfigured && isDeveloperConfigured) {
        return 'ready'
    }

    if (hasAnyValue) {
        return 'partial'
    }

    return 'empty'
}

export function getBusinessScenarioStatusLabel(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    const state = getBusinessAssumptionsState(assumptions)

    if (state === 'ready') {
        return DASHBOARD_TEXT.business.scenarioStatusReady
    }

    if (state === 'partial') {
        return DASHBOARD_TEXT.business.scenarioStatusPartial
    }

    return DASHBOARD_TEXT.business.scenarioStatusEmpty
}

export function getBusinessScenarioStatusHint(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    const state = getBusinessAssumptionsState(assumptions)

    if (state === 'ready') {
        return DASHBOARD_TEXT.business.scenarioStatusReadyHint
    }

    if (state === 'partial') {
        return DASHBOARD_TEXT.business.scenarioStatusPartialHint
    }

    return DASHBOARD_TEXT.business.scenarioStatusEmptyHint
}

export function getBusinessImpactLevel(totalCost: number | null, costPerDay: number | null): 'high' | 'medium' | 'low' | 'unknown' {
    if (totalCost === null) {
        return 'unknown'
    }

    if (totalCost >= 50000 || (costPerDay !== null && costPerDay >= 10000)) {
        return 'high'
    }

    if (totalCost >= 15000 || (costPerDay !== null && costPerDay >= 3000)) {
        return 'medium'
    }

    return 'low'
}

export function getBusinessImpactClass(totalCost: number | null, costPerDay: number | null): string {
    return `impact-${getBusinessImpactLevel(totalCost, costPerDay)}`
}

export function getBusinessImpactLabel(totalCost: number | null, costPerDay: number | null): string {
    const impactLevel = getBusinessImpactLevel(totalCost, costPerDay)

    if (impactLevel === 'high') {
        return DASHBOARD_TEXT.business.impactHigh
    }

    if (impactLevel === 'medium') {
        return DASHBOARD_TEXT.business.impactMedium
    }

    if (impactLevel === 'low') {
        return DASHBOARD_TEXT.business.impactLow
    }

    return DASHBOARD_TEXT.business.impactUnknown
}

export function getBusinessDriverType(ciCost: number | null, developerCost: number | null, totalCost: number | null): 'ci' | 'development' | 'balanced' | 'missing' {
    if (totalCost === null || totalCost <= 0) {
        return 'missing'
    }

    const normalizedCiCost = ciCost ?? 0
    const normalizedDeveloperCost = developerCost ?? 0
    const delta = Math.abs(normalizedCiCost - normalizedDeveloperCost)

    if (delta <= totalCost * 0.15) {
        return 'balanced'
    }

    return normalizedCiCost > normalizedDeveloperCost ? 'ci' : 'development'
}

export function getBusinessBreakdownItemClass(ciCost: number | null, developerCost: number | null, totalCost: number | null, target: 'ci' | 'development'): string {
    return getBusinessDriverType(ciCost, developerCost, totalCost) === target ? 'is-dominant' : ''
}

export function getBusinessDriverSignalClass(ciCost: number | null, developerCost: number | null, totalCost: number | null, target: 'ci' | 'development'): string {
    return getBusinessDriverType(ciCost, developerCost, totalCost) === target ? 'is-dominant' : ''
}

export function getBusinessDriverInsightTitle(ciCost: number | null, developerCost: number | null, totalCost: number | null): string {
    const driverType = getBusinessDriverType(ciCost, developerCost, totalCost)

    if (driverType === 'ci') {
        return DASHBOARD_TEXT.business.topDriverCiTitle
    }

    if (driverType === 'development') {
        return DASHBOARD_TEXT.business.topDriverDevelopmentTitle
    }

    if (driverType === 'balanced') {
        return DASHBOARD_TEXT.business.topDriverBalancedTitle
    }

    return DASHBOARD_TEXT.business.topDriverMissingTitle
}

export function getBusinessDriverInsightBody(ciCost: number | null, developerCost: number | null, totalCost: number | null): string {
    const driverType = getBusinessDriverType(ciCost, developerCost, totalCost)

    if (driverType === 'ci') {
        return DASHBOARD_TEXT.business.topDriverCiBody
    }

    if (driverType === 'development') {
        return DASHBOARD_TEXT.business.topDriverDevelopmentBody
    }

    if (driverType === 'balanced') {
        return DASHBOARD_TEXT.business.topDriverBalancedBody
    }

    return DASHBOARD_TEXT.business.topDriverMissingBody
}

export function formatCostShare(value: number | null, total: number | null): string {
    if (value === null || total === null || total <= 0) {
        return '—'
    }

    return `${((value / total) * 100).toFixed(1)}%`
}

export function formatCostShareWidth(value: number | null, total: number | null): string {
    if (value === null || total === null || total <= 0) {
        return '0%'
    }

    return `${Math.max(0, Math.min(100, (value / total) * 100)).toFixed(1)}%`
}

export function getDashboardScoreTone(value: number): string {
    if (value >= 80) {
        return ''
    }

    if (value >= 60) {
        return 'warning'
    }

    return 'danger'
}

export function clampDashboardScore(value: number): number {
    return Math.min(Math.max(value, 0), 100)
}

export function roundToOneDigit(value: number): number {
    return roundOne(value)
}

export function roundOne(value: number): number {
    return Math.round(value * 10) / 10
}