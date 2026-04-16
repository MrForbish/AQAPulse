#!/usr/bin/env node

const path = require('node:path')

const [, , command = 'start', ...restArgs] = process.argv

const commandMap = {
    start: '../dist/server.js',
    init: '../dist/backend/init-self-hosted.js',
    'bootstrap-workspace': '../dist/backend/bootstrap-workspace.js',
    'bootstrap-demo': '../dist/backend/bootstrap-demo.js',
    'sqlite-migrate': '../dist/backend/sqlite-migrate.js',
    'sqlite-backup': '../dist/backend/sqlite-backup.js',
    'upload-report': '../dist/backend/upload-report.js',
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
    process.argv = [process.argv[0], entryFile, ...restArgs]
    require(entryFile)
}

function printHelp() {
    console.log('Использование: aqa-pulse-server [start, init, bootstrap-workspace, bootstrap-demo, sqlite-migrate, sqlite-backup, upload-report]')
    console.log('')
    console.log('Команды:')
    console.log('  aqa-pulse-server start')
    console.log('  aqa-pulse-server init')
    console.log('  aqa-pulse-server bootstrap-workspace --name "<workspace name>" [--slug <slug>] [--base-url <url>] [--skip-user] [--json]')
    console.log('  aqa-pulse-server bootstrap-demo')
    console.log('  aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]')
    console.log('  aqa-pulse-server sqlite-backup [backupDirectory]')
    console.log('  aqa-pulse-server upload-report [--report <path>] [--base-url <url>] [--workspace-slug <slug>] [--workspace-api-key <key>]')
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
        console.log('Создаёт data root, workspaces/, registry.json и legacy директории.')
        return
    }

    if (commandName === 'bootstrap-demo') {
        console.log('aqa-pulse-server bootstrap-demo')
        console.log('Создаёт demo workspace и ingest sample report в текущий data root.')
        return
    }

    if (commandName === 'bootstrap-workspace') {
        console.log('aqa-pulse-server bootstrap-workspace --name "<workspace name>" [--slug <slug>] [--base-url <url>] [--skip-user] [--json]')
        console.log('Создаёт workspace, ingestion key и при необходимости viewer token, а затем печатает готовые переменные для GitLab CI.')
        return
    }

    if (commandName === 'sqlite-migrate') {
        console.log('aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]')
        console.log('Мигрирует file storage data root в SQLite базу для self-hosted режима.')
        return
    }

    if (commandName === 'sqlite-backup') {
        console.log('aqa-pulse-server sqlite-backup [backupDirectory]')
        console.log('Создаёт timestamped backup текущей SQLite базы в backup directory.')
        return
    }

    if (commandName === 'upload-report') {
        console.log('aqa-pulse-server upload-report [--report <path>] [--base-url <url>] [--workspace-slug <slug>] [--workspace-api-key <key>]')
        console.log('Делает exchange workspace API key -> ingestion JWT, подготавливает local Playwright attachments и отправляет report в backend ingestion endpoint.')
    }
}

