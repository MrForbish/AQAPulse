/**
 * Назначение: CLI/helper для backend-first upload из CI/manual flow. Он делает exchange workspace API key -> ingestion JWT и отправляет report в self-hosted ingestion endpoint без участия React runtime.
 */
import { getErrorMessage } from '../shared/error-utils'
import { loadReporterReport, type DashboardRunMetadata } from '../dashboard-utils'
import type { IngestionRequestPayload, IngestionResult } from './contracts'
import { prepareReporterReportForUpload } from './upload-report-artifacts'

export interface UploadReportOptions {
    baseUrl: string
    workspaceSlug: string
    workspaceApiKey: string
    reportPath: string
    sourceFile: string
    metadata: Partial<DashboardRunMetadata>
}

interface CliOptions {
    baseUrl?: string
    workspaceSlug?: string
    workspaceApiKey?: string
    reportPath?: string
    sourceFile?: string
    branch?: string | null
    commit?: string | null
    author?: string | null
    json: boolean
}

interface ExchangeApiKeyResponse {
    accessToken?: string
    error?: string
}

void main()

async function main(): Promise<void> {
    try {
        const cliOptions = parseCliOptions(process.argv.slice(2))
        const resolvedOptions = resolveUploadOptions(cliOptions)
        const result = await uploadReportToWorkspace(resolvedOptions)

        if (cliOptions.json) {
            process.stdout.write(`${JSON.stringify({
                workspaceSlug: resolvedOptions.workspaceSlug,
                baseUrl: resolvedOptions.baseUrl,
                reportPath: resolvedOptions.reportPath,
                sourceFile: resolvedOptions.sourceFile,
                result,
            }, null, 2)}\n`)
        } else {
            printHumanReadableOutput(resolvedOptions, result)
        }
    } catch (error) {
        console.error(`Ошибка upload report: ${getErrorMessage(error)}`)
        process.exitCode = 1
    }
}

export async function uploadReportToWorkspace(options: UploadReportOptions): Promise<IngestionResult> {
    const accessToken = await exchangeWorkspaceApiKey(options)
    const report = prepareReporterReportForUpload(loadReporterReport(options.reportPath), {
        reportPath: options.reportPath,
        preparedReportPath: normalizeOptionalText(process.env.AQA_PULSE_PREPARED_REPORT_PATH),
        debugAttachmentsSummary: isEnabledFlag(process.env.AQA_PULSE_DEBUG_ATTACHMENTS_SUMMARY),
        inlineAttachmentsTotalMaxSizeBytes: parsePositiveInteger(process.env.AQA_PULSE_INLINE_ATTACHMENTS_TOTAL_MAX_SIZE_BYTES),
    })
    const payload: IngestionRequestPayload = {
        report,
        metadata: {
            branch: normalizeOptionalText(options.metadata.branch),
            commit: normalizeOptionalText(options.metadata.commit),
            author: normalizeOptionalText(options.metadata.author),
        },
        sourceFile: options.sourceFile,
    }

    return postJson<IngestionResult>(
        `${options.baseUrl}/api/workspaces/${encodeURIComponent(options.workspaceSlug)}/ingestions`,
        payload,
        {
            authorization: `Bearer ${accessToken}`,
        },
    )
}

function parseCliOptions(args: string[]): CliOptions {
    if (args.includes('--help') || args.includes('-h')) {
        printHelp()
        process.exit(0)
    }

    const options: CliOptions = { json: false }

    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index]

        if (currentArg === '--json') {
            options.json = true
            continue
        }

        const nextArg = args[index + 1]

        if (!nextArg || nextArg.startsWith('--')) {
            throw new Error(`Для аргумента ${currentArg} нужно передать значение.`)
        }

        if (currentArg === '--base-url') {
            options.baseUrl = nextArg
            index += 1
            continue
        }

        if (currentArg === '--workspace-slug') {
            options.workspaceSlug = nextArg
            index += 1
            continue
        }

        if (currentArg === '--workspace-api-key') {
            options.workspaceApiKey = nextArg
            index += 1
            continue
        }

        if (currentArg === '--report' || currentArg === '--report-path') {
            options.reportPath = nextArg
            index += 1
            continue
        }

        if (currentArg === '--source-file') {
            options.sourceFile = nextArg
            index += 1
            continue
        }

        if (currentArg === '--branch') {
            options.branch = nextArg
            index += 1
            continue
        }

        if (currentArg === '--commit') {
            options.commit = nextArg
            index += 1
            continue
        }

        if (currentArg === '--author') {
            options.author = nextArg
            index += 1
            continue
        }

        throw new Error(`Неизвестный аргумент: ${currentArg}`)
    }

    return options
}

function resolveUploadOptions(options: CliOptions): UploadReportOptions {
    const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.AQA_PULSE_BASE_URL)
    const workspaceSlug = requireNonEmptyText(options.workspaceSlug ?? process.env.AQA_PULSE_WORKSPACE_SLUG, 'AQA_PULSE_WORKSPACE_SLUG')
    const workspaceApiKey = requireNonEmptyText(options.workspaceApiKey ?? process.env.AQA_PULSE_WORKSPACE_API_KEY, 'AQA_PULSE_WORKSPACE_API_KEY')
    const reportPath = requireNonEmptyText(options.reportPath ?? process.env.PW_LLM_REPORT ?? 'test-results/dashboard/data.json', '--report / PW_LLM_REPORT')
    const sourceFile = normalizeOptionalText(options.sourceFile) ?? buildDefaultSourceFile(reportPath)

    return {
        baseUrl,
        workspaceSlug,
        workspaceApiKey,
        reportPath,
        sourceFile,
        metadata: {
            branch: normalizeOptionalText(options.branch ?? process.env.CI_COMMIT_REF_NAME ?? process.env.GITHUB_REF_NAME),
            commit: normalizeOptionalText(options.commit ?? process.env.CI_COMMIT_SHA ?? process.env.GITHUB_SHA),
            author: normalizeOptionalText(options.author ?? process.env.GITLAB_USER_NAME ?? process.env.CI_COMMIT_AUTHOR ?? process.env.GITHUB_ACTOR ?? 'CI upload'),
        },
    }
}

