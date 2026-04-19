/**
 * Назначение: поднимает self-hosted/saas HTTP-приложение с React shell, JSON API, auth и ingestion-маршрутами.
 */
import * as path from 'node:path'
import express, { type Request, type Response } from 'express'
import { type SaasAppConfig, resolveSaasAppConfig } from './config'
import { createAppRuntimeContext, type SaasServiceMode } from './infrastructure/app-runtime'
import {
    registerAdminRoutes,
    registerCommonHttpErrorHandlers,
    registerRuntimeRoutes,
} from './infrastructure/http'

/**
 * Собирает единый Express app для admin/workspace сценариев: React shell отдаётся из одного места, а bootstrap/session данные заполняются на основе текущего запроса.
 */
export function createSaasApp(options: Partial<SaasAppConfig> = {}): express.Express {
    return createConfiguredSaasApp(options, 'all')
}

export function createAdminApp(options: Partial<SaasAppConfig> = {}): express.Express {
    return createConfiguredSaasApp(options, 'admin')
}

export function createRuntimeApp(options: Partial<SaasAppConfig> = {}): express.Express {
    return createConfiguredSaasApp(options, 'runtime')
}

function createConfiguredSaasApp(options: Partial<SaasAppConfig>, mode: SaasServiceMode): express.Express {
    const app = express()
    const config = resolveSaasAppConfig(options)
    const runtimeContext = createAppRuntimeContext(config, mode)
    const distPath = runtimeContext.staticPaths.distPath
    const distAssetsPath = runtimeContext.staticPaths.distAssetsPath
    const frontendDistPath = runtimeContext.staticPaths.frontendDistPath

    app.use(express.json({ limit: config.requestBodyLimit }))
    app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }))
    app.use('/assets', express.static(distAssetsPath))
    app.use('/ui-assets', express.static(frontendDistPath))
    app.use('/static', express.static(distPath))
    app.use('/w/:slug/assets', express.static(distAssetsPath))

    app.get('/api/health', (_request: Request, response: Response) => {
        response.json({ status: 'ok', service: mode })
    })

    if (runtimeContext.adminRoutesContext) {
        registerAdminRoutes(app, runtimeContext.adminRoutesContext)
    }

    if (runtimeContext.runtimeRoutesContext) {
        registerRuntimeRoutes(app, runtimeContext.runtimeRoutesContext)
    }

    registerCommonHttpErrorHandlers(app)

    return app
}



