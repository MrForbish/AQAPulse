#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const { parseEnvFile, normalizeBaseUrl, normalizePort, normalizePositiveInteger } = require('./self-hosted-utils')

const DEFAULT_PORT = 3000
const DEFAULT_HEALTH_TIMEOUT_MS = 90_000
const DEFAULT_HEALTH_INTERVAL_MS = 1_500

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка setup self-hosted: ${message}`)
    process.exitCode = 1
})

async function main() {
    const options = parseArgs(process.argv.slice(2))

    if (options.help) {
        printHelp()
        return
    }

    const serverRoot = path.resolve(__dirname, '..')
    process.chdir(serverRoot)

    const envPath = path.resolve(serverRoot, options.envPath)
    const envExists = fs.existsSync(envPath)
    const existingEnv = envExists ? parseEnvFile(fs.readFileSync(envPath, 'utf8')) : {}
    const shouldWriteEnv = !envExists || options.overwriteEnv
    const envValues = shouldWriteEnv
        ? buildEnvValues(options, existingEnv)
        : existingEnv

    if (shouldWriteEnv) {
        fs.writeFileSync(envPath, renderEnvFile(envValues), 'utf8')
        console.log(`Создан конфиг: ${envPath}`)
    } else {
        console.log(`Использую существующий конфиг: ${envPath}`)
    }

    const hostDataDir = path.resolve(serverRoot, envValues.AQA_PULSE_HOST_DATA_DIR || './data')
    fs.mkdirSync(hostDataDir, { recursive: true })

    if (!options.skipPackageBuild) {
        ensurePackageBuild(serverRoot, options)
    }

    const port = normalizePort(envValues.PORT) ?? DEFAULT_PORT
    const localBaseUrl = normalizeBaseUrl(options.localBaseUrl || `http://127.0.0.1:${port}`)
    const baseUrl = resolvePublicBaseUrl(options, port)
    const nginxConfigPath = options.publicHost ? writeNginxConfig(serverRoot, options, port) : null

    if (!options.skipStart) {
        runCommand('docker', ['compose', 'up', '--build', '-d'], { stdio: 'inherit' })
        await waitForHealth(`${localBaseUrl}/api/health`, options.healthTimeoutMs)
    }

    if (!options.skipBootstrap && options.workspaceName) {
        const bootstrapArgs = [
            'compose',
            'exec',
            '-T',
            'aqa-pulse-server',
            'node',
            './bin/aqa-pulse-server.js',
            'bootstrap-workspace',
            '--name',
            options.workspaceName,
            '--base-url',
            baseUrl,
        ]

        if (options.workspaceSlug) {
            bootstrapArgs.push('--slug', options.workspaceSlug)
        }

        if (options.skipWorkspaceUser) {
            bootstrapArgs.push('--skip-user')
        }

        runCommand('docker', bootstrapArgs, { stdio: 'inherit' })
    }

    printNextSteps({
        baseUrl,
        localBaseUrl,
        envPath,
        hostDataDir,
        publicHost: options.publicHost,
        nginxConfigPath,
        workspaceName: options.workspaceName,
        workspaceSlug: options.workspaceSlug,
        skipStart: options.skipStart,
        skipBootstrap: options.skipBootstrap,
    })
}

