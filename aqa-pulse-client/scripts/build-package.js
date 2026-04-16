/**
 * Назначение: собирает legacy compatibility package из compiled output `aqa-pulse` и следит, чтобы его runtime оставался browser-only.
 */
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

const generatedIndexJs = `'use strict'\n\nconst renderDashboardModule = require('./render-dashboard')\nconst renderTestHistoryModule = require('./render-test-history')\nconst metricInfoModule = require('./render-metric-info')\nconst formattingModule = require('./shared/formatting')\nconst i18nModule = require('./shared/i18n/ru')\n\nlet didWarnAboutLegacyPackage = false\n\nfunction warnLegacyPackage(apiName) {\n    if (didWarnAboutLegacyPackage) {\n        return\n    }\n\n    didWarnAboutLegacyPackage = true\n    console.warn('[AQA Pulse] aqa-pulse-client is a legacy compatibility package. ' + apiName + ' uses the old HTML renderer flow; new UI work ships through the React runtime in aqa-pulse-server.')\n}\n\nexports.renderDashboardHtml = (...args) => {\n    warnLegacyPackage('renderDashboardHtml')\n    return renderDashboardModule.renderDashboardHtml(...args)\n}\n\nexports.renderTestHistoryHtml = (...args) => {\n    warnLegacyPackage('renderTestHistoryHtml')\n    return renderTestHistoryModule.renderTestHistoryHtml(...args)\n}\n\nObject.defineProperty(exports, 'METRIC_INFO_STYLES', {\n    enumerable: true,\n    get() {\n        warnLegacyPackage('METRIC_INFO_STYLES')\n        return metricInfoModule.METRIC_INFO_STYLES\n    },\n})\n\nexports.renderMetricHeading = (...args) => {\n    warnLegacyPackage('renderMetricHeading')\n    return metricInfoModule.renderMetricHeading(...args)\n}\n\nexports.formatDate = formattingModule.formatDate\nexports.formatDuration = formattingModule.formatDuration\nexports.formatPercent = formattingModule.formatPercent\nexports.ru = i18nModule.ru\n`

const generatedIndexDts = `/** @deprecated Legacy HTML renderer compatibility layer. New UI work ships through the React runtime in aqa-pulse-server. */\nexport { renderDashboardHtml } from './render-dashboard'\n/** @deprecated Legacy HTML renderer compatibility layer. New UI work ships through the React runtime in aqa-pulse-server. */\nexport { renderTestHistoryHtml } from './render-test-history'\n/** @deprecated Legacy HTML renderer compatibility layer. Kept for string-based HTML consumers only. */\nexport { METRIC_INFO_STYLES, renderMetricHeading } from './render-metric-info'\nexport { formatDate, formatDuration, formatPercent } from './shared/formatting'\nexport { ru } from './shared/i18n/ru'\nexport type { DashboardAdvancedMetrics, DashboardAvailableFilters, DashboardFilters, DashboardKpis, DashboardRunMetadata, DashboardSummary } from './dashboard-utils'\nexport type { TestHistoryConflict, TestHistoryResponse } from './api-store'\n`

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

/**
 * Compatibility package не должен случайно подтянуть server/runtime-only зависимости, иначе старые HTML consumers перестанут быть browser-safe.
 */
function assertNoForbiddenRuntimeImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')

    for (const pattern of forbiddenRuntimePatterns) {
        if (content.includes(pattern)) {
            throw new Error(`В публичный runtime попала запрещённая зависимость \"${pattern}\" в файле ${filePath}`)
        }
    }
}

