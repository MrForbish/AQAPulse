import React from 'react'
import { useNavigate } from 'react-router-dom'
import type {
    WorkspaceDescriptor,
    WorkspaceProvisioningResult,
    WorkspaceUserProvisioningResult,
} from '../../../backend/contracts'
import { isUnauthorizedError, readErrorMessage } from '../../shared/http'
import {
    createWorkspace,
    createWorkspaceApiKey,
    createWorkspaceUser,
    disableWorkspaceApiKey,
    disableWorkspaceUser,
    fetchAdminWorkspaces,
    logoutAdmin,
    revokeWorkspaceSession,
} from './admin-api'

export interface DashboardActionResult {
    title: string
    tone: 'success' | 'error' | 'info'
    details: Record<string, string>
}

/**
 * Admin dashboard state объединяет initial bootstrap data, lazy loading registry и все provisioning actions в одном hook, чтобы page-компонент оставался декларативным и не управлял вручную множеством form/result состояний.
 */
export function useAdminDashboardState(initialWorkspaces: WorkspaceDescriptor[] | null): {
    workspaces: WorkspaceDescriptor[]
    isLoading: boolean
    errorMessage: string | null
    actionResult: DashboardActionResult | null
    busyKey: string | null
    createWorkspace: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
    createApiKey: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    createUser: (event: React.FormEvent<HTMLFormElement>, slug: string) => Promise<void>
    disableApiKey: (slug: string, apiKeyId: string) => Promise<void>
    disableUser: (slug: string, userId: string) => Promise<void>
    revokeSession: (slug: string, sessionId: string) => Promise<void>
    logout: () => Promise<void>
} {
    const navigate = useNavigate()
    const [workspaces, setWorkspaces] = React.useState<WorkspaceDescriptor[]>(initialWorkspaces ?? [])
    const [isLoading, setIsLoading] = React.useState(initialWorkspaces === null)
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
    const [actionResult, setActionResult] = React.useState<DashboardActionResult | null>(null)
    const [busyKey, setBusyKey] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (initialWorkspaces !== null) {
            setWorkspaces(initialWorkspaces)
            setIsLoading(false)
            return
        }

        let isMounted = true

        void fetchAdminWorkspaces()
            .then((loadedWorkspaces) => {
                if (isMounted) {
                    setWorkspaces(loadedWorkspaces)
                }
            })
            .catch((error) => {
                if (!isMounted) {
                    return
                }

                if (isUnauthorizedError(error)) {
                    navigate('/admin/login', { replace: true })
                    return
                }

                setErrorMessage(readErrorMessage(error, 'Не удалось загрузить список workspace.'))
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false)
                }
            })

        return () => {
            isMounted = false
        }
    }, [initialWorkspaces, navigate])

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
        const formData = new FormData(event.currentTarget)
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
            setActionResult({ title: 'Workspace создан', tone: 'success', details: mapWorkspaceProvisioningDetails(createdWorkspace) })
            event.currentTarget.reset()
        } catch (error) {
            if (isUnauthorizedError(error)) {
                navigate('/admin/login', { replace: true })
                return
            }

            setActionResult({ title: 'Ошибка создания workspace', tone: 'error', details: { error: readErrorMessage(error, 'Не удалось создать workspace.') } })
        } finally {
            setBusyKey(null)
        }
    }

    async function createApiKeyAction(event: React.FormEvent<HTMLFormElement>, slug: string): Promise<void> {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
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
            })
            event.currentTarget.reset()
        } catch (error) {
            if (isUnauthorizedError(error)) {
                navigate('/admin/login', { replace: true })
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
        const formData = new FormData(event.currentTarget)
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
            setActionResult({ title: 'Workspace user token создан', tone: 'success', details: mapWorkspaceUserProvisioningDetails(createdUser) })
            event.currentTarget.reset()
        } catch (error) {
            if (isUnauthorizedError(error)) {
                navigate('/admin/login', { replace: true })
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

    async function disableApiKeyAction(slug: string, apiKeyId: string): Promise<void> {
        const submitKey = `api-key:disable:${slug}:${apiKeyId}`
        setBusyKey(submitKey)
        setErrorMessage(null)

        try {
            const workspace = await disableWorkspaceApiKey(slug, apiKeyId)
            setWorkspaces((currentWorkspaces) => mergeWorkspace(currentWorkspaces, workspace))
            setActionResult({ title: 'Ключ загрузки отключён', tone: 'info', details: { workspace: slug, apiKeyId } })
        } catch (error) {
            if (isUnauthorizedError(error)) {
                navigate('/admin/login', { replace: true })
                return
            }

            setActionResult({ title: 'Ошибка отключения ключа', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось отключить ключ загрузки.') } })
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
        } catch (error) {
            if (isUnauthorizedError(error)) {
                navigate('/admin/login', { replace: true })
                return
            }

            setActionResult({ title: 'Ошибка отключения пользователя', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось отключить пользователя.') } })
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
        } catch (error) {
            if (isUnauthorizedError(error)) {
                navigate('/admin/login', { replace: true })
                return
            }

            setActionResult({ title: 'Ошибка отзыва сессии', tone: 'error', details: { workspace: slug, error: readErrorMessage(error, 'Не удалось отозвать сессию.') } })
        } finally {
            setBusyKey(null)
        }
    }

    return {
        workspaces,
        isLoading,
        errorMessage,
        actionResult,
        busyKey,
        createWorkspace: createWorkspaceAction,
        createApiKey: createApiKeyAction,
        createUser: createUserAction,
        disableApiKey: disableApiKeyAction,
        disableUser: disableUserAction,
        revokeSession: revokeSessionAction,
        logout,
    }
}

function mapWorkspaceProvisioningDetails(result: WorkspaceProvisioningResult): Record<string, string> {
    return {
        workspace: result.workspace.slug,
        apiKeyLabel: result.apiKey.label,
        apiKeyToken: result.apiKey.token,
        workspaceLoginUrl: `/w/${result.workspace.slug}/login`,
        apiKeyExchangeUrl: `/auth/workspaces/${result.workspace.slug}/api-keys/login`,
    }
}

function mapWorkspaceUserProvisioningDetails(result: WorkspaceUserProvisioningResult): Record<string, string> {
    return {
        workspace: result.workspace.slug,
        label: result.user.label,
        role: result.user.role,
        workspaceUserToken: result.user.token,
        workspaceLoginUrl: `/w/${result.workspace.slug}/login`,
    }
}

/**
 * Merge по slug позволяет переиспользовать один и тот же helper и для create-потока, и для обновления существующего workspace после выдачи новых ключей/пользователей.
 */
function mergeWorkspace(currentWorkspaces: WorkspaceDescriptor[], nextWorkspace: WorkspaceDescriptor, placeFirst = false): WorkspaceDescriptor[] {
    const remainingWorkspaces = currentWorkspaces.filter((workspace) => workspace.slug !== nextWorkspace.slug)
    return placeFirst ? [nextWorkspace, ...remainingWorkspaces] : [...remainingWorkspaces, nextWorkspace]
}