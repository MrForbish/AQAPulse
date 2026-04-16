"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkspaceDashboardHref = buildWorkspaceDashboardHref;
exports.buildSummaryApiUrl = buildSummaryApiUrl;
exports.buildWorkspaceTestHistoryHref = buildWorkspaceTestHistoryHref;
exports.buildTestHistoryApiUrl = buildTestHistoryApiUrl;
exports.buildArtifactBaseUrl = buildArtifactBaseUrl;
exports.buildDashboardHrefFromBasePath = buildDashboardHrefFromBasePath;
exports.buildTestHistoryHrefFromTestDetailsBasePath = buildTestHistoryHrefFromTestDetailsBasePath;
exports.buildTestHistoryHrefFromDashboardBasePath = buildTestHistoryHrefFromDashboardBasePath;
exports.buildApiTestHistoryHrefFromBasePath = buildApiTestHistoryHrefFromBasePath;
exports.buildDashboardTabHref = buildDashboardTabHref;
exports.buildWorkspaceLoginHref = buildWorkspaceLoginHref;
exports.readFiltersFromSearchParams = readFiltersFromSearchParams;
exports.buildQueryString = buildQueryString;
exports.normalizeOptionalFilter = normalizeOptionalFilter;
/**
 * Собирает dashboard href так, чтобы одна и та же фильтрация одинаково работала в standalone, workspace и embedded сценариях.
 */
function buildWorkspaceDashboardHref(workspaceSlug, filters) {
    const pathname = workspaceSlug ? `/w/${encodeURIComponent(workspaceSlug)}` : '/';
    return appendQueryString(pathname, filters);
}
function buildSummaryApiUrl(workspaceSlug, filters) {
    const pathname = workspaceSlug ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/summary` : '/api/summary';
    return appendQueryString(pathname, filters);
}
function buildWorkspaceTestHistoryHref(workspaceSlug, testName, filters) {
    const pathname = workspaceSlug
        ? `/w/${encodeURIComponent(workspaceSlug)}/test/${encodeURIComponent(testName)}`
        : `/test/${encodeURIComponent(testName)}`;
    return appendQueryString(pathname, filters);
}
function buildTestHistoryApiUrl(workspaceSlug, testName, filters) {
    const pathname = workspaceSlug
        ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/test/${encodeURIComponent(testName)}`
        : `/api/test/${encodeURIComponent(testName)}`;
    return appendQueryString(pathname, filters);
}
function buildArtifactBaseUrl(workspaceSlug) {
    return workspaceSlug
        ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/artifacts`
        : '/api/artifacts';
}
function buildDashboardHrefFromBasePath(filters, basePath) {
    return appendQueryString(basePath || '/', filters);
}
function buildTestHistoryHrefFromTestDetailsBasePath(testName, filters, testDetailsBasePath) {
    return appendQueryString(`${testDetailsBasePath}/${encodeURIComponent(testName)}`, filters);
}
function buildTestHistoryHrefFromDashboardBasePath(testName, filters, dashboardBasePath) {
    const testHistoryBasePath = dashboardBasePath ? `${dashboardBasePath}/test` : '/test';
    return appendQueryString(`${testHistoryBasePath}/${encodeURIComponent(testName)}`, filters);
}
function buildApiTestHistoryHrefFromBasePath(testName, filters, apiBasePath) {
    const testHistoryBasePath = apiBasePath || '/api/test';
    return appendQueryString(`${testHistoryBasePath}/${encodeURIComponent(testName)}`, filters);
}
function buildDashboardTabHref(dashboardActionPath, filters, tabId, sectionId) {
    const query = buildQueryString(filters);
    const hash = sectionId ? `#${tabId}:${sectionId}` : `#${tabId}`;
    return query ? `${dashboardActionPath}?${query}${hash}` : `${dashboardActionPath}${hash}`;
}
function buildWorkspaceLoginHref(workspaceSlug) {
    return `/w/${encodeURIComponent(workspaceSlug)}/login`;
}
/**
 * Нормализует фильтры из URLSearchParams в общий QueryFilters shape, чтобы runtime и renderer-слои не расходились по трактовке пустых значений.
 */
function readFiltersFromSearchParams(searchParams) {
    return {
        branch: normalizeOptionalFilter(searchParams.get('branch')),
        project: normalizeOptionalFilter(searchParams.get('project')),
        file: normalizeOptionalFilter(searchParams.get('file')),
    };
}
/**
 * Централизует сериализацию query filters, чтобы изменение набора фильтров происходило в одном месте и не расходилось между HTML и React слоями.
 */
function buildQueryString(filters) {
    const searchParams = new URLSearchParams();
    if (filters.branch) {
        searchParams.set('branch', filters.branch);
    }
    if (filters.project) {
        searchParams.set('project', filters.project);
    }
    if (filters.file) {
        searchParams.set('file', filters.file);
    }
    return searchParams.toString();
}
function normalizeOptionalFilter(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
function appendQueryString(pathname, filters) {
    const query = buildQueryString(filters);
    return query ? `${pathname}?${query}` : pathname;
}
