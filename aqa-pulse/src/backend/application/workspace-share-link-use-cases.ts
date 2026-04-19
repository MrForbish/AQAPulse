/**
 * Назначение файла: содержит application use cases открытия share link и входа по share-link token.
 */
import type { WorkspaceSessionKind } from '../contracts'
import { getSessionRemainingSeconds } from '../domain/share-link-rules'
import { issueApplicationAuthToken, verifyApplicationAuthToken } from './auth-token-service'

interface ShareLinkSession {
    id: string
    subjectId: string
    activatedAt: string | null
    expiresAt: string | null
}

interface ShareLinkSessionLookup {
    workspace: { slug: string }
    session: ShareLinkSession
}

export interface WorkspaceShareLinkRegistryPort {
    findWorkspaceSession(sessionId: string, kind?: WorkspaceSessionKind): ShareLinkSessionLookup | null
    activateWorkspaceShareLink(slug: string, sessionId: string): ShareLinkSession
    isWorkspaceSessionActive(slug: string, sessionId: string, kind?: WorkspaceSessionKind): boolean
    touchWorkspaceSession(slug: string, sessionId: string): void
}

export interface WorkspaceShareLinkAuthConfig {
    jwtSecret: string
}

export type WorkspaceShareLinkOpenResult =
    | { ok: false; kind: 'unknown'; statusCode: 404 }
    | { ok: false; kind: 'error'; statusCode: 400 | 401; workspaceSlug: string; title: string; message: string }
    | { ok: true; workspaceSlug: string; sessionToken: string; maxAgeSeconds: number; redirectPath: string }

export type WorkspaceShareLinkTokenLoginResult =
    | { ok: false; statusCode: 400 | 401; workspaceSlug: string; title: string; message: string }
    | { ok: true; workspaceSlug: string; sessionToken: string; maxAgeSeconds: number; redirectPath: string }

export function openWorkspaceShareLink(
    registry: WorkspaceShareLinkRegistryPort,
    config: WorkspaceShareLinkAuthConfig,
    shareId: string,
): WorkspaceShareLinkOpenResult {
    const resolvedShareSession = registry.findWorkspaceSession(shareId, 'workspace-share-link')

    if (!resolvedShareSession) {
        return { ok: false, kind: 'unknown', statusCode: 404 }
    }

    const workspaceSlug = resolvedShareSession.workspace.slug
    const shareSession = !resolvedShareSession.session.activatedAt
        ? registry.activateWorkspaceShareLink(workspaceSlug, resolvedShareSession.session.id)
        : resolvedShareSession.session

    if (!registry.isWorkspaceSessionActive(workspaceSlug, shareSession.id, 'workspace-share-link')) {
        return {
            ok: false,
            kind: 'error',
            statusCode: 401,
            workspaceSlug,
            title: 'Ссылка отозвана',
            message: 'Эта временная ссылка уже отозвана или её сессия истекла. Запроси новую share link в админке.',
        }
    }

    const maxAgeSeconds = getSessionRemainingSeconds(shareSession.expiresAt)

    if (maxAgeSeconds <= 0) {
        return {
            ok: false,
            kind: 'error',
            statusCode: 401,
            workspaceSlug,
            title: 'Ссылка истекла или некорректна',
            message: 'Эта временная ссылка больше не даёт доступ к dashboard. Запроси новую share link или войди через workspace user token.',
        }
    }

    const issuedToken = issueApplicationAuthToken({
        subject: shareSession.subjectId,
        kind: 'workspace-share-link',
        scope: 'workspace:read',
        secret: config.jwtSecret,
        ttlSeconds: maxAgeSeconds,
        workspaceSlug,
        sessionId: shareSession.id,
    })

    registry.touchWorkspaceSession(workspaceSlug, shareSession.id)

    return {
        ok: true,
        workspaceSlug,
        sessionToken: issuedToken.token,
        maxAgeSeconds,
        redirectPath: `/w/${encodeURIComponent(workspaceSlug)}`,
    }
}

export function loginViaWorkspaceShareLinkToken(
    registry: WorkspaceShareLinkRegistryPort,
    config: WorkspaceShareLinkAuthConfig,
    workspaceSlug: string,
    token: string | null,
): WorkspaceShareLinkTokenLoginResult {
    if (!token) {
        return {
            ok: false,
            statusCode: 400,
            workspaceSlug,
            title: 'Ссылка неполная',
            message: 'Во временной ссылке отсутствует token. Запроси новую ссылку в админке или открой обычный workspace login.',
        }
    }

    const claims = verifyApplicationAuthToken(token, config.jwtSecret)

    if (!claims || claims.kind !== 'workspace-share-link' || claims.scope !== 'workspace:read' || claims.workspaceSlug !== workspaceSlug) {
        return {
            ok: false,
            statusCode: 401,
            workspaceSlug,
            title: 'Ссылка истекла или некорректна',
            message: 'Эта временная ссылка больше не даёт доступ к dashboard. Запроси новую share link или войди через workspace user token.',
        }
    }

    if (!registry.isWorkspaceSessionActive(workspaceSlug, claims.sessionId ?? '', 'workspace-share-link')) {
        return {
            ok: false,
            statusCode: 401,
            workspaceSlug,
            title: 'Ссылка отозвана',
            message: 'Эта временная ссылка уже отозвана или её сессия истекла. Запроси новую share link в админке.',
        }
    }

    const maxAgeSeconds = Math.max(0, claims.exp - Math.floor(Date.now() / 1000))

    registry.touchWorkspaceSession(workspaceSlug, claims.sessionId ?? '')

    return {
        ok: true,
        workspaceSlug,
        sessionToken: token,
        maxAgeSeconds,
        redirectPath: `/w/${encodeURIComponent(workspaceSlug)}`,
    }
}