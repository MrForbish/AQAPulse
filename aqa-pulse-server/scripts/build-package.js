/**
 * Назначение: собирает self-hosted server package вместе с backend runtime и compiled React web bundle.
 */
const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const aqaPulseRoot = path.resolve(packageRoot, '..', 'aqa-pulse')
const runtimeSourceRoot = path.resolve(packageRoot, '..', 'aqa-pulse', 'dist-ts')
const legacySourceRoot = path.resolve(packageRoot, '..', 'aqa-pulse-client', 'dist')
const webSourceRoot = path.resolve(aqaPulseRoot, 'dist', 'web')
const distRoot = path.resolve(packageRoot, 'dist')
const webTargetRoot = path.resolve(distRoot, 'web')
const chartAssetSourcePath = path.resolve(aqaPulseRoot, 'node_modules', 'chart.js', 'dist', 'chart.umd.js')
const chartAssetTargetPath = path.resolve(distRoot, 'assets', 'chart.umd.js')

const runtimeFiles = [
    'api-store.js',
    'dashboard-utils.js',
    'frontend-bootstrap.js',
    'history-utils.js',
    'server.js',
]

const declarationFiles = [
    'api-store.d.ts',
    'dashboard-utils.d.ts',
    'frontend-bootstrap.d.ts',
    'history-utils.d.ts',
    'server.d.ts',
]

const legacyRuntimeFiles = [
    'render-dashboard.js',
    'render-dashboard-legacy-only.js',
    'render-dashboard-sections.js',
    'render-metric-info.js',
    'render-test-history.js',
    'render-test-history-legacy-only.js',
    'render-test-history-sections.js',
]

const legacyDeclarationFiles = [
    'render-dashboard.d.ts',
    'render-dashboard-legacy-only.d.ts',
    'render-dashboard-sections.d.ts',
    'render-metric-info.d.ts',
    'render-test-history.d.ts',
    'render-test-history-legacy-only.d.ts',
    'render-test-history-sections.d.ts',
]

cleanDir(distRoot)

for (const filePath of runtimeFiles) {
    copyFileFromSource(runtimeSourceRoot, filePath)
}

for (const filePath of declarationFiles) {
    copyFileFromSource(runtimeSourceRoot, filePath)
}

copyDirectory(
    path.resolve(runtimeSourceRoot, 'backend'),
    path.resolve(distRoot, 'backend'),
)

copyDirectory(
    path.resolve(runtimeSourceRoot, 'shared'),
    path.resolve(distRoot, 'shared'),
)

for (const filePath of legacyRuntimeFiles) {
    copyFileFromSource(legacySourceRoot, filePath)
}

for (const filePath of legacyDeclarationFiles) {
    copyFileFromSource(legacySourceRoot, filePath)
}

copyDirectory(
    path.resolve(legacySourceRoot, 'shared'),
    path.resolve(distRoot, 'shared'),
)

copyFile(
    path.resolve(aqaPulseRoot, 'fixtures', 'sample-llm-report.json'),
    path.resolve(distRoot, 'fixtures', 'sample-llm-report.json'),
)

copyDirectory(webSourceRoot, webTargetRoot)

copyFile(chartAssetSourcePath, chartAssetTargetPath)

verifyWorkspaceHistoryRoutingArtifacts()

console.log('Внутренний пакет aqa-pulse-server собран.')
console.log(`Источник runtime/server-файлов: ${runtimeSourceRoot}`)
console.log(`Источник legacy renderer-файлов: ${legacySourceRoot}`)
console.log(`Папка пакета: ${distRoot}`)
console.log(`Chart.js asset: ${chartAssetTargetPath}`)

function copyFileFromSource(sourceRoot, relativePath) {
    const sourcePath = path.resolve(sourceRoot, relativePath)
    const targetPath = path.resolve(distRoot, relativePath)

    copyFile(sourcePath, targetPath)
}

function copyFile(sourcePath, targetPath) {

    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Не найден исходный файл: ${sourcePath}`)
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(sourcePath, targetPath)
}

function copyDirectory(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Не найдена frontend-папка: ${sourcePath}`)
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.cpSync(sourcePath, targetPath, { recursive: true })
}

function cleanDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true })
    }
    fs.mkdirSync(dirPath, { recursive: true })
}

/**
 * Эти проверки фиксируют routing/bootstrap contract React shell, чтобы packaging-изменения не ломали молча workspace dashboard/test-history поведение.
 */
function verifyWorkspaceHistoryRoutingArtifacts() {
    const compiledAppPath = path.resolve(distRoot, 'backend', 'app.js')
    const compiledHistoryRendererPath = path.resolve(distRoot, 'render-test-history.js')
    const compiledApp = fs.readFileSync(compiledAppPath, 'utf8')
    const compiledHistoryRenderer = fs.readFileSync(compiledHistoryRendererPath, 'utf8')

    assertIncludes(
        compiledApp,
        "function sendFrontendShell(response, htmlTemplate, bootstrap, statusCode = 200) {",
        compiledAppPath,
    )
    assertIncludes(
        compiledApp,
        "route: { kind: 'dashboard', workspaceSlug: workspace.slug },",
        compiledAppPath,
    )
    assertIncludes(
        compiledApp,
        "route: { kind: 'test-history', workspaceSlug: workspace.slug, testName },",
        compiledAppPath,
    )
    assertIncludes(
        compiledApp,
        "initialTestHistoryPayload: payload,",
        compiledAppPath,
    )
    assertIncludes(
        compiledApp,
        ".send((0, frontend_bootstrap_1.injectFrontendBootstrap)(htmlTemplate, bootstrap));",
        compiledAppPath,
    )

    assertIncludes(
        compiledHistoryRenderer,
        'const normalizedBasePath = (0, render_test_history_sections_1.normalizeBasePath)(options.basePath);',
        compiledHistoryRendererPath,
    )
    assertIncludes(
        compiledHistoryRenderer,
        'const normalizedApiBasePath = (0, render_test_history_sections_1.normalizeBasePath)(options.apiBasePath);',
        compiledHistoryRendererPath,
    )
    assertIncludes(
        compiledHistoryRenderer,
        'const dashboardHref = (0, render_test_history_sections_1.buildDashboardHref)(normalizedFilters, normalizedBasePath);',
        compiledHistoryRendererPath,
    )
}

function assertIncludes(value, expectedFragment, filePath) {
    if (!value.includes(expectedFragment)) {
        throw new Error(`Собранная server-сборка не содержит ожидаемый фрагмент в ${filePath}: ${expectedFragment}`)
    }
}

