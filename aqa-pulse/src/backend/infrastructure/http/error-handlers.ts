/**
 * Назначение файла: регистрирует общие HTTP error handlers для Express backend.
 */
import type express from 'express'
import type { NextFunction, Request, Response } from 'express'

export function registerCommonHttpErrorHandlers(app: express.Express): void {
    app.use((_request: Request, response: Response) => {
        response.status(404).json({ error: 'Endpoint не найден.' })
    })

    app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
        const message = error instanceof Error ? error.message : String(error)

        if (isPayloadTooLargeError(error)) {
            response.status(413).json({ error: 'request entity too large' })
            return
        }

        response.status(500).json({ error: message })
    })
}

function isPayloadTooLargeError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false
    }

    const maybeError = error as {
        type?: string
        status?: number
        statusCode?: number
        message?: string
    }

    return maybeError.type === 'entity.too.large'
        || maybeError.status === 413
        || maybeError.statusCode === 413
        || maybeError.message === 'request entity too large'
}