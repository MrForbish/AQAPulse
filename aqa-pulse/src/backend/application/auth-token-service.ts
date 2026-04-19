/**
 * Назначение файла: адаптер уровня приложения над общим механизмом JWT,
 * чтобы сценарии приложения не зависели напрямую от инфраструктуры.
 */
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

/**
 * Выпускает токен доступа через общий механизм JWT,
 * сохраняя стабильный интерфейс для сценариев приложения.
 */
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

/**
 * Проверяет токен доступа и возвращает его содержимое только для корректного токена.
 */
export function verifyApplicationAuthToken(token: string, secret: string): AuthTokenClaims | null {
    return defaultApplicationAuthTokenService.verifyToken(token, secret)
}

export type { AuthKind, AuthScope, AuthTokenClaims }