import type { DashboardSummary } from '../dashboard-utils'

export interface DashboardBusinessAssumptions {
    ciMinuteCostRub: number | null
    developerHourlyCostRub: number | null
    analysisMinutesPerUnstable: number | null
}

export function normalizeDashboardBusinessAssumptions(
    assumptions: Partial<DashboardBusinessAssumptions> | null | undefined,
): DashboardBusinessAssumptions {
    return {
        ciMinuteCostRub: normalizeOptionalNonNegativeNumber(assumptions?.ciMinuteCostRub),
        developerHourlyCostRub: normalizeOptionalNonNegativeNumber(assumptions?.developerHourlyCostRub),
        analysisMinutesPerUnstable: normalizeOptionalNonNegativeNumber(assumptions?.analysisMinutesPerUnstable),
    }
}

export function applyBusinessAssumptionsToSummary(
    summary: DashboardSummary,
    assumptions: Partial<DashboardBusinessAssumptions> | null | undefined,
): DashboardSummary {
    const mergedAssumptions = normalizeDashboardBusinessAssumptions({
        ...summary.businessMetrics.costOfFlakiness.assumptions,
        ...(assumptions ?? {}),
    })

    return {
        ...summary,
        businessMetrics: {
            ...summary.businessMetrics,
            costOfFlakiness: recalculateCostOfFlakinessMetrics({
                extraRetryMinutes: summary.businessMetrics.costOfFlakiness.extraRetryMinutes,
                extraRetries: summary.businessMetrics.costOfFlakiness.extraRetries,
                unstableRuns: summary.businessMetrics.costOfFlakiness.unstableRuns,
                activeDays: summary.businessMetrics.costOfFlakiness.activeDays,
            }, mergedAssumptions),
        },
    }
}

export function recalculateCostOfFlakinessMetrics(
    baseMetrics: {
        extraRetryMinutes: number
        extraRetries: number
        unstableRuns: number
        activeDays: number
    },
    assumptions: DashboardBusinessAssumptions,
): DashboardSummary['businessMetrics']['costOfFlakiness'] {
    const ciCostRub = assumptions.ciMinuteCostRub === null
        ? null
        : roundToTwoDigits(baseMetrics.extraRetryMinutes * assumptions.ciMinuteCostRub)
    const developerCostRub = assumptions.developerHourlyCostRub === null || assumptions.analysisMinutesPerUnstable === null
        ? null
        : roundToTwoDigits(baseMetrics.unstableRuns * (assumptions.analysisMinutesPerUnstable / 60) * assumptions.developerHourlyCostRub)
    const totalRub = ciCostRub === null && developerCostRub === null
        ? null
        : roundToTwoDigits((ciCostRub ?? 0) + (developerCostRub ?? 0))
    const costPerActiveDayRub = totalRub === null || baseMetrics.activeDays === 0
        ? null
        : roundToTwoDigits(totalRub / baseMetrics.activeDays)

    return {
        totalRub,
        ciCostRub,
        developerCostRub,
        extraRetryMinutes: baseMetrics.extraRetryMinutes,
        extraRetries: baseMetrics.extraRetries,
        unstableRuns: baseMetrics.unstableRuns,
        activeDays: baseMetrics.activeDays,
        costPerActiveDayRub,
        assumptions,
    }
}

function normalizeOptionalNonNegativeNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function roundToTwoDigits(value: number): number {
    return Math.round(value * 100) / 100
}