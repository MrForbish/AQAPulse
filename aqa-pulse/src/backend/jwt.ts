/**
 * Назначение: минимальный JWT/cookie helper для admin и workspace auth flow в self-hosted backend.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export type AuthScope = 'admin' | 'workspace:read' | 'workspace:ingest'
export type AuthKind = 'admin' | 'workspace-user' | 'workspace-api-key'

export interface AuthTokenClaims {
    sub: string
    kind: AuthKind
    scope: AuthScope
    workspaceSlug?: string
    role?: string
    sessionId?: string
    iat: number
    exp: number
}

export function issueJwtToken(options: {
    subject: string
    kind: AuthKind
    scope: AuthScope
    secret: string
    ttlSeconds: number
    workspaceSlug?: string
    role?: string
    sessionId?: string
}): { token: string; claims: AuthTokenClaims } {
    const header = { alg: 'HS256', typ: 'JWT' }
    const issuedAt = Math.floor(Date.now() / 1000)
    const claims: AuthTokenClaims = {
        sub: options.subject,
        kind: options.kind,
        scope: options.scope,
        workspaceSlug: options.workspaceSlug,
        role: options.role,
        sessionId: options.sessionId,
        iat: issuedAt,
        exp: issuedAt + options.ttlSeconds,
    }

    const headerSegment = encodeBase64Url(JSON.stringify(header))
    const payloadSegment = encodeBase64Url(JSON.stringify(claims))
    const signatureSegment = signSegments(headerSegment, payloadSegment, options.secret)

    return {
        token: `${headerSegment}.${payloadSegment}.${signatureSegment}`,
        claims,
    }
}

export function verifyJwtToken(token: string, secret: string): AuthTokenClaims | null {
    const [headerSegment, payloadSegment, signatureSegment] = token.split('.')

    if (!headerSegment || !payloadSegment || !signatureSegment) {
        return null
    }

    const expectedSignature = signSegments(headerSegment, payloadSegment, secret)

    if (!safeCompare(signatureSegment, expectedSignature)) {
        return null
    }

    try {
        const header = JSON.parse(decodeBase64Url(headerSegment)) as { alg?: string; typ?: string }

        if (header.alg !== 'HS256' || header.typ !== 'JWT') {
            return null
        }

        const claims = JSON.parse(decodeBase64Url(payloadSegment)) as Partial<AuthTokenClaims>
        const now = Math.floor(Date.now() / 1000)

        if (typeof claims.sub !== 'string' || typeof claims.kind !== 'string' || typeof claims.scope !== 'string') {
            return null
        }

        if (typeof claims.iat !== 'number' || typeof claims.exp !== 'number' || claims.exp <= now) {
            return null
        }

        return {
            sub: claims.sub,
            kind: claims.kind as AuthKind,
            scope: claims.scope as AuthScope,
            workspaceSlug: typeof claims.workspaceSlug === 'string' ? claims.workspaceSlug : undefined,
            role: typeof claims.role === 'string' ? claims.role : undefined,
            sessionId: typeof claims.sessionId === 'string' ? claims.sessionId : undefined,
            iat: claims.iat,
            exp: claims.exp,
        }
    } catch {
        return null
    }
}

export function buildCookieHeader(options: {
    name: string
    value: string
    maxAgeSeconds: number
    path?: string
    httpOnly?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
    secure?: boolean
}): string {
    const parts = [`${options.name}=${encodeURIComponent(options.value)}`]

    parts.push(`Max-Age=${options.maxAgeSeconds}`)
    parts.push(`Path=${options.path ?? '/'}`)
    parts.push(`SameSite=${options.sameSite ?? 'Lax'}`)

    if (options.httpOnly !== false) {
        parts.push('HttpOnly')
    }

    if (options.secure) {
        parts.push('Secure')
    }

    return parts.join('; ')
}

export function buildExpiredCookieHeader(name: string, path = '/'): string {
    return `${name}=; Max-Age=0; Path=${path}; HttpOnly; SameSite=Lax`
}

function signSegments(headerSegment: string, payloadSegment: string, secret: string): string {
    return createHmac('sha256', secret)
        .update(`${headerSegment}.${payloadSegment}`)
        .digest('base64url')
}

function encodeBase64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url')
}

function decodeBase64Url(value: string): string {
    return Buffer.from(value, 'base64url').toString('utf8')
}

function safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)

    if (leftBuffer.length !== rightBuffer.length) {
        return false
    }

    return timingSafeEqual(leftBuffer, rightBuffer)
}


