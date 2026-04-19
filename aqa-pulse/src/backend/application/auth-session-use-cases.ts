import type { FrontendSessionStatus } from '../../frontend-bootstrap'
import { buildSessionExpiresAt, isWorkspaceReadSessionKind } from '../domain/session-rules'
import type { WorkspaceDescriptor, WorkspaceSessionKind, WorkspaceUserRole } from '../contracts'
import { issueApplicationAuthToken, verifyApplicationAuthToken } from './auth-token-service'

export interface AdminAuthRegistryPort {
    createAdminSession(expiresAt: string, label?: string): { id: string; label: string; expiresAt: string }
    getAdminSession(sessionId: string): { label: string } | null
    revokeAdminSession(sessionId: string): void
    recordAdminAudit(input: {
        action: 'admin-login' | 'admin-logout'
        actorLabel: string
        actorSessionId?: string | null
        targetType: 'admin-session'
        targetId?: string | null
        summary: string
        details?: Record<string, string | number | boolean | null | undefined>
    }): void
    authenticate(token: string): { workspace: WorkspaceDescriptor; apiKey: { id: string; label: string } } | null
    authenticateWorkspaceUser(token: string): { workspace: WorkspaceDescriptor; user: { id: string; label: string; role: WorkspaceUserRole } } | null
    createWorkspaceSession(
        slug: string,
        options: {
            kind: WorkspaceSessionKind
            subjectId: string
            label: string
            scope: 'workspace:read' | 'workspace:ingest'
            role?: WorkspaceUserRole
            expiresAt?: string | null
        },
    ): { id: string }
    revokeWorkspaceSession(slug: string, sessionId: string): WorkspaceDescriptor
    isAdminSessionActive(sessionId: string): boolean
    isWorkspaceSessionActive(slug: string, sessionId: string, kind?: WorkspaceSessionKind): boolean
}

export interface AuthSessionConfig {
    adminToken: string | null
    jwtSecret: string
    accessTokenTtlSeconds: number
    requireWorkspaceAuth: boolean
}

type AuthFailure = {
    ok: false
    statusCode: number
    error: string
}

type AuthSuccess<Body> = {
    ok: true
    sessionToken: string
    maxAgeSeconds: number
    body: Body
}

export type AdminLoginResult = AuthFailure | AuthSuccess<{
    accessToken: string
    expiresAt: string
    scope: 'admin'
}>

export type WorkspaceUserLoginResult = AuthFailure | AuthSuccess<{
    accessToken: string
    expiresAt: string
    scope: 'workspace:read'
    workspace: string
}>

export type WorkspaceApiKeyLoginResult = AuthFailure | AuthSuccess<{
    accessToken: string
    expiresAt: string
    scope: 'workspace:ingest'
    workspace: string
}>

export function loginAdmin(
    registry: AdminAuthRegistryPort,
    config: AuthSessionConfig,
    providedToken: string | null,
): AdminLoginResult {
    if (!config.adminToken) {
        return { ok: false, statusCode: 400, error: 'Admin token не настроен в конфигурации сервера.' }
    }

    if (!providedToken || providedToken !== config.adminToken) {
        return { ok: false, statusCode: 401, error: 'Неверный admin token.' }
    }

    const adminSession = registry.createAdminSession(buildSessionExpiresAt(config.accessTokenTtlSeconds))
    const issuedToken = issueApplicationAuthToken({
        subject: 'admin',
        kind: 'admin',
        scope: 'admin',
        secret: config.jwtSecret,
        ttlSeconds: config.accessTokenTtlSeconds,
        sessionId: adminSession.id,
    })

    registry.recordAdminAudit({
        action: 'admin-login',
        actorLabel: adminSession.label,
        actorSessionId: adminSession.id,
        targetType: 'admin-session',
        targetId: adminSession.id,
        summary: 'Admin session started',
        details: {
            expiresAt: adminSession.expiresAt,
        },
    })

    return {
        ok: true,
        sessionToken: issuedToken.token,
        maxAgeSeconds: config.accessTokenTtlSeconds,
        body: {
            accessToken: issuedToken.token,
            expiresAt: new Date(issuedToken.claims.exp * 1000).toISOString(),
            scope: 'admin',
        },
    }
}