function parseArgs(args) {
    const options = {
        envPath: '.env',
        healthTimeoutMs: DEFAULT_HEALTH_TIMEOUT_MS,
        overwriteEnv: false,
        skipStart: false,
        skipBootstrap: false,
        skipWorkspaceUser: false,
        forcePackageBuild: false,
        skipPackageBuild: false,
        skipInstall: false,
        help: false,
    }

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index]

        if (arg === '--help' || arg === '-h') {
            options.help = true
            continue
        }

        if (arg === '--overwrite-env') {
            options.overwriteEnv = true
            continue
        }

        if (arg === '--skip-start') {
            options.skipStart = true
            continue
        }

        if (arg === '--skip-bootstrap') {
            options.skipBootstrap = true
            continue
        }

        if (arg === '--skip-workspace-user') {
            options.skipWorkspaceUser = true
            continue
        }

        if (arg === '--build-package') {
            options.forcePackageBuild = true
            continue
        }

        if (arg === '--skip-build-package') {
            options.skipPackageBuild = true
            continue
        }

        if (arg === '--skip-install') {
            options.skipInstall = true
            continue
        }

        const nextArg = args[index + 1]

        if (!nextArg || nextArg.startsWith('--')) {
            throw new Error(`Для аргумента ${arg} нужно передать значение.`)
        }

        if (arg === '--workspace-name') {
            options.workspaceName = nextArg
            index += 1
            continue
        }

        if (arg === '--workspace-slug') {
            options.workspaceSlug = nextArg
            index += 1
            continue
        }

        if (arg === '--base-url') {
            options.baseUrl = nextArg
            index += 1
            continue
        }

        if (arg === '--public-host') {
            options.publicHost = nextArg
            index += 1
            continue
        }

        if (arg === '--public-scheme') {
            options.publicScheme = nextArg
            index += 1
            continue
        }

        if (arg === '--public-port') {
            options.publicPort = nextArg
            index += 1
            continue
        }

        if (arg === '--local-base-url') {
            options.localBaseUrl = nextArg
            index += 1
            continue
        }

        if (arg === '--port') {
            options.port = nextArg
            index += 1
            continue
        }

        if (arg === '--storage-driver') {
            options.storageDriver = nextArg
            index += 1
            continue
        }

        if (arg === '--postgres-url') {
            options.postgresUrl = nextArg
            index += 1
            continue
        }

        if (arg === '--admin-token') {
            options.adminToken = nextArg
            index += 1
            continue
        }

        if (arg === '--jwt-secret') {
            options.jwtSecret = nextArg
            index += 1
            continue
        }

        if (arg === '--require-workspace-auth') {
            options.requireWorkspaceAuth = nextArg
            index += 1
            continue
        }

        if (arg === '--env-path') {
            options.envPath = nextArg
            index += 1
            continue
        }

        if (arg === '--host-data-dir') {
            options.hostDataDir = nextArg
            index += 1
            continue
        }

        if (arg === '--nginx-config-path') {
            options.nginxConfigPath = nextArg
            index += 1
            continue
        }

        if (arg === '--health-timeout-ms') {
            options.healthTimeoutMs = normalizePositiveInteger(nextArg) ?? DEFAULT_HEALTH_TIMEOUT_MS
            index += 1
            continue
        }

        throw new Error(`Неизвестный аргумент: ${arg}`)
    }

    if (options.storageDriver && !['file', 'sqlite', 'postgres'].includes(options.storageDriver)) {
        throw new Error('Аргумент --storage-driver поддерживает только file, sqlite или postgres.')
    }

    if (options.workspaceSlug && !options.workspaceName) {
        throw new Error('Аргумент --workspace-slug можно использовать только вместе с --workspace-name.')
    }

    if (options.publicScheme && !['http', 'https'].includes(options.publicScheme)) {
        throw new Error('Аргумент --public-scheme поддерживает только http или https.')
    }

    if (options.publicPort && !normalizePort(options.publicPort)) {
        throw new Error('Аргумент --public-port должен быть целым числом от 1 до 65535.')
    }

    if (!options.skipBootstrap && !options.workspaceName) {
        options.skipBootstrap = true
    }

    return options
}

