import type { Request, Response } from 'express'
import type { FrontendBootstrapData } from '../../../frontend-bootstrap'
import type { FrontendShellRenderer } from '../../frontend-shell'

export function buildWorkspaceShareLinkUrl(
    request: Request,
    runtimeBaseUrl: string | null,
    workspaceSlug: string,
    token: string,
    sessionId?: string,
): string {
    const pathname = sessionId
        ? `/s/${encodeURIComponent(sessionId)}`
        : `/auth/workspaces/${encodeURIComponent(workspaceSlug)}/share-links/login?token=${encodeURIComponent(token)}`

    const serviceBaseUrl = runtimeBaseUrl ?? resolveRequestOrigin(request)

    if (!serviceBaseUrl) {
        return pathname
    }

    return `${serviceBaseUrl.replace(/\/+$/g, '')}${pathname}`
}

export function sendWorkspaceShareLinkErrorShell(
    response: Response,
    frontendShell: FrontendShellRenderer,
    payload: {
        statusCode: number
        initialRequestUrl: string
        workspaceSlug: string
        title: string
        message: string
        serviceUrls: FrontendBootstrapData['serviceUrls']
        initialSessionStatus: FrontendBootstrapData['initialSessionStatus']
    },
): void {
    frontendShell.send(response, {
        route: {
            kind: 'workspace-share-link-error',
            workspaceSlug: payload.workspaceSlug,
            title: payload.title,
            message: payload.message,
        },
        initialRequestUrl: payload.initialRequestUrl,
        serviceUrls: payload.serviceUrls,
        initialDashboardSummary: null,
        initialTestHistoryPayload: null,
        initialAdminWorkspaces: null,
        initialSessionStatus: payload.initialSessionStatus,
    }, payload.statusCode)
}

export function sendUnknownWorkspaceShareLinkErrorHtml(response: Response): void {
    response.status(404).type('html').send(`<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Share link не найдена</title>
    <style>
        body { margin: 0; font-family: "Segoe UI", sans-serif; background: #08111f; color: #edf2fb; display: grid; min-height: 100vh; place-items: center; }
        main { width: min(560px, calc(100vw - 32px)); padding: 32px; border: 1px solid rgba(148,163,184,.24); border-radius: 24px; background: rgba(15,23,42,.92); box-shadow: 0 24px 80px rgba(2,6,23,.42); }
        h1 { margin: 0 0 12px; font-size: 28px; }
        p { margin: 0 0 20px; line-height: 1.6; color: #cbd5e1; }
        a { color: #7dd3fc; text-decoration: none; }
    </style>
</head>
<body>
    <main>
        <h1>Share link не найдена</h1>
        <p>Короткая ссылка не существует, уже была удалена или введена с ошибкой. Запроси новую ссылку в админке.</p>
        <a href="/">Открыть главную страницу</a>
    </main>
</body>
</html>`)
}

function resolveRequestOrigin(request: Request): string | null {
    const forwardedProto = pickForwardedValue(request.header('x-forwarded-proto'))
    const forwardedHost = pickForwardedValue(request.header('x-forwarded-host'))
    const host = forwardedHost ?? request.header('host')?.trim() ?? null
    const protocol = forwardedProto ?? request.protocol ?? 'http'

    if (!host) {
        return null
    }

    return `${protocol}://${host}`
}

function pickForwardedValue(value: string | undefined): string | null {
    if (!value) {
        return null
    }

    const normalizedValue = value.split(',')[0]?.trim()
    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null
}