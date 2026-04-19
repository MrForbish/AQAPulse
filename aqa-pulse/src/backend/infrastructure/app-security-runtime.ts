/**
 * Назначение файла: собирает HTTP-защиту и вспомогательные обработчики аутентификации,
 * чтобы основной runtime-модуль не знал деталей настройки middleware.
 */
import type { RequestHandler } from 'express'
import type { SaasAppConfig } from '../config'
import type { SecurityWorkspaceRegistry } from './persistence'
import {
    createAdminGuard,
    createWorkspaceApiKeyGuard,
    createWorkspaceResolver,
    createWorkspaceUserGuard,
} from './security'

export interface SecurityRuntime {
    adminShellGuard: RequestHandler
    adminApiGuard: RequestHandler
    workspaceResolver: RequestHandler
    workspaceApiKeyGuard: RequestHandler
    workspaceShellGuard: RequestHandler
    workspaceApiGuard: RequestHandler
}

/**
 * Создаёт набор middleware для admin- и workspace-маршрутов,
 * включая проверку сессий, токенов и определение текущего workspace.
 */
export function createSecurityRuntime(registry: SecurityWorkspaceRegistry, config: SaasAppConfig): SecurityRuntime {
    return {
        adminShellGuard: createAdminGuard(registry, config, { unauthorizedResponseMode: 'redirect' }),
        adminApiGuard: createAdminGuard(registry, config, { unauthorizedResponseMode: 'json' }),
        workspaceResolver: createWorkspaceResolver(registry),
        workspaceApiKeyGuard: createWorkspaceApiKeyGuard(registry, config),
        workspaceShellGuard: createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'redirect' }),
        workspaceApiGuard: createWorkspaceUserGuard(registry, config, { unauthorizedResponseMode: 'json' }),
    }
}