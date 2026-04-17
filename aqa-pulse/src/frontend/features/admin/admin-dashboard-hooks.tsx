import React from 'react'
import { useNavigate } from 'react-router-dom'
import type {
    AdminAuditRecord,
    AdminIngestionHealthReport,
    ServerSettingsRecord,
    WorkspaceDescriptor,
    WorkspaceProvisioningResult,
    WorkspaceShareLinkProvisioningResult,
    WorkspaceUpdateResult,
    WorkspaceUserRoleUpdateResult,
    WorkspaceUserProvisioningResult,
} from '../../../backend/contracts'
import { isUnauthorizedError, readErrorMessage } from '../../shared/http'
import {
    createWorkspace,
    createWorkspaceApiKey,
    createWorkspaceShareLink,
    createWorkspaceUser,
    deleteWorkspace,
    deleteWorkspaceApiKey,
    deleteWorkspaceUser,
    disableWorkspaceApiKey,
    disableWorkspaceUser,
    fetchAdminAuditLog,
    fetchAdminIngestionHealth,
    fetchAdminServerSettings,
    fetchAdminWorkspaces,
    logoutAdmin,
    revokeWorkspaceSession,
    updateAdminServerSettings,
    updateWorkspace,
    updateWorkspaceUserRole,
} from './admin-api'

export interface DashboardActionResult {
    title: string
    tone: 'success' | 'error' | 'info'
    details: Record<string, string>
    copyItems?: DashboardCopyItem[]
}

export interface DashboardCopyItem {
    label: string
    value: string
}

/**
 * Admin dashboard state объединяет initial bootstrap data, lazy loading registry и все provisioning actions в одном hook, чтобы page-компонент оставался декларативным и не управлял вручную множеством form/result состояний.
 */
