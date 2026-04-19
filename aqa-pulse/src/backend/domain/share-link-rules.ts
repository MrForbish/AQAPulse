export function normalizeShareLinkTtlMinutes(value: unknown): number {
    return value === 5 ? 5 : 10
}

export function getSessionRemainingSeconds(expiresAt: string | null): number {
    if (!expiresAt) {
        return 0
    }

    const expiresAtMs = Date.parse(expiresAt)

    if (!Number.isFinite(expiresAtMs)) {
        return 0
    }

    return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
}