/**
 * Назначение: проверяет standalone static export, включая офлайн-резолв test history из static-data.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadStaticTestHistoryPayload } from './frontend/shared/static-test-history'

interface StaticTestHistoryIndex {
    generatedAt: string
    entries: StaticTestHistoryIndexEntry[]
}

interface StaticTestHistoryIndexEntry {
    title: string
    project: string
    file: string
    branch: string | null
    payload: {
        test: {
            title: string
        }
    }
}

const distRoot = path.resolve(__dirname, '..', 'dist')
const staticWebDirectoryPath = path.resolve(distRoot, 'static-web')
const staticAssetDirectoryPath = path.resolve(staticWebDirectoryPath, 'assets')
const staticDataIndexPath = path.resolve(distRoot, 'static-data', 'test-history.json')
const indexHtmlPath = path.resolve(distRoot, 'index.html')

void main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})

async function main(): Promise<void> {
    assertFileExists(indexHtmlPath)
    assertDirectoryExists(staticWebDirectoryPath)
    assertDirectoryExists(staticAssetDirectoryPath)
    assertFileExists(staticDataIndexPath)

    const staticTestHistoryIndex = JSON.parse(fs.readFileSync(staticDataIndexPath, 'utf8')) as StaticTestHistoryIndex
    assert(staticTestHistoryIndex.entries.length > 0, `Static test history index must contain at least one entry: ${staticDataIndexPath}`)

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

    await validateOfflineStaticHistoryResolution(staticTestHistoryIndex)

    console.log('Static export smoke passed.')
    console.log(`Checked shell: ${indexHtmlPath}`)
    console.log(`Checked standalone assets: ${staticAssetDirectoryPath}`)
    console.log(`Checked test history index: ${staticDataIndexPath}`)
}

/**
 * Проверяет тот же loader, который использует static mode во frontend, чтобы deep-link на test history не зависел только от структуры файлов на диске.
 */
async function validateOfflineStaticHistoryResolution(index: StaticTestHistoryIndex): Promise<void> {
    const smokeIndex = buildSmokeStaticHistoryIndex(index)
    const concreteEntry = smokeIndex.entries.find((entry) => entry.title === '__static-concrete-test__')
    const previousFetch = globalThis.fetch
    const previousLocation = globalThis.location
    const requestedUrls: string[] = []

    assert(concreteEntry, 'Synthetic static history entry for smoke must be present.')

    try {
        setGlobalValue('fetch', (async (input: RequestInfo | URL): Promise<Response> => {
            const requestUrl = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url
            requestedUrls.push(requestUrl)

            if (requestUrl.endsWith('/static-data/test-history.json')) {
                return new Response(JSON.stringify(smokeIndex), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            return new Response('Not Found', { status: 404 })
        }) as typeof fetch)
        setGlobalValue('location', { href: pathToFileURL(indexHtmlPath).toString() } as Location)

        const resolvedPayload = await loadStaticTestHistoryPayload({
            title: concreteEntry.title,
            branch: concreteEntry.branch,
            project: concreteEntry.project,
            file: concreteEntry.file,
        })
        assert(resolvedPayload !== null && !('candidates' in resolvedPayload), 'Static history loader must resolve a concrete payload for an indexed entry.')
        assert(resolvedPayload.test.title === concreteEntry.title, 'Static history loader must return the payload for the requested test title.')

        const ambiguousPayload = await loadStaticTestHistoryPayload({
            title: '__static-ambiguous-test__',
        })
        assert(ambiguousPayload !== null && 'candidates' in ambiguousPayload, 'Static history loader must return conflict payload for ambiguous titles.')
        assert(ambiguousPayload.candidates.length === 2, 'Static history loader must deduplicate ambiguous candidates by project/file pair.')

        const missingPayload = await loadStaticTestHistoryPayload({
            title: '__missing-static-test__',
        })
        assert(missingPayload === null, 'Static history loader must return null for unknown tests.')
        assert(requestedUrls.some((url) => url.endsWith('/static-data/test-history.json')), 'Static history loader must request the static-data index file.')
    } finally {
        setGlobalValue('fetch', previousFetch)
        setGlobalValue('location', previousLocation)
    }
}

/**
 * Добавляет к реальному static index детерминированные записи для smoke, чтобы проверить и точный resolve, и conflict/dedup ветку без зависимости от конкретных fixture title.
 */
function buildSmokeStaticHistoryIndex(index: StaticTestHistoryIndex): StaticTestHistoryIndex {
    return {
        ...index,
        entries: [
            ...index.entries,
            {
                title: '__static-concrete-test__',
                branch: null,
                project: 'smoke-project',
                file: 'tests/smoke.spec.ts',
                payload: {
                    test: {
                        title: '__static-concrete-test__',
                    },
                },
            },
            {
                title: '__static-ambiguous-test__',
                branch: null,
                project: 'dup-project',
                file: 'tests/dup-a.spec.ts',
                payload: {
                    test: {
                        title: '__static-ambiguous-test__',
                    },
                },
            },
            {
                title: '__static-ambiguous-test__',
                branch: null,
                project: 'dup-project',
                file: 'tests/dup-a.spec.ts',
                payload: {
                    test: {
                        title: '__static-ambiguous-test__',
                    },
                },
            },
            {
                title: '__static-ambiguous-test__',
                branch: null,
                project: 'dup-project',
                file: 'tests/dup-b.spec.ts',
                payload: {
                    test: {
                        title: '__static-ambiguous-test__',
                    },
                },
            },
        ],
    }
}

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

function setGlobalValue<K extends keyof typeof globalThis>(key: K, value: (typeof globalThis)[K]): void {
    Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value,
    })
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}