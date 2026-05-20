/**
 * Назначение: единая точка экспорта для admin hooks.
 */
export type { DashboardActionResult, DashboardCopyItem } from './admin-dashboard-hooks'
export { useAdminDashboardState } from './admin-dashboard-hooks'
export {
    useAdminLoginAction,
    useAdminLoginRedirect,
    useWorkspaceApiKeyExchangeAction,
    useWorkspaceLoginAction,
    useWorkspaceLoginRedirect,
} from './admin-auth-hooks'
