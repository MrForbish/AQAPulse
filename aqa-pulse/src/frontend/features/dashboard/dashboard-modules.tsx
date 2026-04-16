/**
 * Назначение: полноценные React-модули dashboard для business/code quality/team/ai. Здесь собирается feature-level UI поверх уже рассчитанных summary-метрик без возврата к removed pre-React delivery path.
 */
import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import {
    DashboardBusinessConfigAssumptionsSection,
    DashboardBusinessCostSection,
    DashboardBusinessOverviewMetrics,
    DashboardBusinessReadinessSection,
    DashboardBusinessReleaseConfidenceSection,
    DashboardBusinessSummarySection,
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

export function BusinessModule(props: { summary: DashboardSummary; workspaceSlug: string | null }): React.JSX.Element {
    const { summary } = props

    return (
        <div className="page-grid">
            <DashboardBusinessOverviewMetrics summary={summary} />
            <DashboardBusinessSummarySection summary={summary} />
            <DashboardBusinessReleaseConfidenceSection summary={summary} />
            <DashboardBusinessReadinessSection summary={summary} />
            <DashboardBusinessCostSection summary={summary} />
            <DashboardBusinessConfigAssumptionsSection summary={summary} />

            <DashboardManagerSummarySection summary={summary} mapTone={mapManagerTone} />
            <DashboardManagerBlockersSection summary={summary} />
            <DashboardManagerChangesSection summary={summary} mapTone={mapChangeTone} mode="pill-with-value" />
        </div>
    )
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

