import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { TestHistoryConflict, TestHistoryResponse } from '../../api-store'
import { buildWorkspaceLoginHref } from '../shared/navigation'
import { HttpError, isUnauthorizedError, readErrorMessage, readPayloadErrorMessage, requestJsonResponse } from '../shared/http'
import { loadStaticTestHistoryPayload } from '../shared/static-test-history'

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
    const [loadedRequestUrl, setLoadedRequestUrl] = React.useState<string | null>(() => props.initialPayload ? props.currentRequestUrl : null)
    const [isLoading, setIsLoading] = React.useState<boolean>(() => !props.initialPayload)
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (loadedRequestUrl === props.currentRequestUrl) {
            return undefined
        }

        const abortController = new AbortController()
        setIsLoading(true)
        setErrorMessage(null)

        if (props.isStaticMode) {
            void loadStaticTestHistoryPayload({
                title: props.requestedTitle,
                branch: props.branch,
                project: props.project,
                file: props.file,
            })
                .then((staticPayload) => {
                    if (abortController.signal.aborted) {
                        return
                    }

                    setPayload(staticPayload)
                    setLoadedRequestUrl(props.currentRequestUrl)
                })
                .catch((error: unknown) => {
                    if (!abortController.signal.aborted) {
                        setErrorMessage(readErrorMessage(error, 'История теста временно недоступна.'))
                    }
                })
                .finally(() => {
                    if (!abortController.signal.aborted) {
                        setIsLoading(false)
                    }
                })

            return () => {
                abortController.abort()
            }
        }

        void requestJsonResponse(props.apiUrl, { signal: abortController.signal })
            .then(({ response, payload: jsonPayload }) => {
                if (response.status === 401 || response.status === 403) {
                    throw new HttpError(response.status, readPayloadErrorMessage(jsonPayload, response.status), jsonPayload)
                }

                if (response.status === 404) {
                    setPayload(null)
                    setLoadedRequestUrl(props.currentRequestUrl)
                    return
                }

                if (response.status === 409) {
                    setPayload(jsonPayload as TestHistoryConflict)
                    setLoadedRequestUrl(props.currentRequestUrl)
                    return
                }

                if (!response.ok) {
                    throw new Error(readPayloadErrorMessage(jsonPayload, response.status))
                }

                setPayload(jsonPayload as TestHistoryResponse)
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