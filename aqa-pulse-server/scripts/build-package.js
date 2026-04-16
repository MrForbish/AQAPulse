// Purpose: assemble the self-hosted server package, including backend runtime files and the compiled React web bundle.
const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const aqaPulseRoot = path.resolve(packageRoot, '..', 'aqa-pulse')
const sourceRoot = path.resolve(packageRoot, '..', 'aqa-pulse', 'dist-ts')
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
    'render-dashboard.js',
    'render-dashboard-sections.js',
    'render-metric-info.js',
    'render-test-history.js',
    'render-test-history-sections.js',
    'server.js',
    path.join('backend', 'app.js'),
    path.join('backend', 'auth.js'),
    path.join('backend', 'bootstrap-workspace.js'),
    path.join('backend', 'bootstrap-demo.js'),
    path.join('backend', 'config.js'),
    path.join('backend', 'index.js'),
    path.join('backend', 'init-self-hosted.js'),
    path.join('backend', 'jwt.js'),
    path.join('backend', 'postgres-storage.js'),
    path.join('backend', 'run-ingestion.service.js'),
    path.join('backend', 'sqlite-backup.js'),
    path.join('backend', 'sqlite-migrate.js'),
    path.join('backend', 'sqlite-storage.js'),
    path.join('backend', 'storage.js'),
    path.join('backend', 'workspace-paths.js'),
    path.join('backend', 'workspace-registry.js'),
    path.join('shared', 'error-utils.js'),
    path.join('shared', 'formatting.js'),
    path.join('shared', 'i18n', 'ru.js'),
    path.join('shared', 'text-utils.js'),
]

const declarationFiles = [
    'api-store.d.ts',
    'dashboard-utils.d.ts',
    'frontend-bootstrap.d.ts',
    'history-utils.d.ts',
    'render-dashboard.d.ts',
    'render-dashboard-sections.d.ts',
    'render-metric-info.d.ts',
    'render-test-history.d.ts',
    'render-test-history-sections.d.ts',
    path.join('backend', 'app.d.ts'),
    path.join('backend', 'auth.d.ts'),
    path.join('backend', 'bootstrap-workspace.d.ts'),
    path.join('backend', 'config.d.ts'),
    path.join('backend', 'contracts.d.ts'),
    path.join('backend', 'index.d.ts'),
    path.join('backend', 'jwt.d.ts'),
    path.join('backend', 'postgres-storage.d.ts'),
    path.join('backend', 'run-ingestion.service.d.ts'),
    path.join('backend', 'sqlite-backup.d.ts'),
    path.join('backend', 'sqlite-migrate.d.ts'),
    path.join('backend', 'sqlite-storage.d.ts'),
    path.join('backend', 'storage.d.ts'),
    path.join('backend', 'workspace-paths.d.ts'),
    path.join('backend', 'workspace-registry.d.ts'),
    path.join('shared', 'error-utils.d.ts'),
    path.join('shared', 'formatting.d.ts'),
    path.join('shared', 'i18n', 'ru.d.ts'),
    path.join('shared', 'text-utils.d.ts'),
]

cleanDir(distRoot)

for (const filePath of runtimeFiles) {
    copyFileFromSource(filePath)
}

for (const filePath of declarationFiles) {
    copyFileFromSource(filePath)
}

copyFile(
    path.resolve(aqaPulseRoot, 'fixtures', 'sample-llm-report.json'),
    path.resolve(distRoot, 'fixtures', 'sample-llm-report.json'),
)

copyDirectory(webSourceRoot, webTargetRoot)

copyFile(chartAssetSourcePath, chartAssetTargetPath)

verifyWorkspaceHistoryRoutingArtifacts()

console.log('Внутренний пакет aqa-pulse-server собран.')
console.log(`Источник собранных server-файлов: ${sourceRoot}`)
console.log(`Папка пакета: ${distRoot}`)
console.log(`Chart.js asset: ${chartAssetTargetPath}`)

function copyFileFromSource(relativePath) {
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

// These assertions lock in the React-shell routing contract so packaging changes cannot silently regress workspace dashboard/test-history bootstrap behavior.
function verifyWorkspaceHistoryRoutingArtifacts() {
    const compiledAppPath = path.resolve(sourceRoot, 'backend', 'app.js')
    const compiledHistoryRendererPath = path.resolve(sourceRoot, 'render-test-history.js')
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

