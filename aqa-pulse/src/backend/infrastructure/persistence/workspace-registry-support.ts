/**
 * Назначение файла: содержит shared helper functions для `WorkspaceRegistry` и normalization логики registry snapshot.
 */
import { createHash, randomBytes } from 'node:crypto'
import { inferShareLinkTtlMinutes } from '../../domain/session-rules'
import { normalizePersistedServerSettings } from '../../domain/server-settings-rules'
import { normalizeWorkspaceSlug, normalizeWorkspaceUserRole } from '../../domain/workspace-rules'
import { normalizeOptionalText } from '../../../shared/text-utils'
import type {
    AdminAuditAction,
    AdminAuditPage,
    AdminAuditRecord,
    AdminSessionRecord,
    WorkspaceApiKeyRecord,
    WorkspaceDescriptor,
    WorkspaceRecord,
    WorkspaceRegistrySnapshot,
    WorkspaceSessionKind,
    WorkspaceSessionRecord,
    WorkspaceUserRecord,
} from '../../contracts'

export const DEFAULT_API_KEY_LABEL = 'Default ingestion key'
export const DEFAULT_WORKSPACE_USER_LABEL = 'Workspace owner'
export const DEFAULT_ADMIN_SESSION_LABEL = 'Admin session'
export const MAX_ADMIN_AUDIT_LOG_ENTRIES = 250

export function normalizeWorkspaceRegistrySnapshot(registry: WorkspaceRegistrySnapshot): WorkspaceRegistrySnapshot {
    return {
        ...registry,
        adminSessions: Array.isArray(registry.adminSessions) ? registry.adminSessions.map(normalizeAdminSessionRecord) : [],
        adminAuditLog: Array.isArray(registry.adminAuditLog) ? registry.adminAuditLog.map(normalizeAdminAuditRecord) : [],
        serverSettings: normalizePersistedServerSettings(registry.serverSettings),
        workspaces: registry.workspaces.map(normalizeWorkspaceRecord),
    }
}

export function mapWorkspaceToDescriptor(workspace: WorkspaceRecord): WorkspaceDescriptor {
    return {
        slug: workspace.slug,
        name: workspace.name,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        apiKeys: workspace.apiKeys.map((apiKey) => ({
            id: apiKey.id,
            label: apiKey.label,
            tokenPreview: apiKey.tokenPreview,
            createdAt: apiKey.createdAt,
            lastUsedAt: apiKey.lastUsedAt,
            disabledAt: apiKey.disabledAt,
        })),
        users: workspace.users.map((user) => ({
            id: user.id,
            label: user.label,
            role: user.role,
            tokenPreview: user.tokenPreview,
            createdAt: user.createdAt,
            lastUsedAt: user.lastUsedAt,
            disabledAt: user.disabledAt,
        })),
        sessions: [...workspace.sessions]
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
            .map((session) => ({
                id: session.id,
                kind: session.kind,
                label: session.label,
                scope: session.scope,
                role: session.role,
                createdAt: session.createdAt,
                activatedAt: session.activatedAt,
                expiresAt: session.expiresAt,
                ttlMinutes: session.ttlMinutes,
                lastSeenAt: session.lastSeenAt,
                revokedAt: session.revokedAt,
            })),
    }
}

export function buildAdminAuditPage(entries: AdminAuditRecord[], page = 1, pageSize = 20): AdminAuditPage {
    const normalizedPageSize = Math.min(Math.max(1, Math.trunc(pageSize) || 20), MAX_ADMIN_AUDIT_LOG_ENTRIES)
    const sortedEntries = entries
        .slice()
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    const totalEntries = sortedEntries.length
    const totalPages = Math.max(1, Math.ceil(totalEntries / normalizedPageSize))
    const normalizedPage = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages)
    const startIndex = (normalizedPage - 1) * normalizedPageSize

    return {
        entries: sortedEntries.slice(startIndex, startIndex + normalizedPageSize),
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalEntries,
        totalPages,
        hasPreviousPage: normalizedPage > 1,
        hasNextPage: normalizedPage < totalPages,
    }
}

export function buildAdminAuditRecord(input: {
    action: AdminAuditAction
    actorLabel: string
    actorSessionId?: string | null
    workspaceSlug?: string | null
    targetType: AdminAuditRecord['targetType']
    targetId?: string | null
    summary: string
    details?: Record<string, string | number | boolean | null | undefined>
}): AdminAuditRecord {
    return {
        id: randomBytes(8).toString('hex'),
        action: input.action,
        actorLabel: normalizeOptionalText(input.actorLabel) ?? DEFAULT_ADMIN_SESSION_LABEL,
        actorSessionId: normalizeOptionalText(input.actorSessionId ?? null),
        workspaceSlug: normalizeOptionalText(input.workspaceSlug ?? null),
        targetType: input.targetType,
        targetId: normalizeOptionalText(input.targetId ?? null),
        summary: normalizeRequiredText(input.summary, 'summary'),
        createdAt: new Date().toISOString(),
        details: normalizeAuditDetails(input.details),
    }
}

