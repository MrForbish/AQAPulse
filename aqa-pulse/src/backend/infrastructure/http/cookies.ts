/**
 * Назначение файла: минимальные HTTP cookie helpers для backend auth и session flows.
 */
import type { Request } from 'express'

export function readCookieValue(request: Request, name: string): string | null {
    const cookieHeader = request.header('cookie')

    if (!cookieHeader) {
        return null
    }

    const cookiePart = cookieHeader
        .split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${name}=`))

    if (!cookiePart) {
        return null
    }

    return decodeURIComponent(cookiePart.slice(name.length + 1))
}