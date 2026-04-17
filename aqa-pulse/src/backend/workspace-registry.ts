import { createHash, randomBytes } from 'node:crypto'
import { normalizeOptionalText } from '../shared/text-utils'
import type {
    AdminSessionRecord,
    CreateWorkspaceInput,
    CreateWorkspaceUserInput,
    WorkspaceApiAuthResult,
    WorkspaceApiKeyRecord,
    WorkspaceDescriptor,
    WorkspaceProvisioningResult,
    WorkspaceRecord,
    WorkspaceRegistrySnapshot,
    WorkspaceSessionKind,
    WorkspaceSessionRecord,
    WorkspaceUserAuthResult,
    WorkspaceUserProvisioningResult,
    WorkspaceUserRecord,
} from './contracts'
import { FileSystemWorkspaceRegistryStorage, type WorkspaceRegistryStorage } from './storage'

const DEFAULT_API_KEY_LABEL = 'Default ingestion key'
const DEFAULT_WORKSPACE_USER_LABEL = 'Workspace owner'
const DEFAULT_ADMIN_SESSION_LABEL = 'Admin session'
const SESSION_ACTIVITY_REFRESH_MS = 60_000

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
            role: input.role === 'owner' ? 'owner' : 'viewer',
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
            expiresAt: string
        },
    ): WorkspaceSessionRecord {
        const registry = this.readRegistry()
        const workspace = findWorkspaceOrThrow(registry, slug)
        const now = new Date().toISOString()
        const session: WorkspaceSessionRecord = {
            id: randomBytes(8).toString('hex'),
            kind: options.kind,
            subjectId: options.subjectId,
            label: normalizeRequiredText(options.label, 'label'),
            scope: options.scope,
            role: options.scope === 'workspace:read' ? options.role ?? null : null,
            createdAt: now,
            expiresAt: options.expiresAt,
            lastSeenAt: now,
            revokedAt: null,
        }

        workspace.sessions.push(session)
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
        role: user.role === 'owner' ? 'owner' : 'viewer',
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

function normalizeWorkspaceSessionRecord(session: Partial<WorkspaceSessionRecord>): WorkspaceSessionRecord {
    const createdAt = typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString()

    return {
        id: typeof session.id === 'string' ? session.id : randomBytes(8).toString('hex'),
        kind: session.kind === 'workspace-api-key' ? 'workspace-api-key' : 'workspace-user',
        subjectId: typeof session.subjectId === 'string' ? session.subjectId : randomBytes(8).toString('hex'),
        label: normalizeOptionalText(session.label) ?? 'Session',
        scope: session.scope === 'workspace:ingest' ? 'workspace:ingest' : 'workspace:read',
        role: session.role === 'owner' ? 'owner' : session.role === 'viewer' ? 'viewer' : null,
        createdAt,
        expiresAt: typeof session.expiresAt === 'string' ? session.expiresAt : createdAt,
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
                expiresAt: session.expiresAt,
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

function normalizeWorkspaceSlug(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    if (!slug) {
        throw new Error('Не удалось сформировать slug workspace. Используй латиницу или цифры.')
    }

    return slug
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

function revokeWorkspaceSessionsBySubject(workspace: WorkspaceRecord, kind: WorkspaceSessionKind, subjectId: string, revokedAt: string): void {
    for (const session of workspace.sessions) {
        if (session.kind === kind && session.subjectId === subjectId && !session.revokedAt) {
            session.revokedAt = revokedAt
        }
    }
}

function isSessionActive(session: Pick<AdminSessionRecord, 'expiresAt' | 'revokedAt'> | Pick<WorkspaceSessionRecord, 'expiresAt' | 'revokedAt'> | undefined): boolean {
    if (!session || session.revokedAt) {
        return false
    }

    const expiresAt = Date.parse(session.expiresAt)

    return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

function shouldRefreshLastSeen(lastSeenAt: string, nowIso: string): boolean {
    const lastSeenTime = Date.parse(lastSeenAt)
    const nowTime = Date.parse(nowIso)

    if (!Number.isFinite(lastSeenTime) || !Number.isFinite(nowTime)) {
        return true
    }

    return nowTime - lastSeenTime >= SESSION_ACTIVITY_REFRESH_MS
}


