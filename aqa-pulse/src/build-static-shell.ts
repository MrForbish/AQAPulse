/**
 * Назначение: собирает React static shell и сопутствующие offline-данные для standalone dashboard/test-history режима.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ApiStore, type TestHistoryResponse } from './api-store'
import { type FileSystemDashboardReadStorage, FileSystemDashboardReadStorage as DashboardReadStorage } from './backend/storage'
import { readDashboardSummary, writeTextFile } from './dashboard-utils'
import { injectFrontendBootstrap } from './frontend-bootstrap'

const inputPath = path.resolve(process.cwd(), process.argv[2] ?? './dist/dashboard-data.json')
const outputPath = path.resolve(process.cwd(), process.argv[3] ?? './dist/index.html')
const frontendTemplatePath = path.resolve(process.cwd(), './dist/web/index.html')
const frontendSourceDirectoryPath = path.resolve(process.cwd(), './dist/web')
const historyPath = path.resolve(process.cwd(), './dist/history.json')
const archiveRootPath = path.resolve(process.cwd(), './history')
const staticFrontendDirectoryPath = path.resolve(path.dirname(outputPath), './static-web')
const staticDataDirectoryPath = path.resolve(path.dirname(outputPath), './static-data')
const staticTestHistoryIndexPath = path.resolve(staticDataDirectoryPath, './test-history.json')

try {
	const summary = readDashboardSummary(inputPath)
	const testHistoryIndex = buildStaticTestHistoryIndex()
	prepareStaticFrontendAssets(frontendSourceDirectoryPath, staticFrontendDirectoryPath)
	const htmlTemplate = rewriteStaticFrontendTemplate(fs.readFileSync(frontendTemplatePath, 'utf8'))
	const html = injectFrontendBootstrap(htmlTemplate, {
		route: { kind: 'static-dashboard', workspaceSlug: null },
		initialRequestUrl: '/',
		initialDashboardSummary: summary,
		initialTestHistoryPayload: null,
		initialAdminWorkspaces: null,
		initialSessionStatus: { scope: 'public', authenticated: true, authRequired: false, workspaceSlug: null },
	})

	fs.mkdirSync(staticDataDirectoryPath, { recursive: true })
	fs.writeFileSync(staticTestHistoryIndexPath, `${JSON.stringify(testHistoryIndex, null, 2)}\n`, 'utf8')
	writeTextFile(outputPath, html)

	console.log('React static shell собран.')
	console.log(`Источник: ${inputPath}`)
	console.log(`HTML shell: ${outputPath}`)
	console.log(`Frontend template: ${frontendTemplatePath}`)
	console.log(`Static frontend assets: ${staticFrontendDirectoryPath}`)
	console.log(`Static test history index: ${staticTestHistoryIndexPath}`)
} catch (error) {
	const errorMessage = error instanceof Error ? error.message : String(error)
	console.error(`Ошибка генерации React static shell: ${errorMessage}`)
	process.exitCode = 1
}

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

/**
 * Строит индекс всех доступных test-history payload, чтобы static mode мог открывать deep links без серверного API.
 */
function buildStaticTestHistoryIndex(): StaticTestHistoryIndex {
	const storage = new DashboardReadStorage({
		summaryPath: inputPath,
		historyPath,
		archiveRootPath,
	})
	const store = new ApiStore({
		summaryPath: inputPath,
		historyPath,
		archiveRootPath,
	})
	const candidates = collectStaticTestHistoryCandidates(storage)
	const entries: StaticTestHistoryIndexEntry[] = []

	for (const candidate of candidates) {
		appendStaticHistoryEntry(entries, store, candidate, null)

		for (const branch of candidate.branches) {
			appendStaticHistoryEntry(entries, store, candidate, branch)
		}
	}

	return {
		generatedAt: new Date().toISOString(),
		entries,
	}
}

/**
 * Проходит по архивным прогонам и собирает уникальные test/project/file candidates, из которых потом строится offline index.
 */
