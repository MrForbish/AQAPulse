import type { WorkspaceShareLinkProvisioningResult } from '../contracts'
import {
    recordAdminAuditIfNeeded,
    type AdminActorContext,
    type AdminWorkspaceCommandRuntime,
    type AdminWorkspaceRegistryPort,
} from './admin-workspace-use-case-support'

export function createWorkspaceShareLinkCommand(
    registry: AdminWorkspaceRegistryPort,
    runtime: Pick<AdminWorkspaceCommandRuntime, 'buildWorkspaceShareLinkUrl' | 'createShareLinkSubjectId'>,
    input: { workspaceSlug: string; ttlMinutes: number; actor?: AdminActorContext | null },
): WorkspaceShareLinkProvisioningResult {
    const session = registry.createWorkspaceSession(input.workspaceSlug, {
        kind: 'workspace-share-link',
        subjectId: runtime.createShareLinkSubjectId(),
        label: `Share link (${input.ttlMinutes}m)`,
        scope: 'workspace:read',
        activatedAt: null,
        expiresAt: null,
        ttlMinutes: input.ttlMinutes,
    })
    const workspace = registry.getWorkspace(input.workspaceSlug)

    if (!workspace) {
        throw new Error(`Workspace со slug "${input.workspaceSlug}" не найден.`)
    }

    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-share-link-created',
        workspaceSlug: input.workspaceSlug,
        targetType: 'session',
        targetId: session.id,
        summary: 'Workspace share link created',
        details: {
            workspace: input.workspaceSlug,
            sessionId: session.id,
            ttlMinutes: input.ttlMinutes,
            activationMode: 'first-open',
        },
    })

    return {
        workspace,
        shareSession: {
            id: session.id,
            label: session.label,
            activatedAt: session.activatedAt,
            expiresAt: session.expiresAt,
            ttlMinutes: session.ttlMinutes ?? input.ttlMinutes,
        },
        shareLinkUrl: runtime.buildWorkspaceShareLinkUrl(input.workspaceSlug, session.id),
    }
}