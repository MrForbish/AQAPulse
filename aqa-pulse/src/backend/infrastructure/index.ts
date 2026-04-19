/**
 * Назначение файла: публичная точка входа в инфраструктурный слой backend.
 */
export { configureAppHttpRuntime } from './app-http-runtime'
export { applyServerSettingsToConfig, buildServerSettingsDefaults } from './server-settings'
export * as persistence from './persistence'
export * as security from './security'
export * as http from './http'