export function useAdminDashboardState(initialWorkspaces: WorkspaceDescriptor[] | null): {
    workspaces: WorkspaceDescriptor[]
    serverSettings: ServerSettingsRecord | null
    auditEntries: AdminAuditRecord[]
    ingestionHealth: AdminIngestionHealthReport | null
    isLoading: boolean
    errorMessage: string | null
    actionResult: DashboardActionResult | null
    dismissActionResult: () => void
    busyKey: string | null
    createWorkspace: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
    updateWorkspace: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    deleteWorkspace: (slug: string) => Promise<void>
    createApiKey: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    createShareLink: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    createUser: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    updateUserRole: (event: React.FormEvent<HTMLFormElement>, slug: string, userId: string) => Promise<void>
    disableApiKey: (slug: string, apiKeyId: string) => Promise<void>
    deleteApiKey: (slug: string, apiKeyId: string) => Promise<void>
    disableUser: (slug: string, userId: string) => Promise<void>
    deleteUser: (slug: string, userId: string) => Promise<void>
    revokeSession: (slug: string, sessionId: string) => Promise<void>
    updateServerSettings: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
    logout: () => Promise<void>
} {
    const navigate = useNavigate()
    const [workspaces, setWorkspaces] = React.useState<WorkspaceDescriptor[]>(initialWorkspaces ?? [])
    const [serverSettings, setServerSettings] = React.useState<ServerSettingsRecord | null>(null)
    const [auditEntries, setAuditEntries] = React.useState<AdminAuditRecord[]>([])
    const [ingestionHealth, setIngestionHealth] = React.useState<AdminIngestionHealthReport | null>(null)
    const [isLoading, setIsLoading] = React.useState(initialWorkspaces === null)
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
    const [actionResult, setActionResult] = React.useState<DashboardActionResult | null>(null)
    const [busyKey, setBusyKey] = React.useState<string | null>(null)

    const dismissActionResult = React.useCallback(() => {
        setActionResult(null)
    }, [])

    const handleUnauthorized = React.useCallback((error: unknown): boolean => {
        if (isUnauthorizedError(error)) {
            navigate('/admin/login', { replace: true })
            return true
        }

        return false
    }, [navigate])

    const refreshSupplementaryData = React.useCallback(async (): Promise<void> => {
        try {
            const [settings, entries, health] = await Promise.all([
                fetchAdminServerSettings(),
                fetchAdminAuditLog(),
                fetchAdminIngestionHealth(),
            ])

            setServerSettings(settings)
            setAuditEntries(entries)
            setIngestionHealth(health)
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setErrorMessage(readErrorMessage(error, 'Не удалось загрузить admin telemetry.'))
        }
    }, [handleUnauthorized])

    React.useEffect(() => {
        let isMounted = true

        async function loadAdminState(): Promise<void> {
            try {
                if (initialWorkspaces === null) {
                    const [loadedWorkspaces, settings, entries, health] = await Promise.all([
                        fetchAdminWorkspaces(),
                        fetchAdminServerSettings(),
                        fetchAdminAuditLog(),
                        fetchAdminIngestionHealth(),
                    ])

                    if (!isMounted) {
                        return
                    }

                    setWorkspaces(loadedWorkspaces)
                    setServerSettings(settings)
                    setAuditEntries(entries)
                    setIngestionHealth(health)
                } else {
                    setWorkspaces(initialWorkspaces)
                    await refreshSupplementaryData()
                }
            } catch (error) {
                if (!isMounted) {
                    return
                }

                if (handleUnauthorized(error)) {
                    return
                }

                setErrorMessage(readErrorMessage(error, 'Не удалось загрузить admin dashboard.'))
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        void loadAdminState()

        return () => {
            isMounted = false
        }
    }, [handleUnauthorized, initialWorkspaces, refreshSupplementaryData])

    async function logout(): Promise<void> {
        setBusyKey('logout')

        try {
            await logoutAdmin()
            window.location.assign('/admin/login')
        } catch (error) {
            setErrorMessage(readErrorMessage(error, 'Не удалось завершить admin session.'))
            setBusyKey(null)
        }
    }

    async function createWorkspaceAction(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        const name = String(formData.get('name') ?? '').trim()
        const slug = String(formData.get('slug') ?? '').trim()
        const apiKeyLabel = String(formData.get('apiKeyLabel') ?? '').trim()

        if (!name) {
            setActionResult({ title: 'Ошибка создания workspace', tone: 'error', details: { error: 'Поле name обязательно.' } })
            return
        }

        setBusyKey('workspace:create')
        setErrorMessage(null)

        try {
            const createdWorkspace = await createWorkspace({ name, slug: slug || undefined, apiKeyLabel: apiKeyLabel || undefined })
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, createdWorkspace.workspace, true))
            setActionResult({
                title: 'Workspace создан',
                tone: 'success',
                details: mapWorkspaceProvisioningDetails(createdWorkspace),
                copyItems: [
                    { label: 'API key token', value: createdWorkspace.apiKey.token },
                    { label: 'Workspace login path', value: `/w/${createdWorkspace.workspace.slug}/login` },
                    { label: 'API key exchange path', value: `/auth/workspaces/${createdWorkspace.workspace.slug}/api-keys/login` },
                ],
            })
            form.reset()
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка создания workspace', tone: 'error', details: { error: readErrorMessage(error, 'Не удалось создать workspace.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function updateWorkspaceAction(event: React.FormEvent<HTMLFormElement>, slug: string): Promise<void> {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        const name = String(formData.get('name') ?? '').trim()
        const nextSlug = String(formData.get('slug') ?? '').trim()
        const submitKey = `workspace:update:${slug}`

        if (!name) {
            setActionResult({ title: 'Ошибка обновления workspace', tone: 'error', details: { workspace: slug, error: 'Поле name обязательно.' } })
            return
        }

        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const result = await updateWorkspace(slug, { name, slug: nextSlug || slug })
            setWorkspaces((currentWorkspaces) => mergeWorkspaceByPreviousSlug(currentWorkspaces, result.previousSlug, result.workspace))
            setActionResult({ title: 'Workspace обновлён', tone: 'success', details: mapWorkspaceUpdateDetails(result) })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка обновления workspace', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось обновить workspace.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function deleteWorkspaceAction(slug: string): Promise<void> {
        if (typeof window !== 'undefined' && !window.confirm(`Удалить workspace ${slug} вместе с его history, raw reports и access records?`)) {
            return
        }

        const submitKey = `workspace:delete:${slug}`
        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            await deleteWorkspace(slug)
            setWorkspaces((currentWorkspaces) => currentWorkspaces.filter((workspace) => workspace.slug !== slug))
            setActionResult({ title: 'Workspace удалён', tone: 'info', details: { workspace: slug } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка удаления workspace', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось удалить workspace.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function createApiKeyAction(event: React.FormEvent<HTMLFormElement>, slug: string): Promise<void> {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        const label = String(formData.get('label') ?? '').trim()
        const submitKey = `api-key:${slug}`

        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const createdApiKey = await createWorkspaceApiKey(slug, label || undefined)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, createdApiKey.workspace))
            setActionResult({
                title: 'API key создан',
                tone: 'success',
                details: {
                    workspace: slug,
                    label: createdApiKey.apiKey.label,
                    apiKeyToken: createdApiKey.apiKey.token,
                    apiKeyExchangeUrl: `/auth/workspaces/${slug}/api-keys/login`,
                },
                copyItems: [
                    { label: 'API key token', value: createdApiKey.apiKey.token },
                    { label: 'API key exchange path', value: `/auth/workspaces/${slug}/api-keys/login` },
                ],
            })
            form.reset()
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({
                title: 'Ошибка создания API key',
                tone: 'error',
                details: {
                    workspace: slug,
                    error: readErrorMessage(error, 'Не удалось создать API key.'),
                },
            })
        } finally {
            setBusyKey(null)
        }
    }

    async function createUserAction(event: React.FormEvent<HTMLFormElement>, slug: string): Promise<void> {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        const label = String(formData.get('label') ?? '').trim()
        const role = formData.get('role') === 'owner' ? 'owner' : 'viewer'
        const submitKey = `user:${slug}`

        if (!label) {
            setActionResult({ title: 'Ошибка создания user token', tone: 'error', details: { workspace: slug, error: 'Поле label обязательно.' } })
            return
        }

        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const createdUser = await createWorkspaceUser(slug, { label, role })
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, createdUser.workspace))
            setActionResult({
                title: 'Workspace user token создан',
                tone: 'success',
                details: mapWorkspaceUserProvisioningDetails(createdUser),
                copyItems: [
                    { label: 'Workspace user token', value: createdUser.user.token },
                    { label: 'Workspace login path', value: `/w/${createdUser.workspace.slug}/login` },
                ],
            })
            form.reset()
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({
                title: 'Ошибка создания user token',
                tone: 'error',
                details: {
                    workspace: slug,
                    error: readErrorMessage(error, 'Не удалось создать user token.'),
                },
            })
        } finally {
            setBusyKey(null)
        }
    }

    async function createShareLinkAction(event: React.FormEvent<HTMLFormElement>, slug: string): Promise<void> {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        const ttlMinutes = formData.get('ttlMinutes') === '5' ? 5 : 10
        const submitKey = `share-link:${slug}`

        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const result = await createWorkspaceShareLink(slug, ttlMinutes)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, result.workspace))
            setActionResult({
                title: 'Share link создан',
                tone: 'success',
                details: mapWorkspaceShareLinkDetails(result),
                copyItems: [{ label: 'Short share link', value: result.shareLinkUrl }],
            })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка создания share link', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось создать временную ссылку.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function updateUserRoleAction(event: React.FormEvent<HTMLFormElement>, slug: string, userId: string): Promise<void> {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const role = formData.get('role') === 'owner' ? 'owner' : 'viewer'
        const submitKey = `user:role:${slug}:${userId}`

        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const result = await updateWorkspaceUserRole(slug, userId, role)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, result.workspace))
            setActionResult({ title: 'Роль пользователя обновлена', tone: 'info', details: mapWorkspaceUserRoleUpdateDetails(result) })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка обновления роли', tone: 'error', details: { workspace: slug, userId, error: readErrorMessage(error, 'Не удалось обновить роль пользователя.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function disableApiKeyAction(slug: string, apiKeyId: string): Promise<void> {
        const submitKey = `api-key:disable:${slug}:${apiKeyId}`
        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const workspace = await disableWorkspaceApiKey(slug, apiKeyId)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, workspace))
            setActionResult({ title: 'Ключ загрузки отключён', tone: 'info', details: { workspace: slug, apiKeyId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка отключения ключа', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось отключить ключ загрузки.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function deleteApiKeyAction(slug: string, apiKeyId: string): Promise<void> {
        if (typeof window !== 'undefined' && !window.confirm(`Удалить ключ загрузки ${apiKeyId} из workspace ${slug}?`)) {
            return
        }

        const submitKey = `api-key:delete:${slug}:${apiKeyId}`
        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const workspace = await deleteWorkspaceApiKey(slug, apiKeyId)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, workspace))
            setActionResult({ title: 'Ключ загрузки удалён', tone: 'info', details: { workspace: slug, apiKeyId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка удаления ключа', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось удалить ключ загрузки.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function disableUserAction(slug: string, userId: string): Promise<void> {
        const submitKey = `user:disable:${slug}:${userId}`
        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const workspace = await disableWorkspaceUser(slug, userId)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, workspace))
            setActionResult({ title: 'Доступ пользователя отключён', tone: 'info', details: { workspace: slug, userId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка отключения пользователя', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось отключить пользователя.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function deleteUserAction(slug: string, userId: string): Promise<void> {
        if (typeof window !== 'undefined' && !window.confirm(`Удалить пользователя ${userId} из workspace ${slug}?`)) {
            return
        }

        const submitKey = `user:delete:${slug}:${userId}`
        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const workspace = await deleteWorkspaceUser(slug, userId)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, workspace))
            setActionResult({ title: 'Пользователь удалён', tone: 'info', details: { workspace: slug, userId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка удаления пользователя', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось удалить пользователя.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function revokeSessionAction(slug: string, sessionId: string): Promise<void> {
        const submitKey = `session:revoke:${slug}:${sessionId}`
        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const workspace = await revokeWorkspaceSession(slug, sessionId)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, workspace))
            setActionResult({ title: 'Сессия отозвана', tone: 'info', details: { workspace: slug, sessionId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка отзыва сессии', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось отозвать сессию.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function updateServerSettingsAction(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        const accessTokenTtlSeconds = Number(String(formData.get('accessTokenTtlSeconds') ?? '').trim())

        if (!Number.isInteger(accessTokenTtlSeconds) || accessTokenTtlSeconds <= 0) {
            setActionResult({ title: 'Ошибка обновления настроек', tone: 'error', details: { error: 'TTL должен быть положительным целым числом.' } })
            return
        }

        setBusyKey('settings:update')
        setErrorMessage(null)

        try {
            const nextSettings = await updateAdminServerSettings({
                adminBaseUrl: normalizeOptionalFormValue(formData.get('adminBaseUrl')),
                runtimeBaseUrl: normalizeOptionalFormValue(formData.get('runtimeBaseUrl')),
                allowDevBootstrap: formData.get('allowDevBootstrap') === 'on',
                requireWorkspaceAuth: formData.get('requireWorkspaceAuth') === 'on',
                accessTokenTtlSeconds,
                adminToken: normalizeOptionalFormValue(formData.get('adminToken')),
                businessAssumptions: {
                    ciMinuteCostRub: normalizeOptionalNumberFormValue(formData.get('ciMinuteCostRub')),
                    developerHourlyCostRub: normalizeOptionalNumberFormValue(formData.get('developerHourlyCostRub')),
                    analysisMinutesPerUnstable: normalizeOptionalNumberFormValue(formData.get('analysisMinutesPerUnstable')),
                },
            })

            setServerSettings(nextSettings)
            setActionResult({
                title: 'Server settings обновлены',
                tone: 'success',
                details: {
                    requireWorkspaceAuth: String(nextSettings.requireWorkspaceAuth),
                    allowDevBootstrap: String(nextSettings.allowDevBootstrap),
                    accessTokenTtlSeconds: String(nextSettings.accessTokenTtlSeconds),
                },
            })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка обновления настроек', tone: 'error', details: { error: readErrorMessage(error, 'Не удалось обновить server settings.') } })
        } finally {
            setBusyKey(null)
        }
    }

    return {
        workspaces,
        serverSettings,
        auditEntries,
        ingestionHealth,
        isLoading,
        errorMessage,
        actionResult,
        dismissActionResult,
        busyKey,
        createWorkspace: createWorkspaceAction,
        updateWorkspace: updateWorkspaceAction,
        deleteWorkspace: deleteWorkspaceAction,
        createApiKey: createApiKeyAction,
        createShareLink: createShareLinkAction,
        createUser: createUserAction,
        updateUserRole: updateUserRoleAction,
        disableApiKey: disableApiKeyAction,
        deleteApiKey: deleteApiKeyAction,
        disableUser: disableUserAction,
        deleteUser: deleteUserAction,
        revokeSession: revokeSessionAction,
        updateServerSettings: updateServerSettingsAction,
        logout,
    }
}

function mapWorkspaceProvisioningDetails(result: WorkspaceProvisioningResult): Record<string, string> {
    return {
        workspace: result.workspace.slug,
        apiKeyLabel: result.apiKey.label,
        apiKeyToken: result.apiKey.token,
        workspaceLoginPath: `/w/${result.workspace.slug}/login`,
        apiKeyExchangePath: `/auth/workspaces/${result.workspace.slug}/api-keys/login`,
    }
}

function mapWorkspaceUserProvisioningDetails(result: WorkspaceUserProvisioningResult): Record<string, string> {
    return {
        workspace: result.workspace.slug,
        label: result.user.label,
        role: result.user.role,
        workspaceUserToken: result.user.token,
        workspaceLoginPath: `/w/${result.workspace.slug}/login`,
    }
}

function mapWorkspaceUpdateDetails(result: WorkspaceUpdateResult): Record<string, string> {
    return {
        previousSlug: result.previousSlug,
        workspace: result.workspace.slug,
        name: result.workspace.name,
        workspaceLoginPath: `/w/${result.workspace.slug}/login`,
        dashboardPath: `/w/${result.workspace.slug}`,
    }
}

function mapWorkspaceShareLinkDetails(result: WorkspaceShareLinkProvisioningResult): Record<string, string> {
    return {
        workspace: result.workspace.slug,
        sessionId: result.shareSession.id,
        ttlMinutes: String(result.shareSession.ttlMinutes),
        expiresAt: result.shareSession.expiresAt,
        shareLinkUrl: result.shareLinkUrl,
    }
}

function mapWorkspaceUserRoleUpdateDetails(result: WorkspaceUserRoleUpdateResult): Record<string, string> {
    return {
        workspace: result.workspace.slug,
        userId: result.userId,
        role: result.role,
        note: 'Активные workspace sessions этого пользователя были перевыпущены через revoke.',
    }
}

/**
 * Merge по slug позволяет переиспользовать один и тот же helper и для create-потока, и для обновления существующего workspace после выдачи новых ключей/пользователей.
 */
function mergeWorkspace(currentWorkspaces: WorkspaceDescriptor[], nextWorkspace: WorkspaceDescriptor, placeFirst = false): WorkspaceDescriptor[] {
    const remainingWorkspaces = currentWorkspaces.filter((workspace) => workspace.slug !== nextWorkspace.slug)
    return placeFirst ? [nextWorkspace, ...remainingWorkspaces] : [...remainingWorkspaces, nextWorkspace]
}

function mergeWorkspaceByPreviousSlug(currentWorkspaces: WorkspaceDescriptor[], previousSlug: string, nextWorkspace: WorkspaceDescriptor): WorkspaceDescriptor[] {
    const remainingWorkspaces = currentWorkspaces.filter((workspace) => workspace.slug !== previousSlug && workspace.slug !== nextWorkspace.slug)
    return [nextWorkspace, ...remainingWorkspaces]
}

function normalizeOptionalFormValue(value: FormDataEntryValue | null): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeOptionalNumberFormValue(value: FormDataEntryValue | null): number | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null
    }

    const parsedValue = Number(value)
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null
}