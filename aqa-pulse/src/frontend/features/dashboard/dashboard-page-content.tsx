import React from 'react'
import type { DashboardSummary } from '../../../dashboard-utils'
import { PageFrame } from '../../shared/ui'
import { DashboardFiltersSection, DashboardHeroSection, DashboardMetricsSection, DashboardRuntimeNotices } from './dashboard-shell-sections'
import { type DashboardTabId, DashboardTabsSection } from './dashboard-tab-content'

export interface DashboardPageContentProps {
    workspaceSlug: string | null
    summary: DashboardSummary
    activeTab: DashboardTabId
    isStaticMode: boolean
    selectedBranch: string
    selectedProject: string
    selectedFile: string
    isLoading: boolean
    errorMessage: string | null
    onBranchChange: (value: string) => void
    onProjectChange: (value: string) => void
    onFileChange: (value: string) => void
    onReset: () => void
    onTabChange: (value: string) => void
}

export function DashboardPageContent(props: DashboardPageContentProps): React.JSX.Element {
    return (
        <PageFrame>
            <DashboardHeroSection summary={props.summary} workspaceSlug={props.workspaceSlug} isStaticMode={props.isStaticMode} />
            <DashboardFiltersSection
                summary={props.summary}
                isStaticMode={props.isStaticMode}
                selectedBranch={props.selectedBranch}
                selectedProject={props.selectedProject}
                selectedFile={props.selectedFile}
                onBranchChange={props.onBranchChange}
                onProjectChange={props.onProjectChange}
                onFileChange={props.onFileChange}
                onReset={props.onReset}
            />
            <DashboardMetricsSection summary={props.summary} />
            <DashboardTabsSection
                activeTab={props.activeTab}
                summary={props.summary}
                workspaceSlug={props.workspaceSlug}
                onTabChange={props.onTabChange}
            >
                <DashboardRuntimeNotices summaryPresent={true} isLoading={props.isLoading} errorMessage={props.errorMessage} />
            </DashboardTabsSection>
        </PageFrame>
    )
}