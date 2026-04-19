/**
 * Назначение файла: формирует HTML-оболочку фронтенда и встраивает в неё
 * данные, которые клиенту нужны при первой загрузке.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Response } from 'express'
import { injectFrontendBootstrap, type FrontendBootstrapData } from '../frontend-bootstrap'

export interface FrontendShellRenderer {
    send(response: Response, bootstrap: FrontendBootstrapData, statusCode?: number): void
}

/**
 * Держит чтение HTML-шаблона и подстановку начальных данных рядом,
 * чтобы основной модуль приложения не занимался ручной сборкой HTML.
 */
export function createFrontendShellRenderer(frontendDistPath: string): FrontendShellRenderer {
    const frontendTemplatePath = path.resolve(frontendDistPath, './index.html')
    const frontendTemplate = fs.existsSync(frontendTemplatePath)
        ? fs.readFileSync(frontendTemplatePath, 'utf8')
        : null

    return {
        send(response: Response, bootstrap: FrontendBootstrapData, statusCode = 200): void {
            if (!frontendTemplate) {
                response.status(503).type('html').send(renderUnavailableFrontendShell())
                return
            }

            response.status(statusCode).type('html').send(injectFrontendBootstrap(frontendTemplate, bootstrap))
        },
    }
}

function renderUnavailableFrontendShell(): string {
    return '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>AQA Pulse UI unavailable</title></head><body><h1>React frontend не собран</h1><p>Запусти compile/build для aqa-pulse, чтобы получить dist/web/index.html.</p></body></html>'
}