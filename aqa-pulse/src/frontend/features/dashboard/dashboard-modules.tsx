/**
 * Назначение: полноценные React-модули dashboard для business/code quality/team/ai. Здесь собирается feature-level UI поверх уже рассчитанных summary-метрик без возврата к removed pre-React delivery path.
 */
import React from 'react'
import {
    applyBusinessAssumptionsToSummary,
    type DashboardBusinessAssumptions,
    type DashboardSummary,
} from '../../../dashboard-utils'
import { ru } from '../../../shared/i18n/ru'
import {
    DashboardBusinessConfigAssumptionsSection,
    DashboardBusinessCostSection,
    DashboardBusinessOpsOverviewMetrics,
    DashboardBusinessProductRiskOverviewMetrics,
    DashboardBusinessReadinessSection,
    DashboardBusinessReleaseConfidenceSection,
    DashboardBusinessScenarioOverviewMetrics,
    DashboardBusinessSummarySection,
    DashboardBusinessTrackIntro,
} from './dashboard-business-sections'
import {
    DashboardAiClustersSection,
    DashboardAiOverviewMetrics,
    DashboardAiReadinessSection,
    DashboardAiRiskRankingSection,
} from './dashboard-ai-sections'
import {
    DashboardCodeQualityFailureHotspotsSection,
    DashboardCodeQualityOverviewMetrics,
    DashboardCodeQualityPhaseBreakdownSection,
    DashboardCodeQualitySlowTestsSection,
    DashboardCodeQualitySuiteDurationSection,
} from './dashboard-code-quality-sections'
import { mapChangeTone, mapManagerTone } from './dashboard-manager-helpers'
import {
    DashboardManagerBlockersSection,
    DashboardManagerChangesSection,
    DashboardManagerSummarySection,
} from './dashboard-manager-sections'
import { DashboardTeamOverviewMetrics, DashboardTeamRecentRunsSection } from './dashboard-team-sections'

const DASHBOARD_TEXT = ru.dashboard

const BUSINESS_SCENARIO_PRESETS: Array<{ key: string; label: string; assumptions: DashboardBusinessAssumptions }> = [
    {
        key: 'conservative',
        label: DASHBOARD_TEXT.business.presetConservative,
        assumptions: {
            ciMinuteCostRub: 4,
            developerHourlyCostRub: 2500,
            analysisMinutesPerUnstable: 10,
        },
    },
    {
        key: 'realistic',
        label: DASHBOARD_TEXT.business.presetRealistic,
        assumptions: {
            ciMinuteCostRub: 9,
            developerHourlyCostRub: 4500,
            analysisMinutesPerUnstable: 20,
        },
    },
    {
        key: 'enterprise',
        label: DASHBOARD_TEXT.business.presetEnterprise,
        assumptions: {
            ciMinuteCostRub: 18,
            developerHourlyCostRub: 7000,
            analysisMinutesPerUnstable: 30,
        },
    },
]

