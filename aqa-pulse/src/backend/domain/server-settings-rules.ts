/**
 * Назначение файла: содержит правила нормализации и объединения настроек сервера.
 */
import type {
    PersistedServerSettingsRecord,
    ServerSettingsRecord,
    UpdateServerSettingsInput,
} from '../contracts'

export function normalizePersistedServerSettings(settings: Partial<PersistedServerSettingsRecord> | null | undefined): PersistedServerSettingsRecord | null {
    if (!settings || typeof settings !== 'object') {
        return null
    }

    const normalizedBusinessAssumptions = settings.businessAssumptions && typeof settings.businessAssumptions === 'object'
        ? {
            ciMinuteCostRub: normalizeNullableNonNegativeNumber(settings.businessAssumptions.ciMinuteCostRub),
            developerHourlyCostRub: normalizeNullableNonNegativeNumber(settings.businessAssumptions.developerHourlyCostRub),
            analysisMinutesPerUnstable: normalizeNullableNonNegativeNumber(settings.businessAssumptions.analysisMinutesPerUnstable),
        }
        : null

    return {
        adminBaseUrl: normalizeOptionalText(settings.adminBaseUrl ?? null),
        runtimeBaseUrl: normalizeOptionalText(settings.runtimeBaseUrl ?? null),
        allowDevBootstrap: typeof settings.allowDevBootstrap === 'boolean' ? settings.allowDevBootstrap : undefined,
        requireWorkspaceAuth: typeof settings.requireWorkspaceAuth === 'boolean' ? settings.requireWorkspaceAuth : undefined,
        accessTokenTtlSeconds: normalizeNullablePositiveInteger(settings.accessTokenTtlSeconds),
        adminToken: normalizeOptionalText(settings.adminToken ?? null),
        businessAssumptions: normalizedBusinessAssumptions,
    }
}

export function mergePersistedServerSettings(
    currentSettings: PersistedServerSettingsRecord | null,
    input: UpdateServerSettingsInput,
): PersistedServerSettingsRecord {
    const normalizedCurrentSettings = normalizePersistedServerSettings(currentSettings) ?? {}
    const normalizedInput = normalizePersistedServerSettings(input) ?? {}

    return {
        ...normalizedCurrentSettings,
        ...normalizedInput,
        businessAssumptions: {
            ...(normalizedCurrentSettings.businessAssumptions ?? {}),
            ...(normalizedInput.businessAssumptions ?? {}),
        },
    }
}

export function mergeServerSettings(
    persistedSettings: PersistedServerSettingsRecord | null,
    defaults: ServerSettingsRecord,
): ServerSettingsRecord {
    const normalizedPersistedSettings = normalizePersistedServerSettings(persistedSettings)

    return {
        adminBaseUrl: normalizedPersistedSettings?.adminBaseUrl ?? defaults.adminBaseUrl,
        runtimeBaseUrl: normalizedPersistedSettings?.runtimeBaseUrl ?? defaults.runtimeBaseUrl,
        allowDevBootstrap: normalizedPersistedSettings?.allowDevBootstrap ?? defaults.allowDevBootstrap,
        requireWorkspaceAuth: normalizedPersistedSettings?.requireWorkspaceAuth ?? defaults.requireWorkspaceAuth,
        accessTokenTtlSeconds: normalizedPersistedSettings?.accessTokenTtlSeconds ?? defaults.accessTokenTtlSeconds,
        adminToken: normalizedPersistedSettings?.adminToken ?? defaults.adminToken,
        businessAssumptions: {
            ciMinuteCostRub: normalizedPersistedSettings?.businessAssumptions?.ciMinuteCostRub ?? defaults.businessAssumptions.ciMinuteCostRub,
            developerHourlyCostRub: normalizedPersistedSettings?.businessAssumptions?.developerHourlyCostRub ?? defaults.businessAssumptions.developerHourlyCostRub,
            analysisMinutesPerUnstable: normalizedPersistedSettings?.businessAssumptions?.analysisMinutesPerUnstable ?? defaults.businessAssumptions.analysisMinutesPerUnstable,
        },
    }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeNullablePositiveInteger(value: number | undefined): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function normalizeNullableNonNegativeNumber(value: number | null | undefined): number | null | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : value === null ? null : undefined
}
