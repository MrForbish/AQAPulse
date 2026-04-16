"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRONTEND_BOOTSTRAP_PLACEHOLDER = void 0;
exports.createEmptyFrontendBootstrap = createEmptyFrontendBootstrap;
exports.parseFrontendBootstrap = parseFrontendBootstrap;
exports.injectFrontendBootstrap = injectFrontendBootstrap;
exports.FRONTEND_BOOTSTRAP_PLACEHOLDER = '__AQA_PULSE_BOOTSTRAP__';
/**
 * Возвращает безопасный bootstrap по умолчанию для случаев, когда shell ещё не встроил данные или bootstrap оказался повреждён.
 */
function createEmptyFrontendBootstrap() {
    return {
        route: { kind: 'dashboard', workspaceSlug: null },
        initialRequestUrl: '/',
        initialDashboardSummary: null,
        initialTestHistoryPayload: null,
        initialAdminWorkspaces: null,
        initialSessionStatus: null,
    };
}
/**
 * Парсит bootstrap максимально терпимо: сломанный inline JSON не должен валить клиент, а должен откатывать runtime к пустому состоянию.
 */
function parseFrontendBootstrap(rawValue) {
    if (!rawValue || rawValue.trim().length === 0 || rawValue === exports.FRONTEND_BOOTSTRAP_PLACEHOLDER) {
        return createEmptyFrontendBootstrap();
    }
    try {
        const parsedValue = JSON.parse(rawValue);
        return {
            route: normalizeRouteDescriptor(parsedValue.route),
            initialRequestUrl: typeof parsedValue.initialRequestUrl === 'string' && parsedValue.initialRequestUrl.length > 0
                ? parsedValue.initialRequestUrl
                : '/',
            initialDashboardSummary: parsedValue.initialDashboardSummary ?? null,
            initialTestHistoryPayload: parsedValue.initialTestHistoryPayload ?? null,
            initialAdminWorkspaces: Array.isArray(parsedValue.initialAdminWorkspaces) ? parsedValue.initialAdminWorkspaces : null,
            initialSessionStatus: normalizeSessionStatus(parsedValue.initialSessionStatus),
        };
    }
    catch {
        return createEmptyFrontendBootstrap();
    }
}
/**
 * Вставляет bootstrap как inline JSON в HTML template с экранированием опасных символов, чтобы shell оставался безопасным для `<script>`-контекста.
 */
function injectFrontendBootstrap(templateHtml, bootstrap) {
    return templateHtml.replace(exports.FRONTEND_BOOTSTRAP_PLACEHOLDER, serializeInlineBootstrap(bootstrap));
}
/**
 * Нормализует route descriptor из сырого JSON так, чтобы неизвестные или частично заполненные маршруты откатывались к безопасному runtime shape, а не ломали router ветвление.
 */
function normalizeRouteDescriptor(route) {
    if (!route) {
        return { kind: 'dashboard', workspaceSlug: null };
    }
    if (route.kind === 'test-history') {
        return {
            kind: 'test-history',
            workspaceSlug: normalizeWorkspaceSlug(route.workspaceSlug),
            testName: route.testName,
        };
    }
    if (route.kind === 'static-dashboard') {
        return { kind: 'static-dashboard', workspaceSlug: null };
    }
    if (route.kind === 'admin-dashboard' || route.kind === 'admin-login') {
        return route;
    }
    if (route.kind === 'workspace-login' || route.kind === 'workspace-api-key-exchange') {
        return {
            kind: route.kind,
            workspaceSlug: normalizeRequiredWorkspaceSlug(route.workspaceSlug),
        };
    }
    return {
        kind: 'dashboard',
        workspaceSlug: normalizeWorkspaceSlug(route.workspaceSlug),
    };
}
function normalizeWorkspaceSlug(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
function normalizeRequiredWorkspaceSlug(value) {
    return normalizeWorkspaceSlug(value) ?? 'workspace';
}
function normalizeSessionStatus(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const scope = value.scope === 'admin' || value.scope === 'workspace' || value.scope === 'public'
        ? value.scope
        : 'public';
    return {
        scope,
        authenticated: value.authenticated === true,
        authRequired: value.authRequired === true,
        workspaceSlug: scope === 'workspace' ? normalizeRequiredWorkspaceSlug(value.workspaceSlug) : null,
    };
}
function serializeInlineBootstrap(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
