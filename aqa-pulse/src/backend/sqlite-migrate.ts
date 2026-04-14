import * as fs from 'node:fs'
import * as path from 'node:path'
import { resolveSaasAppConfig } from './config'
import { FileSystemBackendStorage, SqliteBackendStorage } from './storage'

const config = resolveSaasAppConfig()
const sourceDataRoot = path.resolve(process.argv[2] ?? process.env.AQA_PULSE_MIGRATION_SOURCE_DATA_ROOT ?? config.dataRoot)
const targetSqlitePath = path.resolve(process.argv[3] ?? process.env.AQA_PULSE_SQLITE_PATH ?? path.join(config.dataRoot, 'aqa-pulse.sqlite'))

try {
    if (!fs.existsSync(sourceDataRoot)) {
        throw new Error(`Source data root не найден: ${sourceDataRoot}`)
    }

    fs.mkdirSync(path.dirname(targetSqlitePath), { recursive: true })

    const sourceStorage = new FileSystemBackendStorage(sourceDataRoot)
    const targetStorage = new SqliteBackendStorage(targetSqlitePath)
    const registrySnapshot = sourceStorage.registry.readRegistry()

    targetStorage.registry.writeRegistry(registrySnapshot)

    let migratedWorkspaceCount = 0
    let archivedRunCount = 0

    for (const workspace of registrySnapshot.workspaces) {
        const sourceWorkspaceStorage = sourceStorage.getWorkspaceStorage(workspace.slug)
        const targetWorkspaceStorage = targetStorage.getWorkspaceStorage(workspace.slug)

        try {
            targetWorkspaceStorage.writeSummary(sourceWorkspaceStorage.readSummary())
        } catch {
            // summary может отсутствовать у пустого workspace — это допустимо
        }

        const history = sourceWorkspaceStorage.readHistory()
        targetWorkspaceStorage.writeHistory(history)

        for (const run of history.runs) {
            const archivedDirectory = sourceWorkspaceStorage.findArchivedRunDirectory(run.id)

            if (!archivedDirectory) {
                continue
            }

            const archivedRun = sourceWorkspaceStorage.readArchivedRunRecord(archivedDirectory)
            targetWorkspaceStorage.archiveRun(archivedRun.data, run)
            archivedRunCount += 1
        }

        migratedWorkspaceCount += 1
    }

    console.log('Миграция file storage → SQLite завершена.')
    console.log(`Source data root: ${sourceDataRoot}`)
    console.log(`Target SQLite path: ${targetSqlitePath}`)
    console.log(`Workspaces migrated: ${migratedWorkspaceCount}`)
    console.log(`Archived runs migrated: ${archivedRunCount}`)
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка миграции в SQLite: ${errorMessage}`)
    process.exitCode = 1
}

