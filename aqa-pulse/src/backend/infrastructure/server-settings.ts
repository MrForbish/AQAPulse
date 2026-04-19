/**
 * Назначение файла: содержит вспомогательные функции для настроек сервера
 * по умолчанию и их применения к конфигурации backend.
 */
import type { SaasAppConfig } from '../config'
import type { ServerSettingsRecord } from '../contracts'

export function buildServerSettingsDefaults(config: SaasAppConfig): ServerSettingsRecord {
    return {
        adminBaseUrl: config.adminBaseUrl,
        runtimeBaseUrl: config.runtimeBaseUrl,
        allowDevBootstrap: config.allowDevBootstrap,
        requireWorkspaceAuth: config.requireWorkspaceAuth,
        accessTokenTtlSeconds: config.accessTokenTtlSeconds,
        adminToken: config.adminToken,
        businessAssumptions: {
            ciMinuteCostRub: config.businessAssumptions.ciMinuteCostRub,
            developerHourlyCostRub: config.businessAssumptions.developerHourlyCostRub,
            analysisMinutesPerUnstable: config.businessAssumptions.analysisMinutesPerUnstable,
        },
    }
}

export function applyServerSettingsToConfig(config: SaasAppConfig, settings: ServerSettingsRecord): void {
    config.adminBaseUrl = settings.adminBaseUrl
    config.runtimeBaseUrl = settings.runtimeBaseUrl
    config.allowDevBootstrap = settings.allowDevBootstrap
    config.requireWorkspaceAuth = settings.requireWorkspaceAuth
    config.accessTokenTtlSeconds = settings.accessTokenTtlSeconds
    config.adminToken = settings.adminToken
    config.businessAssumptions = {
        ciMinuteCostRub: settings.businessAssumptions.ciMinuteCostRub,
        developerHourlyCostRub: settings.businessAssumptions.developerHourlyCostRub,
        analysisMinutesPerUnstable: settings.businessAssumptions.analysisMinutesPerUnstable,
    }
}