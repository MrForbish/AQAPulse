/**
 * Назначение: thin frontend API-layer для admin/workspace auth, provisioning и session endpoints.
 */
import type {
    AdminAuditPage,
    AdminAuditRecord,
    AdminIngestionHealthReport,
    ServerSettingsRecord,
    WorkspaceDescriptor,
    WorkspaceProvisioningResult,
    WorkspaceShareLinkProvisioningResult,
    WorkspaceUpdateResult,
    WorkspaceUserRoleUpdateResult,
    WorkspaceUserProvisioningResult,
} from '../../../backend/contracts'
import { requestJson } from '../../shared/http'

export interface AdminLoginResponse {
    accessToken: string
    expiresAt: string
    scope: string
}

export interface WorkspaceLoginResponse {
    accessToken: string
    expiresAt: string
    scope: string
    workspace: string
}

export interface WorkspaceApiKeyExchangeResponse {
    accessToken: string
    expiresAt: string
    scope: string
    workspace: string
}

export interface SessionStatusResponse {
    authenticated: boolean
    authRequired: boolean
    scope: string
    workspace?: string
}

/**
 * API helper-слой intentionally остаётся тонким: hooks управляют navigation/state, а этот модуль только сериализует запросы к backend contract.
 */
export async function loginAsAdmin(token: string): Promise<AdminLoginResponse> {
    return requestJson('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ token }),
    })
}

export async function logoutAdmin(): Promise<void> {
    await requestJson('/auth/admin/logout', {
        method: 'POST',
    })
}

export async function fetchAdminWorkspaces(): Promise<WorkspaceDescriptor[]> {
    const payload = await requestJson<{ workspaces: WorkspaceDescriptor[] }>('/api/workspaces')
    return payload.workspaces
}

export async function createWorkspace(input: {
    name: string
    slug?: string
    apiKeyLabel?: string
}): Promise<WorkspaceProvisioningResult> {
    return requestJson('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify(input),
    })
}

export async function updateWorkspace(slug: string, input: {
    name: string
    slug?: string
}): Promise<WorkspaceUpdateResult> {
    return requestJson(`/api/workspaces/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    })
}

export async function deleteWorkspace(slug: string): Promise<WorkspaceDescriptor> {
    const payload = await requestJson<{ workspace: WorkspaceDescriptor }>(`/api/workspaces/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
    })

    return payload.workspace
}

export async function resetWorkspaceData(slug: string): Promise<WorkspaceDescriptor> {
    const payload = await requestJson<{ workspace: WorkspaceDescriptor }>(`/api/workspaces/${encodeURIComponent(slug)}/reset-data`, {
        method: 'POST',
    })

    return payload.workspace
}

export async function createWorkspaceApiKey(slug: string, label?: string): Promise<WorkspaceProvisioningResult> {
    return requestJson(`/api/workspaces/${encodeURIComponent(slug)}/api-keys`, {
        method: 'POST',
        body: JSON.stringify({ label }),
    })
}

export async function createWorkspaceUser(slug: string, input: {
    label: string
    role: 'owner' | 'viewer'
}): Promise<WorkspaceUserProvisioningResult> {
    return requestJson(`/api/workspaces/${encodeURIComponent(slug)}/users`, {
        method: 'POST',
        body: JSON.stringify(input),
    })
}

export async function createWorkspaceShareLink(slug: string, ttlMinutes: 5 | 10): Promise<WorkspaceShareLinkProvisioningResult> {
    return requestJson(`/api/workspaces/${encodeURIComponent(slug)}/share-links`, {
        method: 'POST',
        body: JSON.stringify({ ttlMinutes }),
    })
}