function collectStaticTestHistoryCandidates(storage: FileSystemDashboardReadStorage): Array<{
	title: string
	project: string
	file: string
	branches: string[]
}> {
	const history = storage.readHistory()
	const candidateMap = new Map<string, {
		title: string
		project: string
		file: string
		branches: Set<string>
	}>()

	for (const run of history.runs) {
		const archivedDirectory = storage.findArchivedRunDirectory(run.id)

		if (!archivedDirectory) {
			continue
		}

		const archivedRun = storage.readArchivedRunRecord(archivedDirectory)

		for (const test of archivedRun.data.tests ?? []) {
			const title = normalizeStaticText(test.title)
			const project = normalizeStaticText(test.project)
			const file = normalizeStaticText(test.location?.file)

			if (!title || !project || !file) {
				continue
			}

			const key = `${title}\u0000${project}\u0000${file}`
			const existingCandidate = candidateMap.get(key) ?? {
				title,
				project,
				file,
				branches: new Set<string>(),
			}

			if (run.branch) {
				existingCandidate.branches.add(run.branch)
			}

			candidateMap.set(key, existingCandidate)
		}
	}

	return [...candidateMap.values()]
		.map((candidate) => ({
			...candidate,
			branches: [...candidate.branches].sort(),
		}))
		.sort((left, right) => {
			const titleOrder = left.title.localeCompare(right.title)

			if (titleOrder !== 0) {
				return titleOrder
			}

			const projectOrder = left.project.localeCompare(right.project)

			if (projectOrder !== 0) {
				return projectOrder
			}

			return left.file.localeCompare(right.file)
		})
}

/**
 * Кладёт в индекс только однозначно разрешённые payload: conflict-ответы в static index не сохраняются, чтобы не раздувать артефакт неоднозначными дубликатами.
 */
function appendStaticHistoryEntry(
	entries: StaticTestHistoryIndexEntry[],
	store: ApiStore,
	candidate: { title: string; project: string; file: string },
	branch: string | null,
): void {
	const payload = store.getTestHistory(candidate.title, {
		branch: branch ?? undefined,
		project: candidate.project,
		file: candidate.file,
	})

	if (!payload || 'candidates' in payload) {
		return
	}

	entries.push({
		title: candidate.title,
		project: candidate.project,
		file: candidate.file,
		branch,
		payload,
	})
}

function normalizeStaticText(value: string | undefined): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * Готовит отдельную static-web копию Vite bundle и переписывает абсолютные self-hosted asset URLs в относительные standalone-пути.
 */
function prepareStaticFrontendAssets(sourceDirectoryPath: string, targetDirectoryPath: string): void {
	fs.rmSync(targetDirectoryPath, { recursive: true, force: true })
	fs.cpSync(sourceDirectoryPath, targetDirectoryPath, { recursive: true })
	rewriteStaticFrontendAssetDirectory(targetDirectoryPath)
}

function rewriteStaticFrontendAssetDirectory(directoryPath: string): void {
	for (const entryName of fs.readdirSync(directoryPath)) {
		const entryPath = path.join(directoryPath, entryName)
		const entryStats = fs.statSync(entryPath)

		if (entryStats.isDirectory()) {
			rewriteStaticFrontendAssetDirectory(entryPath)
			continue
		}

		if (!isStaticFrontendTextAsset(entryPath)) {
			continue
		}

		const fileContents = fs.readFileSync(entryPath, 'utf8')
		const rewrittenContents = rewriteStaticFrontendAssetContent(entryPath, fileContents)

		if (rewrittenContents !== fileContents) {
			fs.writeFileSync(entryPath, rewrittenContents, 'utf8')
		}
	}
}

function isStaticFrontendTextAsset(filePath: string): boolean {
	return filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')
}

function rewriteStaticFrontendAssetContent(filePath: string, fileContents: string): string {
	if (filePath.endsWith('.html')) {
		return fileContents.split('/ui-assets/').join('./static-web/')
	}

	if (filePath.endsWith('.js')) {
		return fileContents.split('/ui-assets/').join('./static-web/')
	}

	return fileContents
}

function rewriteStaticFrontendTemplate(templateHtml: string): string {
	return templateHtml.split('/ui-assets/').join('./static-web/')
}