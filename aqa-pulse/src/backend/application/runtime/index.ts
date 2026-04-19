/**
 * Назначение файла: grouped facade для runtime-oriented application query use cases и auth flows.
 */
export {
    loginViaWorkspaceShareLinkToken,
    openWorkspaceShareLink,
    type WorkspaceShareLinkAuthConfig,
    type WorkspaceShareLinkOpenResult,
    type WorkspaceShareLinkRegistryPort,
    type WorkspaceShareLinkTokenLoginResult,
} from '../workspace-share-link-use-cases'
export {
    queryDashboardCostMetricsPayload,
    queryDashboardErrorClustersPayload,
    queryDashboardFlakyPayload,
    queryDashboardRunById,
    queryDashboardRuns,
    queryDashboardSummary,
    queryTestHistoryForApi,
    queryTestHistoryForShell,
} from '../dashboard-query-use-cases'
export {
    loginWorkspaceApiKey,
    loginWorkspaceUser,
    logoutWorkspaceReadSession,
    readWorkspaceBootstrapSessionState,
    type AuthSessionConfig,
    type WorkspaceApiKeyLoginResult,
    type WorkspaceUserLoginResult,
} from '../auth-session-use-cases'