/**
 * Назначение: тонкая export-boundary для admin auth/login hooks и dashboard provisioning state.
 */
export type { DashboardActionResult } from './admin-dashboard-hooks'
export { useAdminDashboardState } from './admin-dashboard-hooks'
export {
    useAdminLoginAction,
    useAdminLoginRedirect,
    useWorkspaceApiKeyExchangeAction,
    useWorkspaceLoginAction,
    useWorkspaceLoginRedirect,
} from './admin-auth-hooks'
