const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const sourceRoot = path.resolve(packageRoot, '..', 'aqa-pulse', 'dist-ts')
const distRoot = path.resolve(packageRoot, 'dist')

const runtimeFiles = [
    'render-dashboard.js',
    'render-test-history.js',
    'render-metric-info.js',
    path.join('shared', 'formatting.js'),
    path.join('shared', 'i18n', 'ru.js'),
]

const declarationFiles = [
    'render-dashboard.d.ts',
    'render-test-history.d.ts',
    'render-metric-info.d.ts',
    'dashboard-utils.d.ts',
    'api-store.d.ts',
    'history-utils.d.ts',
    path.join('shared', 'formatting.d.ts'),
    path.join('shared', 'i18n', 'ru.d.ts'),
]

const generatedIndexJs = `'use strict'\n\nexports.renderDashboardHtml = require('./render-dashboard').renderDashboardHtml\nexports.renderTestHistoryHtml = require('./render-test-history').renderTestHistoryHtml\nexports.METRIC_INFO_STYLES = require('./render-metric-info').METRIC_INFO_STYLES\nexports.renderMetricHeading = require('./render-metric-info').renderMetricHeading\nexports.formatDate = require('./shared/formatting').formatDate\nexports.formatDuration = require('./shared/formatting').formatDuration\nexports.formatPercent = require('./shared/formatting').formatPercent\nexports.ru = require('./shared/i18n/ru').ru\n`

const generatedIndexDts = `export { renderDashboardHtml } from './render-dashboard'\nexport { renderTestHistoryHtml } from './render-test-history'\nexport { METRIC_INFO_STYLES, renderMetricHeading } from './render-metric-info'\nexport { formatDate, formatDuration, formatPercent } from './shared/formatting'\nexport { ru } from './shared/i18n/ru'\nexport type { DashboardAdvancedMetrics, DashboardAvailableFilters, DashboardFilters, DashboardKpis, DashboardRunMetadata, DashboardSummary } from './dashboard-utils'\nexport type { TestHistoryConflict, TestHistoryResponse } from './api-store'\n`

const forbiddenRuntimePatterns = [
    'require("./server")',
    "require('./server')",
    'require("./api-store")',
    "require('./api-store')",
    'require("./dashboard-utils")',
    "require('./dashboard-utils')",
    'require("./history-utils")',
    "require('./history-utils')",
    'node:fs',
    'express',
]

cleanDir(distRoot)

for (const filePath of runtimeFiles) {
    copyFileFromSource(filePath)
    assertNoForbiddenRuntimeImports(path.resolve(distRoot, filePath))
}

for (const filePath of declarationFiles) {
    copyFileFromSource(filePath)
}

writeFile(path.resolve(distRoot, 'index.js'), generatedIndexJs)
writeFile(path.resolve(distRoot, 'index.d.ts'), generatedIndexDts)

console.log('Публичный пакет aqa-pulse-client собран.')
console.log(`Источник runtime: ${sourceRoot}`)
console.log(`Папка пакета: ${distRoot}`)

function copyFileFromSource(relativePath) {
    const sourcePath = path.resolve(sourceRoot, relativePath)
    const targetPath = path.resolve(distRoot, relativePath)

    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Не найден исходный файл: ${sourcePath}`)
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(sourcePath, targetPath)
}

function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf8')
}

function cleanDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true })
    }
    fs.mkdirSync(dirPath, { recursive: true })
}

function assertNoForbiddenRuntimeImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')

    for (const pattern of forbiddenRuntimePatterns) {
        if (content.includes(pattern)) {
            throw new Error(`В публичный runtime попала запрещённая зависимость \"${pattern}\" в файле ${filePath}`)
        }
    }
}

