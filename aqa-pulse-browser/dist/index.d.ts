export { formatDate, formatDuration, formatPercent } from './shared/formatting';
export { renderMetricHeading, METRIC_INFO_STYLES } from './render-metric-info';
export { ru } from './shared/i18n/ru';
export { createEmptyFrontendBootstrap, parseFrontendBootstrap, type FrontendBootstrapData, type FrontendRouteDescriptor, type FrontendSessionStatus } from './frontend-bootstrap';
export type { DashboardAdvancedMetrics, DashboardAvailableFilters, DashboardFilters, DashboardKpis, DashboardRunMetadata, DashboardSummary } from './dashboard-utils';
export type { TestHistoryConflict, TestHistoryResponse } from './api-store';
export type { WorkspaceDescriptor } from './backend/contracts';
