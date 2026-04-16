/**
 * Назначение: единая сборка href и query/filter routing для compatibility HTML renderers, React runtime и static mode.
 */
export interface QueryFilters {
    branch?: string | null
    project?: string | null
    file?: string | null
}

/**
 * Собирает dashboard href так, чтобы одна и та же фильтрация одинаково работала в standalone, workspace и embedded сценариях.
 */
export function buildWorkspaceDashboardHref(workspaceSlug: string | null, filters: QueryFilters): string {
    const pathname = workspaceSlug ? `/w/${encodeURIComponent(workspaceSlug)}` : '/'
    return appendQueryString(pathname, filters)
}

export function buildSummaryApiUrl(workspaceSlug: string | null, filters: QueryFilters): string {
    const pathname = workspaceSlug ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/summary` : '/api/summary'
    return appendQueryString(pathname, filters)
}

export function buildWorkspaceTestHistoryHref(workspaceSlug: string | null, testName: string, filters: QueryFilters): string {
    const pathname = workspaceSlug
        ? `/w/${encodeURIComponent(workspaceSlug)}/test/${encodeURIComponent(testName)}`
        : `/test/${encodeURIComponent(testName)}`

    return appendQueryString(pathname, filters)
}

export function buildTestHistoryApiUrl(workspaceSlug: string | null, testName: string, filters: QueryFilters): string {
    const pathname = workspaceSlug
        ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/test/${encodeURIComponent(testName)}`
        : `/api/test/${encodeURIComponent(testName)}`

    return appendQueryString(pathname, filters)
}

export function buildArtifactBaseUrl(workspaceSlug: string | null): string {
    return workspaceSlug
        ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/artifacts`
        : '/api/artifacts'
}

export function buildDashboardHrefFromBasePath(filters: QueryFilters, basePath: string): string {
    return appendQueryString(basePath || '/', filters)
}

export function buildTestHistoryHrefFromTestDetailsBasePath(testName: string, filters: QueryFilters, testDetailsBasePath: string): string {
    return appendQueryString(`${testDetailsBasePath}/${encodeURIComponent(testName)}`, filters)
}

export function buildTestHistoryHrefFromDashboardBasePath(testName: string, filters: QueryFilters, dashboardBasePath: string): string {
    const testHistoryBasePath = dashboardBasePath ? `${dashboardBasePath}/test` : '/test'
    return appendQueryString(`${testHistoryBasePath}/${encodeURIComponent(testName)}`, filters)
}

export function buildApiTestHistoryHrefFromBasePath(testName: string, filters: QueryFilters, apiBasePath: string): string {
    const testHistoryBasePath = apiBasePath || '/api/test'
    return appendQueryString(`${testHistoryBasePath}/${encodeURIComponent(testName)}`, filters)
}

export function buildDashboardTabHref(dashboardActionPath: string, filters: QueryFilters, tabId: string, sectionId?: string): string {
    const query = buildQueryString(filters)
    const hash = sectionId ? `#${tabId}:${sectionId}` : `#${tabId}`
    return query ? `${dashboardActionPath}?${query}${hash}` : `${dashboardActionPath}${hash}`
}

export function buildWorkspaceLoginHref(workspaceSlug: string): string {
    return `/w/${encodeURIComponent(workspaceSlug)}/login`
}

/**
 * Нормализует фильтры из URLSearchParams в общий QueryFilters shape, чтобы runtime и renderer-слои не расходились по трактовке пустых значений.
 */
export function readFiltersFromSearchParams(searchParams: URLSearchParams): QueryFilters {
    return {
        branch: normalizeOptionalFilter(searchParams.get('branch')),
        project: normalizeOptionalFilter(searchParams.get('project')),
        file: normalizeOptionalFilter(searchParams.get('file')),
    }
}

/**
 * Централизует сериализацию query filters, чтобы изменение набора фильтров происходило в одном месте и не расходилось между HTML и React слоями.
 */
export function buildQueryString(filters: QueryFilters): string {
    const searchParams = new URLSearchParams()

    if (filters.branch) {
        searchParams.set('branch', filters.branch)
    }

    if (filters.project) {
        searchParams.set('project', filters.project)
    }

    if (filters.file) {
        searchParams.set('file', filters.file)
    }

    return searchParams.toString()
}

export function normalizeOptionalFilter(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function appendQueryString(pathname: string, filters: QueryFilters): string {
    const query = buildQueryString(filters)
    return query ? `${pathname}?${query}` : pathname
}