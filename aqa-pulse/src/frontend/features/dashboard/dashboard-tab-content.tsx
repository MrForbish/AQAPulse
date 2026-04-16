import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { SegmentedTabs } from '../../shared/ui'
import { ru } from '../../../shared/i18n/ru'
import { FlakyTab, OverviewTab, PerformanceTab } from './dashboard-core-tabs'
import { AiModule, BusinessModule, CodeQualityModule, TeamModule } from './dashboard-modules'

const DASHBOARD_TEXT = ru.dashboard

export const DASHBOARD_TABS = [
    { id: 'overview', label: DASHBOARD_TEXT.tabs.overview },
    { id: 'performance', label: DASHBOARD_TEXT.tabs.performance },
    { id: 'flaky', label: DASHBOARD_TEXT.tabs.flaky },
    { id: 'business', label: DASHBOARD_TEXT.tabs.business },
    { id: 'codeQuality', label: DASHBOARD_TEXT.tabs.codeQuality },
    { id: 'team', label: DASHBOARD_TEXT.tabs.team },
    { id: 'ai', label: DASHBOARD_TEXT.tabs.ai },
] as const

export type DashboardTabId = typeof DASHBOARD_TABS[number]['id']

const DASHBOARD_TAB_ITEMS = DASHBOARD_TABS.map((item) => ({ id: item.id, label: item.label }))

export function DashboardActiveTabContent(props: {
    activeTab: DashboardTabId
    summary: DashboardSummary
    workspaceSlug: string | null
}): React.JSX.Element | null {
    if (props.activeTab === 'overview') {
        return <OverviewTab summary={props.summary} workspaceSlug={props.workspaceSlug} />
    }

    if (props.activeTab === 'performance') {
        return <PerformanceTab summary={props.summary} workspaceSlug={props.workspaceSlug} />
    }

    if (props.activeTab === 'flaky') {
        return <FlakyTab summary={props.summary} workspaceSlug={props.workspaceSlug} />
    }

    if (props.activeTab === 'business') {
        return <BusinessModule summary={props.summary} workspaceSlug={props.workspaceSlug} />
    }

    if (props.activeTab === 'codeQuality') {
        return <CodeQualityModule summary={props.summary} workspaceSlug={props.workspaceSlug} />
    }

    if (props.activeTab === 'team') {
        return <TeamModule summary={props.summary} workspaceSlug={props.workspaceSlug} />
    }

    if (props.activeTab === 'ai') {
        return <AiModule summary={props.summary} workspaceSlug={props.workspaceSlug} />
    }

    return null
}

export function DashboardTabsSection(props: {
    activeTab: DashboardTabId
    summary: DashboardSummary
    workspaceSlug: string | null
    onTabChange: (value: string) => void
    children?: React.ReactNode
}): React.JSX.Element {
    return (
        <>
            <SegmentedTabs activeTab={props.activeTab} items={DASHBOARD_TAB_ITEMS} onChange={props.onTabChange} />
            {props.children}
            <DashboardActiveTabContent activeTab={props.activeTab} summary={props.summary} workspaceSlug={props.workspaceSlug} />
        </>
    )
}