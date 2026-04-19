import type { DashboardSummary } from '../../dashboard-utils'
import type { DashboardHistory } from '../../history-utils'
import type { WorkspaceDescriptor } from '../contracts'

export interface WorkspaceReadModelStorage {
    readHistory(): DashboardHistory
    writeHistory(history: DashboardHistory): void
    readSummary(): DashboardSummary
    writeSummary(summary: DashboardSummary): void
}

export interface WorkspaceReadModelBackendStorage {
    getWorkspaceStorage(slug: string): WorkspaceReadModelStorage
}

export interface ReadModelWorkspaceRegistry {
    listWorkspaces(): WorkspaceDescriptor[]
}