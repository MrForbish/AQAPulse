#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const DEFAULT_PORT = 3000
const DEFAULT_HEALTH_TIMEOUT_MS = 90_000
const DEFAULT_HEALTH_INTERVAL_MS = 1_500

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка update self-hosted: ${message}`)
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

    if (!fs.existsSync(envPath)) {
        throw new Error(`Не найден .env: ${envPath}. Сначала выполни setup:docker или создай env вручную.`)
    }

    const envValues = parseEnvFile(fs.readFileSync(envPath, 'utf8'))
    const port = normalizePort(envValues.PORT) ?? DEFAULT_PORT
    const localBaseUrl = normalizeBaseUrl(options.localBaseUrl || `http://127.0.0.1:${port}`)
    const hostDataDir = path.resolve(serverRoot, envValues.AQA_PULSE_HOST_DATA_DIR || './data')
    const storageDriver = envValues.AQA_PULSE_STORAGE_DRIVER || 'sqlite'

    let sqliteBackupPath = null

    if (options.buildPackage) {
        runCommand(getNpmCommand(), ['run', 'build'], { stdio: 'inherit', dryRun: options.dryRun })
    }

    if (!options.skipBackup && storageDriver === 'sqlite') {
        sqliteBackupPath = backupSqliteDatabase({
            serverRoot,
            hostDataDir,
            sqlitePath: envValues.AQA_PULSE_SQLITE_PATH || '/data/aqa-pulse.sqlite',
            backupDir: options.backupDir,
            dryRun: options.dryRun,
        })
    }

    runCommand('docker', ['compose', 'up', '--build', '-d'], { stdio: 'inherit', dryRun: options.dryRun })

    if (!options.dryRun) {
        await waitForHealth(`${localBaseUrl}/api/health`, options.healthTimeoutMs)
    }

    printSummary({
        envPath,
        localBaseUrl,
        hostDataDir,
        storageDriver,
        sqliteBackupPath,
        buildPackage: options.buildPackage,
        dryRun: options.dryRun,
    })
}

function parseArgs(args) {
    const options = {
        envPath: '.env',
        healthTimeoutMs: DEFAULT_HEALTH_TIMEOUT_MS,
        skipBackup: false,
        buildPackage: false,
        dryRun: false,
        help: false,
    }

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index]

        if (arg === '--help' || arg === '-h') {
            options.help = true
            continue
        }

        if (arg === '--skip-backup') {
            options.skipBackup = true
            continue
        }

        if (arg === '--build-package') {
            options.buildPackage = true
            continue
        }

        if (arg === '--dry-run') {
            options.dryRun = true
            continue
        }

        const nextArg = args[index + 1]

        if (!nextArg || nextArg.startsWith('--')) {
            throw new Error(`Для аргумента ${arg} нужно передать значение.`)
        }

        if (arg === '--env-path') {
            options.envPath = nextArg
            index += 1
            continue
        }

        if (arg === '--local-base-url') {
            options.localBaseUrl = nextArg
            index += 1
            continue
        }

        if (arg === '--backup-dir') {
            options.backupDir = nextArg
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

    return options
}

function parseEnvFile(text) {
    const values = {}

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim()

        if (!line || line.startsWith('#')) {
            continue
        }

        const separatorIndex = line.indexOf('=')

        if (separatorIndex <= 0) {
            continue
        }

        const key = line.slice(0, separatorIndex).trim()
        const value = line.slice(separatorIndex + 1).trim()
        values[key] = value
    }

    return values
}

function backupSqliteDatabase(options) {
    const sqliteHostPath = resolveHostSqlitePath(options.serverRoot, options.hostDataDir, options.sqlitePath)

    if (!fs.existsSync(sqliteHostPath)) {
        console.log(`SQLite backup пропущен: файл базы не найден по пути ${sqliteHostPath}`)
        return null
    }

    const backupDirectory = options.backupDir
        ? path.resolve(options.serverRoot, options.backupDir)
        : path.join(options.hostDataDir, 'backups')
    const backupFileName = `aqa-pulse-${formatTimestamp(new Date())}.sqlite`
    const backupPath = path.join(backupDirectory, backupFileName)

    if (options.dryRun) {
        console.log(`[dry-run] SQLite backup: ${sqliteHostPath} -> ${backupPath}`)
        return backupPath
    }

    fs.mkdirSync(backupDirectory, { recursive: true })
    fs.copyFileSync(sqliteHostPath, backupPath)
    console.log(`SQLite backup готов: ${backupPath}`)
    return backupPath
}

function resolveHostSqlitePath(serverRoot, hostDataDir, sqlitePath) {
    const normalized = sqlitePath.replace(/\\/g, '/')

    if (normalized === '/data' || normalized.startsWith('/data/')) {
        return path.join(hostDataDir, normalized.replace(/^\/data\/?/, ''))
    }

    if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('/')) {
        return path.resolve(normalized)
    }

    return path.resolve(serverRoot, normalized)
}

function formatTimestamp(value) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const hours = String(value.getHours()).padStart(2, '0')
    const minutes = String(value.getMinutes()).padStart(2, '0')
    const seconds = String(value.getSeconds()).padStart(2, '0')

    return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

function getNpmCommand() {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function normalizePort(value) {
    const parsed = normalizePositiveInteger(value)
    return parsed && parsed <= 65535 ? parsed : null
}

function normalizePositiveInteger(value) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        return null
    }

    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizeBaseUrl(value) {
    return value.trim().replace(/\/+$/, '')
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
    if (options.dryRun) {
        console.log(`[dry-run] ${command} ${args.join(' ')}`)
        return { status: 0 }
    }

    const result = spawnSync(command, args, {
        cwd: process.cwd(),
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

function printSummary(options) {
    console.log('')
    console.log('Update завершён.')
    console.log(`.env: ${options.envPath}`)
    console.log(`Local health URL: ${options.localBaseUrl}`)
    console.log(`Host data dir: ${options.hostDataDir}`)
    console.log(`Storage driver: ${options.storageDriver}`)

    if (options.sqliteBackupPath) {
        console.log(`SQLite backup: ${options.sqliteBackupPath}`)
    }

    if (options.buildPackage) {
        console.log('Готовая сборка сервера была пересобрана перед update.')
    }

    if (options.dryRun) {
        console.log('Dry-run режим: команды не выполнялись фактически.')
    }
}

function printHelp() {
    console.log('node ./scripts/update-self-hosted.js [options]')
    console.log('')
    console.log('Основной сценарий:')
    console.log('  1. читает текущий .env;')
    console.log('  2. при sqlite делает backup базы;')
    console.log('  3. пересобирает и перезапускает docker compose;')
    console.log('  4. ждёт локальный health-check.')
    console.log('')
    console.log('Опции:')
    console.log('  --env-path <path>                 Какой .env использовать, по умолчанию ./.env')
    console.log('  --local-base-url <url>            Локальный URL для health-check, по умолчанию http://127.0.0.1:<port>')
    console.log('  --backup-dir <path>               Куда складывать SQLite backup, по умолчанию <data>/backups')
    console.log('  --skip-backup                     Не делать backup SQLite перед update')
    console.log('  --build-package                   Перед update выполнить npm run build')
    console.log('  --dry-run                         Только показать действия без реального выполнения')
    console.log('  --health-timeout-ms <ms>          Сколько ждать /api/health')
}