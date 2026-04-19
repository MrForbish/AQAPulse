/**
 * Назначение файла: публичный entrypoint HTTP infrastructure слоя, который собирает route registrars,
 * request helpers и transport-specific adapters для backend composition root.
 */
export { registerAdminRoutes, type AdminRoutesContext } from './admin-routes'
export { createAdminRoutesContext, type AdminSecurityRuntime } from './admin-routes-context'
export {
    readAdminBootstrapSession,
    readWorkspaceBootstrapSession,
} from './bootstrap-session-readers'
export { readCookieValue } from './cookies'
export { ensureDevBootstrapEnabled } from './dev-bootstrap-middleware'
export { registerCommonHttpErrorHandlers } from './error-handlers'
export { buildFrontendServiceUrls } from './frontend-service-urls'
export { sendArtifactFile } from './artifact-file-response'
export { normalizeIngestionPayload } from './ingestion-payload'
export {
    getFiltersFromRequest,
    getRouteParam,
    normalizePaginationQueryValue,
    pickOptionalString,
    pickQueryParam,
} from './request-inputs'
export { registerRuntimeRoutes, type RuntimeRoutesContext } from './runtime-routes'
export { createRuntimeRoutesContext, type WorkspaceSecurityRuntime } from './runtime-routes-context'
export {
    buildWorkspaceShareLinkUrl,
    sendUnknownWorkspaceShareLinkErrorHtml,
    sendWorkspaceShareLinkErrorShell,
} from './workspace-share-link-http'