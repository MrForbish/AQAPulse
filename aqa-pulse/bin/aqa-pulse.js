#!/usr/bin/env node

const path = require('node:path')

const [, , command, ...restArgs] = process.argv

const commandMap = {
    parse: '../dist-ts/parser.js',
    build: '../dist-ts/build-dashboard.js',
    api: '../dist-ts/server.js',
}

if (!command || command === '--help' || command === '-h') {
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
    console.log('Использование: aqa-pulse <parse|build|api> [...args]')
    console.log('')
    console.log('Команды:')
    console.log('  aqa-pulse parse <input.json> <dashboard-data.json> [history.json] [archiveDir] [--branch <name>] [--commit <sha>] [--author <name>]')
    console.log('  aqa-pulse build <dashboard-data.json> <index.html>')
    console.log('  aqa-pulse api')
    console.log('')
    console.log('Подсказка: aqa-pulse <command> --help')
}

function printCommandHelp(commandName) {
    if (commandName === 'parse') {
        console.log('aqa-pulse parse <input.json> <dashboard-data.json> [history.json] [archiveDir] [--branch <name>] [--commit <sha>] [--author <name>]')
        return
    }

    if (commandName === 'build') {
        console.log('aqa-pulse build <dashboard-data.json> <index.html>')
        return
    }

    if (commandName === 'api') {
        console.log('aqa-pulse api')
        console.log('Использует PORT, AQA_PULSE_SUMMARY_PATH, AQA_PULSE_HISTORY_PATH и AQA_PULSE_ARCHIVE_PATH при необходимости.')
    }
}

