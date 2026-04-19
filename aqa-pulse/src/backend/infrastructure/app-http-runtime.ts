/**
 * Назначение файла: настраивает Express-приложение поверх уже собранного runtime-контекста,
 * чтобы верхний composition root не занимался регистрацией базовых middleware и маршрутов вручную.
 */
import express from 'express'
import type { Request, Response } from 'express'
import type { AppRuntimeContext, SaasServiceMode } from './app-runtime'
import {
    registerAdminRoutes,
    registerCommonHttpErrorHandlers,
    registerRuntimeRoutes,
} from './http'

/**
 * Подключает базовые middleware, технические маршруты, admin/runtime маршруты
 * и общую обработку ошибок на основе уже подготовленного runtime-контекста.
 */
export function configureAppHttpRuntime(
    app: express.Express,
    context: AppRuntimeContext,
    mode: SaasServiceMode,
): void {
    const { config, staticPaths, adminRoutesContext, runtimeRoutesContext } = context

    app.use(express.json({ limit: config.requestBodyLimit }))
    app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }))
    app.use('/assets', express.static(staticPaths.distAssetsPath))
    app.use('/ui-assets', express.static(staticPaths.frontendDistPath))
    app.use('/static', express.static(staticPaths.distPath))
    app.use('/w/:slug/assets', express.static(staticPaths.distAssetsPath))

    app.get('/api/health', (_request: Request, response: Response) => {
        response.json({ status: 'ok', service: mode })
    })

    if (adminRoutesContext) {
        registerAdminRoutes(app, adminRoutesContext)
    }

    if (runtimeRoutesContext) {
        registerRuntimeRoutes(app, runtimeRoutesContext)
    }

    registerCommonHttpErrorHandlers(app)
}