const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const aqaPulseRoot = path.resolve(packageRoot, '..', 'aqa-pulse')
const sourceRoot = path.resolve(aqaPulseRoot, 'dist-ts')
const distRoot = path.resolve(packageRoot, 'dist')

const filesToCopy = [
    'shared/formatting.js',
    'shared/formatting.d.ts',
    'shared/i18n/ru.js',
    'shared/i18n/ru.d.ts',
    'frontend-bootstrap.js',
    'frontend-bootstrap.d.ts',
    'dashboard-utils.d.ts',
    'api-store.d.ts',
    'history-utils.d.ts',
    'backend/contracts.d.ts',
    'backend/storage.d.ts',
]

cleanDir(distRoot)

for (const relativePath of filesToCopy) {
    copyFileFromSource(relativePath)
}

writeFile(
    path.resolve(distRoot, 'index.js'),
    `'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.parseFrontendBootstrap = exports.createEmptyFrontendBootstrap = exports.ru = exports.formatPercent = exports.formatDuration = exports.formatDate = void 0;
var formatting_1 = require('./shared/formatting');
Object.defineProperty(exports, 'formatDate', { enumerable: true, get: function () { return formatting_1.formatDate; } });
Object.defineProperty(exports, 'formatDuration', { enumerable: true, get: function () { return formatting_1.formatDuration; } });
Object.defineProperty(exports, 'formatPercent', { enumerable: true, get: function () { return formatting_1.formatPercent; } });
var ru_1 = require('./shared/i18n/ru');
Object.defineProperty(exports, 'ru', { enumerable: true, get: function () { return ru_1.ru; } });
var frontend_bootstrap_1 = require('./frontend-bootstrap');
Object.defineProperty(exports, 'createEmptyFrontendBootstrap', { enumerable: true, get: function () { return frontend_bootstrap_1.createEmptyFrontendBootstrap; } });
Object.defineProperty(exports, 'parseFrontendBootstrap', { enumerable: true, get: function () { return frontend_bootstrap_1.parseFrontendBootstrap; } });
`,
)

writeFile(
    path.resolve(distRoot, 'index.d.ts'),
    `export { formatDate, formatDuration, formatPercent } from './shared/formatting';
export { ru } from './shared/i18n/ru';
export { createEmptyFrontendBootstrap, parseFrontendBootstrap, type FrontendBootstrapData, type FrontendRouteDescriptor, type FrontendSessionStatus } from './frontend-bootstrap';
export type { DashboardAdvancedMetrics, DashboardAvailableFilters, DashboardFilters, DashboardKpis, DashboardRunMetadata, DashboardSummary } from './dashboard-utils';
export type { TestHistoryConflict, TestHistoryResponse } from './api-store';
export type { WorkspaceDescriptor } from './backend/contracts';
`,
)

console.log('Публичный пакет aqa-pulse-browser собран.')
console.log(`Источник browser-safe файлов: ${sourceRoot}`)
console.log(`Папка пакета: ${distRoot}`)

function copyFileFromSource(relativePath) {
    copyFile(path.resolve(sourceRoot, relativePath), path.resolve(distRoot, relativePath))
}

function copyFile(sourcePath, targetPath) {
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