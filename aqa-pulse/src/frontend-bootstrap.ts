/**
 * Назначение: описывает bootstrap-контракт между HTML shell и React runtime для route, session и initial data.
 */
import type { TestHistoryConflict, TestHistoryResponse } from './api-store'
import type { WorkspaceDescriptor } from './backend/contracts'
import type { DashboardSummary } from './dashboard-utils'

export const FRONTEND_BOOTSTRAP_PLACEHOLDER = '__AQA_PULSE_BOOTSTRAP__'

export interface FrontendSessionStatus {
    scope: 'admin' | 'workspace' | 'public'
    authenticated: boolean
    authRequired: boolean
    workspaceSlug: string | null
}

export type FrontendRouteDescriptor =
    | { kind: 'dashboard'; workspaceSlug: string | null }
    | { kind: 'test-history'; workspaceSlug: string | null; testName: string }
    | { kind: 'admin-dashboard' }
    | { kind: 'admin-login' }
    | { kind: 'workspace-login'; workspaceSlug: string }
    | { kind: 'workspace-api-key-exchange'; workspaceSlug: string }
    | { kind: 'static-dashboard'; workspaceSlug: null }

export interface FrontendBootstrapData {
    route: FrontendRouteDescriptor
    initialRequestUrl: string
    initialDashboardSummary: DashboardSummary | null
    initialTestHistoryPayload: TestHistoryResponse | TestHistoryConflict | null
    initialAdminWorkspaces: WorkspaceDescriptor[] | null
    initialSessionStatus: FrontendSessionStatus | null
}

/**
 * Возвращает безопасный bootstrap по умолчанию для случаев, когда shell ещё не встроил данные или bootstrap оказался повреждён.
 */
export function createEmptyFrontendBootstrap(): FrontendBootstrapData {
    return {
        route: { kind: 'dashboard', workspaceSlug: null },
        initialRequestUrl: '/',
        initialDashboardSummary: null,
        initialTestHistoryPayload: null,
        initialAdminWorkspaces: null,
        initialSessionStatus: null,
    }
}

/**
 * Парсит bootstrap максимально терпимо: сломанный inline JSON не должен валить клиент, а должен откатывать runtime к пустому состоянию.
 */
export function parseFrontendBootstrap(rawValue: string | null | undefined): FrontendBootstrapData {
    if (!rawValue || rawValue.trim().length === 0 || rawValue === FRONTEND_BOOTSTRAP_PLACEHOLDER) {
        return createEmptyFrontendBootstrap()
    }

    try {
        const parsedValue = JSON.parse(rawValue) as Partial<FrontendBootstrapData>

        return {
            route: normalizeRouteDescriptor(parsedValue.route),
            initialRequestUrl: typeof parsedValue.initialRequestUrl === 'string' && parsedValue.initialRequestUrl.length > 0
                ? parsedValue.initialRequestUrl
                : '/',
            initialDashboardSummary: parsedValue.initialDashboardSummary ?? null,
            initialTestHistoryPayload: parsedValue.initialTestHistoryPayload ?? null,
            initialAdminWorkspaces: Array.isArray(parsedValue.initialAdminWorkspaces) ? parsedValue.initialAdminWorkspaces : null,
            initialSessionStatus: normalizeSessionStatus(parsedValue.initialSessionStatus),
        }
    } catch {
        return createEmptyFrontendBootstrap()
    }
}

/**
 * Вставляет bootstrap как inline JSON в HTML template с экранированием опасных символов, чтобы shell оставался безопасным для `<script>`-контекста.
 */
export function injectFrontendBootstrap(templateHtml: string, bootstrap: FrontendBootstrapData): string {
    return templateHtml.replace(FRONTEND_BOOTSTRAP_PLACEHOLDER, serializeInlineBootstrap(bootstrap))
}

/**
 * Нормализует route descriptor из сырого JSON так, чтобы неизвестные или частично заполненные маршруты откатывались к безопасному runtime shape, а не ломали router ветвление.
 */
function normalizeRouteDescriptor(route: FrontendBootstrapData['route'] | undefined): FrontendRouteDescriptor {
    if (!route) {
        return { kind: 'dashboard', workspaceSlug: null }
    }

    if (route.kind === 'test-history') {
        return {
            kind: 'test-history',
            workspaceSlug: normalizeWorkspaceSlug(route.workspaceSlug),
            testName: route.testName,
        }
    }

    if (route.kind === 'static-dashboard') {
        return { kind: 'static-dashboard', workspaceSlug: null }
    }

    if (route.kind === 'admin-dashboard' || route.kind === 'admin-login') {
        return route
    }

    if (route.kind === 'workspace-login' || route.kind === 'workspace-api-key-exchange') {
        return {
            kind: route.kind,
            workspaceSlug: normalizeRequiredWorkspaceSlug(route.workspaceSlug),
        }
    }

    return {
        kind: 'dashboard',
        workspaceSlug: normalizeWorkspaceSlug(route.workspaceSlug),
    }
}

function normalizeWorkspaceSlug(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeRequiredWorkspaceSlug(value: string | null | undefined): string {
    return normalizeWorkspaceSlug(value) ?? 'workspace'
}

function normalizeSessionStatus(value: Partial<FrontendSessionStatus> | null | undefined): FrontendSessionStatus | null {
    if (!value || typeof value !== 'object') {
        return null
    }

    const scope = value.scope === 'admin' || value.scope === 'workspace' || value.scope === 'public'
        ? value.scope
        : 'public'

    return {
        scope,
        authenticated: value.authenticated === true,
        authRequired: value.authRequired === true,
        workspaceSlug: scope === 'workspace' ? normalizeRequiredWorkspaceSlug(value.workspaceSlug) : null,
    }
}

function serializeInlineBootstrap(value: FrontendBootstrapData): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}