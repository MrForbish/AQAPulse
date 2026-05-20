import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { getErrorMessage } from '../shared/error-utils'

interface AqaPulseConfig {
    projectDir?: string
    reportPath?: string
    repoRoot?: string
    sourceFactsPath?: string
    generateSourceFacts?: boolean
    baseUrl?: string
    workspaceSlug?: string
    workspaceApiKey?: string
    merge?: {
        projectKind?: 'ui' | 'api'
        output?: string
        inputs?: string[]
        allowMissing?: boolean
    }
    upload?: {
        reportPath?: string
        repoRoot?: string
        sourceFactsPath?: string
        generateSourceFacts?: boolean
    }
}

interface CliOptions {
    configPath?: string
    json: boolean
    dryRun: boolean
}

if (require.main === module) {
    void main()
}

async function main(): Promise<void> {
    try {
        const cliOptions = parseCliOptions(process.argv.slice(2))
        const configPath = resolveConfigPath(cliOptions.configPath)
        const config = readConfig(configPath)
        const commands = buildCommands(config, configPath)

        if (cliOptions.json || cliOptions.dryRun) {
            process.stdout.write(`${JSON.stringify({
                configPath,
                commands: commands.map((command) => ({
                    command: path.basename(command.filePath),
                    args: command.args,
                })),
            }, null, 2)}\n`)
        }

        if (cliOptions.dryRun) {
            return
        }

        for (const command of commands) {
            runNodeCommand(command.filePath, command.args)
        }
    } catch (error) {
        console.error(`Ошибка AQA Pulse upload-from-config: ${getErrorMessage(error)}`)
        process.exitCode = 1
    }
}

function parseCliOptions(args: string[]): CliOptions {
    if (args.includes('--help') || args.includes('-h')) {
        printHelp()
        process.exit(0)
    }

    const options: CliOptions = { json: false, dryRun: false }

    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index]

        if (currentArg === '--json') {
            options.json = true
            continue
        }

        if (currentArg === '--dry-run') {
            options.dryRun = true
            continue
        }

        if (currentArg === '--config') {
            const nextArg = args[index + 1]

            if (!nextArg || nextArg.startsWith('--')) {
                throw new Error('Для --config нужно передать путь к .aqa-pulse.yml.')
            }

            options.configPath = nextArg
            index += 1
            continue
        }

        throw new Error(`Неизвестный аргумент: ${currentArg}`)
    }

    return options
}

function resolveConfigPath(configPath: string | undefined): string {
    if (configPath) {
        const resolved = path.resolve(process.cwd(), configPath)

        if (!fs.existsSync(resolved)) {
            throw new Error(`Не найден config: ${resolved}`)
        }

        return resolved
    }

    for (const fileName of ['.aqa-pulse.yml', '.aqa-pulse.yaml', '.aqa-pulse.json']) {
        const candidate = path.resolve(process.cwd(), fileName)

        if (fs.existsSync(candidate)) {
            return candidate
        }
    }

    throw new Error('Не найден .aqa-pulse.yml, .aqa-pulse.yaml или .aqa-pulse.json. Передай путь через --config.')
}

function readConfig(configPath: string): AqaPulseConfig {
    const content = fs.readFileSync(configPath, 'utf8')

    if (configPath.endsWith('.json')) {
        return JSON.parse(content) as AqaPulseConfig
    }

    return parseSimpleYaml(content) as AqaPulseConfig
}

function buildCommands(config: AqaPulseConfig, configPath: string): Array<{ filePath: string; args: string[] }> {
    const configDirectory = path.dirname(configPath)
    const projectRoot = resolveConfigPathValue(configDirectory, config.projectDir ?? '.')
    const repoRoot = resolveConfigPathValue(projectRoot, config.upload?.repoRoot ?? config.repoRoot ?? '.')
    const mergeConfig = config.merge
    const commands: Array<{ filePath: string; args: string[] }> = []
    let reportPath = config.upload?.reportPath ?? config.reportPath ?? 'test-results/dashboard/data.json'

    if (mergeConfig) {
        const projectKind = requireText(mergeConfig.projectKind, 'merge.projectKind')
        const output = requireText(mergeConfig.output, 'merge.output')
        const inputs = Array.isArray(mergeConfig.inputs) ? mergeConfig.inputs : []

        if (inputs.length === 0) {
            throw new Error('merge.inputs должен содержать хотя бы один report.')
        }

        const outputPath = resolveConfigPathValue(projectRoot, output)
        const mergeArgs = [
            '--project-kind',
            projectKind,
            '--output',
            outputPath,
        ]

        if (mergeConfig.allowMissing === true) {
            mergeArgs.push('--allow-missing')
        }

        mergeArgs.push(...inputs.map((inputPath) => resolveConfigPathValue(projectRoot, inputPath)))
        commands.push({ filePath: path.resolve(__dirname, 'merge-reports.js'), args: mergeArgs })
        reportPath = output
    }

    const uploadArgs = [
        '--report',
        resolveConfigPathValue(projectRoot, reportPath),
        '--repo-root',
        repoRoot,
    ]

    if (config.baseUrl) {
        uploadArgs.push('--base-url', config.baseUrl)
    }

    if (config.workspaceSlug) {
        uploadArgs.push('--workspace-slug', config.workspaceSlug)
    }

    if (config.workspaceApiKey) {
        uploadArgs.push('--workspace-api-key', config.workspaceApiKey)
    }

    const sourceFactsPath = config.upload?.sourceFactsPath ?? config.sourceFactsPath

    if (sourceFactsPath) {
        uploadArgs.push('--source-facts', resolveConfigPathValue(projectRoot, sourceFactsPath))
    }

    const generateSourceFacts = config.upload?.generateSourceFacts ?? config.generateSourceFacts ?? true

    if (generateSourceFacts) {
        uploadArgs.push('--generate-source-facts')
    }

    commands.push({ filePath: path.resolve(__dirname, 'upload-report.js'), args: uploadArgs })

    return commands
}

