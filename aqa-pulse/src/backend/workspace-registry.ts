import { createHash, randomBytes } from 'node:crypto'
import { inferShareLinkTtlMinutes, isSessionActive, shouldRefreshLastSeen } from './domain/session-rules'
import { mergePersistedServerSettings, mergeServerSettings, normalizePersistedServerSettings } from './domain/server-settings-rules'
import { normalizeWorkspaceSlug, normalizeWorkspaceUserRole } from './domain/workspace-rules'
import { normalizeOptionalText } from '../shared/text-utils'
import type {
    AdminAuditPage,
    AdminSessionRecord,
    AdminAuditAction,
    AdminAuditRecord,
    CreateWorkspaceInput,
    CreateWorkspaceUserInput,
    PersistedServerSettingsRecord,
    ServerSettingsRecord,
    UpdateServerSettingsInput,
    UpdateWorkspaceInput,
    WorkspaceApiAuthResult,
    WorkspaceApiKeyRecord,
    WorkspaceDescriptor,
    WorkspaceProvisioningResult,
    WorkspaceRecord,
    WorkspaceRegistrySnapshot,
    WorkspaceSessionKind,
    WorkspaceSessionRecord,
    WorkspaceUpdateResult,
    WorkspaceUserAuthResult,
    WorkspaceUserRoleUpdateResult,
    WorkspaceUserProvisioningResult,
    WorkspaceUserRecord,
} from './contracts'
import { FileSystemWorkspaceRegistryStorage, type WorkspaceRegistryStorage } from './storage'

const DEFAULT_API_KEY_LABEL = 'Default ingestion key'
const DEFAULT_WORKSPACE_USER_LABEL = 'Workspace owner'
const DEFAULT_ADMIN_SESSION_LABEL = 'Admin session'
const MAX_ADMIN_AUDIT_LOG_ENTRIES = 250

export class WorkspaceRegistry {
    constructor(private readonly storage: WorkspaceRegistryStorage = new FileSystemWorkspaceRegistryStorage()) {}

    listWorkspaces(): WorkspaceDescriptor[] {
        return this.readRegistry().workspaces.map(mapWorkspaceToDescriptor)
    }

    getWorkspace(slug: string): WorkspaceDescriptor | null {
        const workspace = this.readRegistry().workspaces.find((item) => item.slug === slug)
        return workspace ? mapWorkspaceToDescriptor(workspace) : null
    }

    getWorkspaceRecord(slug: string): WorkspaceRecord | null {
        return this.readRegistry().workspaces.find((item) => item.slug === slug) ?? null
    }

    getAdminSession(sessionId: string): AdminSessionRecord | null {
        if (!sessionId) {
            return null
        }

        return this.readRegistry().adminSessions.find((item) => item.id === sessionId) ?? null
    }

    createWorkspace(input: CreateWorkspaceInput): WorkspaceProvisioningResult {
        const normalizedName = normalizeRequiredText(input.name, 'name')
        const normalizedSlug = normalizeWorkspaceSlug(input.slug ?? normalizedName)
        const registry = this.readRegistry()

        if (registry.workspaces.some((workspace) => workspace.slug === normalizedSlug)) {
            throw new Error(`Workspace со slug "${normalizedSlug}" уже существует.`)
        }

        const now = new Date().toISOString()
        const token = generateApiToken()
        const nextApiKey: WorkspaceApiKeyRecord = {
            id: randomBytes(8).toString('hex'),
            label: normalizeOptionalText(input.apiKeyLabel) ?? DEFAULT_API_KEY_LABEL,
            tokenPreview: buildTokenPreview(token),
            tokenHash: hashToken(token),
            createdAt: now,
            lastUsedAt: null,
            disabledAt: null,
        }
        const nextWorkspace: WorkspaceRecord = {
            slug: normalizedSlug,
            name: normalizedName,
            createdAt: now,
            updatedAt: now,
            apiKeys: [nextApiKey],
            users: [],
            sessions: [],
        }

        registry.workspaces.push(nextWorkspace)
        this.writeRegistry(registry)

        return {
            workspace: mapWorkspaceToDescriptor(nextWorkspace),
            apiKey: {
                id: nextApiKey.id,
                label: nextApiKey.label,
                token,
                tokenPreview: nextApiKey.tokenPreview,
                createdAt: nextApiKey.createdAt,
            },
        }
    }

    createApiKey(slug: string, label = DEFAULT_API_KEY_LABEL): WorkspaceProvisioningResult {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)

