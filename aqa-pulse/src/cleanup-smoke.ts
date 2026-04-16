import * as fs from 'node:fs'
import * as path from 'node:path'

const rootPath = path.resolve(__dirname, '..')

for (const relativePath of ['dist', 'history']) {
    removeDirectoryIfPossible(path.resolve(rootPath, relativePath))
}

function removeDirectoryIfPossible(directoryPath: string): void {
    if (!fs.existsSync(directoryPath)) {
        return
    }

    try {
        fs.rmSync(directoryPath, { recursive: true, force: true })
    } catch (error) {
        if (isBusyDirectoryError(error)) {
            console.warn(`[smoke cleanup] Skip busy directory: ${directoryPath}`)
            return
        }

        throw error
    }
}

function isBusyDirectoryError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false
    }

    const code = 'code' in error ? String(error.code) : ''
    return code === 'EBUSY' || code === 'EPERM'
}