import type { TestHistoryConflict, TestHistoryResponse } from './api-store'
import { METRIC_INFO_STYLES, renderMetricHeading } from './render-metric-info'
import { formatDate, formatDuration, formatPercent } from './shared/formatting'
import { ru } from './shared/i18n/ru'

const METRIC_DESCRIPTIONS = {
    totalRuns: 'Количество сохранённых прогонов, в которых найден именно этот тест с учётом текущих фильтров.',
    failedRuns: 'Количество прогонов, в которых тест завершился неуспешно: failed, timedout или interrupted.',
    flakyRuns: 'Количество прогонов, где тест был отмечен как flaky: падал на одной из попыток, но в итоге завершился успешно.',
    latestStatus: 'Финальный статус теста в самом свежем найденном прогоне.',
    passRate: 'Доля прогонов этого теста со статусом passed среди всех найденных запусков.',
    failRate: 'Доля прогонов этого теста с неуспешным результатом: failed, timedout или interrupted.',
    flakyScore: 'Сводная оценка нестабильности теста на шкале 0–100 с учётом fail rate, паттерна нестабильности и MTBF.',
    mtbf: 'Среднее время между нестабильными прогонами теста. Чем больше значение, тем реже тест становится нестабильным.',
    timeline: 'Хронологическая история прогонов теста с ключевыми метаданными, длительностью, повторами и ошибками.',
    archiveGaps: 'Список run id, для которых запись есть в history.json, но архив исходного data.json уже недоступен.',
    latestEvent: 'Самый свежий нестабильный эпизод для теста: последнее падение с текстом ошибки или последний flaky-прогон, если более свежей ошибки нет.',
    latestRecovery: 'Самый свежий стабильный прогон после нестабильной серии. Показывается только если после падения или flaky был зафиксирован чистый passed-run без flakiness.',
    previousUnstableEvents: 'Несколько предыдущих нестабильных эпизодов до самого свежего нестабильного прогона. Полезно для быстрого просмотра паттерна проблем без прокрутки всей таблицы.',
    currentStabilityStreak: 'Текущая серия подряд идущих стабильных прогонов от самого свежего запуска назад. Стабильным считается только passed-run без flakiness и без текста ошибки.',
    unstableStreakBeforeRecovery: 'Длина нестабильной серии непосредственно перед последним стабильным восстановлением. Помогает понять, какой по глубине был проблемный период до восстановления.',
} as const

const HISTORY_TEXT = ru.testHistory

interface HistoryPageFilters {
    branch?: string
    project?: string
    file?: string
}

interface HistoryPageOptions {
    basePath?: string
    apiBasePath?: string
}