export function BusinessModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props
    const summaryAssumptions = readSummaryBusinessAssumptions(summary)
    const [scenarioAssumptions, setScenarioAssumptions] = React.useState<DashboardBusinessAssumptions>(summaryAssumptions)
    const [lastSyncedAssumptions, setLastSyncedAssumptions] = React.useState<DashboardBusinessAssumptions>(summaryAssumptions)
    const [activePresetKey, setActivePresetKey] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (areBusinessAssumptionsEqual(scenarioAssumptions, lastSyncedAssumptions)) {
            setScenarioAssumptions(summaryAssumptions)
            setActivePresetKey(null)
        }

        setLastSyncedAssumptions(summaryAssumptions)
    }, [
        summaryAssumptions.analysisMinutesPerUnstable,
        summaryAssumptions.ciMinuteCostRub,
        summaryAssumptions.developerHourlyCostRub,
    ])

    const scenarioSummary = applyBusinessAssumptionsToSummary(summary, scenarioAssumptions)
    const isScenarioDirty = !areBusinessAssumptionsEqual(scenarioAssumptions, summaryAssumptions)
    const appliedPresetLabel = BUSINESS_SCENARIO_PRESETS.find((preset) => preset.key === activePresetKey)?.label ?? null

    function handleAssumptionChange(key: keyof DashboardBusinessAssumptions, value: number | null): void {
        setScenarioAssumptions((current) => ({
            ...current,
            [key]: value,
        }))
        setActivePresetKey(null)
    }

    function handleApplyPreset(presetKey: string): void {
        const preset = BUSINESS_SCENARIO_PRESETS.find((candidate) => candidate.key === presetKey)

        if (!preset) {
            return
        }

        setScenarioAssumptions(preset.assumptions)
        setActivePresetKey(preset.key)
    }

    function handleResetScenario(): void {
        setScenarioAssumptions(summaryAssumptions)
        setActivePresetKey(null)
    }

    return (
        <div className="page-grid">
            <DashboardBusinessTrackIntro eyebrow={DASHBOARD_TEXT.business.opsEyebrow} title={DASHBOARD_TEXT.business.opsTitle} description={DASHBOARD_TEXT.business.opsDescription} />
            <DashboardBusinessOpsOverviewMetrics summary={summary} />

            <DashboardBusinessTrackIntro eyebrow={DASHBOARD_TEXT.business.scenarioEyebrow} title={DASHBOARD_TEXT.business.scenarioTitle} description={DASHBOARD_TEXT.business.scenarioDescription} />
            <DashboardBusinessScenarioOverviewMetrics summary={scenarioSummary} />
            <DashboardBusinessSummarySection summary={scenarioSummary} />
            <DashboardBusinessCostSection summary={scenarioSummary} />
            <DashboardBusinessConfigAssumptionsSection
                summary={scenarioSummary}
                assumptions={scenarioAssumptions}
                isDirty={isScenarioDirty}
                appliedPresetLabel={appliedPresetLabel}
                presets={BUSINESS_SCENARIO_PRESETS.map((preset) => ({ key: preset.key, label: preset.label }))}
                onAssumptionChange={handleAssumptionChange}
                onApplyPreset={handleApplyPreset}
                onReset={handleResetScenario}
            />
            <DashboardBusinessReadinessSection summary={scenarioSummary} />

            <DashboardBusinessTrackIntro eyebrow={DASHBOARD_TEXT.business.productRiskEyebrow} title={DASHBOARD_TEXT.business.productRiskTitle} description={DASHBOARD_TEXT.business.productRiskDescription} />
            <DashboardBusinessProductRiskOverviewMetrics summary={summary} />
            <DashboardBusinessReleaseConfidenceSection summary={summary} />

            <DashboardManagerSummarySection summary={summary} mapTone={mapManagerTone} />
            <DashboardManagerBlockersSection summary={summary} />
            <DashboardManagerChangesSection summary={summary} mapTone={mapChangeTone} mode="pill-with-value" />
        </div>
    )
}

function readSummaryBusinessAssumptions(summary: DashboardSummary): DashboardBusinessAssumptions {
    const assumptions = summary.businessMetrics.costOfFlakiness.assumptions

    return {
        ciMinuteCostRub: assumptions.ciMinuteCostRub,
        developerHourlyCostRub: assumptions.developerHourlyCostRub,
        analysisMinutesPerUnstable: assumptions.analysisMinutesPerUnstable,
    }
}

function areBusinessAssumptionsEqual(left: DashboardBusinessAssumptions, right: DashboardBusinessAssumptions): boolean {
    return left.ciMinuteCostRub === right.ciMinuteCostRub
        && left.developerHourlyCostRub === right.developerHourlyCostRub
        && left.analysisMinutesPerUnstable === right.analysisMinutesPerUnstable
}

export function CodeQualityModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <DashboardCodeQualityOverviewMetrics summary={summary} />
            <DashboardCodeQualityFailureHotspotsSection summary={summary} workspaceSlug={props.workspaceSlug} />
            <DashboardCodeQualityPhaseBreakdownSection summary={summary} />
            <DashboardCodeQualitySuiteDurationSection summary={summary} />
            <DashboardCodeQualitySlowTestsSection summary={summary} workspaceSlug={props.workspaceSlug} />
        </div>
    )
}

export function TeamModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <DashboardTeamOverviewMetrics summary={summary} />
            <DashboardManagerSummarySection summary={summary} mapTone={mapManagerTone} />
            <DashboardManagerBlockersSection summary={summary} includeMeta />
            <DashboardManagerChangesSection summary={summary} mapTone={mapChangeTone} mode="separate-value" />
            <DashboardTeamRecentRunsSection summary={summary} />
        </div>
    )
}

export function AiModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <DashboardAiOverviewMetrics summary={summary} />
            <DashboardAiRiskRankingSection summary={summary} workspaceSlug={props.workspaceSlug} />
            <DashboardAiClustersSection summary={summary} />
            <DashboardAiReadinessSection summary={summary} />
        </div>
    )
}

