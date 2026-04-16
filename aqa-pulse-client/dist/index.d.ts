/** @deprecated Legacy HTML renderer compatibility layer. New UI work ships through the React runtime in aqa-pulse-server. */
export { renderDashboardHtml } from './render-dashboard'
/** @deprecated Legacy HTML renderer compatibility layer. New UI work ships through the React runtime in aqa-pulse-server. */
export { renderTestHistoryHtml } from './render-test-history'
/** @deprecated Legacy HTML renderer compatibility layer. Kept for string-based HTML consumers only. */
export { METRIC_INFO_STYLES, renderMetricHeading } from './render-metric-info'
export { formatDate, formatDuration, formatPercent } from './shared/formatting'
export { ru } from './shared/i18n/ru'
export type { DashboardAdvancedMetrics, DashboardAvailableFilters, DashboardFilters, DashboardKpis, DashboardRunMetadata, DashboardSummary } from './dashboard-utils'
export type { TestHistoryConflict, TestHistoryResponse } from './api-store'
