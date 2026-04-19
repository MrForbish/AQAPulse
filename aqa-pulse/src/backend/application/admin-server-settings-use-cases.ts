/**
 * Назначение файла: содержит команду изменения сохранённых настроек сервера
 * и их немедленного применения в работающем backend.
 */
import type { ServerSettingsRecord, UpdateServerSettingsInput } from '../contracts'
import {
    recordAdminAuditIfNeeded,
    type AdminActorContext,
    type AdminWorkspaceCommandRuntime,
    type AdminWorkspaceRegistryPort,
} from './admin-workspace-use-case-support'

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