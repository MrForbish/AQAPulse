import { createAdminApp } from './backend/app'
import { resolveSaasAppConfig } from './backend/config'

const adminPort = resolveServicePort(process.env.AQA_PULSE_ADMIN_PORT, process.env.PORT, 3100)
const runtimePort = resolveServicePort(process.env.AQA_PULSE_RUNTIME_PORT, undefined, 3000)
const config = resolveSaasAppConfig({
    port: adminPort,
    adminBaseUrl: process.env.AQA_PULSE_ADMIN_BASE_URL ?? `http://127.0.0.1:${adminPort}`,
    runtimeBaseUrl: process.env.AQA_PULSE_RUNTIME_BASE_URL ?? `http://127.0.0.1:${runtimePort}`,
})
const app = createAdminApp(config)

app.listen(config.port, () => {
    console.log(`AQA Pulse Admin service started on http://127.0.0.1:${config.port}`)
    console.log(`Admin UI: http://127.0.0.1:${config.port}/admin`)
    console.log(`Admin API: http://127.0.0.1:${config.port}/api/workspaces`)
    console.log(`Runtime UI base: ${config.runtimeBaseUrl ?? 'not configured'}`)
    console.log(`Storage driver: ${config.storageDriver}`)
    console.log(`Workspace data root: ${config.dataRoot}`)
})

function resolveServicePort(primary: string | undefined, fallback: string | undefined, defaultPort: number): number {
    const candidate = primary ?? fallback

    if (!candidate) {
        return defaultPort
    }

    const parsed = Number(candidate)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultPort
}