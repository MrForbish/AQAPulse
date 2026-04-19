/**
 * Назначение файла: выполняет начальную настройку workspace
 * и выпуск первых учётных данных для доступа.
 */
import { ensureWorkspaceReadModelInitialized } from './application/admin'
import { resolveSaasAppConfig } from './config'
import { createBackendStorage, type BackendStorage, type BootstrapWorkspaceRegistry, WorkspaceRegistry } from './infrastructure/persistence'

interface CliOptions {
    name: string
    slug?: string
    baseUrl?: string
    apiKeyLabel?: string
    userLabel?: string
    userRole?: 'owner' | 'viewer'
    skipUser: boolean
    json: boolean
}

interface BootstrapOutput {
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

try {
    const options = parseCliOptions(process.argv.slice(2))
    const config = resolveSaasAppConfig()
    const backendStorage = createBackendStorage(config)
    const registry: BootstrapWorkspaceRegistry = new WorkspaceRegistry(backendStorage.registry)
    const createdWorkspace = registry.createWorkspace({
        name: options.name,
        slug: options.slug,
        apiKeyLabel: options.apiKeyLabel,
    })

    ensureWorkspaceReadModelInitialized(createdWorkspace.workspace.slug, backendStorage, config)

    const shouldCreateWorkspaceUser = config.requireWorkspaceAuth && !options.skipUser
    const createdUser = shouldCreateWorkspaceUser
        ? registry.createUser(createdWorkspace.workspace.slug, {
            label: options.userLabel ?? 'GitLab dashboard viewer',
            role: options.userRole ?? 'viewer',
        })
        : null

    const baseUrl = normalizeBaseUrl(options.baseUrl ?? `http://127.0.0.1:${config.port}`)
    const slug = createdWorkspace.workspace.slug
    const dashboardUrl = `${baseUrl}/w/${encodeURIComponent(slug)}`
    const loginUrl = `${dashboardUrl}/login`
    const gitlabVariables = {
        AQA_PULSE_BASE_URL: baseUrl,
        AQA_PULSE_WORKSPACE_SLUG: slug,
        AQA_PULSE_WORKSPACE_API_KEY: createdWorkspace.apiKey.token,
    }

    const notes = buildNotes({
        requireWorkspaceAuth: config.requireWorkspaceAuth,
        createdWorkspaceUser: Boolean(createdUser),
    })

    const output: BootstrapOutput = {
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
        notes,
    }

    if (options.json) {
        process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
    } else {
        printHumanReadableOutput(output)
    }
} catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка bootstrap workspace: ${message}`)
    process.exitCode = 1
}

function parseCliOptions(args: string[]): CliOptions {
    if (args.includes('--help') || args.includes('-h')) {
        printHelp()
        process.exit(0)
    }

    const options: CliOptions = {
        name: '',
        skipUser: false,
        json: false,
    }
    const positionalArgs: string[] = []

    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index]

        if (!currentArg.startsWith('--')) {
            positionalArgs.push(currentArg)
            continue
        }

        if (currentArg === '--skip-user') {
            options.skipUser = true
            continue
        }

        if (currentArg === '--json') {
            options.json = true
            continue
        }

        const nextArg = args[index + 1]

        if (!nextArg || nextArg.startsWith('--')) {
            throw new Error(`Для аргумента ${currentArg} нужно передать значение.`)
        }

        if (currentArg === '--name') {
            options.name = nextArg
            index += 1
            continue
        }

        if (currentArg === '--slug') {
            options.slug = nextArg
            index += 1
            continue
        }

        if (currentArg === '--base-url') {
            options.baseUrl = nextArg
            index += 1
            continue
        }

        if (currentArg === '--api-key-label') {
            options.apiKeyLabel = nextArg
            index += 1
            continue
        }

        if (currentArg === '--user-label') {
            options.userLabel = nextArg
            index += 1
            continue
        }

        if (currentArg === '--user-role') {
            if (nextArg !== 'owner' && nextArg !== 'viewer') {
                throw new Error('Аргумент --user-role поддерживает только owner или viewer.')
            }

            options.userRole = nextArg
            index += 1
            continue
        }

        throw new Error(`Неизвестный аргумент: ${currentArg}`)
    }

    if (!pickOptionalText(options.name) && positionalArgs.length > 0) {
        options.name = positionalArgs.shift() ?? ''
    }

    if (!pickOptionalText(options.slug) && positionalArgs.length > 0) {
        options.slug = positionalArgs.shift()
    }

    if (!pickOptionalText(options.baseUrl) && positionalArgs.length > 0) {
        options.baseUrl = positionalArgs.shift()
    }

    if (positionalArgs.length > 0) {
        throw new Error(`Передано слишком много позиционных аргументов: ${positionalArgs.join(', ')}`)
    }

    if (!pickOptionalText(options.name)) {
        throw new Error('Нужно передать --name "<workspace name>".')
    }

    return {
        ...options,
        name: options.name.trim(),
        slug: pickOptionalText(options.slug) ?? undefined,
        baseUrl: pickOptionalText(options.baseUrl) ?? undefined,
        apiKeyLabel: pickOptionalText(options.apiKeyLabel) ?? undefined,
        userLabel: pickOptionalText(options.userLabel) ?? undefined,
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

function printHumanReadableOutput(output: BootstrapOutput): void {
    console.log('AQA Pulse workspace bootstrap завершён.')
    console.log('')
    console.log('Workspace:')
    console.log(`  Name: ${output.workspace.name}`)
    console.log(`  Slug: ${output.workspace.slug}`)
    console.log(`  Dashboard URL: ${output.workspace.dashboardUrl}`)
    console.log(`  Login URL: ${output.workspace.loginUrl}`)
    console.log('')
    console.log('Tokens:')
    console.log(`  Workspace API key: ${output.tokens.workspaceApiKey}`)

    if (output.tokens.workspaceUserToken) {
        console.log(`  Workspace user token: ${output.tokens.workspaceUserToken}`)
    } else {
        console.log('  Workspace user token: [not created]')
    }

    console.log('')
    console.log('GitLab CI/CD variables:')

    for (const [key, value] of Object.entries(output.gitlabVariables)) {
        console.log(`  ${key}=${value}`)
    }

    console.log('')
    console.log('Server config:')
    console.log(`  Base URL: ${output.server.baseUrl}`)
    console.log(`  Storage driver: ${output.server.storageDriver}`)
    console.log(`  Data root: ${output.server.dataRoot}`)
    console.log(`  SQLite path: ${output.server.sqlitePath ?? '[not configured]'}`)
    console.log(`  Require workspace auth: ${output.server.requireWorkspaceAuth}`)
    console.log('')
    console.log('Notes:')

    for (const note of output.notes) {
        console.log(`  - ${note}`)
    }
}

function printHelp(): void {
    console.log('aqa-pulse-server bootstrap-workspace --name "<workspace name>" [options]')
    console.log('')
    console.log('Опции:')
    console.log('  --slug <slug>                 Явный slug workspace')
    console.log('  --base-url <url>             Публичный URL сервера для печати dashboard/GitLab links')
    console.log('  --api-key-label <label>      Label для ingestion API key')
    console.log('  --user-label <label>         Label для workspace user token')
    console.log('  --user-role <viewer|owner>   Роль workspace user token')
    console.log('  --skip-user                  Не создавать workspace user token')
    console.log('  --json                       Печатать результат в JSON')
}

function normalizeBaseUrl(value: string): string {
    return value.trim().replace(/\/+$/, '')
}

function pickOptionalText(value: string | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}


