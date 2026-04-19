/**
 * Назначение файла: публичная точка входа в слой безопасности с middleware,
 * JWT-утилитами и вспомогательными функциями для cookie.
 */
export {
    createAdminGuard,
    createWorkspaceApiKeyGuard,
    createWorkspaceResolver,
    createWorkspaceUserGuard,
    extractAccessToken,
    getAuthClaimsFromLocals,
    getWorkspaceAuthFromLocals,
    getWorkspaceFromLocals,
    getWorkspaceSessionCookieName,
    getWorkspaceUserAuthFromLocals,
    requireWorkspaceFromLocals,
} from './auth'
export {
    buildCookieHeader,
    buildExpiredCookieHeader,
    issueJwtToken,
    verifyJwtToken,
    type AuthKind,
    type AuthScope,
    type AuthTokenClaims,
} from './jwt'