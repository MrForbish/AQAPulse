import * as fs from 'node:fs'
import * as path from 'node:path'
import { readDashboardSummary, writeTextFile } from './dashboard-utils'
import { injectFrontendBootstrap } from './frontend-bootstrap'

const inputPath = path.resolve(process.cwd(), process.argv[2] ?? './dist/dashboard-data.json')
const outputPath = path.resolve(process.cwd(), process.argv[3] ?? './dist/index.html')
const frontendTemplatePath = path.resolve(process.cwd(), './dist/web/index.html')

try {
	const summary = readDashboardSummary(inputPath)
	const htmlTemplate = fs.readFileSync(frontendTemplatePath, 'utf8')
	const html = injectFrontendBootstrap(htmlTemplate, {
		route: { kind: 'static-dashboard', workspaceSlug: null },
		initialRequestUrl: '/static/index.html',
		initialDashboardSummary: summary,
		initialTestHistoryPayload: null,
	})

	writeTextFile(outputPath, html)

	console.log('React dashboard shell собран.')
	console.log(`Источник: ${inputPath}`)
	console.log(`HTML shell: ${outputPath}`)
	console.log(`Frontend template: ${frontendTemplatePath}`)
} catch (error) {
	const errorMessage = error instanceof Error ? error.message : String(error)
	console.error(`Ошибка генерации React dashboard shell: ${errorMessage}`)
	process.exitCode = 1
}