export function normalizeRequiredText(value: string, fieldName: string): string {
    const normalizedValue = normalizeOptionalText(value)

    if (!normalizedValue) {
        throw new Error(`Поле "${fieldName}" обязательно.`)
    }

    return normalizedValue
}

export function generateApiToken(): string {
    return `aqp_${randomBytes(24).toString('hex')}`
}

export function generateWorkspaceUserToken(): string {
    return `aqu_${randomBytes(24).toString('hex')}`
}

export function buildTokenPreview(token: string): string {
    return `${token.slice(0, 10)}…`
}

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export function findWorkspaceOrThrow(registry: WorkspaceRegistrySnapshot, slug: string): WorkspaceRecord {
    const workspace = registry.workspaces.find((item) => item.slug === slug)

    if (!workspace) {
        throw new Error(`Workspace со slug "${slug}" не найден.`)
    }

    return workspace
}

export function revokeWorkspaceSessionsBySubject(workspace: WorkspaceRecord, kind: WorkspaceSessionKind, subjectId: string, revokedAt: string): void {
    for (const session of workspace.sessions) {
        if (session.kind === kind && session.subjectId === subjectId && !session.revokedAt) {
            session.revokedAt = revokedAt
        }
    }
}

export function revokeAllWorkspaceSessions(workspace: WorkspaceRecord, revokedAt: string): void {
    for (const session of workspace.sessions) {
        if (!session.revokedAt) {
            session.revokedAt = revokedAt
        }
    }
}

export function normalizeNullablePositiveInteger(value: number | undefined): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function normalizeWorkspaceRecord(workspace: Partial<WorkspaceRecord>): WorkspaceRecord {
    const createdAt = typeof workspace.createdAt === 'string' ? workspace.createdAt : new Date().toISOString()
    const updatedAt = typeof workspace.updatedAt === 'string' ? workspace.updatedAt : createdAt

    return {
        slug: normalizeWorkspaceSlug(workspace.slug ?? 'workspace'),
        name: normalizeRequiredText(workspace.name ?? 'Workspace', 'name'),
        createdAt,
        updatedAt,
        apiKeys: Array.isArray(workspace.apiKeys) ? workspace.apiKeys.map(normalizeApiKeyRecord) : [],
        users: Array.isArray(workspace.users) ? workspace.users.map(normalizeWorkspaceUserRecord) : [],
        sessions: Array.isArray(workspace.sessions) ? workspace.sessions.map(normalizeWorkspaceSessionRecord) : [],
    }
}

function normalizeApiKeyRecord(apiKey: Partial<WorkspaceApiKeyRecord>): WorkspaceApiKeyRecord {
    return {
        id: typeof apiKey.id === 'string' ? apiKey.id : randomBytes(8).toString('hex'),
        label: normalizeOptionalText(apiKey.label) ?? DEFAULT_API_KEY_LABEL,
        tokenPreview: typeof apiKey.tokenPreview === 'string' ? apiKey.tokenPreview : 'aqp_***',
        tokenHash: typeof apiKey.tokenHash === 'string' ? apiKey.tokenHash : '',
        createdAt: typeof apiKey.createdAt === 'string' ? apiKey.createdAt : new Date().toISOString(),
        lastUsedAt: typeof apiKey.lastUsedAt === 'string' ? apiKey.lastUsedAt : null,
        disabledAt: typeof apiKey.disabledAt === 'string' ? apiKey.disabledAt : null,
    }
}

function normalizeWorkspaceUserRecord(user: Partial<WorkspaceUserRecord>): WorkspaceUserRecord {
    return {
        id: typeof user.id === 'string' ? user.id : randomBytes(8).toString('hex'),
        label: normalizeOptionalText(user.label) ?? DEFAULT_WORKSPACE_USER_LABEL,
        role: normalizeWorkspaceUserRole(user.role),
        tokenPreview: typeof user.tokenPreview === 'string' ? user.tokenPreview : 'aqu_***',
        tokenHash: typeof user.tokenHash === 'string' ? user.tokenHash : '',
        createdAt: typeof user.createdAt === 'string' ? user.createdAt : new Date().toISOString(),
        lastUsedAt: typeof user.lastUsedAt === 'string' ? user.lastUsedAt : null,
        disabledAt: typeof user.disabledAt === 'string' ? user.disabledAt : null,
    }
}

