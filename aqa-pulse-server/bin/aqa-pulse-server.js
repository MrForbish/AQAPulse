#!/usr/bin/env node

const path = require('node:path')
const { spawnSync } = require('node:child_process')

const [, , command = 'start', ...restArgs] = process.argv

const commandMap = {
    start: '../dist/server.js',
    init: '../dist/backend/init-self-hosted.js',
    'bootstrap-workspace': '../dist/backend/bootstrap-workspace.js',
    'bootstrap-demo': '../dist/backend/bootstrap-demo.js',
    'sqlite-migrate': '../dist/backend/sqlite-migrate.js',
    'sqlite-backup': '../dist/backend/sqlite-backup.js',
    'generate-source-facts': '../dist/backend/generate-source-facts.js',
    'merge-reports': '../dist/backend/merge-reports.js',
    'upload-report': '../dist/backend/upload-report.js',
    'upload-from-config': '../dist/backend/upload-from-config.js',
}

if (command === '--help' || command === '-h') {
    printHelp()
} else if (!commandMap[command]) {
    console.error(`Неизвестная команда: ${command}`)
    printHelp()
    process.exitCode = 1
} else if (restArgs.includes('--help') || restArgs.includes('-h')) {
    printCommandHelp(command)
} else {
    const entryFile = path.resolve(__dirname, commandMap[command])
    const result = spawnSync(process.execPath, [entryFile, ...restArgs], {
        stdio: 'inherit',
        env: process.env,
    })

    if (result.error) {
        throw result.error
    }

    process.exit(result.status ?? 1)
}

function printHelp() {
    console.log('Использование: aqa-pulse-server <command> [options]')
    console.log('')
    console.log('Команды:')
    console.log('  aqa-pulse-server start')
    console.log('  aqa-pulse-server init')
    console.log('  aqa-pulse-server bootstrap-workspace --name "<workspace name>" [--slug <slug>] [--base-url <url>] [--skip-user] [--json]')
    console.log('  aqa-pulse-server bootstrap-demo')
    console.log('  aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]')
    console.log('  aqa-pulse-server sqlite-backup [backupDirectory]')
    console.log('  aqa-pulse-server generate-source-facts [--report <path>] [--out <path>] [--repo-root <path>] [--json]')
    console.log('  aqa-pulse-server merge-reports [--project-kind ui|api] --output <path> [--allow-missing] <input...>')
    console.log('  aqa-pulse-server upload-report [--report <path>] [--source-facts <path>] [--generate-source-facts] [--repo-root <path>]')
    console.log('  aqa-pulse-server upload-from-config [--config .aqa-pulse.yml] [--dry-run] [--json]')
    console.log('')
    console.log('Подсказка: AQA_PULSE_DATA_ROOT и AQA_PULSE_ADMIN_TOKEN задаются через env.')
}

function printCommandHelp(commandName) {
    if (commandName === 'start') {
        console.log('aqa-pulse-server start')
        console.log('Поднимает self-hosted AQA Pulse server с env-конфигом.')
        return
    }

    if (commandName === 'init') {
        console.log('aqa-pulse-server init')
        console.log('Создает data root, workspaces, registry и runtime storage директории.')
        return
    }

    if (commandName === 'bootstrap-workspace') {
        console.log('aqa-pulse-server bootstrap-workspace --name "<workspace name>" [--slug <slug>] [--base-url <url>] [--skip-user] [--json]')
        console.log('Создает workspace, ingestion key и при необходимости viewer token.')
        return
    }

    if (commandName === 'bootstrap-demo') {
        console.log('aqa-pulse-server bootstrap-demo')
        console.log('Создает demo workspace и ingest sample report в текущий data root.')
        return
    }

    if (commandName === 'sqlite-migrate') {
        console.log('aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]')
        console.log('Мигрирует file storage data root в SQLite базу.')
        return
    }

    if (commandName === 'sqlite-backup') {
        console.log('aqa-pulse-server sqlite-backup [backupDirectory]')
        console.log('Создает timestamped backup текущей SQLite базы.')
        return
    }

    if (commandName === 'generate-source-facts') {
        console.log('aqa-pulse-server generate-source-facts [--report <path>] [--out <path>] [--repo-root <path>] [--json]')
        console.log('Анализирует test source по report.tests[*].location.file и сохраняет source facts.')
        return
    }

    if (commandName === 'merge-reports') {
        console.log('aqa-pulse-server merge-reports [--project-kind ui|api] --output <path> [--allow-missing] <input...>')
        console.log('Объединяет несколько Playwright dashboard JSON reports одного типа проекта.')
        return
    }

    if (commandName === 'upload-report') {
        console.log('aqa-pulse-server upload-report [--report <path>] [--source-facts <path>] [--generate-source-facts] [--repo-root <path>]')
        console.log('Загружает report в backend ingestion endpoint.')
        return
    }

    if (commandName === 'upload-from-config') {
        console.log('aqa-pulse-server upload-from-config [--config .aqa-pulse.yml] [--dry-run] [--json]')
        console.log('Читает .aqa-pulse.yml, при необходимости merge-ит reports и загружает итоговый report.')
    }
}
