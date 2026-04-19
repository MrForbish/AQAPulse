import type {
    ServerSettingsRecord,
    UpdateServerSettingsInput,
    WorkspaceDescriptor,
    WorkspaceProvisioningResult,
    WorkspaceShareLinkProvisioningResult,
    WorkspaceUpdateResult,
    WorkspaceUserProvisioningResult,
    WorkspaceUserRole,
    WorkspaceUserRoleUpdateResult,
} from '../contracts'
import { normalizeWorkspaceUserRole, requireNonEmptyText } from '../domain/workspace-rules'

export interface AdminActorContext {
    label: string
    sessionId: string | null
}

export interface AdminWorkspaceRegistryPort {
    createWorkspace(input: { name: string; slug?: string; apiKeyLabel?: string }): WorkspaceProvisioningResult
    getWorkspace(slug: string): WorkspaceDescriptor | null
    listWorkspaces(): WorkspaceDescriptor[]
    createApiKey(slug: string, label?: string): WorkspaceProvisioningResult
    createUser(slug: string, input: { label: string; role?: WorkspaceUserRole }): WorkspaceUserProvisioningResult
    updateWorkspace(slug: string, input: { name: string; slug?: string }): WorkspaceUpdateResult
    deleteWorkspace(slug: string): WorkspaceDescriptor
    createWorkspaceSession(
        slug: string,
        options: {
            kind: 'workspace-share-link'
            subjectId: string
            label: string
            scope: 'workspace:read'
            activatedAt: null
            expiresAt: null
            ttlMinutes: number
        },
    ): {
        id: string
        label: string
        activatedAt: string | null
        expiresAt: string | null
        ttlMinutes: number | null
    }
    updateUserRole(slug: string, userId: string, role: WorkspaceUserRole): WorkspaceUserRoleUpdateResult
    disableApiKey(slug: string, apiKeyId: string): WorkspaceDescriptor
    deleteApiKey(slug: string, apiKeyId: string): WorkspaceDescriptor
    disableUser(slug: string, userId: string): WorkspaceDescriptor
    deleteUser(slug: string, userId: string): WorkspaceDescriptor
    revokeWorkspaceSession(slug: string, sessionId: string): WorkspaceDescriptor
    updateServerSettings(input: UpdateServerSettingsInput, defaults: ServerSettingsRecord): ServerSettingsRecord
    recordAdminAudit(input: {
        action:
            | 'workspace-created'
            | 'workspace-updated'
            | 'workspace-deleted'
            | 'workspace-api-key-created'
            | 'workspace-api-key-disabled'
            | 'workspace-api-key-deleted'
            | 'workspace-user-created'
            | 'workspace-user-disabled'
            | 'workspace-user-deleted'
            | 'workspace-user-role-updated'
            | 'workspace-share-link-created'
            | 'workspace-session-revoked'
            | 'server-settings-updated'
        actorLabel: string
        actorSessionId?: string | null
        workspaceSlug?: string | null
        targetType: 'workspace' | 'api-key' | 'user' | 'session' | 'server-settings'
        targetId?: string | null
        summary: string
        details?: Record<string, string | number | boolean | null | undefined>
    }): void
}

export interface AdminWorkspaceCommandRuntime {
    ensureWorkspaceReadModelInitialized(slug: string): void
    renameWorkspaceData(previousSlug: string, nextSlug: string): void
    deleteWorkspaceData(slug: string): void
    invalidateWorkspaceApiStore(slug: string): void
    buildWorkspaceShareLinkUrl(workspaceSlug: string, sessionId: string): string
    createShareLinkSubjectId(): string
    applyServerSettings(settings: ServerSettingsRecord): void
    buildServerSettingsDefaults(): ServerSettingsRecord
}

export function createWorkspaceCommand(
    registry: AdminWorkspaceRegistryPort,
    runtime: Pick<AdminWorkspaceCommandRuntime, 'ensureWorkspaceReadModelInitialized'>,
    input: { name: string | null; slug?: string | null; apiKeyLabel?: string | null; actor?: AdminActorContext | null },
): WorkspaceProvisioningResult {
    const name = requireNonEmptyText(input.name, 'Поле "name" обязательно.')
    const createdWorkspace = registry.createWorkspace({
        name,
        slug: input.slug ?? undefined,
        apiKeyLabel: input.apiKeyLabel ?? undefined,
    })

    runtime.ensureWorkspaceReadModelInitialized(createdWorkspace.workspace.slug)
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-created',
        workspaceSlug: createdWorkspace.workspace.slug,
        targetType: 'workspace',
        targetId: createdWorkspace.workspace.slug,
        summary: 'Workspace created',
        details: {
            name: createdWorkspace.workspace.name,
            slug: createdWorkspace.workspace.slug,
            apiKeyId: createdWorkspace.apiKey.id,
        },
    })

    return createdWorkspace
}

