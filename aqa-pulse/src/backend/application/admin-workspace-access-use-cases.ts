/**
 * Назначение файла: содержит admin-команды для API-ключей, пользователей,
 * ролей и отзыва активных сессий.
 */
import type { WorkspaceDescriptor, WorkspaceProvisioningResult, WorkspaceUserProvisioningResult, WorkspaceUserRole, WorkspaceUserRoleUpdateResult } from '../contracts'
import { normalizeWorkspaceUserRole, requireNonEmptyText } from '../domain/workspace-rules'
import {
    recordAdminAuditIfNeeded,
    type AdminActorContext,
    type AdminWorkspaceRegistryPort,
} from './admin-workspace-use-case-support'

export function createWorkspaceApiKeyCommand(
    registry: AdminWorkspaceRegistryPort,
    input: { workspaceSlug: string; label?: string | null; actor?: AdminActorContext | null },
): WorkspaceProvisioningResult {
    const createdApiKey = registry.createApiKey(input.workspaceSlug, input.label ?? 'Generated key')
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-api-key-created',
        workspaceSlug: input.workspaceSlug,
        targetType: 'api-key',
        targetId: createdApiKey.apiKey.id,
        summary: 'Workspace API key created',
        details: {
            workspace: input.workspaceSlug,
            label: createdApiKey.apiKey.label,
            apiKeyId: createdApiKey.apiKey.id,
        },
    })

    return createdApiKey
}

export function createWorkspaceUserCommand(
    registry: AdminWorkspaceRegistryPort,
    input: { workspaceSlug: string; label: string | null; role?: WorkspaceUserRole; actor?: AdminActorContext | null },
): WorkspaceUserProvisioningResult {
    const label = requireNonEmptyText(input.label, 'Поле "label" обязательно.')
    const createdUser = registry.createUser(input.workspaceSlug, {
        label,
        role: normalizeWorkspaceUserRole(input.role),
    })

    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-user-created',
        workspaceSlug: input.workspaceSlug,
        targetType: 'user',
        targetId: createdUser.user.id,
        summary: 'Workspace user created',
        details: {
            workspace: input.workspaceSlug,
            label: createdUser.user.label,
            role: createdUser.user.role,
            userId: createdUser.user.id,
        },
    })

    return createdUser
}

export function updateWorkspaceUserRoleCommand(
    registry: AdminWorkspaceRegistryPort,
    input: { workspaceSlug: string; userId: string; role?: WorkspaceUserRole; actor?: AdminActorContext | null },
): WorkspaceUserRoleUpdateResult {
    const result = registry.updateUserRole(input.workspaceSlug, input.userId, normalizeWorkspaceUserRole(input.role))
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-user-role-updated',
        workspaceSlug: input.workspaceSlug,
        targetType: 'user',
        targetId: result.userId,
        summary: 'Workspace user role updated',
        details: {
            workspace: input.workspaceSlug,
            userId: result.userId,
            role: result.role,
        },
    })

    return result
}

export function disableWorkspaceApiKeyCommand(
    registry: AdminWorkspaceRegistryPort,
    input: { workspaceSlug: string; apiKeyId: string; actor?: AdminActorContext | null },
): { workspace: WorkspaceDescriptor } {
    const workspace = registry.disableApiKey(input.workspaceSlug, input.apiKeyId)
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-api-key-disabled',
        workspaceSlug: input.workspaceSlug,
        targetType: 'api-key',
        targetId: input.apiKeyId,
        summary: 'Workspace API key disabled',
        details: {
            workspace: input.workspaceSlug,
            apiKeyId: input.apiKeyId,
        },
    })

    return { workspace }
}

export function deleteWorkspaceApiKeyCommand(
    registry: AdminWorkspaceRegistryPort,
    input: { workspaceSlug: string; apiKeyId: string; actor?: AdminActorContext | null },
): { workspace: WorkspaceDescriptor } {
    const workspace = registry.deleteApiKey(input.workspaceSlug, input.apiKeyId)
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-api-key-deleted',
        workspaceSlug: input.workspaceSlug,
        targetType: 'api-key',
        targetId: input.apiKeyId,
        summary: 'Workspace API key deleted',
        details: {
            workspace: input.workspaceSlug,
            apiKeyId: input.apiKeyId,
        },
    })

    return { workspace }
}

export function disableWorkspaceUserCommand(
    registry: AdminWorkspaceRegistryPort,
    input: { workspaceSlug: string; userId: string; actor?: AdminActorContext | null },
): { workspace: WorkspaceDescriptor } {
    const workspace = registry.disableUser(input.workspaceSlug, input.userId)
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-user-disabled',
        workspaceSlug: input.workspaceSlug,
        targetType: 'user',
        targetId: input.userId,
        summary: 'Workspace user disabled',
        details: {
            workspace: input.workspaceSlug,
            userId: input.userId,
        },
    })

    return { workspace }
}

export function deleteWorkspaceUserCommand(
    registry: AdminWorkspaceRegistryPort,
    input: { workspaceSlug: string; userId: string; actor?: AdminActorContext | null },
): { workspace: WorkspaceDescriptor } {
    const workspace = registry.deleteUser(input.workspaceSlug, input.userId)
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-user-deleted',
        workspaceSlug: input.workspaceSlug,
        targetType: 'user',
        targetId: input.userId,
        summary: 'Workspace user deleted',
        details: {
            workspace: input.workspaceSlug,
            userId: input.userId,
        },
    })

    return { workspace }
}

export function revokeWorkspaceSessionCommand(
    registry: AdminWorkspaceRegistryPort,
    input: { workspaceSlug: string; sessionId: string; actor?: AdminActorContext | null },
): { workspace: WorkspaceDescriptor } {
    const workspace = registry.revokeWorkspaceSession(input.workspaceSlug, input.sessionId)
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-session-revoked',
        workspaceSlug: input.workspaceSlug,
        targetType: 'session',
        targetId: input.sessionId,
        summary: 'Workspace session revoked',
        details: {
            workspace: input.workspaceSlug,
            sessionId: input.sessionId,
        },
    })

    return { workspace }
}