import { useRuntime } from './runtime'
import {
    isStaticDashboardRuntime,
    readAdminBootstrapSession,
    readDashboardRuntimeBootstrap,
    readInitialAdminWorkspaces,
    readTestHistoryRuntimeBootstrap,
    readWorkspaceBootstrapSession,
} from './runtime-selectors'

export function useIsStaticDashboardRuntime(): boolean {
    return isStaticDashboardRuntime(useRuntime())
}

export function useDashboardRuntimeBootstrapState(workspaceSlug: string | null, currentRequestUrl: string) {
    return readDashboardRuntimeBootstrap(useRuntime(), workspaceSlug, currentRequestUrl)
}

export function useTestHistoryRuntimeBootstrapState(workspaceSlug: string | null, requestedTitle: string, currentRequestUrl: string) {
    return readTestHistoryRuntimeBootstrap(useRuntime(), workspaceSlug, requestedTitle, currentRequestUrl)
}

export function useInitialAdminWorkspaces() {
    return readInitialAdminWorkspaces(useRuntime())
}

export function useAdminBootstrapSession() {
    return readAdminBootstrapSession(useRuntime())
}

export function useWorkspaceBootstrapSession(workspaceSlug: string) {
    return readWorkspaceBootstrapSession(useRuntime(), workspaceSlug)
}