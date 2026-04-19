/**
 * Назначение файла: содержит команды жизненного цикла workspace:
 * создание, переименование и удаление.
 */
import type { WorkspaceDescriptor, WorkspaceProvisioningResult, WorkspaceUpdateResult } from '../contracts'
import { requireNonEmptyText } from '../domain/workspace-rules'
import {
    recordAdminAuditIfNeeded,
    type AdminActorContext,
    type AdminWorkspaceCommandRuntime,
    type AdminWorkspaceRegistryPort,
} from './admin-workspace-use-case-support'

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

/**
 * Поддерживает служебный сценарий начальной настройки: создаёт demo-workspace один раз,
 * а при повторных вызовах только выпускает новый ключ загрузки.
 */
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