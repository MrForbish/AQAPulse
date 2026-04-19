/**
 * Назначение файла: собирает зависимости self-hosted backend и подготавливает
 * контексты маршрутов для основного Express-приложения.
 */
import * as path from 'node:path'
import { createFrontendShellRenderer } from '../frontend-shell'
import { createApiStoreRuntime, type ApiStoreRuntime } from './api-store-runtime'
import type { SaasAppConfig } from '../config'
import { createPersistenceRuntime } from './app-persistence-runtime'
import { createSecurityRuntime, type SecurityRuntime } from './app-security-runtime'
import {
    createAdminRoutesContext,
    createRuntimeRoutesContext,
    type AdminRoutesContext,
    type RuntimeRoutesContext,
} from './http'

export type SaasServiceMode = 'all' | 'admin' | 'runtime'

interface AppStaticPaths {
    distPath: string
    distAssetsPath: string
    frontendDistPath: string
}

export interface AppRuntimeContext {
    config: SaasAppConfig
    staticPaths: AppStaticPaths
    adminRoutesContext: AdminRoutesContext | null
    runtimeRoutesContext: RuntimeRoutesContext | null
}

/**
 * Собирает общий контекст backend: хранилище, аутентификацию, HTML-оболочку фронтенда
 * и набор маршрутов для admin- и runtime-режимов.
 */
export function createAppRuntimeContext(config: SaasAppConfig, mode: SaasServiceMode): AppRuntimeContext {
    const { backendStorage, registry } = createPersistenceRuntime(config)

    const frontendShell = createFrontendShellRenderer(path.resolve(config.distPath, './web'))
    const security = createSecurityRuntime(registry, config)
    const apiStores = createApiStoreRuntime(backendStorage, config)
    const staticPaths = createStaticPaths(config)

    return {
        config,
        staticPaths,
        adminRoutesContext: mode === 'runtime'
            ? null
            : createAdminRoutesContext(config, registry, backendStorage, frontendShell, security, apiStores, mode === 'admin'),
        runtimeRoutesContext: mode === 'admin'
            ? null
            : createRuntimeRoutesContext(config, registry, backendStorage, frontendShell, security, apiStores),
    }
}

function createStaticPaths(config: SaasAppConfig): AppStaticPaths {
    return {
        distPath: config.distPath,
        distAssetsPath: path.resolve(config.distPath, './assets'),
        frontendDistPath: path.resolve(config.distPath, './web'),
    }
}
