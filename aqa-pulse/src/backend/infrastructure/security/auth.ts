import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { isWorkspaceReadSessionKind } from '../../domain/session-rules'
import type { WorkspaceApiAuthResult, WorkspaceDescriptor, WorkspaceUserAuthResult } from '../../contracts'
import type { SaasAppConfig } from '../../config'
import type { AuthTokenClaims } from './jwt'
import { verifyJwtToken } from './jwt'
import { WorkspaceRegistry } from '../persistence/workspace-registry'

interface AqaPulseLocals {
    aqaPulseWorkspace?: WorkspaceDescriptor
    aqaPulseWorkspaceAuth?: WorkspaceApiAuthResult
    aqaPulseWorkspaceUserAuth?: WorkspaceUserAuthResult
    aqaPulseAuthClaims?: AuthTokenClaims
}

type UnauthorizedResponseMode = 'json' | 'redirect'

interface GuardOptions {
    unauthorizedResponseMode?: UnauthorizedResponseMode
}

export function createAdminGuard(registry: WorkspaceRegistry, config: SaasAppConfig, options: GuardOptions = {}): RequestHandler {
    const unauthorizedResponseMode = options.unauthorizedResponseMode ?? 'json'

    return (request: Request, response: Response, next: NextFunction) => {
        if (!config.adminToken) {
            next()
            return
        }

        const token = extractAccessToken(request, 'x-admin-token')
            ?? getCookie(request, config.adminSessionCookieName)

        if (!token) {
            handleUnauthorized(response, {
                responseMode: unauthorizedResponseMode,
                redirectUrl: '/admin/login',
                jsonMessage: 'Требуется admin session или Bearer JWT.',
            })
            return
        }

        const claims = verifyJwtToken(token, config.jwtSecret)

        if (claims?.scope === 'admin' && claims.kind === 'admin' && registry.isAdminSessionActive(claims.sessionId ?? '')) {
            registry.touchAdminSession(claims.sessionId ?? '')
            setAuthClaimsToLocals(response, claims)
            next()
            return
        }

        handleUnauthorized(response, {
            responseMode: unauthorizedResponseMode,
            redirectUrl: '/admin/login',
            jsonMessage: 'Требуется admin session или Bearer JWT.',
        })
    }
}

export function createWorkspaceResolver(registry: WorkspaceRegistry): RequestHandler {
    return (request: Request, response: Response, next: NextFunction) => {
        const slug = getRouteParam(request, 'slug')
        const workspace = registry.getWorkspace(slug)

        if (!workspace) {
            response.status(404).json({ error: `Workspace со slug "${slug}" не найден.` })
            return
        }

        setWorkspaceToLocals(response, workspace)
        next()
    }
}

export function createWorkspaceApiKeyGuard(registry: WorkspaceRegistry, config: SaasAppConfig): RequestHandler {
    return (request: Request, response: Response, next: NextFunction) => {
        const workspace = getWorkspaceFromLocals(response)

        if (!workspace) {
            response.status(500).json({ error: 'Workspace context не подготовлен для запроса.' })
            return
        }

        const token = extractAccessToken(request, 'x-api-key')

        if (!token) {
            response.status(401).json({ error: 'Требуется ingestion JWT через Authorization: Bearer <token>.' })
            return
        }

        const claims = verifyJwtToken(token, config.jwtSecret)

        if (!claims || claims.kind !== 'workspace-api-key' || claims.scope !== 'workspace:ingest') {
            response.status(401).json({ error: 'Ingestion JWT не распознан или scope некорректен.' })
            return
        }

        if (claims.workspaceSlug !== workspace.slug) {
            response.status(403).json({ error: 'Ingestion JWT принадлежит другому workspace.' })
            return
        }

        if (!registry.isWorkspaceSessionActive(workspace.slug, claims.sessionId ?? '', 'workspace-api-key')) {
            response.status(401).json({ error: 'Ingestion JWT отозван, истёк или больше не активен.' })
            return
        }

        const workspaceRecord = registry.getWorkspaceRecord(workspace.slug)
        const apiKey = workspaceRecord?.apiKeys.find((item) => item.id === claims.sub && !item.disabledAt)

        if (!workspaceRecord || !apiKey) {
            response.status(401).json({ error: 'Ключ загрузки больше не активен.' })
            return
        }

        registry.touchWorkspaceSession(workspace.slug, claims.sessionId ?? '')
        setWorkspaceAuthToLocals(response, { workspace: workspaceRecord, apiKey })
        setAuthClaimsToLocals(response, claims)
        next()
    }
}