function buildEnvValues(options, existingEnv) {
    const port = normalizePort(options.port) ?? normalizePort(existingEnv.PORT) ?? DEFAULT_PORT
    const storageDriver = options.storageDriver || existingEnv.AQA_PULSE_STORAGE_DRIVER || 'sqlite'
    const requireWorkspaceAuth = normalizeBooleanString(options.requireWorkspaceAuth, existingEnv.AQA_PULSE_REQUIRE_WORKSPACE_AUTH ?? 'true')
    const hostDataDir = toComposeRelativePath(options.hostDataDir || existingEnv.AQA_PULSE_HOST_DATA_DIR || './data')
    const adminToken = options.adminToken || existingEnv.AQA_PULSE_ADMIN_TOKEN || generateSecret(24)
    const jwtSecret = options.jwtSecret || existingEnv.AQA_PULSE_JWT_SECRET || generateSecret(32)
    const postgresUrl = storageDriver === 'postgres'
        ? (options.postgresUrl || existingEnv.AQA_PULSE_POSTGRES_URL || '')
        : ''

    if (storageDriver === 'postgres' && !postgresUrl) {
        throw new Error('Для --storage-driver postgres нужно передать --postgres-url.')
    }

    return {
        PORT: String(port),
        AQA_PULSE_HOST_DATA_DIR: hostDataDir,
        AQA_PULSE_DATA_ROOT: '/data',
        AQA_PULSE_STORAGE_DRIVER: storageDriver,
        AQA_PULSE_SQLITE_PATH: '/data/aqa-pulse.sqlite',
        AQA_PULSE_POSTGRES_URL: postgresUrl,
        AQA_PULSE_ADMIN_TOKEN: adminToken,
        AQA_PULSE_JWT_SECRET: jwtSecret,
        AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS: existingEnv.AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS || '28800',
        AQA_PULSE_REQUEST_BODY_LIMIT: existingEnv.AQA_PULSE_REQUEST_BODY_LIMIT || '50mb',
        AQA_PULSE_ENABLE_DEV_BOOTSTRAP: 'false',
        AQA_PULSE_REQUIRE_WORKSPACE_AUTH: requireWorkspaceAuth,
    }
}

function resolvePublicBaseUrl(options, localPort) {
    if (options.baseUrl) {
        return normalizeBaseUrl(options.baseUrl)
    }

    if (options.publicHost) {
        const scheme = options.publicScheme || 'https'
        const publicPort = normalizePort(options.publicPort)
        const portSuffix = publicPort && !isDefaultPortForScheme(publicPort, scheme) ? `:${publicPort}` : ''

        return normalizeBaseUrl(`${scheme}://${options.publicHost}${portSuffix}`)
    }

    return normalizeBaseUrl(`http://127.0.0.1:${localPort}`)
}

function isDefaultPortForScheme(port, scheme) {
    return (scheme === 'http' && port === 80) || (scheme === 'https' && port === 443)
}

function renderEnvFile(envValues) {
    const lines = [
        '# Generated by scripts/setup-self-hosted.js',
        '# Host directory mounted into the container as /data.',
        `AQA_PULSE_HOST_DATA_DIR=${envValues.AQA_PULSE_HOST_DATA_DIR}`,
        '',
        `PORT=${envValues.PORT}`,
        `AQA_PULSE_DATA_ROOT=${envValues.AQA_PULSE_DATA_ROOT}`,
        `AQA_PULSE_STORAGE_DRIVER=${envValues.AQA_PULSE_STORAGE_DRIVER}`,
        `AQA_PULSE_SQLITE_PATH=${envValues.AQA_PULSE_SQLITE_PATH}`,
        `AQA_PULSE_POSTGRES_URL=${envValues.AQA_PULSE_POSTGRES_URL}`,
        `AQA_PULSE_ADMIN_TOKEN=${envValues.AQA_PULSE_ADMIN_TOKEN}`,
        `AQA_PULSE_JWT_SECRET=${envValues.AQA_PULSE_JWT_SECRET}`,
        `AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS=${envValues.AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS}`,
        `AQA_PULSE_REQUEST_BODY_LIMIT=${envValues.AQA_PULSE_REQUEST_BODY_LIMIT}`,
        `AQA_PULSE_ENABLE_DEV_BOOTSTRAP=${envValues.AQA_PULSE_ENABLE_DEV_BOOTSTRAP}`,
        `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=${envValues.AQA_PULSE_REQUIRE_WORKSPACE_AUTH}`,
        '',
    ]

    return lines.join('\n')
}