function runNodeCommand(filePath: string, args: string[]): void {
    const result = spawnSync(process.execPath, [filePath, ...args], {
        stdio: 'inherit',
        env: process.env,
    })

    if (result.error) {
        throw result.error
    }

    if ((result.status ?? 1) !== 0) {
        process.exit(result.status ?? 1)
    }
}

function resolveConfigPathValue(baseDirectory: string, value: string): string {
    return path.isAbsolute(value) ? value : path.resolve(baseDirectory, value)
}

function requireText(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Нужно указать ${label}.`)
    }

    return value.trim()
}

function parseSimpleYaml(content: string): Record<string, unknown> {
    const root: Record<string, unknown> = {}
    const stack: Array<{ indent: number; value: Record<string, unknown> | unknown[] }> = [{ indent: -1, value: root }]
    const lines = content.split(/\r?\n/)

    for (const rawLine of lines) {
        const withoutComment = stripYamlComment(rawLine)

        if (!withoutComment.trim()) {
            continue
        }

        const indent = withoutComment.match(/^\s*/)?.[0].length ?? 0
        const line = withoutComment.trim()

        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
            stack.pop()
        }

        const parent = stack[stack.length - 1].value

        if (line.startsWith('- ')) {
            if (!Array.isArray(parent)) {
                throw new Error(`YAML list item без родительского массива: ${line}`)
            }

            parent.push(parseYamlScalar(line.slice(2).trim()))
            continue
        }

        const separatorIndex = line.indexOf(':')

        if (separatorIndex === -1) {
            throw new Error(`Не удалось разобрать строку YAML: ${line}`)
        }

        if (Array.isArray(parent)) {
            throw new Error(`YAML object внутри массива пока не поддерживается: ${line}`)
        }

        const key = line.slice(0, separatorIndex).trim()
        const rawValue = line.slice(separatorIndex + 1).trim()

        if (rawValue.length > 0) {
            parent[key] = parseYamlScalar(rawValue)
            continue
        }

        const nextMeaningfulLine = findNextMeaningfulLine(lines, rawLine)
        const child: Record<string, unknown> | unknown[] = nextMeaningfulLine?.trim().startsWith('- ') ? [] : {}
        parent[key] = child
        stack.push({ indent, value: child })
    }

    return root
}

function findNextMeaningfulLine(lines: string[], currentRawLine: string): string | null {
    const startIndex = lines.indexOf(currentRawLine) + 1

    for (let index = startIndex; index < lines.length; index += 1) {
        const candidate = stripYamlComment(lines[index])

        if (candidate.trim()) {
            return candidate
        }
    }

    return null
}

function stripYamlComment(line: string): string {
    const hashIndex = line.indexOf('#')
    return hashIndex === -1 ? line : line.slice(0, hashIndex)
}

function parseYamlScalar(value: string): unknown {
    const normalized = value.trim()

    if (normalized === 'true') {
        return true
    }

    if (normalized === 'false') {
        return false
    }

    if (normalized === 'null') {
        return null
    }

    if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
        return normalized.slice(1, -1)
    }

    return normalized
}

function printHelp(): void {
    console.log('aqa-pulse upload-from-config [--config .aqa-pulse.yml] [--dry-run] [--json]')
    console.log('')
    console.log('Пример .aqa-pulse.yml:')
    console.log('  projectDir: Playwright')
    console.log('  reportPath: test-results/dashboard/data.json')
    console.log('  repoRoot: .')
    console.log('')
    console.log('Пример с merge:')
    console.log('  projectDir: Playwright')
    console.log('  repoRoot: .')
    console.log('  merge:')
    console.log('    projectKind: ui')
    console.log('    output: test-results/dashboard/ui-merged.json')
    console.log('    allowMissing: true')
    console.log('    inputs:')
    console.log('      - test-results/dashboard/ui-purchase.json')
    console.log('      - test-results/dashboard/ui-cpu.json')
}
