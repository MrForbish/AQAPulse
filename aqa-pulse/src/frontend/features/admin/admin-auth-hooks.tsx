import React from 'react'
import { useNavigate } from 'react-router-dom'
import { isUnauthorizedError, readErrorMessage } from '../../shared/http'
import {
    exchangeWorkspaceApiKey,
    loginAsAdmin,
    loginToWorkspace,
    readAdminSessionStatus,
    readWorkspaceSessionStatus,
    type WorkspaceApiKeyExchangeResponse,
} from './admin-api'
import { useAdminBootstrapSession, useWorkspaceBootstrapSession } from '../../runtime-hooks'

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
            setErrorMessage(readErrorMessage(error, 'Не удалось выпустить JWT для загрузки отчетов.'))
        } finally {
            setIsSubmitting(false)
        }
    }

    return { isSubmitting, errorMessage, exchangeResult, submit }
}
