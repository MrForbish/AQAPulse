import { createHash, randomBytes } from 'node:crypto'
import type {
    CreateWorkspaceInput,
    CreateWorkspaceUserInput,
    WorkspaceApiAuthResult,
    WorkspaceApiKeyRecord,
    WorkspaceDescriptor,
    WorkspaceProvisioningResult,
    WorkspaceRecord,
    WorkspaceRegistrySnapshot,
    WorkspaceUserAuthResult,
    WorkspaceUserProvisioningResult,
    WorkspaceUserRecord,
} from './contracts'
import { FileSystemWorkspaceRegistryStorage, type WorkspaceRegistryStorage } from './storage'

const DEFAULT_API_KEY_LABEL = 'Default ingestion key'
const DEFAULT_WORKSPACE_USER_LABEL = 'Workspace owner'

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
            throw new Error(`Workspace со slug \"${normalizedSlug}\" уже существует.`)
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
        }
        const nextWorkspace: WorkspaceRecord = {
            slug: normalizedSlug,
            name: normalizedName,
            createdAt: now,
            updatedAt: now,
            apiKeys: [nextApiKey],
            users: [],
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
        const workspace = registry.workspaces.find((item) => item.slug === slug)

        if (!workspace) {
            throw new Error(`Workspace со slug \"${slug}\" не найден.`)
        }

        const now = new Date().toISOString()
        const token = generateApiToken()
        const nextApiKey: WorkspaceApiKeyRecord = {
            id: randomBytes(8).toString('hex'),
            label: normalizeOptionalText(label) ?? DEFAULT_API_KEY_LABEL,
            tokenPreview: buildTokenPreview(token),
            tokenHash: hashToken(token),
            createdAt: now,
            lastUsedAt: null,
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
        const workspace = registry.workspaces.find((item) => item.slug === slug)

        if (!workspace) {
            throw new Error(`Workspace со slug "${slug}" не найден.`)
        }

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

    authenticate(token: string): WorkspaceApiAuthResult | null {
        const normalizedToken = normalizeOptionalText(token)

        if (!normalizedToken) {
            return null
        }

        const tokenHash = hashToken(normalizedToken)
        const registry = this.readRegistry()

        for (const workspace of registry.workspaces) {
            const apiKey = workspace.apiKeys.find((item) => item.tokenHash === tokenHash)

            if (!apiKey) {
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

            if (!user) {
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
        })),
        users: workspace.users.map((user) => ({
            id: user.id,
            label: user.label,
            role: user.role,
            tokenPreview: user.tokenPreview,
            createdAt: user.createdAt,
            lastUsedAt: user.lastUsedAt,
        })),
    }
}

function normalizeRequiredText(value: string, fieldName: string): string {
    const normalizedValue = normalizeOptionalText(value)

    if (!normalizedValue) {
        throw new Error(`Поле \"${fieldName}\" обязательно.`)
    }

    return normalizedValue
}

function normalizeOptionalText(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
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


