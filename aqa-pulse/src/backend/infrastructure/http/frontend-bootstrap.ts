import type { Request } from 'express'
import type { FrontendBootstrapData } from '../../../frontend-bootstrap'
import type { AdminAuthRegistryPort, AuthSessionConfig } from '../../application/auth-session-use-cases'
import { readAdminBootstrapSessionState } from '../../application/admin'
import { readWorkspaceBootstrapSessionState } from '../../application/runtime'
import { extractAccessToken, getWorkspaceSessionCookieName } from '../security'
import type { SaasAppConfig } from '../../config'
import { readCookieValue } from './cookies'

export function buildFrontendServiceUrls(config: Pick<SaasAppConfig, 'adminBaseUrl' | 'runtimeBaseUrl'>): FrontendBootstrapData['serviceUrls'] {
    return {
        adminBaseUrl: config.adminBaseUrl,
        runtimeBaseUrl: config.runtimeBaseUrl,
    }
}

export function readAdminBootstrapSession(
    request: Request,
    registry: Pick<AdminAuthRegistryPort, 'isAdminSessionActive'>,
    config: Pick<AuthSessionConfig, 'adminToken' | 'jwtSecret'> & Pick<SaasAppConfig, 'adminSessionCookieName'>,
): FrontendBootstrapData['initialSessionStatus'] {
    return readAdminBootstrapSessionState(registry, config, {
        headerToken: extractAccessToken(request, 'x-admin-token'),
        cookieToken: readCookieValue(request, config.adminSessionCookieName),
    })
}

export function readWorkspaceBootstrapSession(
    request: Request,
    workspaceSlug: string,
    registry: Pick<AdminAuthRegistryPort, 'isAdminSessionActive' | 'isWorkspaceSessionActive'>,
    config: Pick<AuthSessionConfig, 'requireWorkspaceAuth' | 'jwtSecret'> & Pick<SaasAppConfig, 'adminSessionCookieName' | 'workspaceSessionCookiePrefix'>,
): FrontendBootstrapData['initialSessionStatus'] {
    return readWorkspaceBootstrapSessionState(registry, config, workspaceSlug, {
        adminHeaderToken: extractAccessToken(request, 'x-admin-token'),
        adminCookieToken: readCookieValue(request, config.adminSessionCookieName),
        workspaceHeaderToken: extractAccessToken(request, 'x-workspace-token'),
        workspaceCookieToken: readCookieValue(request, getWorkspaceSessionCookieName(config, workspaceSlug)),
    })
}