export function createWorkspaceUserGuard(registry: WorkspaceRegistry, config: SaasAppConfig, options: GuardOptions = {}): RequestHandler {
    const unauthorizedResponseMode = options.unauthorizedResponseMode ?? 'json'

    return (request: Request, response: Response, next: NextFunction) => {
        if (!config.requireWorkspaceAuth) {
            next()
            return
        }

        const workspace = getWorkspaceFromLocals(response)

        if (!workspace) {
            response.status(500).json({ error: 'Workspace context не подготовлен для запроса.' })
            return
        }

        const adminToken = extractAccessToken(request, 'x-admin-token')
            ?? getCookie(request, config.adminSessionCookieName)

        const adminClaims = adminToken ? verifyJwtToken(adminToken, config.jwtSecret) : null

        if (adminClaims?.scope === 'admin' && adminClaims.kind === 'admin' && registry.isAdminSessionActive(adminClaims.sessionId ?? '')) {
            registry.touchAdminSession(adminClaims.sessionId ?? '')
            setAuthClaimsToLocals(response, adminClaims)
            next()
            return
        }

        const token = extractAccessToken(request, 'x-workspace-token')
            ?? getCookie(request, getWorkspaceSessionCookieName(config, workspace.slug))

        if (!token) {
            handleUnauthorized(response, {
                responseMode: unauthorizedResponseMode,
                redirectUrl: `/w/${encodeURIComponent(workspace.slug)}/login`,
                jsonMessage: 'Требуется workspace session или Bearer JWT.',
            })
            return
        }

        const claims = verifyJwtToken(token, config.jwtSecret)

        if (!claims || !isWorkspaceReadSessionKind(claims.kind) || claims.scope !== 'workspace:read') {
            handleUnauthorized(response, {
                responseMode: unauthorizedResponseMode,
                redirectUrl: `/w/${encodeURIComponent(workspace.slug)}/login`,
                jsonMessage: 'Workspace JWT не распознан или scope некорректен.',
            })
            return
        }

        if (claims.workspaceSlug !== workspace.slug) {
            response.status(403).json({ error: 'Workspace JWT принадлежит другому workspace.' })
            return
        }

        if (!registry.isWorkspaceSessionActive(workspace.slug, claims.sessionId ?? '', claims.kind)) {
            handleUnauthorized(response, {
                responseMode: unauthorizedResponseMode,
                redirectUrl: `/w/${encodeURIComponent(workspace.slug)}/login`,
                jsonMessage: 'Workspace session отозвана, истекла или больше не активна.',
            })
            return
        }

        if (claims.kind === 'workspace-share-link') {
            registry.touchWorkspaceSession(workspace.slug, claims.sessionId ?? '')
            setAuthClaimsToLocals(response, claims)
            next()
            return
        }

        const workspaceRecord = registry.getWorkspaceRecord(workspace.slug)
        const user = workspaceRecord?.users.find((item) => item.id === claims.sub && !item.disabledAt)

        if (!workspaceRecord || !user) {
            handleUnauthorized(response, {
                responseMode: unauthorizedResponseMode,
                redirectUrl: `/w/${encodeURIComponent(workspace.slug)}/login`,
                jsonMessage: 'Workspace user больше не активен.',
            })
            return
        }

        registry.touchWorkspaceSession(workspace.slug, claims.sessionId ?? '')
        setWorkspaceUserAuthToLocals(response, { workspace: workspaceRecord, user })
        setAuthClaimsToLocals(response, claims)
        next()
    }
}

export function getWorkspaceFromLocals(response: Response): WorkspaceDescriptor | null {
    const locals = response.locals as AqaPulseLocals
    return locals.aqaPulseWorkspace ?? null
}

export function requireWorkspaceFromLocals(response: Response): WorkspaceDescriptor {
    const workspace = getWorkspaceFromLocals(response)

    if (!workspace) {
        throw new Error('Workspace context не подготовлен для запроса.')
    }

    return workspace
}

export function getWorkspaceAuthFromLocals(response: Response): WorkspaceApiAuthResult | null {
    const locals = response.locals as AqaPulseLocals
    return locals.aqaPulseWorkspaceAuth ?? null
}

export function getWorkspaceUserAuthFromLocals(response: Response): WorkspaceUserAuthResult | null {
    const locals = response.locals as AqaPulseLocals
    return locals.aqaPulseWorkspaceUserAuth ?? null
}

export function getAuthClaimsFromLocals(response: Response): AuthTokenClaims | null {
    const locals = response.locals as AqaPulseLocals
    return locals.aqaPulseAuthClaims ?? null
}

export function getWorkspaceSessionCookieName(config: Pick<SaasAppConfig, 'workspaceSessionCookiePrefix'>, slug: string): string {
    return `${config.workspaceSessionCookiePrefix}_${slug}`
}

export function extractAccessToken(request: Request, fallbackHeaderName: string): string | null {
    const bearerToken = request.header('authorization')?.replace(/^Bearer\s+/i, '').trim()
    const fallbackToken = request.header(fallbackHeaderName)?.trim()
    const token = bearerToken || fallbackToken
    return token && token.length > 0 ? token : null
}

function setWorkspaceToLocals(response: Response, workspace: WorkspaceDescriptor): void {
    const locals = response.locals as AqaPulseLocals
    locals.aqaPulseWorkspace = workspace
}

function setWorkspaceAuthToLocals(response: Response, authResult: WorkspaceApiAuthResult): void {
    const locals = response.locals as AqaPulseLocals
    locals.aqaPulseWorkspaceAuth = authResult
}

function setWorkspaceUserAuthToLocals(response: Response, authResult: WorkspaceUserAuthResult): void {
    const locals = response.locals as AqaPulseLocals
    locals.aqaPulseWorkspaceUserAuth = authResult
}

function setAuthClaimsToLocals(response: Response, claims: AuthTokenClaims): void {
    const locals = response.locals as AqaPulseLocals
    locals.aqaPulseAuthClaims = claims
}

function getRouteParam(request: Request, key: string): string {
    const value = request.params[key]
    return Array.isArray(value) ? value[0] : value
}

function getCookie(request: Request, name: string): string | null {
    const cookieHeader = request.header('cookie')

    if (!cookieHeader) {
        return null
    }

    const cookiePart = cookieHeader
        .split(';')
        .map((entry: string) => entry.trim())
        .find((entry: string) => entry.startsWith(`${name}=`))

    if (!cookiePart) {
        return null
    }

    return decodeURIComponent(cookiePart.slice(name.length + 1))
}

function handleUnauthorized(
    response: Response,
    options: { responseMode: UnauthorizedResponseMode; redirectUrl: string; jsonMessage: string },
): void {
    if (options.responseMode === 'redirect') {
        response.redirect(options.redirectUrl)
        return
    }

    response.status(401).json({ error: options.jsonMessage })
}