function normalizeAdminSessionRecord(session: Partial<AdminSessionRecord>): AdminSessionRecord {
    const createdAt = typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString()

    return {
        id: typeof session.id === 'string' ? session.id : randomBytes(8).toString('hex'),
        label: normalizeOptionalText(session.label) ?? DEFAULT_ADMIN_SESSION_LABEL,
        createdAt,
        expiresAt: typeof session.expiresAt === 'string' ? session.expiresAt : createdAt,
        lastSeenAt: typeof session.lastSeenAt === 'string' ? session.lastSeenAt : createdAt,
        revokedAt: typeof session.revokedAt === 'string' ? session.revokedAt : null,
    }
}

function normalizeAdminAuditRecord(entry: Partial<AdminAuditRecord>): AdminAuditRecord {
    return {
        id: typeof entry.id === 'string' ? entry.id : randomBytes(8).toString('hex'),
        action: normalizeAdminAuditAction(entry.action),
        actorLabel: normalizeOptionalText(entry.actorLabel) ?? DEFAULT_ADMIN_SESSION_LABEL,
        actorSessionId: typeof entry.actorSessionId === 'string' ? entry.actorSessionId : null,
        workspaceSlug: typeof entry.workspaceSlug === 'string' ? entry.workspaceSlug : null,
        targetType: entry.targetType === 'workspace'
            || entry.targetType === 'api-key'
            || entry.targetType === 'user'
            || entry.targetType === 'session'
            || entry.targetType === 'server-settings'
            || entry.targetType === 'admin-session'
            ? entry.targetType
            : 'workspace',
        targetId: typeof entry.targetId === 'string' ? entry.targetId : null,
        summary: normalizeOptionalText(entry.summary) ?? 'Admin action',
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
        details: normalizeAuditDetails(entry.details),
    }
}

function normalizeWorkspaceSessionRecord(session: Partial<WorkspaceSessionRecord>): WorkspaceSessionRecord {
    const createdAt = typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString()
    const kind = session.kind === 'workspace-api-key'
        ? 'workspace-api-key'
        : session.kind === 'workspace-share-link'
            ? 'workspace-share-link'
            : 'workspace-user'
    const expiresAt = typeof session.expiresAt === 'string' ? session.expiresAt : null
    const ttlMinutes = kind === 'workspace-share-link'
        ? normalizeNullablePositiveInteger(session.ttlMinutes ?? undefined) ?? inferShareLinkTtlMinutes(typeof session.label === 'string' ? session.label : '')
        : null
    const activatedAt = typeof session.activatedAt === 'string'
        ? session.activatedAt
        : kind === 'workspace-share-link'
            ? (expiresAt ? createdAt : null)
            : createdAt

    return {
        id: typeof session.id === 'string' ? session.id : randomBytes(8).toString('hex'),
        kind,
        subjectId: typeof session.subjectId === 'string' ? session.subjectId : randomBytes(8).toString('hex'),
        label: normalizeOptionalText(session.label) ?? 'Session',
        scope: session.scope === 'workspace:ingest' ? 'workspace:ingest' : 'workspace:read',
        role: session.role === 'owner' ? 'owner' : session.role === 'viewer' ? 'viewer' : null,
        createdAt,
        activatedAt,
        expiresAt,
        ttlMinutes,
        lastSeenAt: typeof session.lastSeenAt === 'string' ? session.lastSeenAt : createdAt,
        revokedAt: typeof session.revokedAt === 'string' ? session.revokedAt : null,
    }
}

function normalizeAdminAuditAction(value: unknown): AdminAuditAction {
    switch (value) {
        case 'admin-login':
        case 'admin-logout':
        case 'workspace-created':
        case 'workspace-updated':
        case 'workspace-deleted':
        case 'workspace-api-key-created':
        case 'workspace-api-key-disabled':
        case 'workspace-api-key-deleted':
        case 'workspace-user-created':
        case 'workspace-user-disabled':
        case 'workspace-user-deleted':
        case 'workspace-user-role-updated':
        case 'workspace-share-link-created':
        case 'workspace-session-revoked':
        case 'server-settings-updated':
            return value
        default:
            return 'workspace-updated'
    }
}

function normalizeAuditDetails(details: Record<string, string | number | boolean | null | undefined> | unknown): Record<string, string> {
    if (!details || typeof details !== 'object' || Array.isArray(details)) {
        return {}
    }

    return Object.fromEntries(
        Object.entries(details).flatMap(([key, value]) => value === null || value === undefined ? [] : [[key, String(value)]])
    )
}