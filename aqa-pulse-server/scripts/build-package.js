const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const aqaPulseRoot = path.resolve(packageRoot, '..', 'aqa-pulse')
const sourceRoot = path.resolve(packageRoot, '..', 'aqa-pulse', 'dist-ts')
const distRoot = path.resolve(packageRoot, 'dist')

const runtimeFiles = [
    'api-store.js',
    'dashboard-utils.js',
    'history-utils.js',
    'render-dashboard.js',
    'render-metric-info.js',
    'render-test-history.js',
    'server.js',
    path.join('backend', 'admin-ui.js'),
    path.join('backend', 'app.js'),
    path.join('backend', 'auth.js'),
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
    path.join('shared', 'formatting.js'),
    path.join('shared', 'i18n', 'ru.js'),
]

const declarationFiles = [
    'api-store.d.ts',
    'dashboard-utils.d.ts',
    'history-utils.d.ts',
    'render-dashboard.d.ts',
    'render-metric-info.d.ts',
    'render-test-history.d.ts',
    path.join('backend', 'admin-ui.d.ts'),
    path.join('backend', 'app.d.ts'),
    path.join('backend', 'auth.d.ts'),
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
    path.join('shared', 'formatting.d.ts'),
    path.join('shared', 'i18n', 'ru.d.ts'),
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

console.log('Внутренний пакет aqa-pulse-server собран.')
console.log(`Источник runtime: ${sourceRoot}`)
console.log(`Папка пакета: ${distRoot}`)

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

function cleanDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true })
    }
    fs.mkdirSync(dirPath, { recursive: true })
}

