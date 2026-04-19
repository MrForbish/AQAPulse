/**
 * Назначение: минимальный JWT/cookie helper для admin и workspace auth flow в self-hosted backend.
 */
export {
    issueAuthToken as issueJwtToken,
    verifyAuthToken as verifyJwtToken,
    type AuthKind,
    type AuthScope,
    type AuthTokenClaims,
} from '../../auth-token-codec'

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
