import * as fs from 'node:fs'
import * as path from 'node:path'
import { readDashboardSummary, writeTextFile } from './dashboard-utils'
import { renderDashboardHtml } from './render-dashboard'

const inputPath = path.resolve(process.cwd(), process.argv[2] ?? './dist/dashboard-data.json')
const outputPath = path.resolve(process.cwd(), process.argv[3] ?? './dist/index.html')
const chartSourcePath = path.resolve(process.cwd(), './node_modules/chart.js/dist/chart.umd.js')
const chartOutputPath = path.resolve(path.dirname(outputPath), './assets/chart.umd.js')

try {
	const summary = readDashboardSummary(inputPath)
	const html = renderDashboardHtml(summary)

	fs.mkdirSync(path.dirname(chartOutputPath), { recursive: true })
	fs.copyFileSync(chartSourcePath, chartOutputPath)
	writeTextFile(outputPath, html)

	console.log('HTML-дашборд собран.')
	console.log(`Источник: ${inputPath}`)
	console.log(`HTML-файл: ${outputPath}`)
	console.log(`Chart.js asset: ${chartOutputPath}`)
} catch (error) {
	const errorMessage = error instanceof Error ? error.message : String(error)
	console.error(`Ошибка генерации HTML-дашборда: ${errorMessage}`)
	process.exitCode = 1
}