export function renderTestHistoryHtml(
    payload: TestHistoryResponse | TestHistoryConflict | null,
    requestedTitle: string,
    filters: HistoryPageFilters = {},
    options: HistoryPageOptions = {},
): string {
    const normalizedFilters = {
        branch: normalizeOptionalFilter(filters.branch),
        project: normalizeOptionalFilter(filters.project),
        file: normalizeOptionalFilter(filters.file),
    }
    const normalizedBasePath = normalizeBasePath(options.basePath)
    const normalizedApiBasePath = normalizeBasePath(options.apiBasePath)

    if (!payload) {
        return renderStatePage({
            title: requestedTitle,
            heading: HISTORY_TEXT.statePages.notFound.heading,
            statusCode: '404',
            toneClass: 'status-failed',
            message: HISTORY_TEXT.statePages.notFound.message,
            filters: normalizedFilters,
            basePath: normalizedBasePath,
            apiBasePath: normalizedApiBasePath,
            extraContent: `<div class="muted">${escapeHtml(HISTORY_TEXT.statePages.notFound.extra)}</div>`,
        })
    }

    if ('candidates' in payload) {
        const candidatesHtml = payload.candidates.length > 0
            ? payload.candidates.map((candidate) => `
                <div class="candidate-item">
                    <div><a class="test-link" href="${escapeHtml(buildTestHistoryHref(candidate.title, {
                        branch: normalizedFilters.branch,
                        project: candidate.project,
                        file: candidate.file,
                    }, normalizedBasePath))}">${escapeHtml(candidate.title)}</a></div>
                    <div class="muted">${escapeHtml(formatTemplate(HISTORY_TEXT.candidatesMeta, {
                        project: candidate.project,
                        file: candidate.file,
                    }))}</div>
                </div>
            `).join('')
            : `<div class="muted">${escapeHtml(HISTORY_TEXT.statePages.conflict.candidatesEmpty)}</div>`

        return renderStatePage({
            title: requestedTitle,
            heading: HISTORY_TEXT.statePages.conflict.heading,
            statusCode: '409',
            toneClass: 'status-flaky',
            message: payload.message,
            filters: normalizedFilters,
            basePath: normalizedBasePath,
            apiBasePath: normalizedApiBasePath,
            extraContent: `<div class="candidate-list">${candidatesHtml}</div>`,
        })
    }

    const dashboardHref = buildDashboardHref(normalizedFilters, normalizedBasePath)
    const apiHref = buildApiTestHistoryHref(payload.test.title, {
        branch: normalizedFilters.branch,
        project: payload.test.project,
        file: payload.test.file,
    }, normalizedApiBasePath)
    const latestStatusClass = payload.latestRun ? getStatusClass(payload.latestRun.status, payload.latestRun.flaky) : 'status-unknown'
    const latestUnstableEventHtml = renderLatestUnstableEvent(payload.history)
    const previousUnstableEventsHtml = renderPreviousUnstableEvents(payload.history)
    const latestStableRecoveryHtml = renderLatestStableRecovery(payload.history)
    const currentStabilityStreakHtml = renderCurrentStabilityStreak(payload.history)
    const unstableStreakBeforeRecoveryHtml = renderUnstableStreakBeforeRecovery(payload.history)
    const attemptDiagnosticsHtml = renderAttemptDiagnostics(payload.history)
    const missingRunsHtml = payload.missingRuns.length > 0
        ? `<div class="notice-inline">${renderMetricHeading(HISTORY_TEXT.metrics.archiveGaps, METRIC_DESCRIPTIONS.archiveGaps, { className: 'inline-heading', tagName: 'div' })}<div class="mono">${escapeHtml(payload.missingRuns.join(', '))}</div></div>`
        : ''

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(payload.test.title)} — ${escapeHtml(HISTORY_TEXT.titleSuffix)}</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='42' fill='%232f81f7'/%3E%3C/svg%3E">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
        .page-shell { max-width: 1440px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
        .page-title { font-size: 30px; font-weight: 600; color: #ffffff; margin-bottom: 10px; }
        .subtle { color: #8b949e; font-size: 13px; }
        .meta-badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #21262d; color: #c9d1d9; font-size: 12px; margin-right: 8px; margin-top: 8px; }
        .page-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .page-link { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 16px; border-radius: 6px; border: 1px solid #30363d; text-decoration: none; }
        .page-link-primary { background: #2f81f7; color: #ffffff; }
        .page-link-secondary { background: #21262d; color: #c9d1d9; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
        .summary-card, .table-container, .notice-inline { background: #161b22; border: 1px solid #30363d; border-radius: 8px; }
        .summary-card { padding: 16px; }
        .summary-value { font-size: 28px; font-weight: 600; color: #ffffff; margin: 8px 0; }
        .summary-subtitle { color: #8b949e; font-size: 12px; }
        .event-card { padding: 16px; margin-bottom: 24px; }
        .event-card-error { border-color: rgba(248, 81, 73, 0.45); background: linear-gradient(180deg, rgba(248, 81, 73, 0.12) 0%, #161b22 100%); }
        .event-card-flaky { border-color: rgba(210, 153, 34, 0.45); background: linear-gradient(180deg, rgba(210, 153, 34, 0.12) 0%, #161b22 100%); }
        .event-card-recovery { border-color: rgba(63, 185, 80, 0.45); background: linear-gradient(180deg, rgba(63, 185, 80, 0.12) 0%, #161b22 100%); }
        .event-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
        .event-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .event-body { color: #c9d1d9; font-size: 13px; line-height: 1.5; }
        .event-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
        .event-link { color: #58a6ff; text-decoration: none; font-size: 12px; }
        .event-link:hover { text-decoration: underline; }
        .event-list { display: grid; gap: 10px; }
        .event-list-item { padding: 12px; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; }
        .event-list-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .event-list-description { color: #c9d1d9; font-size: 12px; line-height: 1.45; }
        .diagnostics-shell { display: grid; gap: 12px; margin-bottom: 24px; }
        .diagnostics-card { padding: 16px; }
        .diagnostics-card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .diagnostics-card-description { color: #8b949e; font-size: 12px; line-height: 1.5; margin-bottom: 14px; }
        .attempt-list { display: grid; gap: 10px; }
        .attempt-item { padding: 12px; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; }
        .attempt-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .attempt-title { font-size: 13px; font-weight: 600; color: #ffffff; }
        .attempt-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
        .attempt-section-title { color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin: 10px 0 6px; }
        .attempt-error { margin-top: 8px; }
        .step-list, .attachment-list { display: grid; gap: 8px; }
        .step-item, .attachment-item { padding: 10px 12px; border-radius: 8px; background: #161b22; border: 1px solid #21262d; }
        .step-item-header, .attachment-item-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
        .step-title, .attachment-title { color: #ffffff; font-size: 12px; font-weight: 500; }
        .attachment-link { color: #58a6ff; text-decoration: none; font-size: 12px; }
        .attachment-link:hover { text-decoration: underline; }
        ${METRIC_INFO_STYLES}
        .inline-heading { font-size: 13px; color: #ffffff; margin-bottom: 10px; }
        .notice-inline { padding: 14px 16px; margin-bottom: 24px; }
        .table-title { font-weight: 500; margin-bottom: 12px; color: #ffffff; font-size: 18px; }
        .table-container { padding: 8px; overflow-x: auto; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 16px; font-weight: 500; color: #8b949e; border-bottom: 1px solid #30363d; font-size: 13px; }
        td { padding: 12px 16px; border-bottom: 1px solid #21262d; font-size: 13px; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        .history-row:target td { background: rgba(47, 129, 247, 0.14); }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .status-failed { background: #da3633; color: #fff; }
        .status-flaky { background: #d29922; color: #000; }
        .status-passed { background: #1a7f37; color: #fff; }
        .status-skipped { background: #6e7681; color: #fff; }
        .status-unknown { background: #21262d; color: #fff; }
        .mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; color: #ff7b72; word-break: break-word; }
        .muted { color: #8b949e; font-size: 12px; }
        .test-link { color: #58a6ff; text-decoration: none; }
        .test-link:hover { text-decoration: underline; }
        .candidate-list { display: grid; gap: 12px; }
        .candidate-item { padding: 12px; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; }
        @media (max-width: 1100px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 768px) { .summary-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="page-shell">
        <div class="page-header">
            <div>
                <div class="subtle" style="margin-bottom: 12px;">${escapeHtml(HISTORY_TEXT.headerEyebrow)}</div>
                <div class="page-title">${escapeHtml(payload.test.title)}</div>
                <div class="subtle">${escapeHtml(HISTORY_TEXT.headerDescription)}</div>
                <div>
                    <span class="meta-badge">${escapeHtml(HISTORY_TEXT.filters.project)}: ${escapeHtml(payload.test.project)}</span>
                    <span class="meta-badge">${escapeHtml(HISTORY_TEXT.filters.file)}: ${escapeHtml(payload.test.file)}</span>
                    <span class="meta-badge">${escapeHtml(HISTORY_TEXT.filters.branch)}: ${escapeHtml(normalizedFilters.branch ?? HISTORY_TEXT.filters.all)}</span>
                </div>
            </div>
            <div class="page-actions">
                <a class="page-link page-link-secondary" href="${escapeHtml(dashboardHref)}">${escapeHtml(HISTORY_TEXT.backToDashboard)}</a>
                <a class="page-link page-link-primary" href="${escapeHtml(apiHref)}">${escapeHtml(HISTORY_TEXT.openJson)}</a>
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                ${renderMetricHeading(HISTORY_TEXT.metrics.totalRuns, METRIC_DESCRIPTIONS.totalRuns, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${payload.summary.totalRuns}</div>
                <div class="summary-subtitle">${escapeHtml(HISTORY_TEXT.subtitles.totalRuns)}</div>
            </div>
            <div class="summary-card">
                ${renderMetricHeading(HISTORY_TEXT.metrics.failedRuns, METRIC_DESCRIPTIONS.failedRuns, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${payload.summary.failedRuns}</div>
                <div class="summary-subtitle">${escapeHtml(HISTORY_TEXT.subtitles.failedRuns)}</div>
            </div>
            <div class="summary-card">
                ${renderMetricHeading(HISTORY_TEXT.metrics.flakyRuns, METRIC_DESCRIPTIONS.flakyRuns, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${payload.summary.flakyRuns}</div>
                <div class="summary-subtitle">${escapeHtml(HISTORY_TEXT.subtitles.flakyRuns)}</div>
            </div>
            <div class="summary-card">
                ${renderMetricHeading(HISTORY_TEXT.metrics.latestStatus, METRIC_DESCRIPTIONS.latestStatus, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value"><span class="status-badge ${latestStatusClass}">${escapeHtml(formatStatusLabel(payload.summary.latestStatus ?? 'unknown', payload.latestRun?.flaky ?? false))}</span></div>
                <div class="summary-subtitle">${escapeHtml(HISTORY_TEXT.subtitles.latestStatus)}</div>
            </div>
            <div class="summary-card">
                ${renderMetricHeading(HISTORY_TEXT.metrics.passRate, METRIC_DESCRIPTIONS.passRate, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${escapeHtml(formatPercent(payload.summary.passRate))}</div>
                <div class="summary-subtitle">${escapeHtml(HISTORY_TEXT.subtitles.passRate)}</div>
            </div>
            <div class="summary-card">
                ${renderMetricHeading(HISTORY_TEXT.metrics.failRate, METRIC_DESCRIPTIONS.failRate, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${escapeHtml(formatPercent(payload.summary.failRate))}</div>
                <div class="summary-subtitle">${escapeHtml(HISTORY_TEXT.subtitles.failRate)}</div>
            </div>
            <div class="summary-card">
                ${renderMetricHeading(HISTORY_TEXT.metrics.flakyScore, METRIC_DESCRIPTIONS.flakyScore, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${escapeHtml(formatNullableNumber(payload.summary.flakyScore))}</div>
                <div class="summary-subtitle">${escapeHtml(HISTORY_TEXT.subtitles.flakyScore)}</div>
            </div>
            <div class="summary-card">
                ${renderMetricHeading('MTBF', METRIC_DESCRIPTIONS.mtbf, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${escapeHtml(formatNullableDays(payload.summary.mtbfDays))}</div>
                <div class="summary-subtitle">${escapeHtml(HISTORY_TEXT.subtitles.mtbf)}</div>
            </div>
        </div>

        ${latestUnstableEventHtml}

        ${previousUnstableEventsHtml}

        ${latestStableRecoveryHtml}

        ${currentStabilityStreakHtml}

        ${unstableStreakBeforeRecoveryHtml}

        ${attemptDiagnosticsHtml}

        ${missingRunsHtml}

        ${renderMetricHeading(HISTORY_TEXT.metrics.timeline, METRIC_DESCRIPTIONS.timeline, { className: 'table-title', tagName: 'div' })}
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>${escapeHtml(HISTORY_TEXT.tables.time)}</th>
                        <th>${escapeHtml(HISTORY_TEXT.tables.branch)}</th>
                        <th>${escapeHtml(HISTORY_TEXT.tables.commit)}</th>
                        <th>${escapeHtml(HISTORY_TEXT.tables.author)}</th>
                        <th>${escapeHtml(HISTORY_TEXT.tables.status)}</th>
                        <th>${escapeHtml(HISTORY_TEXT.tables.flaky)}</th>
                        <th>${escapeHtml(HISTORY_TEXT.tables.duration)}</th>
                        <th>${escapeHtml(HISTORY_TEXT.tables.retries)}</th>
                        <th>${escapeHtml(HISTORY_TEXT.tables.attempts)}</th>
                        <th>${escapeHtml(HISTORY_TEXT.tables.error)}</th>
                    </tr>
                </thead>
                <tbody>
                    ${payload.history.length > 0
                        ? payload.history.map(renderTestHistoryRow).join('')
                        : `<tr><td colspan="10">${escapeHtml(HISTORY_TEXT.tables.empty)}</td></tr>`}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`
}

function renderTestHistoryRow(item: TestHistoryResponse['history'][number]): string {
    const rowAnchor = buildHistoryRowAnchor(item.runId)

    return `
        <tr id="${escapeHtml(rowAnchor)}" class="history-row">
            <td>${escapeHtml(formatDate(item.reportTimestamp ?? item.generatedAt))}</td>
            <td>${escapeHtml(item.branch ?? '—')}</td>
            <td>${escapeHtml(formatCommit(item.commit))}</td>
            <td>${escapeHtml(item.author ?? '—')}</td>
            <td><span class="status-badge ${getStatusClass(item.status, item.flaky)}">${escapeHtml(formatStatusLabel(item.status, item.flaky))}</span></td>
            <td>${item.flaky ? HISTORY_TEXT.states.yes : HISTORY_TEXT.states.no}</td>
            <td>${escapeHtml(formatDuration(item.durationMs))}</td>
            <td>${item.retries}</td>
            <td>${item.attempts}</td>
            <td class="mono">${escapeHtml(item.errorMessage ?? '—')}</td>
        </tr>
    `
}

function renderLatestUnstableEvent(history: TestHistoryResponse['history']): string {
    const [latestEvent] = getUnstableHistoryItems(history)

    if (!latestEvent) {
        return ''
    }

    const isErrorEvent = Boolean(latestEvent.errorMessage)
    const label = isErrorEvent ? HISTORY_TEXT.metrics.latestError : HISTORY_TEXT.metrics.latestFlakyEvent
    const cardClass = isErrorEvent ? 'event-card-error' : 'event-card-flaky'
    const description = isErrorEvent
        ? latestEvent.errorMessage ?? HISTORY_TEXT.texts.errorMissing
        : HISTORY_TEXT.texts.latestFlakyDescription
    const rowAnchor = buildHistoryRowAnchor(latestEvent.runId)

    return `
        <div class="notice-inline event-card ${cardClass}">
            <div class="event-title">
                ${renderMetricHeading(label, METRIC_DESCRIPTIONS.latestEvent, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${getStatusClass(latestEvent.status, latestEvent.flaky)}">${escapeHtml(formatStatusLabel(latestEvent.status, latestEvent.flaky))}</span>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.time)}: ${escapeHtml(formatDate(latestEvent.reportTimestamp ?? latestEvent.generatedAt))}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.branch)}: ${escapeHtml(latestEvent.branch ?? '—')}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.commit)}: ${escapeHtml(formatCommit(latestEvent.commit))}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.retries)}: ${latestEvent.retries}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.attempts)}: ${latestEvent.attempts}</span>
            </div>
            <div class="event-body${isErrorEvent ? ' mono' : ''}">${escapeHtml(description)}</div>
            <div class="event-actions">
                <a class="event-link" href="#${escapeHtml(rowAnchor)}">${escapeHtml(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `
}

function renderPreviousUnstableEvents(history: TestHistoryResponse['history']): string {
    const previousEvents = getUnstableHistoryItems(history).slice(1, 4)

    if (previousEvents.length === 0) {
        return ''
    }

    return `
        <div class="notice-inline event-card">
            ${renderMetricHeading(HISTORY_TEXT.metrics.previousUnstableEvents, METRIC_DESCRIPTIONS.previousUnstableEvents, { className: 'inline-heading', tagName: 'div' })}
            <div class="event-list">
                ${previousEvents.map((item) => renderPreviousUnstableEventItem(item)).join('')}
            </div>
        </div>
    `
}

function renderPreviousUnstableEventItem(item: TestHistoryResponse['history'][number]): string {
    const rowAnchor = buildHistoryRowAnchor(item.runId)
    const label = item.errorMessage
        ? HISTORY_TEXT.labels.error
        : (item.flaky ? HISTORY_TEXT.labels.flaky : formatStatusLabel(item.status, false))
    const description = item.errorMessage
        ? item.errorMessage
        : (item.flaky ? HISTORY_TEXT.texts.retryFlakyDescription : `Статус: ${formatStatusLabel(item.status, false)}.`)

    return `
        <div class="event-list-item">
            <div class="event-list-header">
                <div>
                    <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.time)}: ${escapeHtml(formatDate(item.reportTimestamp ?? item.generatedAt))}</span>
                    <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.branch)}: ${escapeHtml(item.branch ?? '—')}</span>
                    <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.commit)}: ${escapeHtml(formatCommit(item.commit))}</span>
                </div>
                <span class="status-badge ${getStatusClass(item.status, item.flaky)}">${escapeHtml(label)}</span>
            </div>
            <div class="event-list-description${item.errorMessage ? ' mono' : ''}">${escapeHtml(description)}</div>
            <div class="event-actions">
                <span class="muted">${escapeHtml(HISTORY_TEXT.meta.retries)}: ${item.retries} • ${escapeHtml(HISTORY_TEXT.meta.attempts)}: ${item.attempts}</span>
                <a class="event-link" href="#${escapeHtml(rowAnchor)}">${escapeHtml(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `
}

function renderLatestStableRecovery(history: TestHistoryResponse['history']): string {
    const recoveryPair = findLatestStableRecovery(history)

    if (!recoveryPair) {
        return ''
    }

    const rowAnchor = buildHistoryRowAnchor(recoveryPair.recovery.runId)
    const recoveredFromLabel = recoveryPair.previousUnstable.errorMessage
        ? HISTORY_TEXT.texts.recoveryFromError
        : (recoveryPair.previousUnstable.flaky
            ? HISTORY_TEXT.texts.recoveryFromFlaky
            : formatTemplate(HISTORY_TEXT.texts.statusPrefix, { status: formatStatusLabel(recoveryPair.previousUnstable.status, false) }))

    return `
        <div class="notice-inline event-card event-card-recovery">
            <div class="event-title">
                ${renderMetricHeading(HISTORY_TEXT.metrics.latestStableRecovery, METRIC_DESCRIPTIONS.latestRecovery, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${getStatusClass(recoveryPair.recovery.status, recoveryPair.recovery.flaky)}">${escapeHtml(formatStatusLabel(recoveryPair.recovery.status, recoveryPair.recovery.flaky))}</span>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.time)}: ${escapeHtml(formatDate(recoveryPair.recovery.reportTimestamp ?? recoveryPair.recovery.generatedAt))}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.branch)}: ${escapeHtml(recoveryPair.recovery.branch ?? '—')}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.commit)}: ${escapeHtml(formatCommit(recoveryPair.recovery.commit))}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.retries)}: ${recoveryPair.recovery.retries}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.attempts)}: ${recoveryPair.recovery.attempts}</span>
            </div>
            <div class="event-body">${escapeHtml(formatTemplate(HISTORY_TEXT.texts.recoveryAfter, {
                source: recoveredFromLabel,
                date: formatDate(recoveryPair.previousUnstable.reportTimestamp ?? recoveryPair.previousUnstable.generatedAt),
            }))}</div>
            <div class="event-actions">
                <a class="event-link" href="#${escapeHtml(rowAnchor)}">${escapeHtml(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `
}

function renderCurrentStabilityStreak(history: TestHistoryResponse['history']): string {
    const streak = findCurrentStabilityStreak(history)
    const rowAnchor = streak.latestStable ? buildHistoryRowAnchor(streak.latestStable.runId) : null
    const afterUnstableLabel = streak.previousUnstable ? getUnstableEventLabel(streak.previousUnstable) : null

    return `
        <div class="notice-inline event-card${streak.count > 0 ? ' event-card-recovery' : ''}">
            <div class="event-title">
                ${renderMetricHeading(HISTORY_TEXT.metrics.currentStabilityStreak, METRIC_DESCRIPTIONS.currentStabilityStreak, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${streak.count > 0 ? 'status-passed' : 'status-unknown'}">${escapeHtml(formatRunsLabel(streak.count))}</span>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.latestStable)}: ${escapeHtml(streak.latestStable ? formatDate(streak.latestStable.reportTimestamp ?? streak.latestStable.generatedAt) : '—')}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.streakStart)}: ${escapeHtml(streak.oldestStable ? formatDate(streak.oldestStable.reportTimestamp ?? streak.oldestStable.generatedAt) : '—')}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.currentLatestRun)}: ${escapeHtml(history[0] ? formatDate(history[0].reportTimestamp ?? history[0].generatedAt) : '—')}</span>
            </div>
            <div class="event-body">${escapeHtml(formatCurrentStabilityDescription(streak))}</div>
            ${afterUnstableLabel
                ? `<div class="event-actions"><span class="muted">${escapeHtml(HISTORY_TEXT.meta.afterUnstableEvent)}: ${escapeHtml(afterUnstableLabel)}</span>${rowAnchor ? `<a class="event-link" href="#${escapeHtml(rowAnchor)}">${escapeHtml(HISTORY_TEXT.actions.jumpToRow)}</a>` : ''}</div>`
                : (rowAnchor ? `<div class="event-actions"><a class="event-link" href="#${escapeHtml(rowAnchor)}">${escapeHtml(HISTORY_TEXT.actions.jumpToRow)}</a></div>` : '')}
        </div>
    `
}

function renderUnstableStreakBeforeRecovery(history: TestHistoryResponse['history']): string {
    const streak = findUnstableStreakBeforeRecovery(history)

    if (!streak) {
        return ''
    }

    const rowAnchor = buildHistoryRowAnchor(streak.latestUnstable.runId)
    const nearestLabel = getUnstableEventLabel(streak.latestUnstable)
    const cardClass = streak.latestUnstable.errorMessage ? 'event-card-error' : 'event-card-flaky'

    return `
        <div class="notice-inline event-card ${cardClass}">
            <div class="event-title">
                ${renderMetricHeading(HISTORY_TEXT.metrics.unstableStreakBeforeRecovery, METRIC_DESCRIPTIONS.unstableStreakBeforeRecovery, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge status-flaky">${escapeHtml(formatRunsLabel(streak.count))}</span>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.recoveryAt)}: ${escapeHtml(formatDate(streak.recovery.reportTimestamp ?? streak.recovery.generatedAt))}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.latestUnstable)}: ${escapeHtml(formatDate(streak.latestUnstable.reportTimestamp ?? streak.latestUnstable.generatedAt))}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.oldestUnstable)}: ${escapeHtml(formatDate(streak.oldestUnstable.reportTimestamp ?? streak.oldestUnstable.generatedAt))}</span>
            </div>
            <div class="event-body">${escapeHtml(formatTemplate(HISTORY_TEXT.texts.unstableStreakBeforeRecovery, {
                count: String(streak.count),
                label: nearestLabel,
            }))}</div>
            <div class="event-actions">
                <a class="event-link" href="#${escapeHtml(rowAnchor)}">${escapeHtml(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `
}

function renderAttemptDiagnostics(history: TestHistoryResponse['history']): string {
    if (history.length === 0) {
        return ''
    }

    const latestRun = history[0]
    const latestUnstable = getUnstableHistoryItems(history)[0]
    const cards: string[] = []

    if (latestRun) {
        cards.push(renderAttemptDiagnosticsCard(latestRun, HISTORY_TEXT.diagnostics.latestRunTitle, HISTORY_TEXT.diagnostics.latestRunDescription))
    }

    if (latestUnstable && latestUnstable.runId !== latestRun?.runId) {
        cards.push(renderAttemptDiagnosticsCard(latestUnstable, HISTORY_TEXT.diagnostics.latestUnstableTitle, HISTORY_TEXT.diagnostics.latestUnstableDescription))
    }

    if (cards.length === 0) {
        return ''
    }

    return `
        <div class="diagnostics-shell">
            ${cards.join('')}
        </div>
    `
}

function renderAttemptDiagnosticsCard(
    item: TestHistoryResponse['history'][number],
    title: string,
    description: string,
): string {
    const rowAnchor = buildHistoryRowAnchor(item.runId)
    const attempts = item.attemptDetails ?? []

    return `
        <div class="notice-inline diagnostics-card">
            <div class="diagnostics-card-header">
                ${renderMetricHeading(title, METRIC_DESCRIPTIONS.timeline, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${getStatusClass(item.status, item.flaky)}">${escapeHtml(formatStatusLabel(item.status, item.flaky))}</span>
            </div>
            <div class="diagnostics-card-description">${escapeHtml(description)}</div>
            <div class="event-meta">
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.time)}: ${escapeHtml(formatDate(item.reportTimestamp ?? item.generatedAt))}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.branch)}: ${escapeHtml(item.branch ?? '—')}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.retries)}: ${item.retries}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.meta.attempts)}: ${item.attempts}</span>
            </div>
            <div class="attempt-list">
                ${attempts.map((attempt) => renderAttemptDetail(attempt)).join('')}
            </div>
            <div class="event-actions">
                <a class="event-link" href="#${escapeHtml(rowAnchor)}">${escapeHtml(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `
}

function renderAttemptDetail(attempt: TestHistoryResponse['history'][number]['attemptDetails'][number]): string {
    const hasSteps = attempt.steps.length > 0
    const hasAttachments = attempt.attachments.length > 0

    return `
        <div class="attempt-item">
            <div class="attempt-header">
                <div class="attempt-title">${escapeHtml(formatTemplate(HISTORY_TEXT.diagnostics.attemptTitle, { attempt: String(attempt.attempt) }))}</div>
                <span class="status-badge ${getStatusClass(attempt.status, false)}">${escapeHtml(formatStatusLabel(attempt.status, false))}</span>
            </div>
            <div class="attempt-meta">
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.duration)}: ${escapeHtml(formatDuration(attempt.durationMs))}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.startTime)}: ${escapeHtml(attempt.startTime ? formatDate(attempt.startTime) : '—')}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.steps)}: ${attempt.steps.length}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.attachments)}: ${attempt.attachments.length}</span>
            </div>
            ${attempt.errorMessage ? `<div class="attempt-error mono">${escapeHtml(attempt.errorMessage)}</div>` : ''}
            ${hasSteps ? `
                <div class="attempt-section-title">${escapeHtml(HISTORY_TEXT.diagnostics.stepsTitle)}</div>
                <div class="step-list">
                    ${attempt.steps.map((step) => renderStepDetail(step)).join('')}
                </div>
            ` : ''}
            ${hasAttachments ? `
                <div class="attempt-section-title">${escapeHtml(HISTORY_TEXT.diagnostics.attachmentsTitle)}</div>
                <div class="attachment-list">
                    ${attempt.attachments.map((attachment) => renderAttachmentDetail(attachment)).join('')}
                </div>
            ` : ''}
            ${!attempt.errorMessage && !hasSteps && !hasAttachments ? `<div class="muted">${escapeHtml(HISTORY_TEXT.diagnostics.emptyAttempt)}</div>` : ''}
        </div>
    `
}

function renderStepDetail(step: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'][number]): string {
    return `
        <div class="step-item">
            <div class="step-item-header">
                <div class="step-title">${escapeHtml(step.title)}</div>
                <span class="meta-badge">${escapeHtml(formatDuration(step.durationMs))}</span>
            </div>
            <div class="muted">${escapeHtml(step.category ?? HISTORY_TEXT.diagnostics.noCategory)}</div>
        </div>
    `
}

function renderAttachmentDetail(attachment: TestHistoryResponse['history'][number]['attemptDetails'][number]['attachments'][number]): string {
    const href = attachment.url ?? null
    const location = attachment.url ?? attachment.path ?? HISTORY_TEXT.diagnostics.attachmentLocationMissing

    return `
        <div class="attachment-item">
            <div class="attachment-item-header">
                <div class="attachment-title">${escapeHtml(attachment.name)}</div>
                ${attachment.contentType ? `<span class="meta-badge">${escapeHtml(attachment.contentType)}</span>` : ''}
            </div>
            <div class="mono">${escapeHtml(location)}</div>
            ${href ? `<div style="margin-top: 8px;"><a class="attachment-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(HISTORY_TEXT.diagnostics.openAttachment)}</a></div>` : ''}
        </div>
    `
}

function findLatestStableRecovery(history: TestHistoryResponse['history']): {
    recovery: TestHistoryResponse['history'][number]
    previousUnstable: TestHistoryResponse['history'][number]
} | null {
    for (let index = 0; index < history.length - 1; index += 1) {
        const currentItem = history[index]
        const previousOlderItem = history[index + 1]

        if (isStableHistoryItem(currentItem) && isUnstableHistoryItem(previousOlderItem)) {
            return {
                recovery: currentItem,
                previousUnstable: previousOlderItem,
            }
        }
    }

    return null
}

function findCurrentStabilityStreak(history: TestHistoryResponse['history']): {
    count: number
    latestStable: TestHistoryResponse['history'][number] | null
    oldestStable: TestHistoryResponse['history'][number] | null
    previousUnstable: TestHistoryResponse['history'][number] | null
} {
    if (history.length === 0) {
        return {
            count: 0,
            latestStable: null,
            oldestStable: null,
            previousUnstable: null,
        }
    }

    let count = 0

    for (const item of history) {
        if (!isStableHistoryItem(item)) {
            break
        }

        count += 1
    }

    if (count === 0) {
        return {
            count: 0,
            latestStable: null,
            oldestStable: null,
            previousUnstable: history[0] ?? null,
        }
    }

    return {
        count,
        latestStable: history[0] ?? null,
        oldestStable: history[count - 1] ?? null,
        previousUnstable: history[count] ?? null,
    }
}

function findUnstableStreakBeforeRecovery(history: TestHistoryResponse['history']): {
    count: number
    recovery: TestHistoryResponse['history'][number]
    latestUnstable: TestHistoryResponse['history'][number]
    oldestUnstable: TestHistoryResponse['history'][number]
} | null {
    const recoveryPair = findLatestStableRecovery(history)

    if (!recoveryPair) {
        return null
    }

    const recoveryIndex = history.findIndex((item) => item.runId === recoveryPair.recovery.runId)

    if (recoveryIndex < 0 || recoveryIndex === history.length - 1) {
        return null
    }

    const unstableItems: TestHistoryResponse['history'] = []

    for (let index = recoveryIndex + 1; index < history.length; index += 1) {
        const currentItem = history[index]

        if (!isUnstableHistoryItem(currentItem)) {
            break
        }

        unstableItems.push(currentItem)
    }

    if (unstableItems.length === 0) {
        return null
    }

    return {
        count: unstableItems.length,
        recovery: recoveryPair.recovery,
        latestUnstable: unstableItems[0],
        oldestUnstable: unstableItems[unstableItems.length - 1],
    }
}

function isStableHistoryItem(item: TestHistoryResponse['history'][number]): boolean {
    return item.status === 'passed' && !item.flaky && !item.errorMessage
}

function getUnstableHistoryItems(history: TestHistoryResponse['history']): TestHistoryResponse['history'] {
    return history.filter(isUnstableHistoryItem)
}

function getUnstableEventLabel(item: TestHistoryResponse['history'][number]): string {
    if (item.errorMessage) {
        return HISTORY_TEXT.labels.error
    }

    if (item.flaky) {
        return HISTORY_TEXT.labels.flaky
    }

    return formatStatusLabel(item.status, false)
}

function formatCurrentStabilityDescription(streak: ReturnType<typeof findCurrentStabilityStreak>): string {
    if (streak.count === 0) {
        return HISTORY_TEXT.texts.streakNotStarted
    }

    if (!streak.previousUnstable) {
        return formatTemplate(HISTORY_TEXT.texts.streakWholeHistory, { count: String(streak.count) })
    }

    return formatTemplate(HISTORY_TEXT.texts.streakAfterEvent, {
        count: String(streak.count),
        event: getUnstableEventLabel(streak.previousUnstable),
    })
}

function isUnstableHistoryItem(item: TestHistoryResponse['history'][number]): boolean {
    return Boolean(item.errorMessage)
        || item.flaky
        || item.status === 'failed'
        || item.status === 'timedout'
        || item.status === 'interrupted'
}

function renderStatePage(options: {
    title: string
    heading: string
    statusCode: string
    toneClass: string
    message: string
    filters: { branch: string | null; project: string | null; file: string | null }
    basePath: string
    apiBasePath: string
    extraContent?: string
}): string {
    const dashboardHref = buildDashboardHref(options.filters, options.basePath)
    const apiHref = buildApiTestHistoryHref(options.title, options.filters, options.apiBasePath)

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(options.heading)}</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='42' fill='%232f81f7'/%3E%3C/svg%3E">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
        .page-shell { max-width: 960px; margin: 0 auto; }
        .state-card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; }
        .state-code { display: inline-block; margin-bottom: 16px; }
        .state-title { font-size: 28px; font-weight: 600; color: #ffffff; margin-bottom: 10px; }
        .subtle, .muted { color: #8b949e; font-size: 13px; }
        .page-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
        .page-link { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 16px; border-radius: 6px; border: 1px solid #30363d; text-decoration: none; }
        .page-link-primary { background: #2f81f7; color: #ffffff; }
        .page-link-secondary { background: #21262d; color: #c9d1d9; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .status-failed { background: #da3633; color: #fff; }
        .status-flaky { background: #d29922; color: #000; }
        .status-passed { background: #1a7f37; color: #fff; }
        .status-skipped { background: #6e7681; color: #fff; }
        .status-unknown { background: #21262d; color: #fff; }
        .meta-badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #21262d; color: #c9d1d9; font-size: 12px; margin-right: 8px; margin-top: 12px; }
        .test-link { color: #58a6ff; text-decoration: none; }
        .test-link:hover { text-decoration: underline; }
        .candidate-list { display: grid; gap: 12px; margin-top: 16px; }
        .candidate-item { padding: 12px; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; }
        .mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; color: #ff7b72; word-break: break-word; }
    </style>
</head>
<body>
    <div class="page-shell">
        <div class="state-card">
            <span class="state-code status-badge ${options.toneClass}">${escapeHtml(options.statusCode)}</span>
            <div class="state-title">${escapeHtml(options.heading)}</div>
            <div class="subtle">${escapeHtml(HISTORY_TEXT.statePages.testLabel)}: ${escapeHtml(options.title)}</div>
            <div class="subtle" style="margin-top: 12px;">${escapeHtml(options.message)}</div>
            <div>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.filters.branch)}: ${escapeHtml(options.filters.branch ?? HISTORY_TEXT.filters.all)}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.filters.project)}: ${escapeHtml(options.filters.project ?? HISTORY_TEXT.filters.all)}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.filters.file)}: ${escapeHtml(options.filters.file ?? HISTORY_TEXT.filters.all)}</span>
            </div>
            ${options.extraContent ?? ''}
            <div class="page-actions">
                <a class="page-link page-link-secondary" href="${escapeHtml(dashboardHref)}">${escapeHtml(HISTORY_TEXT.backToDashboard)}</a>
                <a class="page-link page-link-primary" href="${escapeHtml(apiHref)}">${escapeHtml(HISTORY_TEXT.openJson)}</a>
            </div>
        </div>
    </div>
</body>
</html>`
}

function buildDashboardHref(
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    basePath: string,
): string {
    const query = buildQueryString(filters)
    const normalizedBasePath = basePath || '/'
    return query ? `${normalizedBasePath}?${query}` : normalizedBasePath
}

function buildTestHistoryHref(
    title: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    basePath: string,
): string {
    const query = buildQueryString(filters)
    const testHistoryBasePath = basePath ? `${basePath}/test` : '/test'
    const testHistoryHref = `${testHistoryBasePath}/${encodeURIComponent(title)}`
    return query ? `${testHistoryHref}?${query}` : testHistoryHref
}

function buildApiTestHistoryHref(
    title: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    basePath: string,
): string {
    const query = buildQueryString(filters)
    const apiTestHistoryBasePath = basePath || '/api/test'
    const apiTestHistoryHref = `${apiTestHistoryBasePath}/${encodeURIComponent(title)}`
    return query ? `${apiTestHistoryHref}?${query}` : apiTestHistoryHref
}

function buildQueryString(filters: { branch?: string | null; project?: string | null; file?: string | null }): string {
    const searchParams = new URLSearchParams()

    if (filters.branch) {
        searchParams.set('branch', filters.branch)
    }

    if (filters.project) {
        searchParams.set('project', filters.project)
    }

    if (filters.file) {
        searchParams.set('file', filters.file)
    }

    return searchParams.toString()
}

function normalizeOptionalFilter(value: string | undefined): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeBasePath(value: string | undefined): string {
    if (typeof value !== 'string') {
        return ''
    }

    const trimmedValue = value.trim()

    if (!trimmedValue || trimmedValue === '/') {
        return ''
    }

    return trimmedValue.endsWith('/') ? trimmedValue.slice(0, -1) : trimmedValue
}

function getStatusClass(status: string, flaky: boolean): string {
    if (flaky) {
        return 'status-flaky'
    }

    if (status === 'failed' || status === 'timedout' || status === 'interrupted') {
        return 'status-failed'
    }

    if (status === 'passed') {
        return 'status-passed'
    }

    if (status === 'skipped') {
        return 'status-skipped'
    }

    return 'status-unknown'
}

function formatStatusLabel(status: string, flaky: boolean): string {
    if (flaky) {
        return HISTORY_TEXT.labels.flaky
    }

    if (status === 'unknown') {
        return HISTORY_TEXT.states.unknown
    }

    return ru.dashboard.statusLabels[status as keyof typeof ru.dashboard.statusLabels] ?? status
}

function formatNullableNumber(value: number | null): string {
    return value === null ? '—' : value.toFixed(1)
}

function formatNullableDays(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(2)} дн`
}

function formatCommit(commit: string | null): string {
    if (!commit) {
        return '—'
    }

    return commit.slice(0, 8)
}

function buildHistoryRowAnchor(runId: string): string {
    const normalizedId = runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    return normalizedId.length > 0 ? `history-row-${normalizedId}` : 'history-row-run'
}

function formatRunsLabel(count: number): string {
    return `${count} ${getRunWord(count)}`
}

function getRunWord(count: number): string {
    const remainder100 = count % 100
    const remainder10 = count % 10

    if (remainder100 >= 11 && remainder100 <= 14) {
        return 'прогонов'
    }

    if (remainder10 === 1) {
        return 'прогон'
    }

    if (remainder10 >= 2 && remainder10 <= 4) {
        return 'прогона'
    }

    return 'прогонов'
}

function formatTemplate(template: string, values: Record<string, string>): string {
    return Object.entries(values).reduce(
        (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
        template,
    )
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}
