import { renderDashboardHtml as renderDashboardHtmlImpl } from './render-dashboard'
import { METRIC_INFO_STYLES as metricInfoStylesImpl, renderMetricHeading as renderMetricHeadingImpl } from './render-metric-info'
import { renderTestHistoryHtml as renderTestHistoryHtmlImpl } from './render-test-history'
import { formatDate, formatDuration, formatPercent } from './shared/formatting'
import { ru } from './shared/i18n/ru'

let didWarnAboutDeprecatedPackage = false

function warnDeprecatedPackage(apiName: string): void {
    if (didWarnAboutDeprecatedPackage) {
        return
    }

    didWarnAboutDeprecatedPackage = true
    console.warn(`[AQA Pulse] aqa-pulse-client is a deprecated compatibility package scheduled for removal. ${apiName} still uses the old HTML renderer flow; migrate to aqa-pulse-server or the React/static runtime before this package is retired.`)
}

export function renderDashboardHtml(...args: Parameters<typeof renderDashboardHtmlImpl>): ReturnType<typeof renderDashboardHtmlImpl> {
    warnDeprecatedPackage('renderDashboardHtml')
    return renderDashboardHtmlImpl(...args)
}

export function renderTestHistoryHtml(...args: Parameters<typeof renderTestHistoryHtmlImpl>): ReturnType<typeof renderTestHistoryHtmlImpl> {
    warnDeprecatedPackage('renderTestHistoryHtml')
    return renderTestHistoryHtmlImpl(...args)
}

export function renderMetricHeading(...args: Parameters<typeof renderMetricHeadingImpl>): ReturnType<typeof renderMetricHeadingImpl> {
    warnDeprecatedPackage('renderMetricHeading')
    return renderMetricHeadingImpl(...args)
}

export const METRIC_INFO_STYLES = (() => {
    warnDeprecatedPackage('METRIC_INFO_STYLES')
    return metricInfoStylesImpl
})()

export { formatDate, formatDuration, formatPercent, ru }
export type {
    DashboardAdvancedMetrics,
    DashboardAvailableFilters,
    DashboardFilters,
    DashboardKpis,
    DashboardRunMetadata,
    DashboardSummary,
} from './dashboard-utils'
export type { TestHistoryConflict, TestHistoryResponse } from './api-store'