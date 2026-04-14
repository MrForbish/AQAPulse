import * as fs from 'node:fs'
import * as path from 'node:path'
import { resolveSaasAppConfig } from './config'

const config = resolveSaasAppConfig()
const sqlitePath = config.sqlitePath ?? path.join(config.dataRoot, 'aqa-pulse.sqlite')
const backupDirectory = path.resolve(process.argv[2] ?? process.env.AQA_PULSE_BACKUP_DIR ?? path.join(config.dataRoot, 'backups'))

try {
    if (!fs.existsSync(sqlitePath)) {
        throw new Error(`SQLite database не найдена: ${sqlitePath}`)
    }

    fs.mkdirSync(backupDirectory, { recursive: true })

    const backupFileName = `aqa-pulse-${formatTimestamp(new Date())}.sqlite`
    const backupPath = path.join(backupDirectory, backupFileName)

    fs.copyFileSync(sqlitePath, backupPath)

    console.log('SQLite backup готов.')
    console.log(`Source: ${sqlitePath}`)
    console.log(`Backup: ${backupPath}`)
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Ошибка создания SQLite backup: ${errorMessage}`)
    process.exitCode = 1
}

function formatTimestamp(value: Date): string {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const hours = String(value.getHours()).padStart(2, '0')
    const minutes = String(value.getMinutes()).padStart(2, '0')
    const seconds = String(value.getSeconds()).padStart(2, '0')

    return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

