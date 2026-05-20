/**
 * Назначение файла: хранит общие контракты admin-слоя приложения и вспомогательную функцию для аудита,
 * чтобы узкие модули команд не дублировали одни и те же зависимости времени выполнения и реестра.
 */
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
            | 'workspace-data-reset'
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

/**
 * Записывает событие в журнал аудита только тогда, когда у команды есть сведения о том,
 * кто её выполнил. Это позволяет вызывать одну и ту же команду и из обычного admin-сценария,
 * и из служебных сценариев начальной настройки.
 */
export function recordAdminAuditIfNeeded(
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
