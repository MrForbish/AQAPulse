import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { LoadingView, SegmentedTabs } from '../../shared/ui'
import { ru } from '../../../shared/i18n/ru'
import { OverviewTab } from './dashboard-core-tabs'

interface DashboardActiveTabContentProps {
    activeTab: DashboardTabId
    summary: DashboardSummary
    workspaceSlug: string | null
}

type DashboardTabComponentProps = Omit<DashboardActiveTabContentProps, 'activeTab'>

const PerformanceTab = React.lazy(async () => {
    const module = await import('./dashboard-performance-tab.js')

    return {
        default: module.PerformanceTab as React.ComponentType<DashboardTabComponentProps>,
    }
})

const FlakyTab = React.lazy(async () => {
    const module = await import('./dashboard-flaky-tab.js')

    return {
        default: module.FlakyTab as React.ComponentType<DashboardTabComponentProps>,
    }
})

const ReleaseTab = React.lazy(async () => {
    const module = await import('./dashboard-release-tab.js')

    return {
        default: module.ReleaseTab as React.ComponentType<DashboardTabComponentProps>,
    }
})

const BusinessModule = React.lazy(async () => {
    const module = await import('./dashboard-modules.js')

    return {
        default: module.BusinessModule as React.ComponentType<DashboardTabComponentProps>,
    }
})

const CodeQualityModule = React.lazy(async () => {
    const module = await import('./dashboard-modules.js')

    return {
        default: module.CodeQualityModule as React.ComponentType<DashboardTabComponentProps>,
    }
})

const TeamModule = React.lazy(async () => {
    const module = await import('./dashboard-modules.js')

    return {
        default: module.TeamModule as React.ComponentType<DashboardTabComponentProps>,
    }
})

const AiModule = React.lazy(async () => {
    const module = await import('./dashboard-modules.js')

    return {
        default: module.AiModule as React.ComponentType<DashboardTabComponentProps>,
    }
})

const DASHBOARD_TEXT = ru.dashboard

export const DASHBOARD_TABS = [
    { id: 'overview', label: DASHBOARD_TEXT.tabs.overview },
    { id: 'release', label: 'Релиз' },
    { id: 'performance', label: DASHBOARD_TEXT.tabs.performance },
    { id: 'flaky', label: DASHBOARD_TEXT.tabs.flaky },
    { id: 'business', label: DASHBOARD_TEXT.tabs.business },
    { id: 'codeQuality', label: DASHBOARD_TEXT.tabs.codeQuality },
    { id: 'team', label: DASHBOARD_TEXT.tabs.team },
    { id: 'ai', label: DASHBOARD_TEXT.tabs.ai },
] as const

export type DashboardTabId = typeof DASHBOARD_TABS[number]['id']

const DASHBOARD_TAB_ITEMS = DASHBOARD_TABS.map((item) => ({ id: item.id, label: item.label }))

function DashboardTabLoadingState(): React.JSX.Element {
    return <LoadingView label="Загружаем раздел дашборда..." />
}

export function DashboardActiveTabContent(props: DashboardActiveTabContentProps): React.JSX.Element | null {
    if (props.activeTab === 'overview') {
        return <OverviewTab summary={props.summary} workspaceSlug={props.workspaceSlug} />
    }

    if (props.activeTab === 'release') {
        return <ReleaseTab summary={props.summary} workspaceSlug={props.workspaceSlug} />
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
            <SegmentedTabs
                activeTab={props.activeTab}
                items={DASHBOARD_TAB_ITEMS}
                onChange={(value) => {
                    React.startTransition(() => {
                        props.onTabChange(value)
                    })
                }}
            />
            {props.children}
            <React.Suspense fallback={<DashboardTabLoadingState />}>
                <DashboardActiveTabContent activeTab={props.activeTab} summary={props.summary} workspaceSlug={props.workspaceSlug} />
            </React.Suspense>
        </>
    )
}
