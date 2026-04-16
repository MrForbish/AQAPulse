import type {
    WorkspaceDescriptor,
    WorkspaceProvisioningResult,
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