        const now = new Date().toISOString()
        const token = generateApiToken()
        const nextApiKey: WorkspaceApiKeyRecord = {
            id: randomBytes(8).toString('hex'),
            label: normalizeOptionalText(label) ?? DEFAULT_API_KEY_LABEL,
            tokenPreview: buildTokenPreview(token),
            tokenHash: hashToken(token),
            createdAt: now,
            lastUsedAt: null,
            disabledAt: null,
        }

        workspace.apiKeys.push(nextApiKey)
        workspace.updatedAt = now
        this.writeRegistry(registry)

        return {
            workspace: mapWorkspaceToDescriptor(workspace),
            apiKey: {
                id: nextApiKey.id,
                label: nextApiKey.label,
                token,
                tokenPreview: nextApiKey.tokenPreview,
                createdAt: nextApiKey.createdAt,
            },
        }
    }

    createUser(slug: string, input: CreateWorkspaceUserInput): WorkspaceUserProvisioningResult {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)

        const now = new Date().toISOString()
        const token = generateWorkspaceUserToken()
        const nextUser: WorkspaceUserRecord = {
            id: randomBytes(8).toString('hex'),
            label: normalizeOptionalText(input.label) ?? DEFAULT_WORKSPACE_USER_LABEL,
            role: normalizeWorkspaceUserRole(input.role),
            tokenPreview: buildTokenPreview(token),
            tokenHash: hashToken(token),
            createdAt: now,
            lastUsedAt: null,
            disabledAt: null,
        }

        workspace.users.push(nextUser)
        workspace.updatedAt = now
        this.writeRegistry(registry)

        return {
            workspace: mapWorkspaceToDescriptor(workspace),
            user: {
                id: nextUser.id,
                label: nextUser.label,
                role: nextUser.role,
                token,
                tokenPreview: nextUser.tokenPreview,
                createdAt: nextUser.createdAt,
            },
        }
    }

    updateWorkspace(slug: string, input: UpdateWorkspaceInput): WorkspaceUpdateResult {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const nextName = normalizeRequiredText(input.name, 'name')
        const nextSlug = normalizeWorkspaceSlug(input.slug ?? slug)

        if (nextSlug !== slug && registry.workspaces.some((item) => item.slug === nextSlug)) {
            throw new Error(`Workspace со slug "${nextSlug}" уже существует.`)
        }

        const now = new Date().toISOString()
        workspace.name = nextName

        if (nextSlug !== slug) {
            workspace.slug = nextSlug
            revokeAllWorkspaceSessions(workspace, now)
        }

        workspace.updatedAt = now
        this.writeRegistry(registry)

        return {
            workspace: mapWorkspaceToDescriptor(workspace),
            previousSlug: slug,
        }
    }

    deleteWorkspace(slug: string): WorkspaceDescriptor {
        const registry = this.readRegistry()
        const workspaceIndex = registry.workspaces.findIndex((item) => item.slug === slug)

        if (workspaceIndex < 0) {
            throw new Error(`Workspace со slug "${slug}" не найден.`)
        }

        const [workspace] = registry.workspaces.splice(workspaceIndex, 1)
        this.writeRegistry(registry)
        return mapWorkspaceToDescriptor(workspace)
    }

    updateUserRole(slug: string, userId: string, role: 'owner' | 'viewer'): WorkspaceUserRoleUpdateResult {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const user = workspace.users.find((item) => item.id === userId)

        if (!user) {
            throw new Error(`Пользователь "${userId}" не найден в workspace "${slug}".`)
        }

        const nextRole = normalizeWorkspaceUserRole(role)

        if (user.role !== nextRole) {
            const now = new Date().toISOString()
            user.role = nextRole
            revokeWorkspaceSessionsBySubject(workspace, 'workspace-user', user.id, now)
            workspace.updatedAt = now
            this.writeRegistry(registry)
        }

        return {
            workspace: mapWorkspaceToDescriptor(workspace),
            userId: user.id,
            role: user.role,
        }
    }

    disableApiKey(slug: string, apiKeyId: string): WorkspaceDescriptor {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const apiKey = workspace.apiKeys.find((item) => item.id === apiKeyId)

        if (!apiKey) {
            throw new Error(`API key "${apiKeyId}" не найден в workspace "${slug}".`)
        }

        if (apiKey.disabledAt) {
            return mapWorkspaceToDescriptor(workspace)
        }

        const now = new Date().toISOString()
        apiKey.disabledAt = now
        revokeWorkspaceSessionsBySubject(workspace, 'workspace-api-key', apiKey.id, now)
        workspace.updatedAt = now
        this.writeRegistry(registry)

        return mapWorkspaceToDescriptor(workspace)
    }

    deleteApiKey(slug: string, apiKeyId: string): WorkspaceDescriptor {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const apiKeyIndex = workspace.apiKeys.findIndex((item) => item.id === apiKeyId)

        if (apiKeyIndex < 0) {
            throw new Error(`API key "${apiKeyId}" не найден в workspace "${slug}".`)
        }

        const now = new Date().toISOString()
        const [apiKey] = workspace.apiKeys.splice(apiKeyIndex, 1)
        revokeWorkspaceSessionsBySubject(workspace, 'workspace-api-key', apiKey.id, now)
        workspace.updatedAt = now
        this.writeRegistry(registry)

        return mapWorkspaceToDescriptor(workspace)
    }

    disableUser(slug: string, userId: string): WorkspaceDescriptor {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const user = workspace.users.find((item) => item.id === userId)

        if (!user) {
            throw new Error(`Пользователь "${userId}" не найден в workspace "${slug}".`)
        }

        if (user.disabledAt) {
            return mapWorkspaceToDescriptor(workspace)
        }

        const now = new Date().toISOString()
        user.disabledAt = now
        revokeWorkspaceSessionsBySubject(workspace, 'workspace-user', user.id, now)
        workspace.updatedAt = now
        this.writeRegistry(registry)

        return mapWorkspaceToDescriptor(workspace)
    }

    deleteUser(slug: string, userId: string): WorkspaceDescriptor {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const userIndex = workspace.users.findIndex((item) => item.id === userId)

        if (userIndex < 0) {
            throw new Error(`Пользователь "${userId}" не найден в workspace "${slug}".`)
        }

        const now = new Date().toISOString()
        const [user] = workspace.users.splice(userIndex, 1)
        revokeWorkspaceSessionsBySubject(workspace, 'workspace-user', user.id, now)
        workspace.updatedAt = now
        this.writeRegistry(registry)

        return mapWorkspaceToDescriptor(workspace)
    }

    createAdminSession(expiresAt: string, label = DEFAULT_ADMIN_SESSION_LABEL): AdminSessionRecord {
        const registry = this.readRegistry()
        const now = new Date().toISOString()
        const session: AdminSessionRecord = {
            id: randomBytes(8).toString('hex'),
            label: normalizeOptionalText(label) ?? DEFAULT_ADMIN_SESSION_LABEL,
            createdAt: now,
            expiresAt,
            lastSeenAt: now,
            revokedAt: null,
        }

        registry.adminSessions.push(session)
        this.writeRegistry(registry)
        return session
    }

    createWorkspaceSession(
        slug: string,
        options: {
            kind: WorkspaceSessionKind
            subjectId: string
            label: string
            scope: 'workspace:read' | 'workspace:ingest'
            role?: 'owner' | 'viewer'
            activatedAt?: string | null
            expiresAt?: string | null
            ttlMinutes?: number | null
        },
    ): WorkspaceSessionRecord {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const now = new Date().toISOString()
        const activatedAt = options.activatedAt === undefined ? now : options.activatedAt
        const session: WorkspaceSessionRecord = {
            id: randomBytes(8).toString('hex'),
            kind: options.kind,
            subjectId: options.subjectId,
            label: normalizeRequiredText(options.label, 'label'),
            scope: options.scope,
            role: options.scope === 'workspace:read' ? options.role ?? null : null,
            createdAt: now,
            activatedAt,
            expiresAt: options.expiresAt ?? null,
            ttlMinutes: normalizeNullablePositiveInteger(options.ttlMinutes ?? undefined) ?? null,
            lastSeenAt: now,
            revokedAt: null,
        }

        workspace.sessions.push(session)
        workspace.updatedAt = now
        this.writeRegistry(registry)

        return session
    }

    findWorkspaceSession(sessionId: string, kind?: WorkspaceSessionKind): { workspace: WorkspaceRecord; session: WorkspaceSessionRecord } | null {
        if (!sessionId) {
            return null
        }

        const registry = this.readRegistry()

        for (const workspace of registry.workspaces) {
            const session = workspace.sessions.find((item) => item.id === sessionId && (!kind || item.kind === kind))

            if (session) {
                return { workspace, session }
            }
        }

        return null
    }

    activateWorkspaceShareLink(slug: string, sessionId: string): WorkspaceSessionRecord {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const session = workspace.sessions.find((item) => item.id === sessionId)

        if (!session || session.kind !== 'workspace-share-link') {
            throw new Error(`Share link session "${sessionId}" не найдена в workspace "${slug}".`)
        }

        if (session.revokedAt) {
            return session
        }

        if (session.activatedAt && session.expiresAt) {
            return session
        }

        const ttlMinutes = session.ttlMinutes ?? inferShareLinkTtlMinutes(session.label)
        const now = new Date().toISOString()
        session.activatedAt = now
        session.expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString()
        session.lastSeenAt = now
        session.ttlMinutes = ttlMinutes
        workspace.updatedAt = now
        this.writeRegistry(registry)

        return session
    }

    isAdminSessionActive(sessionId: string): boolean {
        if (!sessionId) {
            return false
        }

        const session = this.readRegistry().adminSessions.find((item) => item.id === sessionId)
        return isSessionActive(session)
    }

    touchAdminSession(sessionId: string): void {
        if (!sessionId) {
            return
        }

        const registry = this.readRegistry()
        const session = registry.adminSessions.find((item) => item.id === sessionId)

        if (!session || !isSessionActive(session)) {
            return
        }

        const now = new Date().toISOString()

        if (!shouldRefreshLastSeen(session.lastSeenAt, now)) {
            return
        }

        session.lastSeenAt = now
        this.writeRegistry(registry)
    }

    revokeAdminSession(sessionId: string): void {
        if (!sessionId) {
            return
        }

        const registry = this.readRegistry()
        const session = registry.adminSessions.find((item) => item.id === sessionId)

        if (!session || session.revokedAt) {
            return
        }

        session.revokedAt = new Date().toISOString()
        this.writeRegistry(registry)
    }

    getServerSettings(defaults: ServerSettingsRecord): ServerSettingsRecord {
        return mergeServerSettings(this.readRegistry().serverSettings, defaults)
    }

    updateServerSettings(input: UpdateServerSettingsInput, defaults: ServerSettingsRecord): ServerSettingsRecord {
        const registry = this.readRegistry()
        registry.serverSettings = mergePersistedServerSettings(registry.serverSettings, input)
        this.writeRegistry(registry)
        return mergeServerSettings(registry.serverSettings, defaults)
    }

    listAdminAuditLog(limit = MAX_ADMIN_AUDIT_LOG_ENTRIES): AdminAuditRecord[] {
        return this.listAdminAuditPage(1, limit).entries
    }

    listAdminAuditPage(page = 1, pageSize = 20): AdminAuditPage {
        const normalizedPageSize = Math.min(Math.max(1, Math.trunc(pageSize) || 20), MAX_ADMIN_AUDIT_LOG_ENTRIES)
        const sortedEntries = this.readRegistry().adminAuditLog
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

    recordAdminAudit(input: {
        action: AdminAuditAction
        actorLabel: string
        actorSessionId?: string | null
        workspaceSlug?: string | null
        targetType: AdminAuditRecord['targetType']
        targetId?: string | null
        summary: string
        details?: Record<string, string | number | boolean | null | undefined>
    }): AdminAuditRecord {
        const registry = this.readRegistry()
        const entry: AdminAuditRecord = {
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

        registry.adminAuditLog = [entry, ...registry.adminAuditLog].slice(0, MAX_ADMIN_AUDIT_LOG_ENTRIES)
        this.writeRegistry(registry)
        return entry
    }

    isWorkspaceSessionActive(slug: string, sessionId: string, kind?: WorkspaceSessionKind): boolean {
        if (!sessionId) {
            return false
        }

        const workspace = this.readRegistry().workspaces.find((item) => item.slug === slug)

        if (!workspace) {
            return false
        }

        const session = workspace.sessions.find((item) => item.id === sessionId)

        if (!session || (kind && session.kind !== kind)) {
            return false
        }

        return isSessionActive(session)
    }

    touchWorkspaceSession(slug: string, sessionId: string): void {
        if (!sessionId) {
            return
        }

        const registry = this.readRegistry()
        const workspace = registry.workspaces.find((item) => item.slug === slug)

        if (!workspace) {
            return
        }

        const session = workspace.sessions.find((item) => item.id === sessionId)

        if (!session || !isSessionActive(session)) {
            return
        }

        const now = new Date().toISOString()

        if (!shouldRefreshLastSeen(session.lastSeenAt, now)) {
            return
        }

        session.lastSeenAt = now
        workspace.updatedAt = now
        this.writeRegistry(registry)
    }

    revokeWorkspaceSession(slug: string, sessionId: string): WorkspaceDescriptor {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const session = workspace.sessions.find((item) => item.id === sessionId)

        if (!session) {
            throw new Error(`Сессия "${sessionId}" не найдена в workspace "${slug}".`)
        }

        if (!session.revokedAt) {
            const now = new Date().toISOString()
            session.revokedAt = now
            workspace.updatedAt = now
            this.writeRegistry(registry)
        }

        return mapWorkspaceToDescriptor(workspace)
    }

    authenticate(token: string): WorkspaceApiAuthResult | null {
        const normalizedToken = normalizeOptionalText(token)

        if (!normalizedToken) {
            return null
        }

        const tokenHash = hashToken(normalizedToken)
        const registry = this.readRegistry()

        for (const workspace of registry.workspaces) {
            const apiKey = workspace.apiKeys.find((item) => item.tokenHash === tokenHash)

            if (!apiKey || apiKey.disabledAt) {
                continue
            }

            apiKey.lastUsedAt = new Date().toISOString()
            workspace.updatedAt = apiKey.lastUsedAt
            this.writeRegistry(registry)

            return { workspace, apiKey }
        }

        return null
    }

    authenticateWorkspaceUser(token: string): WorkspaceUserAuthResult | null {
        const normalizedToken = normalizeOptionalText(token)

        if (!normalizedToken) {
            return null
        }

        const tokenHash = hashToken(normalizedToken)
        const registry = this.readRegistry()

        for (const workspace of registry.workspaces) {
            const user = workspace.users.find((item) => item.tokenHash === tokenHash)

            if (!user || user.disabledAt) {
                continue
            }

            user.lastUsedAt = new Date().toISOString()
            workspace.updatedAt = user.lastUsedAt
            this.writeRegistry(registry)

            return { workspace, user }
        }

        return null
    }

    private readRegistry(): WorkspaceRegistrySnapshot {
        const registry = this.storage.readRegistry()

        return {
            ...registry,
            adminSessions: Array.isArray(registry.adminSessions) ? registry.adminSessions.map(normalizeAdminSessionRecord) : [],
            adminAuditLog: Array.isArray(registry.adminAuditLog) ? registry.adminAuditLog.map(normalizeAdminAuditRecord) : [],
            serverSettings: normalizePersistedServerSettings(registry.serverSettings),
            workspaces: registry.workspaces.map(normalizeWorkspaceRecord),
        }
    }

    private writeRegistry(registry: WorkspaceRegistrySnapshot): void {
        this.storage.writeRegistry(registry)
    }
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

function mapWorkspaceToDescriptor(workspace: WorkspaceRecord): WorkspaceDescriptor {
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

function normalizeRequiredText(value: string, fieldName: string): string {
    const normalizedValue = normalizeOptionalText(value)

    if (!normalizedValue) {
        throw new Error(`Поле "${fieldName}" обязательно.`)
    }

    return normalizedValue
}

function generateApiToken(): string {
    return `aqp_${randomBytes(24).toString('hex')}`
}

function generateWorkspaceUserToken(): string {
    return `aqu_${randomBytes(24).toString('hex')}`
}

function buildTokenPreview(token: string): string {
    return `${token.slice(0, 10)}…`
}

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

function findWorkspaceOrThrow(registry: WorkspaceRegistrySnapshot, slug: string): WorkspaceRecord {
    const workspace = registry.workspaces.find((item) => item.slug === slug)

    if (!workspace) {
        throw new Error(`Workspace со slug "${slug}" не найден.`)
    }

    return workspace
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

function revokeWorkspaceSessionsBySubject(workspace: WorkspaceRecord, kind: WorkspaceSessionKind, subjectId: string, revokedAt: string): void {
    for (const session of workspace.sessions) {
        if (session.kind === kind && session.subjectId === subjectId && !session.revokedAt) {
            session.revokedAt = revokedAt
        }
    }
}

function revokeAllWorkspaceSessions(workspace: WorkspaceRecord, revokedAt: string): void {
    for (const session of workspace.sessions) {
        if (!session.revokedAt) {
            session.revokedAt = revokedAt
        }
    }
}

function normalizeNullablePositiveInteger(value: number | undefined): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}


