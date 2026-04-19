import type { Response } from 'express'
import { getAuthClaimsFromLocals } from '../security'
import type { AdminActorRegistry } from '../persistence'

export function resolveAdminActor(response: Response, registry: AdminActorRegistry): { label: string; sessionId: string | null } {
    const claims = getAuthClaimsFromLocals(response)

    if (claims?.kind === 'admin' && claims.scope === 'admin') {
        const session = registry.getAdminSession(claims.sessionId ?? '')

        return {
            label: session?.label ?? 'Admin session',
            sessionId: claims.sessionId ?? null,
        }
    }

    return {
        label: 'Admin session',
        sessionId: null,
    }
}