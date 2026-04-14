import type { DashboardRunMetadata, ReporterRoot } from '../dashboard-utils'

export interface WorkspaceRecord {
    slug: string
    name: string
    createdAt: string
    updatedAt: string
    apiKeys: WorkspaceApiKeyRecord[]
    users: WorkspaceUserRecord[]
}

export interface WorkspaceApiKeyRecord {
    id: string
    label: string
    tokenPreview: string
    tokenHash: string
    createdAt: string
    lastUsedAt: string | null
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
}

export interface WorkspaceRegistrySnapshot {
    schemaVersion: number
    updatedAt: string
    workspaces: WorkspaceRecord[]
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
    }>
    users: Array<{
        id: string
        label: string
        role: WorkspaceUserRole
        tokenPreview: string
        createdAt: string
        lastUsedAt: string | null
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

export interface CreateWorkspaceUserInput {
    label: string
    role?: WorkspaceUserRole
}

export interface WorkspacePaths {
    rootPath: string
    distPath: string
    summaryPath: string
    historyPath: string
    archiveRootPath: string
    rawReportsPath: string
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

