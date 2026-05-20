/**
 * Назначение: объединяет несколько Playwright dashboard JSON reports в один report,
 * чтобы CI мог отправлять агрегированный результат без локальных helper-скриптов.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
    loadReporterReport,
    type ReporterRoot,
    type ReporterSummary,
    type ReporterTest,
} from '../dashboard-utils'
import { getErrorMessage } from '../shared/error-utils'

interface MergeReportsOptions {
    projectKind: 'ui' | 'api'
    outputPath: string
    inputs: string[]
    allowMissing: boolean
}

interface ReportEntry {
    inputPath: string
    relativeInputPath: string
    report: ReporterRoot
    sourceLabel: string
}

if (require.main === module) {
    void main()
}

async function main(): Promise<void> {
    try {
        const options = parseCliOptions(process.argv.slice(2))
        const result = mergeAqaPulseReports(options)

        if (result.missingInputs.length > 0) {
            console.warn(`AQA Pulse merge: пропущено отсутствующих report: ${result.missingInputs.length}`)

            for (const inputPath of result.missingInputs) {
                console.warn(`  - ${toPosixPath(path.relative(process.cwd(), inputPath))}`)
            }
        }

        fs.mkdirSync(path.dirname(options.outputPath), { recursive: true })
        fs.writeFileSync(options.outputPath, `${JSON.stringify(result.mergedReport, null, 2)}\n`, 'utf8')

        console.log('AQA Pulse reports merged.')
        console.log(`Output path: ${options.outputPath}`)
        console.log(`Project kind: ${options.projectKind}`)
        console.log(`Reports: ${result.reports.length}`)
        console.log(`Tests: ${result.mergedReport.summary?.total ?? 0}, passed: ${result.mergedReport.summary?.passed ?? 0}, failed: ${result.mergedReport.summary?.failed ?? 0}, flaky: ${result.mergedReport.summary?.flaky ?? 0}`)
    } catch (error) {
        console.error(`Ошибка merge reports: ${getErrorMessage(error)}`)
        process.exitCode = 1
    }
}

export function mergeAqaPulseReports(options: MergeReportsOptions): { reports: ReportEntry[]; missingInputs: string[]; mergedReport: ReporterRoot } {
    const reports: ReportEntry[] = []
    const missingInputs: string[] = []

    for (const inputPath of options.inputs) {
        if (!fs.existsSync(inputPath)) {
            if (options.allowMissing) {
                missingInputs.push(inputPath)
                continue
            }

            throw new Error(`Не найден input report: ${inputPath}`)
        }

        const report = loadReporterReport(inputPath)
        reports.push({
            inputPath,
            relativeInputPath: toPosixPath(path.relative(process.cwd(), inputPath)),
            report,
            sourceLabel: buildSourceLabel(inputPath),
        })
    }

    if (reports.length === 0) {
        throw new Error(`Не найден ни один input report. Проверено файлов: ${options.inputs.length}`)
    }

    validateReports(reports, options.projectKind)

    const mergedTests: ReporterTest[] = reports.flatMap(({ report, sourceLabel, inputPath }) => (report.tests ?? []).map((test, index) => ({
        ...test,
        id: buildMergedTestId(sourceLabel, test, index),
        aqaPulseSourceReportPath: inputPath,
    })))

    return {
        reports,
        missingInputs,
        mergedReport: {
            schemaVersion: reports[0]?.report.schemaVersion,
            timestamp: pickTimestamp(reports),
            durationMs: sumNumbers(reports.map(({ report }) => report.durationMs)),
            summary: buildSummary(mergedTests),
            environment: buildEnvironment(reports, options.projectKind),
            mergeMetadata: buildMergeMetadata(reports, options.projectKind),
            tests: mergedTests,
        } as ReporterRoot,
    }
}

function parseCliOptions(args: string[]): MergeReportsOptions {
    if (args.includes('--help') || args.includes('-h')) {
        printHelp()
        process.exit(0)
    }

    const options: Partial<MergeReportsOptions> & { inputs: string[] } = {
        inputs: [],
        allowMissing: false,
    }
    const positionalArgs: string[] = []

    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index]

        if (currentArg === '--allow-missing') {
            options.allowMissing = true
            continue
        }

        if (currentArg === '--project-kind') {
            options.projectKind = readNextArg(args, index, currentArg) as MergeReportsOptions['projectKind']
            index += 1
            continue
        }

        if (currentArg === '--output') {
            options.outputPath = path.resolve(process.cwd(), readNextArg(args, index, currentArg))
            index += 1
            continue
        }

        if (currentArg.startsWith('--')) {
            throw new Error(`Неизвестный аргумент: ${currentArg}`)
        }

        positionalArgs.push(currentArg)
    }

    if (!options.projectKind && positionalArgs.length > 0) {
        options.projectKind = positionalArgs.shift() as MergeReportsOptions['projectKind']
    }

    if (!options.outputPath && positionalArgs.length > 0) {
        options.outputPath = path.resolve(process.cwd(), positionalArgs.shift() ?? '')
    }

    options.inputs.push(...positionalArgs.map((value) => path.resolve(process.cwd(), value)))

    if (options.projectKind !== 'ui' && options.projectKind !== 'api') {
        throw new Error('Аргумент --project-kind должен быть ui или api.')
    }

    if (!options.outputPath) {
        throw new Error('Нужно передать --output <path>.')
    }

    if (options.inputs.length === 0) {
        throw new Error('Нужно передать хотя бы один input report.')
    }

    return {
        projectKind: options.projectKind,
        outputPath: options.outputPath,
        inputs: options.inputs,
        allowMissing: options.allowMissing ?? false,
    }
}

function readNextArg(args: string[], index: number, label: string): string {
    const value = args[index + 1]

    if (!value || value.startsWith('--')) {
        throw new Error(`Для аргумента ${label} нужно передать значение.`)
    }

    return value
}

function validateReports(reports: ReportEntry[], expectedProjectKind: 'ui' | 'api'): void {
    const schemaVersions = new Set(reports.map(({ report }) => report.schemaVersion))

    if (schemaVersions.size > 1) {
        throw new Error(`Нельзя объединять reports с разными schemaVersion: ${Array.from(schemaVersions).join(', ')}`)
    }

    for (const { inputPath, report } of reports) {
        for (const test of report.tests ?? []) {
            const actualProjectKind = detectProjectKind(test)

            if (actualProjectKind !== expectedProjectKind) {
                throw new Error(`Файл ${inputPath} содержит тест другого project kind: ожидался ${expectedProjectKind}, получен ${actualProjectKind ?? '<unknown>'}. Тест: ${describeTest(test)}`)
            }
        }
    }
}

function buildMergedTestId(sourceLabel: string, test: ReporterTest, index: number): string {
    const baseId = pickText(test.id)
        ?? `${pickText(test.project) ?? 'unknown-project'}:${pickText(test.location?.file) ?? 'unknown-file'}:${pickText(test.title) ?? 'unknown-title'}:${index}`

    return `${sourceLabel}::${baseId}`
}

function buildSummary(tests: ReporterTest[]): ReporterSummary {
    const summary: Required<ReporterSummary> = {
        total: tests.length,
        passed: 0,
        failed: 0,
        flaky: 0,
        skipped: 0,
        timedOut: 0,
        interrupted: 0,
    }

    for (const test of tests) {
        const status = normalizeStatus(test.status)

        if (status === 'passed') {
            summary.passed += 1
        } else if (status === 'failed') {
            summary.failed += 1
        } else if (status === 'skipped') {
            summary.skipped += 1
        } else if (status === 'timedOut') {
            summary.timedOut += 1
        } else if (status === 'interrupted') {
            summary.interrupted += 1
        }

        if (test.flaky === true) {
            summary.flaky += 1
        }
    }

    return summary
}

function buildEnvironment(reports: ReportEntry[], projectKind: 'ui' | 'api'): ReporterRoot['environment'] {
    const firstEnvironment = reports[0]?.report.environment ?? {}

    return {
        ...firstEnvironment,
        workers: pickMaxNumber(reports.map(({ report }) => report.environment?.workers)),
        retries: pickMaxNumber(reports.map(({ report }) => report.environment?.retries)),
        projects: [projectKind],
    }
}

function buildMergeMetadata(reports: ReportEntry[], projectKind: 'ui' | 'api'): Record<string, unknown> {
    return {
        projectKind,
        mergedAt: new Date().toISOString(),
        sourceCount: reports.length,
        sourceFiles: reports.map((reportEntry) => ({
            sourceLabel: reportEntry.sourceLabel,
            path: reportEntry.relativeInputPath,
            timestamp: reportEntry.report.timestamp ?? null,
            testsCount: reportEntry.report.tests?.length ?? 0,
            summary: {
                total: reportEntry.report.summary?.total ?? 0,
                passed: reportEntry.report.summary?.passed ?? 0,
                failed: reportEntry.report.summary?.failed ?? 0,
                flaky: reportEntry.report.summary?.flaky ?? 0,
                skipped: reportEntry.report.summary?.skipped ?? 0,
                timedOut: reportEntry.report.summary?.timedOut ?? 0,
                interrupted: reportEntry.report.summary?.interrupted ?? 0,
            },
        })),
    }
}

function pickTimestamp(reports: ReportEntry[]): string {
    return reports
        .map(({ report }) => report.timestamp)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .sort()[0] ?? new Date().toISOString()
}

function sumNumbers(values: Array<number | undefined>): number {
    return values.reduce<number>((accumulator, value) => accumulator + (typeof value === 'number' && Number.isFinite(value) ? value : 0), 0)
}

function pickMaxNumber(values: Array<number | undefined>): number | undefined {
    const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    return numbers.length > 0 ? Math.max(...numbers) : undefined
}

function normalizeStatus(value: string | undefined): string {
    const normalized = String(value ?? '').trim().toLowerCase()

    if (normalized === 'timedout') {
        return 'timedOut'
    }

    if (normalized === 'passed' || normalized === 'failed' || normalized === 'skipped' || normalized === 'interrupted') {
        return normalized
    }

    return value === 'timedOut' ? 'timedOut' : normalized
}

function detectProjectKind(test: ReporterTest): 'ui' | 'api' | null {
    const project = pickText(test.project)?.toLowerCase()

    if (project === 'ui' || project === 'api') {
        return project
    }

    const filePath = pickText(test.location?.file)?.replace(/\\/g, '/')

    if (filePath?.includes('/tests/UI/') || filePath?.startsWith('tests/UI/')) {
        return 'ui'
    }

    if (filePath?.includes('/tests/API/') || filePath?.startsWith('tests/API/')) {
        return 'api'
    }

    return null
}

function buildSourceLabel(inputPath: string): string {
    return path.basename(inputPath, path.extname(inputPath))
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'report'
}

function describeTest(test: ReporterTest): string {
    return `${pickText(test.project) ?? '<unknown-project>'} :: ${pickText(test.location?.file) ?? '<unknown-file>'} :: ${pickText(test.title) ?? '<unknown-title>'}`
}

function pickText(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function toPosixPath(value: string): string {
    return value.replace(/\\/g, '/')
}

function printHelp(): void {
    console.log('aqa-pulse-server merge-reports [--project-kind ui|api] --output <path> [--allow-missing] <input...>')
    console.log('')
    console.log('Пример:')
    console.log('  aqa-pulse-server merge-reports --project-kind ui --allow-missing --output test-results/dashboard/ui-merged.json test-results/dashboard/ui-*.json')
}
