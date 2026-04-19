/**
 * Назначение файла: собирает сведения об исходном коде
 * для аналитики и обогащения данных дашборда.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type * as TypeScript from 'typescript'
import {
    loadReporterReport,
    type PrecomputedCodeQualityFileFacts,
    type PrecomputedCodeQualitySourceFacts,
    type PrecomputedCodeQualityTestFacts,
    type ReporterRoot,
} from '../dashboard-utils'
import { getErrorMessage } from '../shared/error-utils'

interface CliOptions {
    reportPath?: string
    outPath?: string
    repoRoot?: string
    json: boolean
}

const DIRECT_LOCATOR_METHODS = new Set([
    'locator',
    'getByRole',
    'getByLabel',
    'getByTestId',
    'getByText',
    'getByPlaceholder',
    'getByAltText',
    'getByTitle',
    '$',
    '$$',
])
const STABLE_LOCATOR_METHODS = new Set(['getByRole', 'getByLabel', 'getByTestId'])
const TEXT_LOCATOR_METHODS = new Set(['getByText', 'getByPlaceholder', 'getByAltText', 'getByTitle'])
const SMART_WAIT_METHODS = new Set(['waitForSelector', 'waitForResponse', 'waitForNavigation', 'waitForURL', 'waitForLoadState'])
const PAGE_ACTION_METHODS = new Set(['click', 'dblclick', 'tap', 'fill', 'press', 'check', 'uncheck', 'selectOption', 'goto', 'reload', 'setInputFiles', 'dragTo', 'hover'])
const SHARED_MUTATION_METHODS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'set', 'add', 'delete', 'clear'])

if (require.main === module) {
    void main()
}

async function main(): Promise<void> {
    try {
        const cliOptions = parseCliOptions(process.argv.slice(2))
        const resolvedOptions = resolveCliOptions(cliOptions)
        const report = loadReporterReport(resolvedOptions.reportPath)
        const sourceFacts = buildPrecomputedSourceFacts(report, resolvedOptions.repoRoot, resolvedOptions.reportPath)
        fs.mkdirSync(path.dirname(resolvedOptions.outPath), { recursive: true })
        fs.writeFileSync(resolvedOptions.outPath, `${JSON.stringify(sourceFacts, null, 2)}\n`, 'utf8')

        if (resolvedOptions.json) {
            process.stdout.write(`${JSON.stringify({
                reportPath: resolvedOptions.reportPath,
                repoRoot: resolvedOptions.repoRoot,
                outPath: resolvedOptions.outPath,
                files: sourceFacts.files.length,
                tests: sourceFacts.files.reduce((total, fileFacts) => total + fileFacts.tests.length, 0),
            }, null, 2)}\n`)
            return
        }

        console.log('AQA Pulse source facts generated.')
        console.log(`Report path: ${resolvedOptions.reportPath}`)
        console.log(`Repo root: ${resolvedOptions.repoRoot}`)
        console.log(`Output path: ${resolvedOptions.outPath}`)
        console.log(`Files analyzed: ${sourceFacts.files.length}`)
        console.log(`Tests analyzed: ${sourceFacts.files.reduce((total, fileFacts) => total + fileFacts.tests.length, 0)}`)
    } catch (error) {
        console.error(`Ошибка generate-source-facts: ${getErrorMessage(error)}`)
        process.exitCode = 1
    }
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

        if (currentArg === '--report' || currentArg === '--report-path') {
            options.reportPath = nextArg
            index += 1
            continue
        }

        if (currentArg === '--out') {
            options.outPath = nextArg
            index += 1
            continue
        }

        if (currentArg === '--repo-root') {
            options.repoRoot = nextArg
            index += 1
            continue
        }

        throw new Error(`Неизвестный аргумент: ${currentArg}`)
    }

    return options
}

function resolveCliOptions(options: CliOptions): { reportPath: string; outPath: string; repoRoot: string; json: boolean } {
    const reportPath = path.resolve(requireNonEmptyText(options.reportPath ?? process.env.PW_LLM_REPORT, '--report / PW_LLM_REPORT'))
    const repoRoot = path.resolve(options.repoRoot ?? process.cwd())
    const outPath = path.resolve(options.outPath ?? process.env.AQA_PULSE_SOURCE_FACTS_PATH ?? path.join(path.dirname(reportPath), 'source-facts.json'))

    return {
        reportPath,
        outPath,
        repoRoot,
        json: options.json,
    }
}

function buildPrecomputedSourceFacts(report: ReporterRoot, repoRoot: string, reportPath: string): PrecomputedCodeQualitySourceFacts {
    const typeScriptModule = getTypeScriptModule(repoRoot, reportPath)

    if (!typeScriptModule) {
        throw new Error('Для generate-source-facts нужен пакет typescript. Установи его в test repo как devDependency.')
    }

    const filePaths = [...new Set((report.tests ?? [])
        .map((test) => typeof test.location?.file === 'string' ? test.location.file.trim() : '')
        .filter((filePath) => filePath.length > 0))]

    const files: PrecomputedCodeQualityFileFacts[] = []

    for (const filePath of filePaths) {
        const resolvedFilePath = resolveSourceFilePath(filePath, repoRoot, reportPath)

        if (!resolvedFilePath) {
            continue
        }

        const fileFacts = analyzeSourceFile(resolvedFilePath, filePath, typeScriptModule)

        if (fileFacts && fileFacts.tests.length > 0) {
            files.push(fileFacts)
        }
    }

    return {
        schemaVersion: 1,
        analyzerVersion: 'aqa-pulse-server generate-source-facts v1',
        files,
    }
}

function getTypeScriptModule(repoRoot: string, reportPath: string): typeof TypeScript | null {
    const resolveRoots = [
        repoRoot,
        path.dirname(reportPath),
        process.cwd(),
        path.resolve(process.cwd(), '..', 'aqa-pulse'),
    ]

    for (const resolveRoot of resolveRoots) {
        try {
            const modulePath = require.resolve('typescript', { paths: [resolveRoot] })
            return require(modulePath) as typeof TypeScript
        } catch {
            continue
        }
    }

    return null
}

function resolveSourceFilePath(filePath: string, repoRoot: string, reportPath: string): string | null {
    const normalizedPath = filePath.trim()

    if (!normalizedPath) {
        return null
    }

    const candidatePaths = new Set<string>()
    const reportDirectory = path.dirname(reportPath)

    if (path.isAbsolute(normalizedPath)) {
        candidatePaths.add(normalizedPath)
    }

    candidatePaths.add(path.resolve(repoRoot, normalizedPath))
    candidatePaths.add(path.resolve(reportDirectory, normalizedPath))
    candidatePaths.add(path.resolve(process.cwd(), normalizedPath))

    for (const candidatePath of candidatePaths) {
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
            return candidatePath
        }
    }

    return null
}

function analyzeSourceFile(
    resolvedFilePath: string,
    reportFilePath: string,
    typeScriptModule: typeof TypeScript,
): PrecomputedCodeQualityFileFacts | null {
    try {
        const sourceText = fs.readFileSync(resolvedFilePath, 'utf8')
        const sourceFile = typeScriptModule.createSourceFile(
            resolvedFilePath,
            sourceText,
            typeScriptModule.ScriptTarget.Latest,
            true,
            resolveScriptKind(resolvedFilePath, typeScriptModule),
        )

        let hasPomImports = false
        const pomImportIdentifiers = new Set<string>()
        let beforeAllCount = 0
        let beforeEachCount = 0
        let serialModeCount = 0
        let topLevelMutableStateCount = 0
        const topLevelMutableIdentifiers = new Set<string>()
        const tests: PrecomputedCodeQualityTestFacts[] = []

        for (const statement of sourceFile.statements) {
            if (typeScriptModule.isImportDeclaration(statement)) {
                const importPath = statement.moduleSpecifier.getText(sourceFile).slice(1, -1)

                if (isPomImportPath(importPath)) {
                    hasPomImports = true

                    if (statement.importClause?.name) {
                        pomImportIdentifiers.add(statement.importClause.name.text)
                    }

                    if (statement.importClause?.namedBindings && typeScriptModule.isNamedImports(statement.importClause.namedBindings)) {
                        for (const element of statement.importClause.namedBindings.elements) {
                            pomImportIdentifiers.add(element.name.text)
                        }
                    }
                }

                continue
            }

            if (typeScriptModule.isVariableStatement(statement)) {
                const declarationFlags = statement.declarationList.flags
                const isConst = (declarationFlags & typeScriptModule.NodeFlags.Const) !== 0

                if (!isConst) {
                    topLevelMutableStateCount += statement.declarationList.declarations.length

                    for (const declaration of statement.declarationList.declarations) {
                        if (typeScriptModule.isIdentifier(declaration.name)) {
                            topLevelMutableIdentifiers.add(declaration.name.text)
                        }
                    }
                }
            }
        }

        visitCallExpressions(sourceFile, typeScriptModule, (callExpression) => {
            if (getCallExpressionName(callExpression, typeScriptModule) === 'beforeAll') {
                beforeAllCount += 1
            }

            if (getCallExpressionName(callExpression, typeScriptModule) === 'beforeEach') {
                beforeEachCount += 1
            }

            if (isSerialConfigureCall(callExpression, sourceFile, typeScriptModule)) {
                serialModeCount += 1
            }

            if (!isTestDeclarationCall(callExpression, typeScriptModule)) {
                return
            }

            const callback = getTestCallback(callExpression, typeScriptModule)

            if (!callback) {
                return
            }

            tests.push(collectSourceTestFacts(callback, callExpression, sourceFile, typeScriptModule, {
                hasPomImports,
                pomImportIdentifiers,
                topLevelMutableIdentifiers,
            }))
        })

        return {
            file: reportFilePath,
            tests,
            hasPomImports,
            beforeAllCount,
            beforeEachCount,
            serialModeCount,
            topLevelMutableStateCount,
        }
    } catch {
        return null
    }
}

function collectSourceTestFacts(
    callback: TypeScript.FunctionExpression | TypeScript.ArrowFunction,
    testDeclaration: TypeScript.CallExpression,
    sourceFile: TypeScript.SourceFile,
    typeScriptModule: typeof TypeScript,
    context: {
        hasPomImports: boolean
        pomImportIdentifiers: Set<string>
        topLevelMutableIdentifiers: Set<string>
    },
): PrecomputedCodeQualityTestFacts {
    let assertionCount = 0
    let smartWaitCount = 0
    let hardWaitCount = 0
    let stepCount = 0
    let directLocatorCount = 0
    let directPageActionCount = 0
    let stableSelectorCount = 0
    let textSelectorCount = 0
    let fragileSelectorCount = 0
    let pomReferenceCount = 0
    let pomFixtureReferenceCount = 0
    let sharedStateMutationCount = 0
    const pomFixtureNames = new Set(getPomFixtureNames(callback, typeScriptModule))

    visitCallExpressions(callback.body, typeScriptModule, (callExpression) => {
        if (isExpectCall(callExpression, typeScriptModule)) {
            assertionCount += 1
            smartWaitCount += 1
            return
        }

        if (isTestStepCall(callExpression, typeScriptModule)) {
            stepCount += 1
            return
        }

        const callName = getCallExpressionName(callExpression, typeScriptModule)

        if (!callName) {
            return
        }

        if (callName === 'waitForTimeout') {
            hardWaitCount += 1
            return
        }

        if (SMART_WAIT_METHODS.has(callName)) {
            smartWaitCount += 1
        }

        if (isDirectPageActionCall(callExpression, typeScriptModule)) {
            directPageActionCount += 1
        }

        if (isPomInteractionCall(callExpression, typeScriptModule, context.pomImportIdentifiers, pomFixtureNames)) {
            if (isFixtureBackedPomCall(callExpression, typeScriptModule, pomFixtureNames)) {
                pomFixtureReferenceCount += 1
            } else {
                pomReferenceCount += 1
            }
        }

        if (isSharedMutableMutationCall(callExpression, typeScriptModule, context.topLevelMutableIdentifiers)) {
            sharedStateMutationCount += 1
        }

        if (DIRECT_LOCATOR_METHODS.has(callName)) {
            directLocatorCount += 1

            if (STABLE_LOCATOR_METHODS.has(callName)) {
                stableSelectorCount += 1
                return
            }

            if (TEXT_LOCATOR_METHODS.has(callName)) {
                textSelectorCount += 1
                return
            }

            const selectorKind = classifySelectorLiteral(readFirstStringArgument(callExpression, sourceFile, typeScriptModule))

            if (selectorKind === 'stable') {
                stableSelectorCount += 1
            } else if (selectorKind === 'text') {
                textSelectorCount += 1
            } else {
                fragileSelectorCount += 1
            }
        }
    })

    visitNodes(callback.body, typeScriptModule, (node) => {
        if (typeScriptModule.isIdentifier(node) && context.pomImportIdentifiers.has(node.text)) {
            pomReferenceCount += 1
        }

        if (typeScriptModule.isIdentifier(node) && pomFixtureNames.has(node.text)) {
            pomFixtureReferenceCount += 1
        }

        if (isSharedMutableAssignment(node, typeScriptModule, context.topLevelMutableIdentifiers)) {
            sharedStateMutationCount += 1
        }
    })

    const startLine = sourceFile.getLineAndCharacterOfPosition(callback.getStart(sourceFile)).line + 1
    const endLine = sourceFile.getLineAndCharacterOfPosition(callback.getEnd()).line + 1

    return {
        startLine,
        endLine,
        title: readTestTitle(testDeclaration, sourceFile, typeScriptModule),
        assertionCount,
        smartWaitCount,
        hardWaitCount,
        stepCount,
        directLocatorCount,
        directPageActionCount,
        stableSelectorCount,
        textSelectorCount,
        fragileSelectorCount,
        pomReferenceCount,
        pomFixtureReferenceCount,
        sharedStateMutationCount,
        usesPom: evaluatePomUsage({
            hasPomImports: context.hasPomImports,
            pomReferenceCount,
            pomFixtureReferenceCount,
            directLocatorCount,
            directPageActionCount,
        }),
    }
}

function resolveScriptKind(filePath: string, typeScriptModule: typeof TypeScript): TypeScript.ScriptKind {
    if (/\.tsx$/i.test(filePath)) {
        return typeScriptModule.ScriptKind.TSX
    }

    if (/\.jsx$/i.test(filePath)) {
        return typeScriptModule.ScriptKind.JSX
    }

    if (/\.js$/i.test(filePath) || /\.mjs$/i.test(filePath) || /\.cjs$/i.test(filePath)) {
        return typeScriptModule.ScriptKind.JS
    }

    return typeScriptModule.ScriptKind.TS
}

function visitCallExpressions(node: TypeScript.Node, typeScriptModule: typeof TypeScript, callback: (callExpression: TypeScript.CallExpression) => void): void {
    const visit = (currentNode: TypeScript.Node): void => {
        if (typeScriptModule.isCallExpression(currentNode)) {
            callback(currentNode)
        }

        typeScriptModule.forEachChild(currentNode, visit)
    }

    visit(node)
}

function visitNodes(node: TypeScript.Node, typeScriptModule: typeof TypeScript, callback: (node: TypeScript.Node) => void): void {
    const visit = (currentNode: TypeScript.Node): void => {
        callback(currentNode)
        typeScriptModule.forEachChild(currentNode, visit)
    }

    visit(node)
}

function isPomImportPath(importPath: string): boolean {
    return /(^|\/)(pages?|page-objects?|pageobjects?|pom|screen-objects?|page-models?)(\/|$)/i.test(importPath)
}

function isTestDeclarationCall(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): boolean {
    const expression = callExpression.expression

    if (typeScriptModule.isIdentifier(expression)) {
        return expression.text === 'test' || expression.text === 'it'
    }

    if (typeScriptModule.isPropertyAccessExpression(expression) && typeScriptModule.isIdentifier(expression.expression)) {
        return (expression.expression.text === 'test' || expression.expression.text === 'it')
            && ['only', 'skip', 'fixme', 'fail'].includes(expression.name.text)
    }

    return false
}

function getTestCallback(
    callExpression: TypeScript.CallExpression,
    typeScriptModule: typeof TypeScript,
): TypeScript.FunctionExpression | TypeScript.ArrowFunction | null {
    const callbackCandidate = [...callExpression.arguments]
        .reverse()
        .find((argument) => typeScriptModule.isArrowFunction(argument) || typeScriptModule.isFunctionExpression(argument))

    if (!callbackCandidate) {
        return null
    }

    return callbackCandidate as TypeScript.FunctionExpression | TypeScript.ArrowFunction
}

function readTestTitle(
    callExpression: TypeScript.CallExpression,
    sourceFile: TypeScript.SourceFile,
    typeScriptModule: typeof TypeScript,
): string | null {
    const firstArgument = callExpression.arguments[0]

    if (!firstArgument) {
        return null
    }

    if (typeScriptModule.isStringLiteral(firstArgument) || typeScriptModule.isNoSubstitutionTemplateLiteral(firstArgument)) {
        return firstArgument.text
    }

    const rawText = firstArgument.getText(sourceFile).trim()
    return rawText.length > 0 ? rawText : null
}

function getPomFixtureNames(
    callback: TypeScript.FunctionExpression | TypeScript.ArrowFunction,
    typeScriptModule: typeof TypeScript,
): string[] {
    const firstParameter = callback.parameters[0]

    if (!firstParameter || !typeScriptModule.isObjectBindingPattern(firstParameter.name)) {
        return []
    }

    return firstParameter.name.elements
        .map((element) => typeScriptModule.isIdentifier(element.name) ? element.name.text : null)
        .filter((value): value is string => typeof value === 'string')
        .filter((value) => isPomLikeIdentifier(value))
}

function isTestStepCall(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): boolean {
    return typeScriptModule.isPropertyAccessExpression(callExpression.expression)
        && typeScriptModule.isIdentifier(callExpression.expression.expression)
        && callExpression.expression.expression.text === 'test'
        && callExpression.expression.name.text === 'step'
}

function isExpectCall(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): boolean {
    if (typeScriptModule.isIdentifier(callExpression.expression)) {
        return callExpression.expression.text === 'expect'
    }

    return typeScriptModule.isPropertyAccessExpression(callExpression.expression)
        && typeScriptModule.isIdentifier(callExpression.expression.expression)
        && callExpression.expression.expression.text === 'expect'
        && ['soft', 'poll'].includes(callExpression.expression.name.text)
}

function isSerialConfigureCall(
    callExpression: TypeScript.CallExpression,
    sourceFile: TypeScript.SourceFile,
    typeScriptModule: typeof TypeScript,
): boolean {
    if (!typeScriptModule.isPropertyAccessExpression(callExpression.expression)) {
        return false
    }

    const objectExpression = callExpression.expression.expression

    if (!typeScriptModule.isIdentifier(objectExpression) || objectExpression.text !== 'test' || callExpression.expression.name.text !== 'describe') {
        return false
    }

    return callExpression.arguments.some((argument) => argument.getText(sourceFile).includes('serial'))
}

function getCallExpressionName(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): string | null {
    const expression = callExpression.expression

    if (typeScriptModule.isIdentifier(expression)) {
        return expression.text
    }

    if (typeScriptModule.isPropertyAccessExpression(expression)) {
        return expression.name.text
    }

    return null
}

function isDirectPageActionCall(callExpression: TypeScript.CallExpression, typeScriptModule: typeof TypeScript): boolean {
    return typeScriptModule.isPropertyAccessExpression(callExpression.expression)
        && typeScriptModule.isIdentifier(callExpression.expression.expression)
        && callExpression.expression.expression.text === 'page'
        && PAGE_ACTION_METHODS.has(callExpression.expression.name.text)
}

function isPomInteractionCall(
    callExpression: TypeScript.CallExpression,
    typeScriptModule: typeof TypeScript,
    pomImportIdentifiers: Set<string>,
    pomFixtureNames: Set<string>,
): boolean {
    if (!typeScriptModule.isPropertyAccessExpression(callExpression.expression)) {
        return false
    }

    const target = callExpression.expression.expression

    if (!typeScriptModule.isIdentifier(target)) {
        return false
    }

    return pomImportIdentifiers.has(target.text)
        || pomFixtureNames.has(target.text)
        || isPomLikeIdentifier(target.text)
}

function isFixtureBackedPomCall(
    callExpression: TypeScript.CallExpression,
    typeScriptModule: typeof TypeScript,
    pomFixtureNames: Set<string>,
): boolean {
    return typeScriptModule.isPropertyAccessExpression(callExpression.expression)
        && typeScriptModule.isIdentifier(callExpression.expression.expression)
        && pomFixtureNames.has(callExpression.expression.expression.text)
}

function isSharedMutableMutationCall(
    callExpression: TypeScript.CallExpression,
    typeScriptModule: typeof TypeScript,
    topLevelMutableIdentifiers: Set<string>,
): boolean {
    if (!typeScriptModule.isPropertyAccessExpression(callExpression.expression)) {
        return false
    }

    const target = callExpression.expression.expression

    return typeScriptModule.isIdentifier(target)
        && topLevelMutableIdentifiers.has(target.text)
        && SHARED_MUTATION_METHODS.has(callExpression.expression.name.text)
}

function isSharedMutableAssignment(
    node: TypeScript.Node,
    typeScriptModule: typeof TypeScript,
    topLevelMutableIdentifiers: Set<string>,
): boolean {
    if (typeScriptModule.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind, typeScriptModule)) {
        return typeScriptModule.isIdentifier(node.left) && topLevelMutableIdentifiers.has(node.left.text)
    }

    if (typeScriptModule.isPrefixUnaryExpression(node) || typeScriptModule.isPostfixUnaryExpression(node)) {
        const operand = node.operand
        return typeScriptModule.isIdentifier(operand)
            && topLevelMutableIdentifiers.has(operand.text)
            && (node.operator === typeScriptModule.SyntaxKind.PlusPlusToken || node.operator === typeScriptModule.SyntaxKind.MinusMinusToken)
    }

    return false
}

function isAssignmentOperator(kind: TypeScript.SyntaxKind, typeScriptModule: typeof TypeScript): boolean {
    return kind >= typeScriptModule.SyntaxKind.FirstAssignment && kind <= typeScriptModule.SyntaxKind.LastAssignment
}

function isPomLikeIdentifier(value: string): boolean {
    return /(?:page|screen|modal|dialog|drawer|form|flow|widget|section|panel|steps|po|model)$/i.test(value)
        && value.toLowerCase() !== 'page'
}

function evaluatePomUsage(input: {
    hasPomImports: boolean
    pomReferenceCount: number
    pomFixtureReferenceCount: number
    directLocatorCount: number
    directPageActionCount: number
}): boolean {
    const pomSignals = input.pomReferenceCount + input.pomFixtureReferenceCount
    const directSignals = input.directLocatorCount + input.directPageActionCount

    if (pomSignals >= 2 && directSignals <= 4) {
        return true
    }

    if (input.pomFixtureReferenceCount > 0 && directSignals <= 3) {
        return true
    }

    if (input.hasPomImports && pomSignals > 0 && input.directLocatorCount <= 1 && input.directPageActionCount <= 2) {
        return true
    }

    return false
}

function readFirstStringArgument(
    callExpression: TypeScript.CallExpression,
    sourceFile: TypeScript.SourceFile,
    typeScriptModule: typeof TypeScript,
): string | null {
    const firstArgument = callExpression.arguments[0]

    if (!firstArgument) {
        return null
    }

    if (typeScriptModule.isStringLiteral(firstArgument) || typeScriptModule.isNoSubstitutionTemplateLiteral(firstArgument)) {
        return firstArgument.text
    }

    const rawText = firstArgument.getText(sourceFile)
    return rawText.length > 0 ? rawText : null
}

function classifySelectorLiteral(selector: string | null): 'stable' | 'text' | 'fragile' {
    if (!selector) {
        return 'fragile'
    }

    const normalizedSelector = selector.trim().toLowerCase()

    if (/data-testid|data-test|qa-id|testid/.test(normalizedSelector)) {
        return 'stable'
    }

    if (/text=|has-text|:text|\btext\(/.test(normalizedSelector)) {
        return 'text'
    }

    if (/^\/\/|^xpath=|nth-child|:nth|\s>\s|\.[a-z0-9_-]+\.[a-z0-9_.-]+|\[class|\.filter-option|\.btn|\.button/.test(normalizedSelector)) {
        return 'fragile'
    }

    return normalizedSelector.includes('#') ? 'stable' : 'fragile'
}

function requireNonEmptyText(value: string | undefined | null, label: string): string {
    const normalized = typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

    if (!normalized) {
        throw new Error(`Нужно передать ${label}.`)
    }

    return normalized
}

function printHelp(): void {
    console.log('aqa-pulse-server generate-source-facts [options]')
    console.log('')
    console.log('Опции:')
    console.log('  --report <path>                 Путь к Playwright report JSON, иначе PW_LLM_REPORT')
    console.log('  --out <path>                    Куда сохранить source-facts.json, иначе AQA_PULSE_SOURCE_FACTS_PATH или <reportDir>/source-facts.json')
    console.log('  --repo-root <path>              Корень test repo для резолва location.file, иначе текущая директория')
    console.log('  --json                          Печатать результат в JSON')
    console.log('')
    console.log('Скрипт анализирует только файлы, которые упомянуты в report.tests[*].location.file.')
}