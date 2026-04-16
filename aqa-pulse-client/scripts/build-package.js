const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const distRoot = path.resolve(packageRoot, 'dist')
const declarationFiles = [
    'api-store.d.ts',
    'dashboard-utils.d.ts',
    'history-utils.d.ts',
    path.join('backend', 'storage.d.ts'),
]

console.log('Публичный пакет aqa-pulse-client собран.')
console.log(`Папка пакета: ${distRoot}`)

for (const relativePath of declarationFiles) {
    const sourcePath = path.resolve(packageRoot, 'src', relativePath)
    const targetPath = path.resolve(distRoot, relativePath)

    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Не найден declaration source: ${sourcePath}`)
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(sourcePath, targetPath)
}

