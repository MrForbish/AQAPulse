/**
 * Назначение файла: реализует центральный реестр workspace,
 * в котором хранятся сессии, учётные данные, настройки сервера и журнал действий администратора.
 */
import { randomBytes } from 'node:crypto'
import { inferShareLinkTtlMinutes, isSessionActive, shouldRefreshLastSeen } from '../../domain/session-rules'
import { mergePersistedServerSettings, mergeServerSettings } from '../../domain/server-settings-rules'
import { normalizeWorkspaceSlug, normalizeWorkspaceUserRole } from '../../domain/workspace-rules'
import { normalizeOptionalText } from '../../../shared/text-utils'
import type {
	AdminAuditAction,
	AdminAuditPage,
	AdminAuditRecord,
	AdminSessionRecord,
	CreateWorkspaceInput,
	CreateWorkspaceUserInput,
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
	WorkspaceUserProvisioningResult,
	WorkspaceUserRecord,
	WorkspaceUserRoleUpdateResult,
} from '../../contracts'
import { FileSystemWorkspaceRegistryStorage } from './file-system-storage'
import type { WorkspaceRegistryStorage } from './storage-contracts'
import {
	buildAdminAuditPage,
	buildAdminAuditRecord,
	buildTokenPreview,
	DEFAULT_ADMIN_SESSION_LABEL,
	DEFAULT_API_KEY_LABEL,
	DEFAULT_WORKSPACE_USER_LABEL,
	findWorkspaceOrThrow,
	generateApiToken,
	generateWorkspaceUserToken,
	hashToken,
	mapWorkspaceToDescriptor,
	MAX_ADMIN_AUDIT_LOG_ENTRIES,
	normalizeNullablePositiveInteger,
	normalizeRequiredText,
	normalizeWorkspaceRegistrySnapshot,
	revokeAllWorkspaceSessions,
	revokeWorkspaceSessionsBySubject,
} from './workspace-registry-support'

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

	/**
	 * Создаёт новый workspace вместе с первичным ключом загрузки
	 * и сохраняет результат одной записью в реестр.
	 */
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

	/**
	 * Добавляет новый ключ загрузки в существующий workspace
	 * и возвращает исходный токен в единственный момент, когда его ещё можно показать вызывающему коду.
	 */
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

	/**
	 * Создаёт пользователя workspace с сохранённой ролью
	 * и однократно возвращает исходный токен входа.
	 */
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

	/**
	 * Открывает серверную admin-сессию, которую затем проверяют middleware аутентификации
	 * вместе с данными из JWT.
	 */
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

	/**
	 * Создаёт сессию workspace для пользователя, API-ключа или общей ссылки
	 * и сохраняет её состояние в реестре независимо от HTTP-слоя.
	 */
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

	/**
	 * Активирует сессию общей ссылки только при первом использовании
	 * и сохраняет вычисленное время жизни в состоянии сессии.
	 */
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
		return buildAdminAuditPage(this.readRegistry().adminAuditLog, page, pageSize)
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
		const entry = buildAdminAuditRecord(input)

		registry.adminAuditLog = [entry, ...registry.adminAuditLog].slice(0, MAX_ADMIN_AUDIT_LOG_ENTRIES)
		this.writeRegistry(registry)
		return entry
	}

	/**
	 * Проверяет, активна ли сессия workspace, при необходимости ограничивая проверку конкретным типом сессии,
	 * чтобы слой безопасности не читал реестр напрямую.
	 */
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

	/**
	 * Обновляет время последней активности для действующей сессии,
	 * но делает это не на каждый запрос, чтобы не перегружать запись в реестр.
	 */
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

	/**
	 * Отзывает сессию workspace без удаления самой записи,
	 * чтобы сохранить понятную историю её жизненного цикла.
	 */
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
		return normalizeWorkspaceRegistrySnapshot(this.storage.readRegistry())
	}

	private writeRegistry(registry: WorkspaceRegistrySnapshot): void {
		this.storage.writeRegistry(registry)
	}
}