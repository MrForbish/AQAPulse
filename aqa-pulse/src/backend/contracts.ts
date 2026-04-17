/**
 * Назначение: backend-доменные контракты для workspace registry, provisioning, storage и ingestion. Это слой типов и протоколов сервера, а не React UI.
 */
import type { DashboardBusinessAssumptions, DashboardRunMetadata, ReporterRoot } from '../dashboard-utils'

export interface WorkspaceRecord {
    slug: string
    name: string
    createdAt: string
    updatedAt: string
    apiKeys: WorkspaceApiKeyRecord[]
    users: WorkspaceUserRecord[]
    sessions: WorkspaceSessionRecord[]
}

export interface WorkspaceApiKeyRecord {
    id: string
    label: string
    tokenPreview: string
    tokenHash: string
    createdAt: string
    lastUsedAt: string | null
    disabledAt: string | null
}

export type WorkspaceUserRole = 'owner' | 'viewer'

export interface WorkspaceUserRecord {
    id: string
    label: string
    role: WorkspaceUserRole
    tokenPreview: string
    tokenHash: string
    createdAt: string
    lastUsedAt: string | null
    disabledAt: string | null
}

export interface AdminSessionRecord {
    id: string
    label: string
    createdAt: string
    expiresAt: string
    lastSeenAt: string
    revokedAt: string | null
}

export type WorkspaceSessionKind = 'workspace-user' | 'workspace-api-key' | 'workspace-share-link'

export interface WorkspaceSessionRecord {
    id: string
    kind: WorkspaceSessionKind
    subjectId: string
    label: string
    scope: 'workspace:read' | 'workspace:ingest'
    role: WorkspaceUserRole | null
    createdAt: string
    expiresAt: string
    lastSeenAt: string
    revokedAt: string | null
}

export interface WorkspaceRegistrySnapshot {
    schemaVersion: number
    updatedAt: string
    adminSessions: AdminSessionRecord[]
    adminAuditLog: AdminAuditRecord[]
    serverSettings: PersistedServerSettingsRecord | null
    workspaces: WorkspaceRecord[]
}

export type AdminAuditAction =
    | 'admin-login'
    | 'admin-logout'
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

export interface AdminAuditRecord {
    id: string
    action: AdminAuditAction
    actorLabel: string
    actorSessionId: string | null
    workspaceSlug: string | null
    targetType: 'workspace' | 'api-key' | 'user' | 'session' | 'server-settings' | 'admin-session'
    targetId: string | null
    summary: string
    createdAt: string
    details: Record<string, string>
}

export interface PersistedServerSettingsRecord {
    adminBaseUrl?: string | null
    runtimeBaseUrl?: string | null
    allowDevBootstrap?: boolean
    requireWorkspaceAuth?: boolean
    accessTokenTtlSeconds?: number
    adminToken?: string | null
    businessAssumptions?: Partial<DashboardBusinessAssumptions> | null
}

export interface ServerSettingsRecord {
    adminBaseUrl: string | null
    runtimeBaseUrl: string | null
    allowDevBootstrap: boolean
    requireWorkspaceAuth: boolean
    accessTokenTtlSeconds: number
    adminToken: string | null
    businessAssumptions: DashboardBusinessAssumptions
}

export interface UpdateServerSettingsInput {
    adminBaseUrl?: string | null
    runtimeBaseUrl?: string | null
    allowDevBootstrap?: boolean
    requireWorkspaceAuth?: boolean
    accessTokenTtlSeconds?: number
    adminToken?: string | null
    businessAssumptions?: Partial<DashboardBusinessAssumptions> | null
}

export interface WorkspaceDescriptor {
    slug: string
    name: string
    createdAt: string
    updatedAt: string
    apiKeys: Array<{
        id: string
        label: string
        tokenPreview: string
        createdAt: string
        lastUsedAt: string | null
        disabledAt: string | null
    }>
    users: Array<{
        id: string
        label: string
        role: WorkspaceUserRole
        tokenPreview: string
        createdAt: string
        lastUsedAt: string | null
        disabledAt: string | null
    }>
    sessions: Array<{
        id: string
        kind: WorkspaceSessionKind
        label: string
        scope: 'workspace:read' | 'workspace:ingest'
        role: WorkspaceUserRole | null
        createdAt: string
        expiresAt: string
        lastSeenAt: string
        revokedAt: string | null
    }>
}

export interface WorkspaceProvisioningResult {
    workspace: WorkspaceDescriptor
    apiKey: {
        id: string
        label: string
        token: string
        tokenPreview: string
        createdAt: string
    }
}

export interface WorkspaceShareLinkProvisioningResult {
    workspace: WorkspaceDescriptor
    shareSession: {
        id: string
        label: string
        expiresAt: string
        ttlMinutes: number
    }
    shareLinkUrl: string
}

export interface WorkspaceUserProvisioningResult {
    workspace: WorkspaceDescriptor
    user: {
        id: string
        label: string
        role: WorkspaceUserRole
        token: string
        tokenPreview: string
        createdAt: string
    }
}

export interface CreateWorkspaceInput {
    slug?: string
    name: string
    apiKeyLabel?: string
}

export interface UpdateWorkspaceInput {
    slug?: string
    name: string
}

export interface CreateWorkspaceUserInput {
    label: string
    role?: WorkspaceUserRole
}

export interface WorkspaceUpdateResult {
    workspace: WorkspaceDescriptor
    previousSlug: string
}

export interface WorkspaceUserRoleUpdateResult {
    workspace: WorkspaceDescriptor
    userId: string
    role: WorkspaceUserRole
}

export type WorkspaceIngestionHealthStatus = 'healthy' | 'warning' | 'critical' | 'stale' | 'idle'

export interface WorkspaceIngestionHealthItem {
    slug: string
    name: string
    status: WorkspaceIngestionHealthStatus
    runCount: number
    lastIngestionAt: string | null
    staleHours: number | null
    latestPassRate: number | null
    latestFailedTests: number | null
    latestFlakyTests: number | null
    latestDurationMs: number | null
    latestSourceFile: string | null
}

export interface AdminIngestionHealthReport {
    generatedAt: string
    totals: {
        total: number
        healthy: number
        warning: number
        critical: number
        stale: number
        idle: number
    }
    items: WorkspaceIngestionHealthItem[]
}

export interface WorkspacePaths {
    rootPath: string
    distPath: string
    summaryPath: string
    historyPath: string
    archiveRootPath: string
    rawReportsPath: string
    artifactsPath: string
}

export interface WorkspaceApiAuthResult {
    workspace: WorkspaceRecord
    apiKey: WorkspaceApiKeyRecord
}

export interface WorkspaceUserAuthResult {
    workspace: WorkspaceRecord
    user: WorkspaceUserRecord
}

export interface IngestionRequestPayload {
    report: ReporterRoot
    sourceFile?: string
    metadata?: Partial<DashboardRunMetadata>
}

export interface IngestionResult {
    workspace: WorkspaceDescriptor
    summaryPath: string
    historyPath: string
    archivedRunDirectory: string
    runId: string
    sourceFile: string
    summaryGeneratedAt: string
}

export type StorageDriver = 'file' | 'sqlite' | 'postgres'

