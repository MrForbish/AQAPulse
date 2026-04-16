/**
 * Назначение: React dashboard-страница с табами, KPI, графиками и переходами в test history для standalone и workspace режимов.
 */
import React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ru } from '../../../shared/i18n/ru'
import { useDashboardSummaryData } from '../../hooks/use-dashboard-summary'
import {
    buildDashboardHref,
    buildSummaryApiUrl,
    readFiltersFromSearchParams,
    useRuntime,
} from '../../runtime'
import { ErrorView, LoadingView, PageFrame, SegmentedTabs } from '../../shared/ui'
import { FlakyTab, OverviewTab, PerformanceTab } from './dashboard-core-tabs'
import { AiModule, BusinessModule, CodeQualityModule, TeamModule } from './dashboard-modules'
import { DashboardFiltersSection, DashboardHeroSection, DashboardMetricsSection, DashboardRuntimeNotices } from './dashboard-shell-sections'

const DASHBOARD_TEXT = ru.dashboard

const DASHBOARD_TABS = [
    { id: 'overview', label: DASHBOARD_TEXT.tabs.overview },
    { id: 'performance', label: DASHBOARD_TEXT.tabs.performance },
    { id: 'flaky', label: DASHBOARD_TEXT.tabs.flaky },
    { id: 'business', label: DASHBOARD_TEXT.tabs.business },
    { id: 'codeQuality', label: DASHBOARD_TEXT.tabs.codeQuality },
    { id: 'team', label: DASHBOARD_TEXT.tabs.team },
    { id: 'ai', label: DASHBOARD_TEXT.tabs.ai },
] as const

/**
 * Dashboard умеет переиспользовать bootstrap summary только когда URL и workspace совпадают с исходным shell, чтобы не показывать устаревшие данные после client-side navigation.
 */
export function DashboardPage(props: { workspaceSlug: string | null }): React.JSX.Element {
    const runtime = useRuntime()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = DASHBOARD_TABS.some((tab) => tab.id === searchParams.get('tab'))
        ? searchParams.get('tab') ?? 'overview'
        : 'overview'
    const currentRequestUrl = `${location.pathname}${location.search}`
    const filters = readFiltersFromSearchParams(searchParams)
    const apiUrl = buildSummaryApiUrl(props.workspaceSlug, filters)
    const isStaticMode = runtime.route.kind === 'static-dashboard'
    const bootstrapMatches = runtime.route.kind === 'static-dashboard'
        || (runtime.route.kind === 'dashboard'
            && runtime.route.workspaceSlug === props.workspaceSlug
            && runtime.initialRequestUrl === currentRequestUrl)
    const initialSummary = bootstrapMatches ? runtime.initialDashboardSummary : null

    const { summary, isLoading, errorMessage } = useDashboardSummaryData({
        workspaceSlug: props.workspaceSlug,
        apiUrl,
        currentRequestUrl,
        initialSummary,
        isStaticMode,
    })

    if (!summary && isLoading) {
        return (
            <PageFrame>
                <LoadingView label="Собираем React dashboard..." />
            </PageFrame>
        )
    }

    if (!summary) {
        return (
            <PageFrame>
                <ErrorView
                    title="Не удалось загрузить dashboard"
                    message={errorMessage ?? 'Сводка временно недоступна.'}
                    action={<a className="ghost-link" href={buildDashboardHref(props.workspaceSlug, filters)}>Перезагрузить страницу</a>}
                />
            </PageFrame>
        )
    }

    const selectedBranch = searchParams.get('branch') ?? ''
    const selectedProject = searchParams.get('project') ?? ''
    const selectedFile = searchParams.get('file') ?? ''

    return (
        <PageFrame>
            <DashboardHeroSection summary={summary} workspaceSlug={props.workspaceSlug} isStaticMode={isStaticMode} />
            <DashboardFiltersSection
                summary={summary}
                isStaticMode={isStaticMode}
                selectedBranch={selectedBranch}
                selectedProject={selectedProject}
                selectedFile={selectedFile}
                onBranchChange={(value) => updateSearchParams(setSearchParams, 'branch', value)}
                onProjectChange={(value) => updateSearchParams(setSearchParams, 'project', value)}
                onFileChange={(value) => updateSearchParams(setSearchParams, 'file', value)}
                onReset={() => resetFilters(setSearchParams)}
            />
            <DashboardMetricsSection summary={summary} />

            <SegmentedTabs activeTab={activeTab} items={DASHBOARD_TABS.map((item) => ({ id: item.id, label: item.label }))} onChange={(value) => updateSearchParams(setSearchParams, 'tab', value, true)} />

            <DashboardRuntimeNotices summaryPresent={Boolean(summary)} isLoading={isLoading} errorMessage={errorMessage} />

            {activeTab === 'overview' ? <OverviewTab summary={summary} workspaceSlug={props.workspaceSlug} /> : null}

            {activeTab === 'performance' ? <PerformanceTab summary={summary} workspaceSlug={props.workspaceSlug} /> : null}

            {activeTab === 'flaky' ? <FlakyTab summary={summary} workspaceSlug={props.workspaceSlug} /> : null}

            {activeTab === 'business' ? (
                <BusinessModule summary={summary} workspaceSlug={props.workspaceSlug} />
            ) : null}

            {activeTab === 'codeQuality' ? <CodeQualityModule summary={summary} workspaceSlug={props.workspaceSlug} /> : null}
            {activeTab === 'team' ? <TeamModule summary={summary} workspaceSlug={props.workspaceSlug} /> : null}
            {activeTab === 'ai' ? <AiModule summary={summary} workspaceSlug={props.workspaceSlug} /> : null}
        </PageFrame>
    )
}

function updateSearchParams(
    setSearchParams: ReturnType<typeof useSearchParams>[1],
    key: string,
    value: string,
    keepValueWhenEmpty = false,
): void {
    setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)

        if (!value && !keepValueWhenEmpty) {
            nextParams.delete(key)
        } else {
            nextParams.set(key, value)
        }

        return nextParams
    })
}

function resetFilters(setSearchParams: ReturnType<typeof useSearchParams>[1]): void {
    setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.delete('branch')
        nextParams.delete('project')
        nextParams.delete('file')
        return nextParams
    })
}
