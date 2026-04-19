/**
 * Назначение файла: выполняет bootstrap отдельного workspace
 * и возвращает структурированный результат для CLI-слоя.
 */
import { ensureWorkspaceReadModelInitialized } from './application/admin'
import { type SaasAppConfig } from './config'
import { createBootstrapCliRuntime } from './bootstrap-cli-runtime'

export interface BootstrapWorkspaceInput {
    name: string
    slug?: string
    baseUrl?: string
    apiKeyLabel?: string
    userLabel?: string
    userRole?: 'owner' | 'viewer'
    skipUser: boolean
}

export interface BootstrapWorkspaceOutput {
    workspace: {
        name: string
        slug: string
        dashboardUrl: string
        loginUrl: string
    }
    tokens: {
        workspaceApiKey: string
        workspaceUserToken: string | null
    }
    gitlabVariables: Record<string, string>
    server: {
        baseUrl: string
        storageDriver: string
        dataRoot: string
        sqlitePath: string | null
        requireWorkspaceAuth: boolean
    }
    notes: string[]
}

/**
 * Выполняет полный bootstrap workspace: создаёт его, при необходимости выпускает user token,
 * и подготавливает URL, CI variables и пояснения для оператора.
 */
export function bootstrapWorkspace(
    input: BootstrapWorkspaceInput,
    configOverrides: Partial<SaasAppConfig> = {},
): BootstrapWorkspaceOutput {
    const { config, backendStorage, registry } = createBootstrapCliRuntime(configOverrides)
    const createdWorkspace = registry.createWorkspace({
        name: input.name,
        slug: input.slug,
        apiKeyLabel: input.apiKeyLabel,
    })

    ensureWorkspaceReadModelInitialized(createdWorkspace.workspace.slug, backendStorage, config)

    const shouldCreateWorkspaceUser = config.requireWorkspaceAuth && !input.skipUser
    const createdUser = shouldCreateWorkspaceUser
        ? registry.createUser(createdWorkspace.workspace.slug, {
            label: input.userLabel ?? 'GitLab dashboard viewer',
            role: input.userRole ?? 'viewer',
        })
        : null

    const baseUrl = normalizeBaseUrl(input.baseUrl ?? `http://127.0.0.1:${config.port}`)
    const slug = createdWorkspace.workspace.slug
    const dashboardUrl = `${baseUrl}/w/${encodeURIComponent(slug)}`
    const loginUrl = `${dashboardUrl}/login`
    const gitlabVariables = {
        AQA_PULSE_BASE_URL: baseUrl,
        AQA_PULSE_WORKSPACE_SLUG: slug,
        AQA_PULSE_WORKSPACE_API_KEY: createdWorkspace.apiKey.token,
    }

    return {
        workspace: {
            name: createdWorkspace.workspace.name,
            slug,
            dashboardUrl,
            loginUrl,
        },
        tokens: {
            workspaceApiKey: createdWorkspace.apiKey.token,
            workspaceUserToken: createdUser?.user.token ?? null,
        },
        gitlabVariables,
        server: {
            baseUrl,
            storageDriver: config.storageDriver,
            dataRoot: config.dataRoot,
            sqlitePath: config.sqlitePath,
            requireWorkspaceAuth: config.requireWorkspaceAuth,
        },
        notes: buildNotes({
            requireWorkspaceAuth: config.requireWorkspaceAuth,
            createdWorkspaceUser: Boolean(createdUser),
        }),
    }
}

function buildNotes(options: { requireWorkspaceAuth: boolean; createdWorkspaceUser: boolean }): string[] {
    const notes = [
        'Сохрани plaintext токены в секретное хранилище: сервер хранит только hash/preview и не сможет показать их повторно.',
        'В GitLab CI достаточно хранить только AQA_PULSE_WORKSPACE_API_KEY: upload-скрипт сам делает exchange raw key -> ingestion JWT.',
        'Admin token не нужен в GitLab CI: он нужен только для первичного provisioning/admin операций.',
    ]

    if (!options.requireWorkspaceAuth) {
        notes.push('AQA_PULSE_REQUIRE_WORKSPACE_AUTH=false: dashboard read-routes открыты, workspace user token можно не создавать.')
        return notes
    }

    if (options.createdWorkspaceUser) {
        notes.push('Dashboard защищён: используй workspace user token только для /w/<slug>/login, а не для CI upload.')
    } else {
        notes.push('Dashboard защищён, но workspace user token не создан из-за --skip-user. Создай его позже через admin UI/API, если потребуется закрытый доступ.')
    }

    return notes
}

function normalizeBaseUrl(value: string): string {
    return value.trim().replace(/\/+$/, '')
}