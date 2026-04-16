const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const aqaPulseRoot = path.resolve(packageRoot, '..', 'aqa-pulse')
const sourceRoot = path.resolve(aqaPulseRoot, 'dist-ts')
const distRoot = path.resolve(packageRoot, 'dist')
const metricInfoStyles = `
.metric-heading { display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.metric-icon { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; color: #7dd3fc; flex: 0 0 auto; }
.metric-icon svg { width: 15px; height: 15px; display: block; }
.metric-info { position: relative; display: inline-flex; align-items: center; z-index: 1; }
.metric-info-button { width: 16px; height: 16px; border-radius: 50%; border: 1px solid #30363d; background: #21262d; color: #8b949e; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; cursor: help; }
.metric-info-button:focus-visible { outline: 2px solid #2f81f7; outline-offset: 2px; }
.metric-tooltip { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(4px); width: min(280px, 70vw); padding: 10px 12px; border-radius: 8px; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; font-size: 12px; line-height: 1.45; box-shadow: 0 10px 30px rgba(1, 4, 9, 0.45); opacity: 0; pointer-events: none; z-index: 10; white-space: normal; text-align: left; transition: opacity 0.15s ease, transform 0.15s ease; }
.metric-info:hover .metric-tooltip, .metric-info:focus-within .metric-tooltip { opacity: 1; pointer-events: auto; z-index: 20; transform: translateX(-50%) translateY(0); }
`

const filesToCopy = [
    'shared/formatting.js',
    'shared/formatting.d.ts',
    'shared/i18n/ru.js',
    'shared/i18n/ru.d.ts',
    'shared/metric-info.js',
    'shared/metric-info.d.ts',
    'shared/text-utils.js',
    'shared/text-utils.d.ts',
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
        path.resolve(distRoot, 'render-metric-info.js'),
        `'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.METRIC_INFO_STYLES = void 0;
exports.renderMetricHeading = renderMetricHeading;
exports.renderMetricInfoIcon = renderMetricInfoIcon;
var text_utils_1 = require('./shared/text-utils');
var metric_info_1 = require('./shared/metric-info');
exports.METRIC_INFO_STYLES = ${JSON.stringify(metricInfoStyles)};
function renderMetricHeading(label, description, options) {
    if (options === void 0) {
        options = {};
    }
    var className = [options.className, 'metric-heading'].filter(Boolean).join(' ');
    var tagName = options.tagName || 'span';
    var iconMarkup = renderMetricIcon((0, metric_info_1.resolveMetricIcon)(options.metricKey, label));
    return \`<\${tagName} class="\${(0, text_utils_1.escapeHtml)(className)}">\${iconMarkup}<span>\${(0, text_utils_1.escapeHtml)(label)}</span>\${renderMetricInfoIcon(description, label)}</\${tagName}>\`;
}
function renderMetricInfoIcon(description, label) {
    return \`<span class="metric-info"><span class="metric-info-button" tabindex="0" role="img" aria-label="Описание метрики \${(0, text_utils_1.escapeHtml)(label)}">i</span><span class="metric-tooltip">\${(0, text_utils_1.escapeHtml)(description)}</span></span>\`;
}
function renderMetricIcon(icon) {
    if (!icon) {
        return '';
    }
    return \`<span class="metric-icon" aria-hidden="true">\${(0, metric_info_1.renderMetricIconSvg)(icon)}</span>\`;
}
`,
)

writeFile(
        path.resolve(distRoot, 'render-metric-info.d.ts'),
        `export declare const METRIC_INFO_STYLES: string;
export declare function renderMetricHeading(label: string, description: string, options?: {
        className?: string;
        tagName?: 'div' | 'span';
        metricKey?: string;
}): string;
export declare function renderMetricInfoIcon(description: string, label: string): string;
`,
)

writeFile(
    path.resolve(distRoot, 'index.js'),
    `'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.parseFrontendBootstrap = exports.createEmptyFrontendBootstrap = exports.ru = exports.METRIC_INFO_STYLES = exports.renderMetricHeading = exports.formatPercent = exports.formatDuration = exports.formatDate = void 0;
var formatting_1 = require('./shared/formatting');
Object.defineProperty(exports, 'formatDate', { enumerable: true, get: function () { return formatting_1.formatDate; } });
Object.defineProperty(exports, 'formatDuration', { enumerable: true, get: function () { return formatting_1.formatDuration; } });
Object.defineProperty(exports, 'formatPercent', { enumerable: true, get: function () { return formatting_1.formatPercent; } });
var render_metric_info_1 = require('./render-metric-info');
Object.defineProperty(exports, 'renderMetricHeading', { enumerable: true, get: function () { return render_metric_info_1.renderMetricHeading; } });
Object.defineProperty(exports, 'METRIC_INFO_STYLES', { enumerable: true, get: function () { return render_metric_info_1.METRIC_INFO_STYLES; } });
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
export { renderMetricHeading, METRIC_INFO_STYLES } from './render-metric-info';
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