export function logoutAdmin(
    registry: AdminAuthRegistryPort,
    config: Pick<AuthSessionConfig, 'jwtSecret'>,
    sessionToken: string | null,
): void {
    const claims = sessionToken ? verifyApplicationAuthToken(sessionToken, config.jwtSecret) : null

    if (claims?.kind === 'admin' && claims.scope === 'admin') {
        registry.revokeAdminSession(claims.sessionId ?? '')
        const session = registry.getAdminSession(claims.sessionId ?? '')
        registry.recordAdminAudit({
            action: 'admin-logout',
            actorLabel: session?.label ?? 'Admin session',
            actorSessionId: claims.sessionId ?? null,
            targetType: 'admin-session',
            targetId: claims.sessionId ?? null,
            summary: 'Admin session closed',
        })
    }
}

export function loginWorkspaceUser(
    registry: AdminAuthRegistryPort,
    config: Pick<AuthSessionConfig, 'jwtSecret' | 'accessTokenTtlSeconds'>,
    workspaceSlug: string,
    rawToken: string | null,
): WorkspaceUserLoginResult {
    if (!rawToken) {
        return { ok: false, statusCode: 401, error: 'Нужно передать workspace user token.' }
    }

    const authResult = registry.authenticateWorkspaceUser(rawToken)

    if (!authResult || authResult.workspace.slug !== workspaceSlug) {
        return { ok: false, statusCode: 401, error: 'Неверный workspace user token.' }
    }

    const session = registry.createWorkspaceSession(workspaceSlug, {
        kind: 'workspace-user',
        subjectId: authResult.user.id,
        label: authResult.user.label,
        scope: 'workspace:read',
        role: authResult.user.role,
        expiresAt: buildSessionExpiresAt(config.accessTokenTtlSeconds),
    })
    const issuedToken = issueApplicationAuthToken({
        subject: authResult.user.id,
        kind: 'workspace-user',
        scope: 'workspace:read',
        secret: config.jwtSecret,
        ttlSeconds: config.accessTokenTtlSeconds,
        workspaceSlug,
        role: authResult.user.role,
        sessionId: session.id,
    })

    return {
        ok: true,
        sessionToken: issuedToken.token,
        maxAgeSeconds: config.accessTokenTtlSeconds,
        body: {
            accessToken: issuedToken.token,
            expiresAt: new Date(issuedToken.claims.exp * 1000).toISOString(),
            scope: 'workspace:read',
            workspace: workspaceSlug,
        },
    }
}

export function loginWorkspaceApiKey(
    registry: AdminAuthRegistryPort,
    config: Pick<AuthSessionConfig, 'jwtSecret' | 'accessTokenTtlSeconds'>,
    workspaceSlug: string,
    rawToken: string | null,
): WorkspaceApiKeyLoginResult {
    if (!rawToken) {
        return { ok: false, statusCode: 401, error: 'Нужно передать workspace API key.' }
    }

    const authResult = registry.authenticate(rawToken)

    if (!authResult || authResult.workspace.slug !== workspaceSlug) {
        return { ok: false, statusCode: 401, error: 'Неверный workspace API key.' }
    }

    const session = registry.createWorkspaceSession(workspaceSlug, {
        kind: 'workspace-api-key',
        subjectId: authResult.apiKey.id,
        label: authResult.apiKey.label,
        scope: 'workspace:ingest',
        expiresAt: buildSessionExpiresAt(config.accessTokenTtlSeconds),
    })
    const issuedToken = issueApplicationAuthToken({
        subject: authResult.apiKey.id,
        kind: 'workspace-api-key',
        scope: 'workspace:ingest',
        secret: config.jwtSecret,
        ttlSeconds: config.accessTokenTtlSeconds,
        workspaceSlug,
        sessionId: session.id,
    })

    return {
        ok: true,
        sessionToken: issuedToken.token,
        maxAgeSeconds: config.accessTokenTtlSeconds,
        body: {
            accessToken: issuedToken.token,
            expiresAt: new Date(issuedToken.claims.exp * 1000).toISOString(),
            scope: 'workspace:ingest',
            workspace: workspaceSlug,
        },
    }
}