export async function updateWorkspaceUserRole(slug: string, userId: string, role: 'owner' | 'viewer'): Promise<WorkspaceUserRoleUpdateResult> {
    return requestJson(`/api/workspaces/${encodeURIComponent(slug)}/users/${encodeURIComponent(userId)}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
    })
}

export async function disableWorkspaceApiKey(slug: string, apiKeyId: string): Promise<WorkspaceDescriptor> {
    const payload = await requestJson<{ workspace: WorkspaceDescriptor }>(`/api/workspaces/${encodeURIComponent(slug)}/api-keys/${encodeURIComponent(apiKeyId)}/disable`, {
        method: 'POST',
    })

    return payload.workspace
}

export async function deleteWorkspaceApiKey(slug: string, apiKeyId: string): Promise<WorkspaceDescriptor> {
    const payload = await requestJson<{ workspace: WorkspaceDescriptor }>(`/api/workspaces/${encodeURIComponent(slug)}/api-keys/${encodeURIComponent(apiKeyId)}`, {
        method: 'DELETE',
    })

    return payload.workspace
}

export async function disableWorkspaceUser(slug: string, userId: string): Promise<WorkspaceDescriptor> {
    const payload = await requestJson<{ workspace: WorkspaceDescriptor }>(`/api/workspaces/${encodeURIComponent(slug)}/users/${encodeURIComponent(userId)}/disable`, {
        method: 'POST',
    })

    return payload.workspace
}

export async function deleteWorkspaceUser(slug: string, userId: string): Promise<WorkspaceDescriptor> {
    const payload = await requestJson<{ workspace: WorkspaceDescriptor }>(`/api/workspaces/${encodeURIComponent(slug)}/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
    })

    return payload.workspace
}

export async function revokeWorkspaceSession(slug: string, sessionId: string): Promise<WorkspaceDescriptor> {
    const payload = await requestJson<{ workspace: WorkspaceDescriptor }>(`/api/workspaces/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}/revoke`, {
        method: 'POST',
    })

    return payload.workspace
}

export async function fetchAdminServerSettings(): Promise<ServerSettingsRecord> {
    const payload = await requestJson<{ settings: ServerSettingsRecord }>('/api/admin/settings')
    return payload.settings
}

export async function updateAdminServerSettings(input: {
    adminBaseUrl: string | null
    runtimeBaseUrl: string | null
    allowDevBootstrap: boolean
    requireWorkspaceAuth: boolean
    accessTokenTtlSeconds: number
    adminToken: string | null
    businessAssumptions: ServerSettingsRecord['businessAssumptions']
}): Promise<ServerSettingsRecord> {
    const payload = await requestJson<{ settings: ServerSettingsRecord }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(input),
    })

    return payload.settings
}

export async function fetchAdminAuditLog(page = 1, pageSize = 20): Promise<AdminAuditPage> {
    return requestJson(`/api/admin/audit?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`)
}

export async function fetchAdminIngestionHealth(): Promise<AdminIngestionHealthReport> {
    return requestJson('/api/admin/ingestion-health')
}

export async function loginToWorkspace(slug: string, token: string): Promise<WorkspaceLoginResponse> {
    return requestJson(`/auth/workspaces/${encodeURIComponent(slug)}/users/login`, {
        method: 'POST',
        body: JSON.stringify({ token }),
    })
}

export async function logoutWorkspace(slug: string): Promise<void> {
    await requestJson(`/auth/workspaces/${encodeURIComponent(slug)}/users/logout`, {
        method: 'POST',
    })
}

export async function exchangeWorkspaceApiKey(slug: string, token: string): Promise<WorkspaceApiKeyExchangeResponse> {
    return requestJson(`/auth/workspaces/${encodeURIComponent(slug)}/api-keys/login`, {
        method: 'POST',
        body: JSON.stringify({ token }),
    })
}

export async function readAdminSessionStatus(): Promise<SessionStatusResponse> {
    return requestJson('/auth/admin/session')
}

export async function readWorkspaceSessionStatus(slug: string): Promise<SessionStatusResponse> {
    return requestJson(`/auth/workspaces/${encodeURIComponent(slug)}/session`)
}
