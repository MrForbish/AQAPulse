"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.METRIC_INFO_STYLES = void 0;
exports.renderMetricHeading = renderMetricHeading;
exports.renderMetricInfoIcon = renderMetricInfoIcon;
exports.METRIC_INFO_STYLES = `
.metric-heading { display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.metric-info { position: relative; display: inline-flex; align-items: center; }
.metric-info-button { width: 16px; height: 16px; border-radius: 50%; border: 1px solid #30363d; background: #21262d; color: #8b949e; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; cursor: help; }
.metric-info-button:focus-visible { outline: 2px solid #2f81f7; outline-offset: 2px; }
.metric-tooltip { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(4px); width: min(280px, 70vw); padding: 10px 12px; border-radius: 8px; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; font-size: 12px; line-height: 1.45; box-shadow: 0 10px 30px rgba(1, 4, 9, 0.45); opacity: 0; pointer-events: none; z-index: 10; white-space: normal; text-align: left; transition: opacity 0.15s ease, transform 0.15s ease; }
.metric-info:hover .metric-tooltip, .metric-info:focus-within .metric-tooltip { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
`;
function renderMetricHeading(label, description, options = {}) {
    const className = [options.className, 'metric-heading'].filter(Boolean).join(' ');
    const tagName = options.tagName ?? 'span';
    return `<${tagName} class="${escapeHtml(className)}"><span>${escapeHtml(label)}</span>${renderMetricInfoIcon(description, label)}</${tagName}>`;
}
function renderMetricInfoIcon(description, label) {
    return `<span class="metric-info"><span class="metric-info-button" tabindex="0" role="img" aria-label="Описание метрики ${escapeHtml(label)}">i</span><span class="metric-tooltip">${escapeHtml(description)}</span></span>`;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
