import {
    issueAuthToken,
    verifyAuthToken,
    type AuthKind,
    type AuthScope,
    type AuthTokenClaims,
} from '../auth-token-codec'

export interface ApplicationAuthTokenService {
    issueToken(options: {
        subject: string
        kind: AuthKind
        scope: AuthScope
        secret: string
        ttlSeconds: number
        workspaceSlug?: string
        role?: string
        sessionId?: string
    }): { token: string; claims: AuthTokenClaims }
    verifyToken(token: string, secret: string): AuthTokenClaims | null
}

const defaultApplicationAuthTokenService: ApplicationAuthTokenService = {
    issueToken: issueAuthToken,
    verifyToken: verifyAuthToken,
}

export function issueApplicationAuthToken(options: {
    subject: string
    kind: AuthKind
    scope: AuthScope
    secret: string
    ttlSeconds: number
    workspaceSlug?: string
    role?: string
    sessionId?: string
}): { token: string; claims: AuthTokenClaims } {
    return defaultApplicationAuthTokenService.issueToken(options)
}

export function verifyApplicationAuthToken(token: string, secret: string): AuthTokenClaims | null {
    return defaultApplicationAuthTokenService.verifyToken(token, secret)
}

export type { AuthKind, AuthScope, AuthTokenClaims }