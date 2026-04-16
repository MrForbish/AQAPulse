import fs from 'node:fs'
import path from 'node:path'

const distRoot = path.resolve(__dirname, '..', 'dist')
const staticWebDirectoryPath = path.resolve(distRoot, 'static-web')
const staticAssetDirectoryPath = path.resolve(staticWebDirectoryPath, 'assets')
const staticDataIndexPath = path.resolve(distRoot, 'static-data', 'test-history.json')
const indexHtmlPath = path.resolve(distRoot, 'index.html')

assertFileExists(indexHtmlPath)
assertDirectoryExists(staticWebDirectoryPath)
assertDirectoryExists(staticAssetDirectoryPath)
assertFileExists(staticDataIndexPath)

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8')
assert(indexHtml.includes('./static-web/assets/'), `Standalone shell must reference ./static-web/assets/* in ${indexHtmlPath}`)

const staticAssetFilePaths = collectFilePaths(staticAssetDirectoryPath)
assert(staticAssetFilePaths.length > 0, `No standalone frontend assets found in ${staticAssetDirectoryPath}`)

for (const filePath of staticAssetFilePaths) {
    if (!isTextAsset(filePath)) {
        continue
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    assert(!fileContents.includes('/ui-assets/'), `Standalone asset still contains /ui-assets/ reference: ${filePath}`)
}

const uiChunkPath = staticAssetFilePaths.find((filePath) => path.basename(filePath).startsWith('ui-') && filePath.endsWith('.js'))
assert(uiChunkPath, `Could not find standalone ui chunk in ${staticAssetDirectoryPath}`)

const uiChunkContents = fs.readFileSync(uiChunkPath, 'utf8')
assert(uiChunkContents.includes('./static-web/'), `Standalone ui chunk must resolve lazy assets via ./static-web/: ${uiChunkPath}`)

console.log('Static export smoke passed.')
console.log(`Checked shell: ${indexHtmlPath}`)
console.log(`Checked standalone assets: ${staticAssetDirectoryPath}`)
console.log(`Checked test history index: ${staticDataIndexPath}`)

function collectFilePaths(directoryPath: string): string[] {
    const result: string[] = []

    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
        const entryPath = path.resolve(directoryPath, entry.name)

        if (entry.isDirectory()) {
            result.push(...collectFilePaths(entryPath))
            continue
        }

        result.push(entryPath)
    }

    return result
}

function isTextAsset(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase()
    return extension === '.js' || extension === '.css' || extension === '.html' || extension === '.json' || extension === '.map'
}

function assertFileExists(filePath: string): void {
    assert(fs.existsSync(filePath), `Expected file to exist: ${filePath}`)
}

function assertDirectoryExists(directoryPath: string): void {
    assert(fs.existsSync(directoryPath), `Expected directory to exist: ${directoryPath}`)
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}