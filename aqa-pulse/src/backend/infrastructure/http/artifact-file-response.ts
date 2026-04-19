import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Response } from 'express'

export function sendArtifactFile(response: Response, artifactsRootPath: string, runId: string, requestedPath: string | undefined): void {
    if (!requestedPath) {
        response.status(400).json({ error: 'Нужно передать query-параметр path.' })
        return
    }

    const normalizedRunDirectory = normalizeRunDirectory(runId)
    const normalizedRequestedPath = requestedPath.replace(/\\/g, '/').replace(/^\/+/, '')

    if (!normalizedRequestedPath.startsWith(`${normalizedRunDirectory}/`) || normalizedRequestedPath.includes('..')) {
        response.status(400).json({ error: 'Некорректный путь к артефакту.' })
        return
    }

    const resolvedRoot = path.resolve(artifactsRootPath)
    const resolvedPath = path.resolve(resolvedRoot, normalizedRequestedPath)

    if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`) && resolvedPath !== resolvedRoot) {
        response.status(400).json({ error: 'Некорректный путь к артефакту.' })
        return
    }

    if (!fs.existsSync(resolvedPath)) {
        response.status(404).json({ error: 'Артефакт не найден.' })
        return
    }

    response.sendFile(resolvedPath)
}

function normalizeRunDirectory(runId: string): string {
    return runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'run'
}