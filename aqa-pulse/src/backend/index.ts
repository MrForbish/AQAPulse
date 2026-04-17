export { ApiStore, type ApiFilters, type TestHistoryConflict, type TestHistoryResponse } from '../api-store'
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
} from '../dashboard-utils'
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
} from '../history-utils'
export { createAdminApp, createRuntimeApp, createSaasApp } from './app'
export {
    createAdminGuard,
    createWorkspaceApiKeyGuard,
    createWorkspaceResolver,
    createWorkspaceUserGuard,
    extractAccessToken,
    getWorkspaceAuthFromLocals,
    getWorkspaceFromLocals,
    getWorkspaceUserAuthFromLocals,
    requireWorkspaceFromLocals,
} from './auth'
export { resolveSaasAppConfig, type SaasAppConfig } from './config'
export { ingestReporterRun } from './run-ingestion.service'
export { uploadReportToWorkspace, type UploadReportOptions } from './upload-report'
export {
    createBackendStorage,
    FileSystemBackendStorage,
    FileSystemDashboardReadStorage,
    FileSystemWorkspaceRegistryStorage,
    FileSystemWorkspaceRunStorage,
    SqliteBackendStorage,
    SqliteWorkspaceRegistryStorage,
    SqliteWorkspaceRunStorage,
    type BackendStorage,
    type DashboardReadStorage,
    type DashboardStoragePaths,
    type WorkspaceRegistryStorage,
    type WorkspaceRunStorage,
} from './storage'
export { WorkspaceRegistry } from './workspace-registry'
export {
    getDevDataRoot,
    getWorkspacePaths,
    getWorkspacePathsFromDataRoot,
    getWorkspaceRegistryPath,
    getWorkspaceRegistryPathFromDataRoot,
    resolveWorkspaceDataRoot,
} from './workspace-paths'
export type {
    CreateWorkspaceInput,
    CreateWorkspaceUserInput,
    IngestionRequestPayload,
    IngestionResult,
    StorageDriver,
    WorkspaceApiAuthResult,
    WorkspaceDescriptor,
    WorkspacePaths,
    WorkspaceProvisioningResult,
    WorkspaceRecord,
    WorkspaceRegistrySnapshot,
    WorkspaceUserAuthResult,
    WorkspaceUserProvisioningResult,
    WorkspaceUserRole,
    WorkspaceUserRecord,
} from './contracts'

