import * as path from 'node:path'
import type { WorkspacePaths } from './contracts'

const DEFAULT_DEV_DATA_DIR = 'dev-data'
const DEFAULT_WORKSPACES_DIR = 'workspaces'

export function resolveWorkspaceDataRoot(dataRoot: string | undefined = process.env.AQA_PULSE_DATA_ROOT): string {
    const normalizedDataRoot = typeof dataRoot === 'string' && dataRoot.trim().length > 0 ? dataRoot.trim() : null
    return normalizedDataRoot ? path.resolve(normalizedDataRoot) : getDevDataRoot()
}

export function getDevDataRoot(basePath = process.cwd()): string {
    return path.resolve(basePath, DEFAULT_DEV_DATA_DIR)
}

export function getWorkspaceRegistryPath(basePath = process.cwd()): string {
    return path.join(getDevDataRoot(basePath), 'registry.json')
}

export function getWorkspaceRegistryPathFromDataRoot(dataRoot = resolveWorkspaceDataRoot()): string {
    return path.join(dataRoot, 'registry.json')
}

export function getWorkspacePaths(slug: string, basePath = process.cwd()): WorkspacePaths {
    const rootPath = path.join(getDevDataRoot(basePath), DEFAULT_WORKSPACES_DIR, slug)
    const distPath = path.join(rootPath, 'dist')

    return buildWorkspacePaths(rootPath, distPath)
}

export function getWorkspacePathsFromDataRoot(slug: string, dataRoot = resolveWorkspaceDataRoot()): WorkspacePaths {
    const rootPath = path.join(dataRoot, DEFAULT_WORKSPACES_DIR, slug)
    const distPath = path.join(rootPath, 'dist')

    return buildWorkspacePaths(rootPath, distPath)
}

function buildWorkspacePaths(rootPath: string, distPath: string): WorkspacePaths {
    return {
        rootPath,
        distPath,
        summaryPath: path.join(distPath, 'dashboard-data.json'),
        historyPath: path.join(distPath, 'history.json'),
        archiveRootPath: path.join(rootPath, 'history'),
        rawReportsPath: path.join(rootPath, 'raw-reports'),
        artifactsPath: path.join(rootPath, 'artifacts'),
    }
}

