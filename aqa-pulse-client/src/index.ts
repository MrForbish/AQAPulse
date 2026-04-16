import { renderDashboardHtml as renderDashboardHtmlImpl } from './render-dashboard'
import { METRIC_INFO_STYLES as metricInfoStylesImpl, renderMetricHeading as renderMetricHeadingImpl } from './render-metric-info'
import { renderTestHistoryHtml as renderTestHistoryHtmlImpl } from './render-test-history'
import { formatDate, formatDuration, formatPercent } from './shared/formatting'
import { ru } from './shared/i18n/ru'

let didWarnAboutLegacyPackage = false

function warnLegacyPackage(apiName: string): void {
    if (didWarnAboutLegacyPackage) {
        return
    }

    didWarnAboutLegacyPackage = true
    console.warn(`[AQA Pulse] aqa-pulse-client is a legacy compatibility package. ${apiName} uses the old HTML renderer flow; new UI work ships through the React runtime in aqa-pulse-server.`)
}

export function renderDashboardHtml(...args: Parameters<typeof renderDashboardHtmlImpl>): ReturnType<typeof renderDashboardHtmlImpl> {
    warnLegacyPackage('renderDashboardHtml')
    return renderDashboardHtmlImpl(...args)
}

export function renderTestHistoryHtml(...args: Parameters<typeof renderTestHistoryHtmlImpl>): ReturnType<typeof renderTestHistoryHtmlImpl> {
    warnLegacyPackage('renderTestHistoryHtml')
    return renderTestHistoryHtmlImpl(...args)
}

export function renderMetricHeading(...args: Parameters<typeof renderMetricHeadingImpl>): ReturnType<typeof renderMetricHeadingImpl> {
    warnLegacyPackage('renderMetricHeading')
    return renderMetricHeadingImpl(...args)
}

export const METRIC_INFO_STYLES = (() => {
    warnLegacyPackage('METRIC_INFO_STYLES')
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