export function bootstrapWorkspaceForDev(
    registry: Pick<AdminWorkspaceRegistryPort, 'getWorkspace' | 'createWorkspace' | 'createApiKey'>,
    input: { name?: string | null; slug?: string | null },
): { statusCode: 200 | 201; body: WorkspaceProvisioningResult } {
    const requestedName = input.name ?? 'Demo Workspace'
    const requestedSlug = input.slug ?? 'demo'
    const existingWorkspace = registry.getWorkspace(requestedSlug)

    if (!existingWorkspace) {
        return {
            statusCode: 201,
            body: registry.createWorkspace({
                name: requestedName,
                slug: requestedSlug,
                apiKeyLabel: 'Bootstrap key',
            }),
        }
    }

    return {
        statusCode: 200,
        body: registry.createApiKey(requestedSlug, 'Bootstrap key'),
    }
}

export function updateWorkspaceCommand(
    registry: AdminWorkspaceRegistryPort,
    runtime: Pick<AdminWorkspaceCommandRuntime, 'renameWorkspaceData' | 'invalidateWorkspaceApiStore' | 'ensureWorkspaceReadModelInitialized'>,
    input: { workspaceSlug: string; name: string | null; nextSlug?: string | null; actor?: AdminActorContext | null },
): WorkspaceUpdateResult {
    const name = requireNonEmptyText(input.name, 'Поле "name" обязательно.')
    const updatedWorkspace = registry.updateWorkspace(input.workspaceSlug, {
        name,
        slug: input.nextSlug ?? input.workspaceSlug,
    })

    if (updatedWorkspace.previousSlug !== updatedWorkspace.workspace.slug) {
        runtime.renameWorkspaceData(updatedWorkspace.previousSlug, updatedWorkspace.workspace.slug)
        runtime.invalidateWorkspaceApiStore(updatedWorkspace.previousSlug)
    }

    runtime.invalidateWorkspaceApiStore(updatedWorkspace.workspace.slug)
    runtime.ensureWorkspaceReadModelInitialized(updatedWorkspace.workspace.slug)
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-updated',
        workspaceSlug: updatedWorkspace.workspace.slug,
        targetType: 'workspace',
        targetId: updatedWorkspace.workspace.slug,
        summary: 'Workspace updated',
        details: {
            previousSlug: updatedWorkspace.previousSlug,
            slug: updatedWorkspace.workspace.slug,
            name: updatedWorkspace.workspace.name,
        },
    })

    return updatedWorkspace
}

export function deleteWorkspaceCommand(
    registry: AdminWorkspaceRegistryPort,
    runtime: Pick<AdminWorkspaceCommandRuntime, 'deleteWorkspaceData' | 'invalidateWorkspaceApiStore'>,
    input: { workspaceSlug: string; actor?: AdminActorContext | null },
): { workspace: WorkspaceDescriptor } {
    const deletedWorkspace = registry.deleteWorkspace(input.workspaceSlug)
    runtime.deleteWorkspaceData(input.workspaceSlug)
    runtime.invalidateWorkspaceApiStore(input.workspaceSlug)
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'workspace-deleted',
        workspaceSlug: input.workspaceSlug,
        targetType: 'workspace',
        targetId: input.workspaceSlug,
        summary: 'Workspace deleted',
        details: {
            slug: input.workspaceSlug,
            name: deletedWorkspace.name,
        },
    })

    return { workspace: deletedWorkspace }
}

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

export function updateServerSettingsCommand(
    registry: AdminWorkspaceRegistryPort,
    runtime: Pick<AdminWorkspaceCommandRuntime, 'applyServerSettings' | 'buildServerSettingsDefaults'>,
    input: { settings: UpdateServerSettingsInput; actor?: AdminActorContext | null },
): { settings: ServerSettingsRecord } {
    const settings = registry.updateServerSettings(input.settings, runtime.buildServerSettingsDefaults())
    runtime.applyServerSettings(settings)
    recordAdminAuditIfNeeded(registry, input.actor, {
        action: 'server-settings-updated',
        targetType: 'server-settings',
        summary: 'Server settings updated',
        details: {
            requireWorkspaceAuth: settings.requireWorkspaceAuth,
            allowDevBootstrap: settings.allowDevBootstrap,
            accessTokenTtlSeconds: settings.accessTokenTtlSeconds,
            adminBaseUrl: settings.adminBaseUrl ?? '',
            runtimeBaseUrl: settings.runtimeBaseUrl ?? '',
        },
    })

    return { settings }
}

function recordAdminAuditIfNeeded(
    registry: Pick<AdminWorkspaceRegistryPort, 'recordAdminAudit'>,
    actor: AdminActorContext | null | undefined,
    input: Omit<Parameters<AdminWorkspaceRegistryPort['recordAdminAudit']>[0], 'actorLabel' | 'actorSessionId'>,
): void {
    if (!actor) {
        return
    }

    registry.recordAdminAudit({
        ...input,
        actorLabel: actor.label,
        actorSessionId: actor.sessionId,
    })
}