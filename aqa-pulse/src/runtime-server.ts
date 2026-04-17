import { createRuntimeApp } from './backend/app'
import { resolveSaasAppConfig } from './backend/config'

const runtimePort = resolveServicePort(process.env.AQA_PULSE_RUNTIME_PORT, process.env.PORT, 3000)
const adminPort = resolveServicePort(process.env.AQA_PULSE_ADMIN_PORT, undefined, 3100)
const config = resolveSaasAppConfig({
    port: runtimePort,
    runtimeBaseUrl: process.env.AQA_PULSE_RUNTIME_BASE_URL ?? `http://127.0.0.1:${runtimePort}`,
    adminBaseUrl: process.env.AQA_PULSE_ADMIN_BASE_URL ?? `http://127.0.0.1:${adminPort}`,
})
const app = createRuntimeApp(config)

app.listen(config.port, () => {
    console.log(`AQA Pulse Runtime service started on http://127.0.0.1:${config.port}`)
    console.log(`Dashboard UI: http://127.0.0.1:${config.port}/`)
    console.log(`Workspace dashboard: http://127.0.0.1:${config.port}/w/:slug`)
    console.log(`Workspace API: http://127.0.0.1:${config.port}/api/workspaces/:slug/summary`)
    console.log(`Admin service base: ${config.adminBaseUrl ?? 'not configured'}`)
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