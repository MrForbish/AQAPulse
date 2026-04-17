/**
 * Назначение: нормализует runtime-конфигурацию self-hosted/backend слоя вокруг актуального archiveRootPath contract.
 */
import * as path from 'node:path'
import type { DashboardBusinessAssumptions } from '../dashboard-utils'
import { normalizeOptionalText } from '../shared/text-utils'
import type { StorageDriver } from './contracts'
import { resolveWorkspaceDataRoot } from './workspace-paths'

export interface SaasAppConfig {
    port: number
    adminBaseUrl: string | null
    runtimeBaseUrl: string | null
    dataRoot: string
    storageDriver: StorageDriver
    sqlitePath: string | null
    postgresConnectionString: string | null
    requestBodyLimit: string
    distPath: string
    archiveRootPath: string
    allowDevBootstrap: boolean
    adminToken: string | null
    requireWorkspaceAuth: boolean
    jwtSecret: string
    accessTokenTtlSeconds: number
    adminSessionCookieName: string
    workspaceSessionCookiePrefix: string
    businessAssumptions: DashboardBusinessAssumptions
}

export function resolveSaasAppConfig(overrides: Partial<SaasAppConfig> = {}): SaasAppConfig {
    const configuredPort = normalizePort(overrides.port ?? process.env.PORT)
    const configuredAdminBaseUrl = normalizeOptionalText(overrides.adminBaseUrl ?? process.env.AQA_PULSE_ADMIN_BASE_URL)
    const configuredRuntimeBaseUrl = normalizeOptionalText(overrides.runtimeBaseUrl ?? process.env.AQA_PULSE_RUNTIME_BASE_URL)
    const configuredAdminToken = normalizeOptionalText(overrides.adminToken ?? process.env.AQA_PULSE_ADMIN_TOKEN)
    const configuredDistPath = normalizeOptionalText(overrides.distPath ?? process.env.AQA_PULSE_DIST_PATH)
    const configuredArchiveRootPath = normalizeOptionalText(overrides.archiveRootPath ?? process.env.AQA_PULSE_ARCHIVE_PATH)
    const configuredSqlitePath = normalizeOptionalText(overrides.sqlitePath ?? process.env.AQA_PULSE_SQLITE_PATH)
    const configuredPostgresConnectionString = normalizeOptionalText(overrides.postgresConnectionString ?? process.env.AQA_PULSE_POSTGRES_URL)
    const configuredRequestBodyLimit = normalizeOptionalText(overrides.requestBodyLimit ?? process.env.AQA_PULSE_REQUEST_BODY_LIMIT)
    const configuredJwtSecret = normalizeOptionalText(overrides.jwtSecret ?? process.env.AQA_PULSE_JWT_SECRET)
    const configuredAccessTokenTtlSeconds = normalizePositiveInteger(overrides.accessTokenTtlSeconds ?? process.env.AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS)
    const configuredAdminSessionCookieName = normalizeOptionalText(overrides.adminSessionCookieName ?? process.env.AQA_PULSE_ADMIN_SESSION_COOKIE_NAME)
    const configuredWorkspaceSessionCookiePrefix = normalizeOptionalText(overrides.workspaceSessionCookiePrefix ?? process.env.AQA_PULSE_WORKSPACE_SESSION_COOKIE_PREFIX)
    const configuredBusinessAssumptions = {
        ciMinuteCostRub: normalizeNonNegativeNumber(overrides.businessAssumptions?.ciMinuteCostRub ?? process.env.AQA_PULSE_CI_MINUTE_COST),
        developerHourlyCostRub: normalizeNonNegativeNumber(overrides.businessAssumptions?.developerHourlyCostRub ?? process.env.AQA_PULSE_DEV_HOURLY_COST),
        analysisMinutesPerUnstable: normalizeNonNegativeNumber(overrides.businessAssumptions?.analysisMinutesPerUnstable ?? process.env.AQA_PULSE_ANALYSIS_MINUTES_PER_UNSTABLE),
    }
    const archiveRootPath = configuredArchiveRootPath ? path.resolve(configuredArchiveRootPath) : path.resolve(process.cwd(), './history')

    return {
        port: configuredPort ?? 3000,
        adminBaseUrl: configuredAdminBaseUrl,
        runtimeBaseUrl: configuredRuntimeBaseUrl,
        dataRoot: resolveWorkspaceDataRoot(overrides.dataRoot),
        storageDriver: normalizeStorageDriver(overrides.storageDriver ?? process.env.AQA_PULSE_STORAGE_DRIVER),
        sqlitePath: configuredSqlitePath ? path.resolve(configuredSqlitePath) : null,
        postgresConnectionString: configuredPostgresConnectionString,
        requestBodyLimit: configuredRequestBodyLimit ?? '50mb',
        distPath: configuredDistPath ? path.resolve(configuredDistPath) : path.resolve(process.cwd(), './dist'),
        archiveRootPath,
        allowDevBootstrap: normalizeBoolean(overrides.allowDevBootstrap ?? process.env.AQA_PULSE_ENABLE_DEV_BOOTSTRAP, true),
        adminToken: configuredAdminToken,
        requireWorkspaceAuth: normalizeBoolean(overrides.requireWorkspaceAuth ?? process.env.AQA_PULSE_REQUIRE_WORKSPACE_AUTH, false),
        jwtSecret: configuredJwtSecret ?? configuredAdminToken ?? 'aqa-pulse-dev-jwt-secret',
        accessTokenTtlSeconds: configuredAccessTokenTtlSeconds ?? 60 * 60 * 8,
        adminSessionCookieName: configuredAdminSessionCookieName ?? 'aqa_pulse_admin_session',
        workspaceSessionCookiePrefix: configuredWorkspaceSessionCookiePrefix ?? 'aqa_pulse_workspace_session',
        businessAssumptions: configuredBusinessAssumptions,
    }
}

function normalizePort(value: number | string | undefined): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        return null
    }

    const parsedValue = Number(value)
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null
}

function normalizeBoolean(value: boolean | string | undefined, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value !== 'string') {
        return defaultValue
    }

    const normalizedValue = value.trim().toLowerCase()

    if (!normalizedValue) {
        return defaultValue
    }

    if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
        return true
    }

    if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
        return false
    }

    return defaultValue
}

function normalizeStorageDriver(value: StorageDriver | string | undefined): StorageDriver {
    if (value === 'postgres') {
        return 'postgres'
    }

    if (value === 'sqlite') {
        return 'sqlite'
    }

    return 'file'
}

function normalizePositiveInteger(value: number | string | undefined): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        return null
    }

    const parsedValue = Number(value)
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null
}

function normalizeNonNegativeNumber(value: number | string | undefined): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return value
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        return null
    }

    const parsedValue = Number(value)
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null
}

