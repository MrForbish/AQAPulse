#!/usr/bin/env node

const path = require('node:path')
const { spawnSync } = require('node:child_process')

const [, , command = '--help', ...restArgs] = process.argv

const commandMap = {
    'upload-report': '../dist/backend/upload-report.js',
    upload: '../dist/backend/upload-report.js',
    'merge-reports': '../dist/backend/merge-reports.js',
    merge: '../dist/backend/merge-reports.js',
    'generate-source-facts': '../dist/backend/generate-source-facts.js',
    'source-facts': '../dist/backend/generate-source-facts.js',
}

if (command === '--help' || command === '-h') {
    printHelp()
} else if (!commandMap[command]) {
    console.error(`Неизвестная команда: ${command}`)
    printHelp()
    process.exitCode = 1
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
    console.log('AQA Pulse CLI')
    console.log('')
    console.log('Использование:')
    console.log('  aqa-pulse upload-report [--report <path>] [--generate-source-facts] [--repo-root <path>]')
    console.log('  aqa-pulse merge-reports --project-kind ui|api --output <path> [--allow-missing] <input...>')
    console.log('  aqa-pulse generate-source-facts [--report <path>] [--out <path>] [--repo-root <path>]')
    console.log('')
    console.log('Короткие алиасы:')
    console.log('  aqa-pulse upload')
    console.log('  aqa-pulse merge')
    console.log('  aqa-pulse source-facts')
}