function generateSecret(byteLength) {
    return crypto.randomBytes(byteLength).toString('base64url')
}

function normalizeBooleanString(value, fallback) {
    const normalized = typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : String(fallback).trim().toLowerCase()
    return ['1', 'true', 'yes', 'on'].includes(normalized) ? 'true' : 'false'
}

function toComposeRelativePath(value) {
    const normalized = value.trim().replace(/\\/g, '/')

    if (normalized.startsWith('./') || normalized.startsWith('../')) {
        return normalized
    }

    if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('/')) {
        return normalized
    }

    return `./${normalized.replace(/^\/+/, '')}`
}

function writeNginxConfig(serverRoot, options, upstreamPort) {
    const targetPath = path.resolve(serverRoot, options.nginxConfigPath || path.join('.generated', 'nginx', `${sanitizeFileSegment(options.publicHost)}.conf`))
    const renderedConfig = renderNginxConfig({
        serverName: options.publicHost,
        upstreamPort,
        enableTlsRedirect: (options.publicScheme || 'https') === 'https',
    })

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, renderedConfig, 'utf8')
    return targetPath
}

function ensurePackageBuild(serverRoot, options) {
    const distEntry = path.join(serverRoot, 'dist', 'backend', 'index.js')

    if (!options.forcePackageBuild && fs.existsSync(distEntry)) {
        console.log('Package build found: dist/backend/index.js')
        return
    }

    const appRoot = path.resolve(serverRoot, '..', 'aqa-pulse')
    console.log(options.forcePackageBuild ? 'Rebuilding server package...' : 'Server package build is missing, building it now...')

    if (!options.skipInstall) {
        ensureNpmInstall(appRoot)
        ensureNpmInstall(serverRoot)
    }

    runCommand(getNpmCommand(), ['run', 'build'], { cwd: serverRoot, stdio: 'inherit' })

    if (!fs.existsSync(distEntry)) {
        throw new Error('Build finished, but dist/backend/index.js was not created.')
    }
}

function ensureNpmInstall(projectRoot) {
    const packageLockPath = path.join(projectRoot, 'package-lock.json')
    const nodeModulesPath = path.join(projectRoot, 'node_modules')

    if (!fs.existsSync(packageLockPath) || fs.existsSync(nodeModulesPath)) {
        return
    }

    console.log(`Installing dependencies: ${projectRoot}`)
    runCommand(getNpmCommand(), ['ci'], { cwd: projectRoot, stdio: 'inherit' })
}

function getNpmCommand() {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function sanitizeFileSegment(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'aqa-pulse'
}

function renderNginxConfig(options) {
    const redirectBlock = options.enableTlsRedirect
        ? `server {
    listen 80;
    listen [::]:80;
    server_name ${options.serverName};

    return 301 https://$host$request_uri;
}

`
        : ''
    const listenBlock = options.enableTlsRedirect
        ? `    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    # Укажи свои реальные certificate paths.
    ssl_certificate /etc/letsencrypt/live/${options.serverName}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${options.serverName}/privkey.pem;

`
        : `    listen 80;
    listen [::]:80;

`

    return `# Generated by scripts/setup-self-hosted.js
# Upstream AQA Pulse container is expected on 127.0.0.1:${options.upstreamPort}

${redirectBlock}server {
${listenBlock}    server_name ${options.serverName};

    location / {
        proxy_pass http://127.0.0.1:${options.upstreamPort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`
}

async function waitForHealth(healthUrl, timeoutMs) {
    const startedAt = Date.now()
    console.log(`Жду health-check: ${healthUrl}`)

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(healthUrl)

            if (response.ok) {
                console.log('Health-check успешен.')
                return
            }
        } catch {
            // Server is still starting up.
        }

        await sleep(DEFAULT_HEALTH_INTERVAL_MS)
    }

    throw new Error(`Сервер не ответил health-check за ${timeoutMs}ms: ${healthUrl}`)
}

function sleep(timeoutMs) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeoutMs)
    })
}

