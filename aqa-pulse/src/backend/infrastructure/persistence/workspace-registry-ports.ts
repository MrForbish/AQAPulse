import type { AdminWorkspaceRegistryPort } from '../../application/admin-workspace-use-cases'
import type { AdminAuthRegistryPort } from '../../application/auth-session-use-cases'
import type { ReadModelWorkspaceRegistry } from '../../application/workspace-read-model-ports'
import type { WorkspaceShareLinkRegistryPort } from '../../application/workspace-share-link-use-cases'
import type { WorkspaceDescriptor, WorkspaceRecord, WorkspaceSessionKind } from '../../contracts'

export type AdminHttpWorkspaceRegistry = AdminWorkspaceRegistryPort & AdminAuthRegistryPort
    & Pick<
        {
            listAdminAuditPage(page?: number, pageSize?: number): {
                entries: unknown[]
                page: number
                pageSize: number
                totalEntries: number
                totalPages: number
                hasPreviousPage: boolean
                hasNextPage: boolean
            }
        },
        'listAdminAuditPage'
    >

export type RuntimeHttpWorkspaceRegistry = AdminAuthRegistryPort
    & WorkspaceShareLinkRegistryPort
    & Pick<{ getWorkspace(slug: string): WorkspaceDescriptor | null }, 'getWorkspace'>

export type SecurityWorkspaceRegistry = Pick<
    {
        getWorkspace(slug: string): WorkspaceDescriptor | null
        getWorkspaceRecord(slug: string): WorkspaceRecord | null
        isAdminSessionActive(sessionId: string): boolean
        touchAdminSession(sessionId: string): void
        isWorkspaceSessionActive(slug: string, sessionId: string, kind?: WorkspaceSessionKind): boolean
        touchWorkspaceSession(slug: string, sessionId: string): void
    },
    | 'getWorkspace'
    | 'getWorkspaceRecord'
    | 'isAdminSessionActive'
    | 'touchAdminSession'
    | 'isWorkspaceSessionActive'
    | 'touchWorkspaceSession'
>

export type AdminActorRegistry = Pick<AdminAuthRegistryPort, 'getAdminSession'>

export type BootstrapWorkspaceRegistry = Pick<AdminWorkspaceRegistryPort, 'createWorkspace' | 'createApiKey' | 'createUser' | 'getWorkspace'>
