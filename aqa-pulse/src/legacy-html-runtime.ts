/**
 * Назначение: единая deprecated boundary для legacy HTML renderer API, чтобы compatibility surface был отделён от основного React runtime.
 */
import { renderDashboardHtml as renderDashboardHtmlImpl } from './render-dashboard'
import { METRIC_INFO_STYLES as metricInfoStylesImpl, renderMetricHeading as renderMetricHeadingImpl } from './render-metric-info'
import { renderTestHistoryHtml as renderTestHistoryHtmlImpl } from './render-test-history'

let hasWarnedLegacyHtmlRuntime = false

function warnLegacyHtmlRuntime(apiName: string): void {
    if (hasWarnedLegacyHtmlRuntime) {
        return
    }

    hasWarnedLegacyHtmlRuntime = true

    console.warn(
        `[AQA Pulse] ${apiName} uses the legacy HTML renderer compatibility layer. New UI capabilities ship through the React runtime in aqa-pulse-server and dist/web.`,
    )
}

/**
 * @deprecated Legacy HTML renderer compatibility layer. New UI work ships through the React runtime in aqa-pulse-server and dist/web.
 */
export function renderDashboardHtml(
    ...args: Parameters<typeof renderDashboardHtmlImpl>
): ReturnType<typeof renderDashboardHtmlImpl> {
    warnLegacyHtmlRuntime('renderDashboardHtml')
    return renderDashboardHtmlImpl(...args)
}

/**
 * @deprecated Legacy HTML renderer compatibility layer. New UI work ships through the React runtime in aqa-pulse-server and dist/web.
 */
export function renderTestHistoryHtml(
    ...args: Parameters<typeof renderTestHistoryHtmlImpl>
): ReturnType<typeof renderTestHistoryHtmlImpl> {
    warnLegacyHtmlRuntime('renderTestHistoryHtml')
    return renderTestHistoryHtmlImpl(...args)
}

/**
 * @deprecated Legacy HTML renderer compatibility layer. Prefer the React UI and shared metric metadata instead of string-based HTML composition.
 */
export function renderMetricHeading(
    ...args: Parameters<typeof renderMetricHeadingImpl>
): ReturnType<typeof renderMetricHeadingImpl> {
    warnLegacyHtmlRuntime('renderMetricHeading')
    return renderMetricHeadingImpl(...args)
}

/**
 * @deprecated Legacy HTML renderer compatibility layer. Kept only for string-based HTML consumers.
 */
export const METRIC_INFO_STYLES = (() => {
    warnLegacyHtmlRuntime('METRIC_INFO_STYLES')
    return metricInfoStylesImpl
})()