import type { TestHistoryConflict, TestHistoryResponse } from '../../api-store'

interface StaticTestHistoryIndex {
    generatedAt: string
    entries: StaticTestHistoryIndexEntry[]
}

interface StaticTestHistoryIndexEntry {
    title: string
    project: string
    file: string
    branch: string | null
    payload: TestHistoryResponse
}

let staticTestHistoryIndexPromise: Promise<StaticTestHistoryIndex> | null = null

export async function loadStaticTestHistoryPayload(options: {
    title: string
    branch?: string | null
    project?: string | null
    file?: string | null
}): Promise<TestHistoryResponse | TestHistoryConflict | null> {
    const index = await loadStaticTestHistoryIndex()
    const requestedBranch = normalizeValue(options.branch)
    const requestedProject = normalizeValue(options.project)
    const requestedFile = normalizeValue(options.file)

    let matches = index.entries.filter((entry) => entry.title === options.title)

    matches = matches.filter((entry) => entry.branch === requestedBranch)

    if (requestedProject) {
        matches = matches.filter((entry) => entry.project === requestedProject)
    }

    if (requestedFile) {
        matches = matches.filter((entry) => entry.file === requestedFile)
    }

    if (matches.length === 0) {
        return null
    }

    if (matches.length > 1) {
        return {
            message: 'Найдено несколько тестов с одинаковым title. Уточни file и/или project через query params.',
            candidates: deduplicateCandidates(matches),
        }
    }

    return matches[0].payload
}

function loadStaticTestHistoryIndex(): Promise<StaticTestHistoryIndex> {
    if (!staticTestHistoryIndexPromise) {
        staticTestHistoryIndexPromise = fetch(resolveStaticTestHistoryIndexUrl(), {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
            },
        }).then(async (response) => {
            if (!response.ok) {
                throw new Error(`Не удалось загрузить static test history index (HTTP ${response.status}).`)
            }

            return response.json() as Promise<StaticTestHistoryIndex>
        })
    }

    return staticTestHistoryIndexPromise
}

function resolveStaticTestHistoryIndexUrl(): string {
    const baseHref = readBrowserLocationHref() ?? '/'

    return new URL('./static-data/test-history.json', baseHref).toString()
}

function readBrowserLocationHref(): string | null {
    const maybeLocation = (globalThis as { location?: { href?: unknown } }).location

    if (!maybeLocation || typeof maybeLocation.href !== 'string') {
        return null
    }

    return maybeLocation.href.split('#')[0] ?? maybeLocation.href
}

function deduplicateCandidates(matches: StaticTestHistoryIndexEntry[]): Array<{ title: string; file: string; project: string }> {
    const candidateMap = new Map<string, { title: string; file: string; project: string }>()

    for (const match of matches) {
        const key = `${match.title}\u0000${match.project}\u0000${match.file}`

        if (!candidateMap.has(key)) {
            candidateMap.set(key, {
                title: match.title,
                project: match.project,
                file: match.file,
            })
        }
    }

    return [...candidateMap.values()]
}

function normalizeValue(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}