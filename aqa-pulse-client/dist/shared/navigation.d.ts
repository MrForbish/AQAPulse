/**
 * Назначение: единая сборка href и query/filter routing для compatibility HTML renderers, React runtime и static mode.
 */
export interface QueryFilters {
    branch?: string | null;
    project?: string | null;
    file?: string | null;
}
/**
 * Собирает dashboard href так, чтобы одна и та же фильтрация одинаково работала в standalone, workspace и embedded сценариях.
 */
export declare function buildWorkspaceDashboardHref(workspaceSlug: string | null, filters: QueryFilters): string;
export declare function buildSummaryApiUrl(workspaceSlug: string | null, filters: QueryFilters): string;
export declare function buildWorkspaceTestHistoryHref(workspaceSlug: string | null, testName: string, filters: QueryFilters): string;
export declare function buildTestHistoryApiUrl(workspaceSlug: string | null, testName: string, filters: QueryFilters): string;
export declare function buildArtifactBaseUrl(workspaceSlug: string | null): string;
export declare function buildDashboardHrefFromBasePath(filters: QueryFilters, basePath: string): string;
export declare function buildTestHistoryHrefFromTestDetailsBasePath(testName: string, filters: QueryFilters, testDetailsBasePath: string): string;
export declare function buildTestHistoryHrefFromDashboardBasePath(testName: string, filters: QueryFilters, dashboardBasePath: string): string;
export declare function buildApiTestHistoryHrefFromBasePath(testName: string, filters: QueryFilters, apiBasePath: string): string;
export declare function buildDashboardTabHref(dashboardActionPath: string, filters: QueryFilters, tabId: string, sectionId?: string): string;
export declare function buildWorkspaceLoginHref(workspaceSlug: string): string;
/**
 * Нормализует фильтры из URLSearchParams в общий QueryFilters shape, чтобы runtime и renderer-слои не расходились по трактовке пустых значений.
 */
export declare function readFiltersFromSearchParams(searchParams: URLSearchParams): QueryFilters;
/**
 * Централизует сериализацию query filters, чтобы изменение набора фильтров происходило в одном месте и не расходилось между HTML и React слоями.
 */
export declare function buildQueryString(filters: QueryFilters): string;
export declare function normalizeOptionalFilter(value: string | null | undefined): string | null;
