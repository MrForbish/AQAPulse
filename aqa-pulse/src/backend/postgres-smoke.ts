import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { runAuthFlowSmoke } from './auth-flow-smoke'

const POSTGRES_IMAGE = process.env.AQA_PULSE_POSTGRES_SMOKE_IMAGE ?? 'postgres:16-alpine'
const POSTGRES_DB = process.env.AQA_PULSE_POSTGRES_SMOKE_DB ?? 'aqa_pulse_smoke'
const POSTGRES_USER = process.env.AQA_PULSE_POSTGRES_SMOKE_USER ?? 'postgres'
const POSTGRES_PASSWORD = process.env.AQA_PULSE_POSTGRES_SMOKE_PASSWORD ?? 'postgres'
const containerName = `aqa-pulse-postgres-smoke-${Date.now()}`
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aqa-pulse-postgres-smoke-'))
const wrapperDirectory = path.join(tempRoot, 'bin')
const wrapperPath = path.join(wrapperDirectory, 'psql.cmd')
const connectionString = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}`
const originalPath = process.env.PATH ?? ''

async function main(): Promise<void> {
    ensureCommandAvailable('docker')
    ensureDockerDaemonAvailable()
    fs.mkdirSync(wrapperDirectory, { recursive: true })
    fs.writeFileSync(wrapperPath, `@echo off\r\ndocker exec -i ${containerName} psql %*\r\n`, 'utf8')

    try {
        runCommand('docker', [
            'run',
            '--detach',
            '--rm',
            '--name', containerName,
            '--env', `POSTGRES_DB=${POSTGRES_DB}`,
            '--env', `POSTGRES_USER=${POSTGRES_USER}`,
            '--env', `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
            POSTGRES_IMAGE,
        ], 'Не удалось запустить временный Postgres container для smoke.')

        waitForPostgresReady()

        process.env.PATH = `${wrapperDirectory};${originalPath}`

        await runAuthFlowSmoke({
            scenarioName: 'postgres',
            configOverrides: {
                storageDriver: 'postgres',
                postgresConnectionString: connectionString,
                dataRoot: path.join(tempRoot, 'data'),
                distPath: path.join(tempRoot, 'dist'),
                legacyArchiveRootPath: path.join(tempRoot, 'history'),
            },
        })

        console.log('Postgres smoke завершён успешно.')
        console.log(`Container: ${containerName}`)
        console.log(`Connection string: ${connectionString}`)
    } finally {
        process.env.PATH = originalPath
        runCommand('docker', ['rm', '--force', containerName], '', { allowFailure: true })

        if (process.env.AQA_PULSE_KEEP_SMOKE_DATA !== '1') {
            fs.rmSync(tempRoot, { recursive: true, force: true })
        }
    }
}

main().catch((error) => {
    console.error(`Postgres smoke завершился ошибкой: ${getErrorMessage(error)}`)
    process.exitCode = 1
})

function waitForPostgresReady(): void {
    const attempts = 30

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const result = spawnSync('docker', ['exec', containerName, 'pg_isready', '-U', POSTGRES_USER, '-d', POSTGRES_DB], {
            encoding: 'utf8',
            env: process.env,
        })

        if (result.status === 0) {
            return
        }

        sleep(1000)
    }

    throw new Error(`Postgres container ${containerName} не стал ready за ожидаемое время.`)
}

function ensureCommandAvailable(commandName: string): void {
    const result = spawnSync('where', [commandName], {
        encoding: 'utf8',
        env: process.env,
        shell: true,
    })

    if (result.status !== 0) {
        throw new Error(`Команда ${commandName} недоступна в PATH.`)
    }
}

function ensureDockerDaemonAvailable(): void {
    const result = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
        encoding: 'utf8',
        env: process.env,
    })

    if (result.error) {
        throw new Error(`Не удалось выполнить docker info: ${result.error.message}`)
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`Docker daemon недоступен. Убедись, что Docker Desktop запущен и активен Linux engine. Детали: ${result.stderr || result.stdout}`)
    }
}

function runCommand(
    command: string,
    args: string[],
    errorPrefix: string,
    options: { allowFailure?: boolean } = {},
): void {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        env: process.env,
    })

    if (options.allowFailure) {
        return
    }

    if (result.error) {
        throw new Error(`${errorPrefix || `Не удалось выполнить ${command}`}: ${result.error.message}`)
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`${errorPrefix || `Команда ${command} завершилась с ошибкой`}: ${result.stderr || result.stdout}`)
    }
}

function sleep(milliseconds: number): void {
    const endTime = Date.now() + milliseconds

    while (Date.now() < endTime) {
        // busy wait достаточно для короткого smoke-скрипта
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