export function logoutWorkspaceReadSession(
    registry: AdminAuthRegistryPort,
    config: Pick<AuthSessionConfig, 'jwtSecret'>,
    workspaceSlug: string,
    sessionToken: string | null,
): void {
    const claims = sessionToken ? verifyApplicationAuthToken(sessionToken, config.jwtSecret) : null

    if ((claims?.kind === 'workspace-user' || claims?.kind === 'workspace-share-link') && claims.workspaceSlug === workspaceSlug) {
        registry.revokeWorkspaceSession(workspaceSlug, claims.sessionId ?? '')
    }
}

export function readAdminBootstrapSessionState(
    registry: Pick<AdminAuthRegistryPort, 'isAdminSessionActive'>,
    config: Pick<AuthSessionConfig, 'adminToken' | 'jwtSecret'>,
    tokens: { headerToken?: string | null; cookieToken?: string | null },
): FrontendSessionStatus {
    if (!config.adminToken) {
        return { scope: 'admin', authenticated: true, authRequired: false, workspaceSlug: null }
    }

    const token = tokens.headerToken ?? tokens.cookieToken ?? null
    const claims = token ? verifyApplicationAuthToken(token, config.jwtSecret) : null

    return {
        scope: 'admin',
        authenticated: claims?.scope === 'admin'
            && claims.kind === 'admin'
            && registry.isAdminSessionActive(claims.sessionId ?? ''),
        authRequired: true,
        workspaceSlug: null,
    }
}

export function readWorkspaceBootstrapSessionState(
    registry: Pick<AdminAuthRegistryPort, 'isAdminSessionActive' | 'isWorkspaceSessionActive'>,
    config: Pick<AuthSessionConfig, 'requireWorkspaceAuth' | 'jwtSecret'>,
    workspaceSlug: string,
    tokens: {
        adminHeaderToken?: string | null
        adminCookieToken?: string | null
        workspaceHeaderToken?: string | null
        workspaceCookieToken?: string | null
    },
): FrontendSessionStatus {
    if (!config.requireWorkspaceAuth) {
        return { scope: 'workspace', authenticated: true, authRequired: false, workspaceSlug }
    }

    const adminToken = tokens.adminHeaderToken ?? tokens.adminCookieToken ?? null
    const adminClaims = adminToken ? verifyApplicationAuthToken(adminToken, config.jwtSecret) : null

    if (adminClaims?.scope === 'admin' && adminClaims.kind === 'admin' && registry.isAdminSessionActive(adminClaims.sessionId ?? '')) {
        return { scope: 'workspace', authenticated: true, authRequired: true, workspaceSlug }
    }

    const workspaceToken = tokens.workspaceHeaderToken ?? tokens.workspaceCookieToken ?? null
    const workspaceClaims = workspaceToken ? verifyApplicationAuthToken(workspaceToken, config.jwtSecret) : null

    return {
        scope: 'workspace',
        authenticated: isWorkspaceReadSessionKind(workspaceClaims?.kind)
            && workspaceClaims.scope === 'workspace:read'
            && workspaceClaims.workspaceSlug === workspaceSlug
            && registry.isWorkspaceSessionActive(workspaceSlug, workspaceClaims.sessionId ?? '', workspaceClaims.kind),
        authRequired: true,
        workspaceSlug,
    }
}