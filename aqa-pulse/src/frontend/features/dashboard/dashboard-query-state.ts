import type { SetURLSearchParams } from 'react-router-dom'
import { DASHBOARD_TABS, type DashboardTabId } from './dashboard-tab-content'

export function resolveDashboardActiveTab(searchParams: URLSearchParams): DashboardTabId {
    const requestedTab = searchParams.get('tab')

    if (DASHBOARD_TABS.some((tab) => tab.id === requestedTab)) {
        return requestedTab as DashboardTabId
    }

    return 'overview'
}

export function readDashboardSelectedFilters(searchParams: URLSearchParams): {
    selectedBranch: string
    selectedProject: string
    selectedFile: string
} {
    return {
        selectedBranch: searchParams.get('branch') ?? '',
        selectedProject: searchParams.get('project') ?? '',
        selectedFile: searchParams.get('file') ?? '',
    }
}

export function updateDashboardSearchParam(
    setSearchParams: SetURLSearchParams,
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

export function resetDashboardFilters(setSearchParams: SetURLSearchParams): void {
    setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.delete('branch')
        nextParams.delete('project')
        nextParams.delete('file')
        return nextParams
    })
}