function runCommand(command, args, options) {
    const result = spawnSync(command, args, {
        cwd: options.cwd || process.cwd(),
        stdio: options.stdio,
        encoding: 'utf8',
    })

    if (result.error) {
        throw result.error
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`Команда завершилась с кодом ${result.status}: ${command} ${args.join(' ')}`)
    }

    return result
}

function printNextSteps(options) {
    console.log('')
    console.log('Self-hosted setup завершён.')
    console.log(`Public base URL: ${options.baseUrl}`)
    console.log(`Local health URL: ${options.localBaseUrl}`)
    console.log(`.env: ${options.envPath}`)
    console.log(`Host data dir: ${options.hostDataDir}`)

    if (options.nginxConfigPath) {
        console.log(`Nginx config snippet: ${options.nginxConfigPath}`)
    }

    if (options.skipStart) {
        console.log('Сервер не запускался автоматически: используй docker compose up --build -d')
    }

    if (options.workspaceName && options.skipBootstrap) {
        console.log('Workspace не создавался автоматически: убери --skip-bootstrap или вызови bootstrap:workspace отдельно.')
    }

    if (!options.workspaceName) {
        console.log('Workspace пока не создавался: передай --workspace-name, чтобы setup сделал это автоматически.')
    }

    if (options.publicHost) {
        console.log(`Публичный домен: ${options.publicHost}`)
        console.log('Health-check идёт локально, поэтому reverse proxy можно настроить уже после docker setup.')
    }
}

function printHelp() {
    console.log('node ./scripts/setup-self-hosted.js [options]')
    console.log('')
    console.log('Основной сценарий:')
    console.log('  1. генерирует .env с безопасными токенами;')
    console.log('  2. поднимает docker compose;')
    console.log('  3. ждёт /api/health;')
    console.log('  4. при --workspace-name сразу создаёт первый workspace.')
    console.log('')
    console.log('Опции:')
    console.log('  --workspace-name <name>           Сразу создать первый workspace')
    console.log('  --workspace-slug <slug>           Явный slug для первого workspace')
    console.log('  --base-url <url>                  Публичный base URL для dashboard links')
    console.log('  --public-host <host>              Собрать public base URL из домена и сгенерировать Nginx snippet')
    console.log('  --public-scheme <http|https>      Схема для public host, по умолчанию https')
    console.log('  --public-port <port>              Внешний порт для public host, если не 80/443')
    console.log('  --local-base-url <url>            Локальный URL для health-check, по умолчанию http://127.0.0.1:<port>')
    console.log('  --port <port>                     HTTP port для compose и самого сервера')
    console.log('  --storage-driver <file|sqlite|postgres>  Storage driver, по умолчанию sqlite')
    console.log('  --postgres-url <url>              Connection string для postgres storage')
    console.log('  --admin-token <token>             Явный admin token вместо автогенерации')
    console.log('  --jwt-secret <secret>             Явный JWT secret вместо автогенерации')
    console.log('  --require-workspace-auth <true|false>    Нужен ли login для dashboard')
    console.log('  --host-data-dir <path>            Host path для docker volume, по умолчанию ./data')
    console.log('  --nginx-config-path <path>        Куда записать generated Nginx config, по умолчанию ./.generated/nginx/<host>.conf')
    console.log('  --env-path <path>                 Куда писать .env, по умолчанию ./.env')
    console.log('  --overwrite-env                   Перезаписать существующий .env')
    console.log('  --skip-start                      Не запускать docker compose автоматически')
    console.log('  --skip-bootstrap                  Не создавать workspace автоматически')
    console.log('  --skip-workspace-user             При bootstrap не создавать workspace user token')
    console.log('  --build-package                   Пересобрать dist перед docker compose')
    console.log('  --skip-build-package              Не собирать dist автоматически')
    console.log('  --skip-install                    Не запускать npm ci при отсутствии node_modules')
    console.log('  --health-timeout-ms <ms>          Сколько ждать /api/health')
}
