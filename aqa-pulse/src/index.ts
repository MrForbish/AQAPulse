export { ApiStore, type ApiFilters, type TestHistoryResponse, type TestHistoryConflict } from './api-store'
export {
    buildAdvancedMetrics,
    buildAdvancedMetricsFromArchivedRuns,
    buildDashboardSummary,
    formatDate,
    formatDuration,
    formatPercent,
    loadReporterReport,
    readDashboardSummary,
    type DashboardAdvancedMetrics,
    type DashboardAvailableFilters,
    type DashboardFilters,
    type DashboardKpis,
    type DashboardRunMetadata,
    type PrecomputedCodeQualityFileFacts,
    type PrecomputedCodeQualitySourceFacts,
    type PrecomputedCodeQualityTestFacts,
    type DashboardSummary,
    type ReporterAttempt,
    type ReporterRoot,
    type ReporterTest,
    normalizePrecomputedSourceFacts,
    writeJsonFile,
    writeTextFile,
} from './dashboard-utils'
export {
    appendHistoryEntry,
    archiveHistoryRun,
    buildHistoryEntryId,
    readDashboardHistory,
    type ArchivedRunMetadata,
    type ArchivedRunRecord,
    type DashboardHistory,
    type DashboardHistoryEntry,
    writeDashboardHistory,
} from './history-utils'
export {
    createEmptyFrontendBootstrap,
    parseFrontendBootstrap,
    type FrontendBootstrapData,
    type FrontendRouteDescriptor,
    type FrontendSessionStatus,
} from './frontend-bootstrap'


