const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const sourceRoot = path.resolve(repoRoot, 'aqa-pulse', 'dist-ts')
const targetRoot = path.resolve(packageRoot, 'dist')

const filesToCopy = [
    'dashboard-utils.js',
    'dashboard-utils.d.ts',
    'history-utils.js',
    'history-utils.d.ts',
    'backend/upload-report.js',
    'backend/upload-report.d.ts',
    'backend/upload-from-config.js',
    'backend/upload-from-config.d.ts',
    'backend/upload-report-artifacts.js',
    'backend/upload-report-artifacts.d.ts',
    'backend/generate-source-facts.js',
    'backend/generate-source-facts.d.ts',
    'backend/merge-reports.js',
    'backend/merge-reports.d.ts',
]

cleanDirectory(targetRoot)

for (const relativePath of filesToCopy) {
    copyFile(path.resolve(sourceRoot, relativePath), path.resolve(targetRoot, relativePath))
}

copyDirectory(path.resolve(sourceRoot, 'shared'), path.resolve(targetRoot, 'shared'))

console.log(`AQA Pulse CLI package runtime собран: ${targetRoot}`)

function cleanDirectory(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        fs.rmSync(directoryPath, { recursive: true, force: true })
    }

    fs.mkdirSync(directoryPath, { recursive: true })
}

function copyFile(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Не найден файл сборки: ${sourcePath}`)
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(sourcePath, targetPath)
}

function copyDirectory(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Не найдена папка сборки: ${sourcePath}`)
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.cpSync(sourcePath, targetPath, { recursive: true })
}
