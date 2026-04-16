/**
 * Назначение: загружает dashboard summary и переиспользует bootstrap-данные только для исходного shell URL.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardSummary } from '../../dashboard-utils'
import { buildWorkspaceLoginHref } from '../shared/navigation'
import { isUnauthorizedError, readErrorMessage, requestJson } from '../shared/http'
import { hasResolvedRequestUrl, resolveInitialLoadedRequestUrl } from './request-state-helpers'

/**
 * Static export не делает runtime fetch summary, а server/workspace маршруты могут переходить между фильтрами и slug, поэтому хук отдельно отслеживает, к какому URL уже привязаны текущие данные.
 */
export function useDashboardSummaryData(props: {
    workspaceSlug: string | null
    apiUrl: string
    currentRequestUrl: string
    initialSummary: DashboardSummary | null
    isStaticMode: boolean
}): {
    summary: DashboardSummary | null
    isLoading: boolean
    errorMessage: string | null
} {
    const navigate = useNavigate()
    const [summary, setSummary] = React.useState<DashboardSummary | null>(() => props.initialSummary)
    const [loadedRequestUrl, setLoadedRequestUrl] = React.useState<string | null>(() => resolveInitialLoadedRequestUrl(props.initialSummary, props.currentRequestUrl))
    const [isLoading, setIsLoading] = React.useState<boolean>(() => !props.initialSummary && !props.isStaticMode)
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (props.isStaticMode) {
            return undefined
        }

        if (hasResolvedRequestUrl(loadedRequestUrl, props.currentRequestUrl) && summary) {
            return undefined
        }

        const abortController = new AbortController()
        setIsLoading(true)
        setErrorMessage(null)

        void loadDashboardSummaryForRequest(props.apiUrl, abortController.signal)
            .then((payload) => {
                setSummary(payload)
                setLoadedRequestUrl(props.currentRequestUrl)
            })
            .catch((error: unknown) => {
                if (abortController.signal.aborted) {
                    return
                }

                if (props.workspaceSlug && isUnauthorizedError(error)) {
                    navigate(buildWorkspaceLoginHref(props.workspaceSlug), { replace: true })
                    return
                }

                setErrorMessage(readErrorMessage(error, 'Сводка временно недоступна.'))
            })
            .finally(() => {
                if (!abortController.signal.aborted) {
                    setIsLoading(false)
                }
            })

        return () => {
            abortController.abort()
        }
    }, [loadedRequestUrl, navigate, props.apiUrl, props.currentRequestUrl, props.isStaticMode, props.workspaceSlug, summary])

    return { summary, isLoading, errorMessage }
}

function loadDashboardSummaryForRequest(apiUrl: string, signal: AbortSignal): Promise<DashboardSummary> {
    return requestJson<DashboardSummary>(apiUrl, { signal })
}