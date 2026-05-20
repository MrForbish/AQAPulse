import React from 'react'
import { useNavigate } from 'react-router-dom'
import type {
    AdminAuditPage,
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
    resetWorkspaceData,
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
 * Hook хранит состояние админки, догружает справочники и обрабатывает действия форм.
 */
export function useAdminDashboardState(initialWorkspaces: WorkspaceDescriptor[] | null): {
    workspaces: WorkspaceDescriptor[]
    serverSettings: ServerSettingsRecord | null
    auditPage: AdminAuditPage | null
    ingestionHealth: AdminIngestionHealthReport | null
    isLoading: boolean
    isAuditPageLoading: boolean
    errorMessage: string | null
    actionResult: DashboardActionResult | null
    dismissActionResult: () => void
    busyKey: string | null
    createWorkspace: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
    updateWorkspace: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    deleteWorkspace: (slug: string) => Promise<void>
    resetWorkspaceData: (slug: string) => Promise<void>
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
    goToPreviousAuditPage: () => Promise<void>
    goToNextAuditPage: () => Promise<void>
    logout: () => Promise<void>
} {
    const auditPageSize = 20
    const navigate = useNavigate()
    const [workspaces, setWorkspaces] = React.useState<WorkspaceDescriptor[]>(initialWorkspaces ?? [])
    const [serverSettings, setServerSettings] = React.useState<ServerSettingsRecord | null>(null)
    const [auditPage, setAuditPage] = React.useState<AdminAuditPage | null>(null)
    const [ingestionHealth, setIngestionHealth] = React.useState<AdminIngestionHealthReport | null>(null)
    const [isLoading, setIsLoading] = React.useState(initialWorkspaces === null)
    const [isAuditPageLoading, setIsAuditPageLoading] = React.useState(false)
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

    const refreshSupplementaryData = React.useCallback(async (requestedAuditPage?: number): Promise<void> => {
        try {
            const auditPageToLoad = requestedAuditPage ?? auditPage?.page ?? 1
            const [settings, entries, health] = await Promise.all([
                fetchAdminServerSettings(),
                fetchAdminAuditLog(auditPageToLoad, auditPageSize),
                fetchAdminIngestionHealth(),
            ])

            setServerSettings(settings)
            setAuditPage(entries)
            setIngestionHealth(health)
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setErrorMessage(readErrorMessage(error, 'Не удалось загрузить служебные данные админки.'))
        }
    }, [auditPage?.page, auditPageSize, handleUnauthorized])

    const loadAuditPage = React.useCallback(async (page: number): Promise<void> => {
        setIsAuditPageLoading(true)

        try {
            const nextAuditPage = await fetchAdminAuditLog(page, auditPageSize)
            setAuditPage(nextAuditPage)
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setErrorMessage(readErrorMessage(error, 'Не удалось загрузить аудит админки.'))
        } finally {
            setIsAuditPageLoading(false)
        }
    }, [auditPageSize, handleUnauthorized])

    React.useEffect(() => {
        let isMounted = true

        async function loadAdminState(): Promise<void> {
            try {
                if (initialWorkspaces === null) {
                    const [loadedWorkspaces, settings, entries, health] = await Promise.all([
                        fetchAdminWorkspaces(),
                        fetchAdminServerSettings(),
                        fetchAdminAuditLog(1, auditPageSize),
                        fetchAdminIngestionHealth(),
                    ])

                    if (!isMounted) {
                        return
                    }

                    setWorkspaces(loadedWorkspaces)
                    setServerSettings(settings)
                    setAuditPage(entries)
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

                setErrorMessage(readErrorMessage(error, 'Не удалось загрузить админку.'))
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
    }, [auditPageSize, handleUnauthorized, initialWorkspaces, refreshSupplementaryData])

    async function goToPreviousAuditPageAction(): Promise<void> {
        if (!auditPage?.hasPreviousPage) {
            return
        }

        await loadAuditPage(auditPage.page - 1)
    }

    async function goToNextAuditPageAction(): Promise<void> {
        if (!auditPage?.hasNextPage) {
            return
        }

        await loadAuditPage(auditPage.page + 1)
    }

    async function logout(): Promise<void> {
        setBusyKey('logout')

        try {
            await logoutAdmin()
            window.location.assign('/admin/login')
        } catch (error) {
            setErrorMessage(readErrorMessage(error, 'Не удалось завершить сессию администратора.'))
            setBusyKey(null)
        }
    }

    async function createWorkspaceAction(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        const name = String(formData.get('name') ?? '').trim()
        const slug = String(formData.get('slug') ?? '').trim()
        const template = normalizeWorkspaceTemplate(formData.get('template'))
        const apiKeyLabel = String(formData.get('apiKeyLabel') ?? '').trim() || getDefaultApiKeyLabel(template)

        if (!name) {
            setActionResult({ title: 'Ошибка создания workspace', tone: 'error', details: { error: 'Поле «Название» обязательно.' } })
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
                    { label: 'Токен ключа загрузки', value: createdWorkspace.apiKey.token },
                    { label: '1. GitLab CI/CD Variables', value: buildGitLabVariables(createdWorkspace) },
                    { label: '2. .aqa-pulse.yml в репозиторий автотестов', value: buildAqaPulseConfig() },
                    { label: '3. .gitlab-ci.yml: простой job без include', value: buildDirectGitLabUploadJob() },
                    { label: '3. .gitlab-ci.yml: вариант через reusable template', value: buildTemplateGitLabUploadJob() },
                    { label: 'Страница входа в workspace', value: `/w/${createdWorkspace.workspace.slug}/login` },
                    { label: 'Проверка ключа загрузки', value: `/auth/workspaces/${createdWorkspace.workspace.slug}/api-keys/login` },
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
            setActionResult({ title: 'Ошибка обновления workspace', tone: 'error', details: { Workspace: slug, Ошибка: 'Поле «Название» обязательно.' } })
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

            setActionResult({ title: 'Ошибка обновления workspace', tone: 'error', details: { Workspace: slug, Ошибка: readErrorMessage(error, 'Не удалось обновить workspace.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function deleteWorkspaceAction(slug: string): Promise<void> {
        if (typeof window !== 'undefined' && !window.confirm(`Удалить workspace ${slug} вместе с историей прогонов, сырыми отчетами и настройками доступа?`)) {
            return
        }

        const submitKey = `workspace:delete:${slug}`
        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            await deleteWorkspace(slug)
            setWorkspaces((currentWorkspaces) => currentWorkspaces.filter((workspace) => workspace.slug !== slug))
            setActionResult({ title: 'Workspace удалён', tone: 'info', details: { Workspace: slug } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка удаления workspace', tone: 'error', details: { Workspace: slug, Ошибка: readErrorMessage(error, 'Не удалось удалить workspace.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function resetWorkspaceDataAction(slug: string): Promise<void> {
        if (typeof window !== 'undefined' && !window.confirm(`Очистить историю прогонов и сырые отчеты workspace ${slug}? Ключи и пользователи останутся активными.`)) {
            return
        }

        const submitKey = `workspace:reset-data:${slug}`
        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const workspace = await resetWorkspaceData(slug)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, workspace))
            setActionResult({ title: 'Данные прогонов очищены', tone: 'info', details: { Workspace: slug, Примечание: 'История прогонов и сырые отчеты удалены. Доступы не изменились.' } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка очистки прогонов', tone: 'error', details: { Workspace: slug, Ошибка: readErrorMessage(error, 'Не удалось очистить данные прогонов.') } })
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
                title: 'Ключ загрузки создан',
                tone: 'success',
                details: {
                    Workspace: slug,
                    'Название ключа': createdApiKey.apiKey.label,
                    'Токен': createdApiKey.apiKey.token,
                    'Проверка ключа': `/auth/workspaces/${slug}/api-keys/login`,
                },
                copyItems: [
                    { label: 'Токен ключа загрузки', value: createdApiKey.apiKey.token },
                    { label: 'Проверка ключа загрузки', value: `/auth/workspaces/${slug}/api-keys/login` },
                ],
            })
            form.reset()
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({
                title: 'Ошибка создания ключа загрузки',
                tone: 'error',
                details: {
                    Workspace: slug,
                    Ошибка: readErrorMessage(error, 'Не удалось создать ключ загрузки.'),
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
            setActionResult({ title: 'Ошибка создания пользователя', tone: 'error', details: { Workspace: slug, Ошибка: 'Поле «Имя или описание» обязательно.' } })
            return
        }

        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const createdUser = await createWorkspaceUser(slug, { label, role })
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, createdUser.workspace))
            setActionResult({
                title: 'Пользователь создан',
                tone: 'success',
                details: mapWorkspaceUserProvisioningDetails(createdUser),
                copyItems: [
                    { label: 'Токен пользователя', value: createdUser.user.token },
                    { label: 'Страница входа в workspace', value: `/w/${createdUser.workspace.slug}/login` },
                ],
            })
            form.reset()
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({
                title: 'Ошибка создания пользователя',
                tone: 'error',
                details: {
                    Workspace: slug,
                    Ошибка: readErrorMessage(error, 'Не удалось создать пользователя.'),
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
                title: 'Временная ссылка создана',
                tone: 'success',
                details: mapWorkspaceShareLinkDetails(result),
                copyItems: [{ label: 'Временная ссылка', value: result.shareLinkUrl }],
            })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка создания временной ссылки', tone: 'error', details: { Workspace: slug, Ошибка: readErrorMessage(error, 'Не удалось создать временную ссылку.') } })
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

            setActionResult({ title: 'Ошибка обновления роли', tone: 'error', details: { Workspace: slug, 'ID пользователя': userId, Ошибка: readErrorMessage(error, 'Не удалось обновить роль пользователя.') } })
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
            setActionResult({ title: 'Ключ загрузки отключён', tone: 'info', details: { Workspace: slug, 'ID ключа': apiKeyId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка отключения ключа', tone: 'error', details: { Workspace: slug, Ошибка: readErrorMessage(error, 'Не удалось отключить ключ загрузки.') } })
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
            setActionResult({ title: 'Ключ загрузки удалён', tone: 'info', details: { Workspace: slug, 'ID ключа': apiKeyId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка удаления ключа', tone: 'error', details: { Workspace: slug, Ошибка: readErrorMessage(error, 'Не удалось удалить ключ загрузки.') } })
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
            setActionResult({ title: 'Доступ пользователя отключён', tone: 'info', details: { Workspace: slug, 'ID пользователя': userId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка отключения пользователя', tone: 'error', details: { Workspace: slug, Ошибка: readErrorMessage(error, 'Не удалось отключить пользователя.') } })
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
            setActionResult({ title: 'Пользователь удалён', tone: 'info', details: { Workspace: slug, 'ID пользователя': userId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка удаления пользователя', tone: 'error', details: { Workspace: slug, Ошибка: readErrorMessage(error, 'Не удалось удалить пользователя.') } })
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
            setActionResult({ title: 'Сессия отозвана', tone: 'info', details: { Workspace: slug, 'ID сессии': sessionId } })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка отзыва сессии', tone: 'error', details: { Workspace: slug, Ошибка: readErrorMessage(error, 'Не удалось отозвать сессию.') } })
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
                title: 'Настройки сервера обновлены',
                tone: 'success',
                details: {
                    'Вход в workspace обязателен': nextSettings.requireWorkspaceAuth ? 'да' : 'нет',
                    'Тестовый bootstrap включен': nextSettings.allowDevBootstrap ? 'да' : 'нет',
                    'TTL сессии, секунд': String(nextSettings.accessTokenTtlSeconds),
                },
            })
            await refreshSupplementaryData()
        } catch (error) {
            if (handleUnauthorized(error)) {
                return
            }

            setActionResult({ title: 'Ошибка обновления настроек', tone: 'error', details: { error: readErrorMessage(error, 'Не удалось обновить настройки сервера.') } })
        } finally {
            setBusyKey(null)
        }
    }

    return {
        workspaces,
        serverSettings,
        auditPage,
        ingestionHealth,
        isLoading,
        isAuditPageLoading,
        errorMessage,
        actionResult,
        dismissActionResult,
        busyKey,
        createWorkspace: createWorkspaceAction,
        updateWorkspace: updateWorkspaceAction,
        deleteWorkspace: deleteWorkspaceAction,
        resetWorkspaceData: resetWorkspaceDataAction,
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
        goToPreviousAuditPage: goToPreviousAuditPageAction,
        goToNextAuditPage: goToNextAuditPageAction,
        logout,
    }
}

function mapWorkspaceProvisioningDetails(result: WorkspaceProvisioningResult): Record<string, string> {
    return {
        Workspace: result.workspace.slug,
        'Название ключа': result.apiKey.label,
        'Токен': result.apiKey.token,
        'Страница входа': `/w/${result.workspace.slug}/login`,
        'Проверка ключа': `/auth/workspaces/${result.workspace.slug}/api-keys/login`,
    }
}

type WorkspaceTemplate = 'production' | 'sandbox' | 'demo'

function normalizeWorkspaceTemplate(value: FormDataEntryValue | null): WorkspaceTemplate {
    return value === 'sandbox' || value === 'demo' ? value : 'production'
}

function getDefaultApiKeyLabel(template: WorkspaceTemplate): string {
    if (template === 'sandbox') {
        return 'Песочница: загрузка из GitLab CI'
    }

    if (template === 'demo') {
        return 'Demo: загрузка отчетов'
    }

    return 'Боевой GitLab CI'
}

function buildGitLabVariables(result: WorkspaceProvisioningResult): string {
    return [
        `AQA_PULSE_BASE_URL=${getCurrentBaseUrl()}`,
        `AQA_PULSE_WORKSPACE_SLUG=${result.workspace.slug}`,
        `AQA_PULSE_WORKSPACE_API_KEY=${result.apiKey.token}`,
    ].join('\n')
}

function buildAqaPulseConfig(): string {
    return [
        'projectDir: Playwright',
        'reportPath: test-results/dashboard/data.json',
        'repoRoot: .',
        '',
        '# Если reports несколько, замени reportPath на merge:',
        '# merge:',
        '#   projectKind: ui',
        '#   output: test-results/dashboard/ui-merged.json',
        '#   allowMissing: true',
        '#   inputs:',
        '#     - test-results/dashboard/ui-part-1.json',
        '#     - test-results/dashboard/ui-part-2.json',
    ].join('\n')
}

function buildDirectGitLabUploadJob(): string {
    return [
        'aqa pulse upload:',
        '  stage: Tests',
        '  image: node:22-bookworm-slim',
        '  needs:',
        '    - job: playwright tests',
        '      artifacts: true',
        '  script:',
        '    - npx @aqa-pulse/cli@latest upload-from-config --config .aqa-pulse.yml',
        '  artifacts:',
        '    when: always',
        '    paths:',
        '      - "**/test-results/dashboard"',
        '  allow_failure: true',
        '',
        '# Замени "playwright tests" на имя job, которая генерирует dashboard JSON.',
    ].join('\n')
}

function buildTemplateGitLabUploadJob(): string {
    return [
        'include:',
        "  - project: 'your-gitlab-group/AQAPulse'",
        '    ref: main',
        "    file: '/aqa-pulse-server/template/gitlab/aqa-pulse-upload.gitlab-ci.yml'",
        '',
        'aqa pulse upload:',
        '  extends: .aqa_pulse_upload_from_config',
        '  needs:',
        '    - job: playwright tests',
        '      artifacts: true',
        '',
        '# project - это GitLab repo, где лежит template AQA Pulse.',
        '# Если такого repo нет, используй простой job выше без include.',
    ].join('\n')
}

function getCurrentBaseUrl(): string {
    if (typeof window === 'undefined') {
        return ''
    }

    return window.location.origin
}

function mapWorkspaceUserProvisioningDetails(result: WorkspaceUserProvisioningResult): Record<string, string> {
    return {
        Workspace: result.workspace.slug,
        'Имя или описание': result.user.label,
        'Роль': result.user.role,
        'Токен': result.user.token,
        'Страница входа': `/w/${result.workspace.slug}/login`,
    }
}

function mapWorkspaceUpdateDetails(result: WorkspaceUpdateResult): Record<string, string> {
    return {
        'Предыдущий slug': result.previousSlug,
        Workspace: result.workspace.slug,
        'Название': result.workspace.name,
        'Страница входа': `/w/${result.workspace.slug}/login`,
        'Дашборд': `/w/${result.workspace.slug}`,
    }
}

function mapWorkspaceShareLinkDetails(result: WorkspaceShareLinkProvisioningResult): Record<string, string> {
    return {
        Workspace: result.workspace.slug,
        'ID сессии': result.shareSession.id,
        'TTL, минут': String(result.shareSession.ttlMinutes),
        'Активация': result.shareSession.activatedAt ? 'Уже активирована' : 'Время жизни начнется после первого открытия',
        'Истекает': result.shareSession.expiresAt ?? 'После первого открытия',
        'Временная ссылка': result.shareLinkUrl,
    }
}

function mapWorkspaceUserRoleUpdateDetails(result: WorkspaceUserRoleUpdateResult): Record<string, string> {
    return {
        Workspace: result.workspace.slug,
        'ID пользователя': result.userId,
        'Роль': result.role,
        'Примечание': 'Активные сессии этого пользователя были отозваны.',
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
