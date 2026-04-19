/**
 * Назначение: поднимает HTTP-приложение с интерфейсом, JSON API,
 * аутентификацией и маршрутами для загрузки отчётов.
 */
import express from 'express'
import { type SaasAppConfig, resolveSaasAppConfig } from './config'
import { configureAppHttpRuntime } from './infrastructure/app-http-runtime'
import { createAppRuntimeContext, type SaasServiceMode } from './infrastructure/app-runtime'

/**
 * Собирает единое Express-приложение для admin- и workspace-сценариев:
 * интерфейс отдается из одного места, а начальные данные сессии подготавливаются по текущему запросу.
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

    configureAppHttpRuntime(app, runtimeContext, mode)

    return app
}
