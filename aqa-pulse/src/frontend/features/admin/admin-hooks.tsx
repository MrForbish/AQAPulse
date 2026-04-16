/**
 * Назначение: frontend hooks для admin/workspace auth, session redirect и provisioning actions поверх React shell.
 */
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
    exchangeWorkspaceApiKey,
    fetchAdminWorkspaces,
    loginAsAdmin,
    loginToWorkspace,
    logoutAdmin,
    readAdminSessionStatus,
    readWorkspaceSessionStatus,
    type WorkspaceApiKeyExchangeResponse,
} from './admin-api'
import { useAdminBootstrapSession, useWorkspaceBootstrapSession } from '../../runtime-hooks'

export interface DashboardActionResult {
    title: string
    tone: 'success' | 'error' | 'info'
    details: Record<string, string>
}

/**
 * Redirect hook сначала использует bootstrap session, чтобы не делать лишний HTTP roundtrip после server-rendered shell, и только затем падает обратно на session endpoint.
 */
export function useAdminLoginRedirect(): { isCheckingSession: boolean } {
    const navigate = useNavigate()
    const bootstrapSession = useAdminBootstrapSession()
    const [isCheckingSession, setIsCheckingSession] = React.useState(bootstrapSession === null)

    React.useEffect(() => {
        if (bootstrapSession) {
            if (bootstrapSession.authenticated) {
                navigate('/admin', { replace: true })
                return
            }

            setIsCheckingSession(false)
            return
        }

        let isMounted = true

        void readAdminSessionStatus()
            .then(() => {
                if (isMounted) {
                    navigate('/admin', { replace: true })
                }
            })
            .catch((error) => {
                if (isMounted && !isUnauthorizedError(error)) {
                    setIsCheckingSession(false)
                    return
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsCheckingSession(false)
                }
            })

        return () => {
            isMounted = false
        }
    }, [navigate])

    return { isCheckingSession }
}

/**
 * Workspace redirect зависит от slug, поэтому bootstrap session принимается только если она действительно относится к текущему workspace route.
 */
export function useWorkspaceLoginRedirect(workspaceSlug: string): { isCheckingSession: boolean } {
    const navigate = useNavigate()
    const bootstrapSession = useWorkspaceBootstrapSession(workspaceSlug)
    const [isCheckingSession, setIsCheckingSession] = React.useState(bootstrapSession === null)

    React.useEffect(() => {
        if (bootstrapSession) {
            if (bootstrapSession.authenticated) {
                navigate(`/w/${encodeURIComponent(workspaceSlug)}`, { replace: true })
                return
            }

            setIsCheckingSession(false)
            return
        }

        let isMounted = true

        void readWorkspaceSessionStatus(workspaceSlug)
            .then(() => {
                if (isMounted) {
                    navigate(`/w/${encodeURIComponent(workspaceSlug)}`, { replace: true })
                }
            })
            .catch((error) => {
                if (isMounted && !isUnauthorizedError(error)) {
                    setIsCheckingSession(false)
                    return
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsCheckingSession(false)
                }
            })

        return () => {
            isMounted = false
        }
    }, [bootstrapSession, navigate, workspaceSlug])

    return { isCheckingSession }
}

/**
 * Submit hook изолирует login navigation от формы, чтобы страница могла оставаться чистым view-компонентом без transport-логики.
 */
export function useAdminLoginAction(): {
    isSubmitting: boolean
    errorMessage: string | null
    submit: (token: string) => Promise<void>
} {
    const navigate = useNavigate()
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

    async function submit(token: string): Promise<void> {
        setIsSubmitting(true)
        setErrorMessage(null)

        try {
            await loginAsAdmin(token)
            navigate('/admin', { replace: true })
        } catch (error) {
            setErrorMessage(readErrorMessage(error, 'Не удалось выполнить admin login.'))
        } finally {
            setIsSubmitting(false)
        }
    }

    return { isSubmitting, errorMessage, submit }
}

export function useWorkspaceLoginAction(workspaceSlug: string): {
    isSubmitting: boolean
    errorMessage: string | null
    submit: (token: string) => Promise<void>
} {
    const navigate = useNavigate()
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

    async function submit(token: string): Promise<void> {
        setIsSubmitting(true)
        setErrorMessage(null)

        try {
            await loginToWorkspace(workspaceSlug, token)
            navigate(`/w/${encodeURIComponent(workspaceSlug)}`, { replace: true })
        } catch (error) {
            setErrorMessage(readErrorMessage(error, 'Не удалось выполнить workspace login.'))
        } finally {
            setIsSubmitting(false)
        }
    }

    return { isSubmitting, errorMessage, submit }
}

/**
 * Exchange hook хранит последний выданный JWT рядом с loading/error state, чтобы страница могла показать готовые onboarding-данные сразу после успешного запроса.
 */
export function useWorkspaceApiKeyExchangeAction(workspaceSlug: string): {
    isSubmitting: boolean
    errorMessage: string | null
    exchangeResult: WorkspaceApiKeyExchangeResponse | null
    submit: (token: string) => Promise<void>
} {
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
    const [exchangeResult, setExchangeResult] = React.useState<WorkspaceApiKeyExchangeResponse | null>(null)

    async function submit(token: string): Promise<void> {
        setIsSubmitting(true)
        setErrorMessage(null)

        try {
            const result = await exchangeWorkspaceApiKey(workspaceSlug, token)
            setExchangeResult(result)
        } catch (error) {
            setExchangeResult(null)
            setErrorMessage(readErrorMessage(error, 'Не удалось выпустить ingestion JWT.'))
        } finally {
            setIsSubmitting(false)
        }
    }

    return { isSubmitting, errorMessage, exchangeResult, submit }
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

    return {
        workspaces,
        isLoading,
        errorMessage,
        actionResult,
        busyKey,
        createWorkspace: createWorkspaceAction,
        createApiKey: createApiKeyAction,
        createUser: createUserAction,
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
