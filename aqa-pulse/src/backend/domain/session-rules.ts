/**
 * Назначение файла: содержит правила для времени жизни сессий,
 * проверки их активности и поведения сессий по общей ссылке.
 */
import type { WorkspaceSessionKind } from '../contracts'

export function buildSessionExpiresAt(ttlSeconds: number, nowMs = Date.now()): string {
    return new Date(nowMs + ttlSeconds * 1000).toISOString()
}

export function isSessionActive(
    session: { expiresAt: string | null; revokedAt: string | null } | undefined,
    nowMs = Date.now(),
): boolean {
    if (!session || session.revokedAt || !session.expiresAt) {
        return false
    }

    const expiresAtMs = Date.parse(session.expiresAt)
    return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs
}

export function inferShareLinkTtlMinutes(label: string): number {
    const ttlMatch = label.match(/\((\d+)m\)/i)
    const ttlMinutes = ttlMatch ? Number(ttlMatch[1]) : Number.NaN

    return Number.isInteger(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 10
}

export function shouldRefreshLastSeen(lastSeenAt: string, nowIso: string, refreshIntervalMs = 60_000): boolean {
    const lastSeenTime = Date.parse(lastSeenAt)
    const nowTime = Date.parse(nowIso)

    if (!Number.isFinite(lastSeenTime) || !Number.isFinite(nowTime)) {
        return true
    }

    return nowTime - lastSeenTime >= refreshIntervalMs
}

export function isWorkspaceReadSessionKind(kind: WorkspaceSessionKind | string | undefined): kind is 'workspace-user' | 'workspace-share-link' {
    return kind === 'workspace-user' || kind === 'workspace-share-link'
}
