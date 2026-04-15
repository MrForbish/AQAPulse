import type { TestHistoryConflict, TestHistoryResponse } from './api-store'
import type { DashboardSummary } from './dashboard-utils'

export const FRONTEND_BOOTSTRAP_PLACEHOLDER = '__AQA_PULSE_BOOTSTRAP__'

export type FrontendRouteDescriptor =
    | { kind: 'dashboard'; workspaceSlug: string | null }
    | { kind: 'test-history'; workspaceSlug: string | null; testName: string }
    | { kind: 'static-dashboard'; workspaceSlug: null }

export interface FrontendBootstrapData {
    route: FrontendRouteDescriptor
    initialRequestUrl: string
    initialDashboardSummary: DashboardSummary | null
    initialTestHistoryPayload: TestHistoryResponse | TestHistoryConflict | null
}

export function createEmptyFrontendBootstrap(): FrontendBootstrapData {
    return {
        route: { kind: 'dashboard', workspaceSlug: null },
        initialRequestUrl: '/',
        initialDashboardSummary: null,
        initialTestHistoryPayload: null,
    }
}

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
        }
    } catch {
        return createEmptyFrontendBootstrap()
    }
}

export function injectFrontendBootstrap(templateHtml: string, bootstrap: FrontendBootstrapData): string {
    return templateHtml.replace(FRONTEND_BOOTSTRAP_PLACEHOLDER, serializeInlineBootstrap(bootstrap))
}

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

    return {
        kind: 'dashboard',
        workspaceSlug: normalizeWorkspaceSlug(route.workspaceSlug),
    }
}

function normalizeWorkspaceSlug(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function serializeInlineBootstrap(value: FrontendBootstrapData): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}