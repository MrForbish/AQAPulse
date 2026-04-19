/**
 * Назначение файла: middleware-защита для dev-only bootstrap endpoints.
 */
import type { NextFunction, Request, Response } from 'express'

export function ensureDevBootstrapEnabled(allowDevBootstrap: boolean) {
    return (_request: Request, response: Response, next: NextFunction) => {
        if (!allowDevBootstrap) {
            response.status(404).json({ error: 'Dev bootstrap отключён в конфигурации сервера.' })
            return
        }

        next()
    }
}