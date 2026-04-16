/**
 * Назначение: загружает test-history payload из API или static-data и синхронизирует его с текущим route URL.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { TestHistoryConflict, TestHistoryResponse } from '../../api-store'
import { buildWorkspaceLoginHref } from '../shared/navigation'
import { HttpError, isUnauthorizedError, readErrorMessage, readPayloadErrorMessage, requestJsonResponse } from '../shared/http'
import { loadStaticTestHistoryPayload } from '../shared/static-test-history'
import { hasResolvedRequestUrl, resolveInitialLoadedRequestUrl } from './request-state-helpers'

/**
 * Хук хранит `loadedRequestUrl`, чтобы bootstrap payload использовался ровно для того URL, с которым был отрендерен shell, и не подмешивался в следующий client-side переход.
 */
export function useTestHistoryData(props: {
    workspaceSlug: string | null
    apiUrl: string
    currentRequestUrl: string
    initialPayload: TestHistoryResponse | TestHistoryConflict | null
    isStaticMode: boolean
    branch?: string | null
    project?: string | null
    file?: string | null
    requestedTitle: string
}): {
    payload: TestHistoryResponse | TestHistoryConflict | null
    isLoading: boolean
    errorMessage: string | null
} {
    const navigate = useNavigate()
    const [payload, setPayload] = React.useState<TestHistoryResponse | TestHistoryConflict | null>(() => props.initialPayload)
    const [loadedRequestUrl, setLoadedRequestUrl] = React.useState<string | null>(() => resolveInitialLoadedRequestUrl(props.initialPayload, props.currentRequestUrl))
    const [isLoading, setIsLoading] = React.useState<boolean>(() => !props.initialPayload)
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

    /**
     * В static mode идёт resolve из local index, а в server mode — обычный JSON fetch; обе ветки сходятся к одному payload shape, чтобы страница не дублировала transport-логику.
     */
    React.useEffect(() => {
        if (hasResolvedRequestUrl(loadedRequestUrl, props.currentRequestUrl)) {
            return undefined
        }

        const abortController = new AbortController()
        setIsLoading(true)
        setErrorMessage(null)

        void loadTestHistoryPayloadForRequest(props, abortController.signal)
            .then((nextPayload) => {
                if (abortController.signal.aborted) {
                    return
                }

                setPayload(nextPayload)
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

                setErrorMessage(readErrorMessage(error, 'История теста временно недоступна.'))
            })
            .finally(() => {
                if (!abortController.signal.aborted) {
                    setIsLoading(false)
                }
            })

        return () => {
            abortController.abort()
        }
    }, [loadedRequestUrl, navigate, props.apiUrl, props.branch, props.currentRequestUrl, props.file, props.isStaticMode, props.project, props.requestedTitle, props.workspaceSlug])

    return { payload, isLoading, errorMessage }
}

async function loadTestHistoryPayloadForRequest(props: {
    apiUrl: string
    isStaticMode: boolean
    branch?: string | null
    project?: string | null
    file?: string | null
    requestedTitle: string
}, signal: AbortSignal): Promise<TestHistoryResponse | TestHistoryConflict | null> {
    if (props.isStaticMode) {
        return loadStaticTestHistoryPayload({
            title: props.requestedTitle,
            branch: props.branch,
            project: props.project,
            file: props.file,
        })
    }

    const { response, payload } = await requestJsonResponse(props.apiUrl, { signal })

    if (response.status === 401 || response.status === 403) {
        throw new HttpError(response.status, readPayloadErrorMessage(payload, response.status), payload)
    }

    if (response.status === 404) {
        return null
    }

    if (response.status === 409) {
        return payload as TestHistoryConflict
    }

    if (!response.ok) {
        throw new Error(readPayloadErrorMessage(payload, response.status))
    }

    return payload as TestHistoryResponse
}