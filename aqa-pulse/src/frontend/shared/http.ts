/**
 * Назначение: минимальный HTTP-слой frontend runtime для JSON-запросов и нормализации transport-ошибок.
 */
export class HttpError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly payload: unknown,
    ) {
        super(message)
        this.name = 'HttpError'
    }
}

/**
 * JSON helper централизует проверку `response.ok`, чтобы hooks не дублировали разбор payload и формирование HttpError.
 */
export async function requestJson<T>(input: string, init: RequestInit = {}): Promise<T> {
    const { response, payload } = await requestJsonResponse(input, init)

    if (!response.ok) {
        throw new HttpError(response.status, readPayloadErrorMessage(payload, response.status), payload)
    }

    return payload as T
}

export async function requestJsonResponse(input: string, init: RequestInit = {}): Promise<{ response: Response; payload: unknown }> {
    const response = await fetch(input, buildJsonRequestInit(init))
    const payload = await readJsonResponse(response)

    return { response, payload }
}

export async function readJsonResponse(response: Response): Promise<unknown> {
    const responseText = await response.text()
    return tryParseJson(responseText)
}

export function isUnauthorizedError(error: unknown): error is HttpError {
    return error instanceof HttpError && (error.status === 401 || error.status === 403)
}

export function readErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message
    }

    return fallbackMessage
}

export function readPayloadErrorMessage(payload: unknown, status: number): string {
    if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
        return (payload as { error: string }).error
    }

    return `HTTP ${status}`
}

function tryParseJson(value: string): unknown {
    if (!value) {
        return null
    }

    try {
        return JSON.parse(value)
    } catch {
        return null
    }
}

/**
 * Собирает единый JSON-friendly RequestInit, чтобы credentials и Accept заголовки были одинаковыми во всех frontend fetch-вызовах.
 */
function buildJsonRequestInit(init: RequestInit): RequestInit {
    return {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers ?? {}),
        },
        ...init,
    }
}