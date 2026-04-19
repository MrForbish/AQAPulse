/**
 * Назначение: собирает self-hosted server package вместе с backend runtime и compiled React web bundle.
 */
const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const aqaPulseRoot = path.resolve(packageRoot, '..', 'aqa-pulse')
const runtimeSourceRoot = path.resolve(packageRoot, '..', 'aqa-pulse', 'dist-ts')
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

copyFile(
    path.resolve(aqaPulseRoot, 'fixtures', 'sample-llm-report.json'),
    path.resolve(distRoot, 'fixtures', 'sample-llm-report.json'),
)

copyDirectory(webSourceRoot, webTargetRoot)

copyFile(chartAssetSourcePath, chartAssetTargetPath)

verifyWorkspaceHistoryRoutingArtifacts()

console.log('Внутренний пакет aqa-pulse-server собран.')
console.log(`Источник runtime/server-файлов: ${runtimeSourceRoot}`)
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
 * После разбиения backend/app.ts на composition root и feature-specific route registrars проверяем и composition root, и runtime feature entrypoint.
 */
function verifyWorkspaceHistoryRoutingArtifacts() {
    const compiledAppPath = path.resolve(distRoot, 'backend', 'app.js')
    const compiledRuntimeRoutesPath = path.resolve(distRoot, 'backend', 'infrastructure', 'http', 'runtime-routes.js')
    const compiledFrontendShellPath = path.resolve(distRoot, 'backend', 'frontend-shell.js')
    const compiledApp = fs.readFileSync(compiledAppPath, 'utf8')
    const compiledRuntimeRoutes = fs.readFileSync(compiledRuntimeRoutesPath, 'utf8')
    const compiledFrontendShell = fs.readFileSync(compiledFrontendShellPath, 'utf8')

    assertIncludes(
        compiledApp,
        'createFrontendShellRenderer',
        compiledAppPath,
    )
    assertIncludes(
        compiledApp,
        'registerRuntimeRoutes',
        compiledAppPath,
    )
    assertIncludes(
        compiledApp,
        'registerCommonHttpErrorHandlers',
        compiledAppPath,
    )
    assertIncludes(
        compiledRuntimeRoutes,
        'frontendShell.send(response, {',
        compiledRuntimeRoutesPath,
    )
    assertIncludes(
        compiledRuntimeRoutes,
        "route: { kind: 'dashboard', workspaceSlug: workspace.slug },",
        compiledRuntimeRoutesPath,
    )
    assertIncludes(
        compiledRuntimeRoutes,
        "route: { kind: 'test-history', workspaceSlug: workspace.slug, testName },",
        compiledRuntimeRoutesPath,
    )
    assertIncludes(
        compiledRuntimeRoutes,
        'initialTestHistoryPayload: result.payload,',
        compiledRuntimeRoutesPath,
    )
    assertIncludes(
        compiledRuntimeRoutes,
        'readWorkspaceBootstrapSession',
        compiledRuntimeRoutesPath,
    )
    assertIncludes(
        compiledFrontendShell,
        'function createFrontendShellRenderer(frontendDistPath)',
        compiledFrontendShellPath,
    )
    assertIncludes(
        compiledFrontendShell,
        '.send((0, frontend_bootstrap_1.injectFrontendBootstrap)(frontendTemplate, bootstrap));',
        compiledFrontendShellPath,
    )
}

function assertIncludes(value, expectedFragment, filePath) {
    if (!value.includes(expectedFragment)) {
        throw new Error(`Собранная server-сборка не содержит ожидаемый фрагмент в ${filePath}: ${expectedFragment}`)
    }
}