async function exchangeWorkspaceApiKey(options: UploadReportOptions): Promise<string> {
    const response = await fetch(
        `${options.baseUrl}/auth/workspaces/${encodeURIComponent(options.workspaceSlug)}/api-keys/login`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({ token: options.workspaceApiKey }),
        },
    )

    const payload = await readJsonPayload<ExchangeApiKeyResponse>(response)

    if (!response.ok || !payload?.accessToken) {
        throw new Error(readPayloadErrorMessage(payload, response.status, 'Не удалось получить ingestion JWT.'))
    }

    return payload.accessToken
}

async function postJson<T>(url: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...extraHeaders,
        },
        body: JSON.stringify(body),
    })
    const payload = await readJsonPayload<T & { error?: string }>(response)

    if (!response.ok || payload === null) {
        throw new Error(readPayloadErrorMessage(payload, response.status, 'Upload ingestion report завершился ошибкой.'))
    }

    return payload as T
}

async function readJsonPayload<T>(response: Response): Promise<T | null> {
    const text = await response.text()

    if (!text.trim()) {
        return null
    }

    return JSON.parse(text) as T
}

function readPayloadErrorMessage(payload: { error?: string } | null, status: number, fallback: string): string {
    return normalizeOptionalText(payload?.error) ?? `${fallback} HTTP ${status}.`
}

function printHumanReadableOutput(options: UploadReportOptions, result: IngestionResult): void {
    console.log('AQA Pulse report upload завершён.')
    console.log('')
    console.log(`Workspace slug: ${options.workspaceSlug}`)
    console.log(`Base URL: ${options.baseUrl}`)
    console.log(`Report path: ${options.reportPath}`)
    console.log(`Source file: ${options.sourceFile}`)
    console.log(`Run id: ${result.runId}`)
    console.log(`Summary generated at: ${result.summaryGeneratedAt}`)
    console.log(`Dashboard summary path: ${result.summaryPath}`)
    console.log(`History path: ${result.historyPath}`)
}

function printHelp(): void {
    console.log('aqa-pulse-server upload-report [options]')
    console.log('')
    console.log('Опции:')
    console.log('  --base-url <url>                Base URL сервера, иначе AQA_PULSE_BASE_URL')
    console.log('  --workspace-slug <slug>         Workspace slug, иначе AQA_PULSE_WORKSPACE_SLUG')
    console.log('  --workspace-api-key <key>       Raw workspace API key, иначе AQA_PULSE_WORKSPACE_API_KEY')
    console.log('  --report <path>                 Путь к report JSON, иначе PW_LLM_REPORT или test-results/dashboard/data.json')
    console.log('  --source-file <value>           Явный sourceFile для ingestion payload')
    console.log('  --branch <value>                Явная branch metadata')
    console.log('  --commit <value>                Явная commit metadata')
    console.log('  --author <value>                Явный author metadata')
    console.log('  --json                          Печатать результат в JSON')
    console.log('')
    console.log('Дополнительные env для attachment-aware upload:')
    console.log('  AQA_PULSE_PREPARED_REPORT_PATH                   Сохранить подготовленный payload report в JSON')
    console.log('  AQA_PULSE_DEBUG_ATTACHMENTS_SUMMARY=true         Печатать debug summary по найденным attachment')
    console.log('  AQA_PULSE_INLINE_ATTACHMENTS_TOTAL_MAX_SIZE_BYTES Общий budget inline attachment в байтах')
}

function normalizeBaseUrl(value: string | undefined): string {
    const normalized = requireNonEmptyText(value, 'AQA_PULSE_BASE_URL').replace(/\/+$/g, '')

    if (!/^https?:\/\//i.test(normalized)) {
        throw new Error(`Base URL должен начинаться с http:// или https://, получено: ${normalized}`)
    }

    return normalized
}

function buildDefaultSourceFile(reportPath: string): string {
    const gitlabProjectPath = normalizeOptionalText(process.env.CI_PROJECT_PATH)
    const gitlabPipelineId = normalizeOptionalText(process.env.CI_PIPELINE_ID)
    const gitlabJobName = normalizeOptionalText(process.env.CI_JOB_NAME)

    if (gitlabProjectPath && gitlabPipelineId && gitlabJobName) {
        return `gitlab://${gitlabProjectPath}/${gitlabPipelineId}/${gitlabJobName}`
    }

    const githubRepository = normalizeOptionalText(process.env.GITHUB_REPOSITORY)
    const githubRunId = normalizeOptionalText(process.env.GITHUB_RUN_ID)
    const githubJob = normalizeOptionalText(process.env.GITHUB_JOB)

    if (githubRepository && githubRunId && githubJob) {
        return `github://${githubRepository}/${githubRunId}/${githubJob}`
    }

    return `manual://${reportPath.replace(/\\/g, '/')}`
}

function requireNonEmptyText(value: string | undefined, label: string): string {
    const normalized = normalizeOptionalText(value)

    if (!normalized) {
        throw new Error(`Нужно передать ${label}.`)
    }

    return normalized
}

function normalizeOptionalText(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function parsePositiveInteger(value: string | undefined): number | null {
    if (!value || value.trim().length === 0) {
        return null
    }

    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function isEnabledFlag(value: string | undefined): boolean {
    const normalized = normalizeOptionalText(value)?.toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
}