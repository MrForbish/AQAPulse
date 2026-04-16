import { escapeHtml } from './shared/text-utils'
import { renderMetricIconSvg, resolveMetricIcon, type MetricIconDefinition } from './shared/metric-info'

export const METRIC_INFO_STYLES = `
.metric-heading { display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.metric-icon { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; color: #7dd3fc; flex: 0 0 auto; }
.metric-icon svg { width: 15px; height: 15px; display: block; }
.metric-info { position: relative; display: inline-flex; align-items: center; z-index: 1; }
.metric-info-button { width: 16px; height: 16px; border-radius: 50%; border: 1px solid #30363d; background: #21262d; color: #8b949e; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; cursor: help; }
.metric-info-button:focus-visible { outline: 2px solid #2f81f7; outline-offset: 2px; }
.metric-tooltip { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(4px); width: min(280px, 70vw); padding: 10px 12px; border-radius: 8px; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; font-size: 12px; line-height: 1.45; box-shadow: 0 10px 30px rgba(1, 4, 9, 0.45); opacity: 0; pointer-events: none; z-index: 10; white-space: normal; text-align: left; transition: opacity 0.15s ease, transform 0.15s ease; }
.metric-info:hover .metric-tooltip, .metric-info:focus-within .metric-tooltip { opacity: 1; pointer-events: auto; z-index: 20; transform: translateX(-50%) translateY(0); }
`

export function renderMetricHeading(
    label: string,
    description: string,
    options: { className?: string; tagName?: 'div' | 'span'; metricKey?: string } = {},
): string {
    const className = [options.className, 'metric-heading'].filter(Boolean).join(' ')
    const tagName = options.tagName ?? 'span'
    const iconMarkup = renderMetricIcon(resolveMetricIcon(options.metricKey, label))

    return `<${tagName} class="${escapeHtml(className)}">${iconMarkup}<span>${escapeHtml(label)}</span>${renderMetricInfoIcon(description, label)}</${tagName}>`
}

export function renderMetricInfoIcon(description: string, label: string): string {
    return `<span class="metric-info"><span class="metric-info-button" tabindex="0" role="img" aria-label="Описание метрики ${escapeHtml(label)}">i</span><span class="metric-tooltip">${escapeHtml(description)}</span></span>`
}

function renderMetricIcon(icon: MetricIconDefinition | null): string {
    if (!icon) {
        return ''
    }

    return `<span class="metric-icon" aria-hidden="true">${renderMetricIconSvg(icon)}</span>`
}


