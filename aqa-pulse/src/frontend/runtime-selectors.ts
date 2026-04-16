import type { TestHistoryConflict, TestHistoryResponse } from '../api-store'
import type { WorkspaceDescriptor } from '../backend/contracts'
import type { DashboardSummary } from '../dashboard-utils'
import type { FrontendBootstrapData } from '../frontend-bootstrap'

export interface DashboardRuntimeBootstrapState {
    isStaticMode: boolean
    initialSummary: DashboardSummary | null
}

export interface TestHistoryRuntimeBootstrapState {
    isStaticMode: boolean
    initialPayload: TestHistoryResponse | TestHistoryConflict | null
}

export function isStaticDashboardRuntime(runtime: FrontendBootstrapData): boolean {
    return runtime.route.kind === 'static-dashboard'
}

export function readDashboardRuntimeBootstrap(runtime: FrontendBootstrapData, workspaceSlug: string | null, currentRequestUrl: string): DashboardRuntimeBootstrapState {
    const isStaticMode = isStaticDashboardRuntime(runtime)
    const bootstrapMatches = isStaticMode
        || (runtime.route.kind === 'dashboard'
            && runtime.route.workspaceSlug === workspaceSlug
            && runtime.initialRequestUrl === currentRequestUrl)

    return {
        isStaticMode,
        initialSummary: bootstrapMatches ? runtime.initialDashboardSummary : null,
    }
}

export function readTestHistoryRuntimeBootstrap(runtime: FrontendBootstrapData, workspaceSlug: string | null, requestedTitle: string, currentRequestUrl: string): TestHistoryRuntimeBootstrapState {
    const isStaticMode = isStaticDashboardRuntime(runtime)
    const bootstrapMatches = runtime.route.kind === 'test-history'
        && runtime.route.workspaceSlug === workspaceSlug
        && runtime.route.testName === requestedTitle
        && runtime.initialRequestUrl === currentRequestUrl

    return {
        isStaticMode,
        initialPayload: bootstrapMatches ? runtime.initialTestHistoryPayload : null,
    }
}

export function readInitialAdminWorkspaces(runtime: FrontendBootstrapData): WorkspaceDescriptor[] | null {
    return runtime.initialAdminWorkspaces
}

export function readAdminBootstrapSession(runtime: FrontendBootstrapData): FrontendBootstrapData['initialSessionStatus'] | null {
    return runtime.initialSessionStatus?.scope === 'admin' ? runtime.initialSessionStatus : null
}

export function readWorkspaceBootstrapSession(runtime: FrontendBootstrapData, workspaceSlug: string): FrontendBootstrapData['initialSessionStatus'] | null {
    return runtime.initialSessionStatus?.scope === 'workspace' && runtime.initialSessionStatus.workspaceSlug === workspaceSlug
        ? runtime.initialSessionStatus
        : null
}