/**
 * Назначение: общие HTML-секции legacy test-history renderer, включая incident summary и attempt diagnostics.
 */
import type { TestHistoryConflict, TestHistoryResponse } from './api-store'
import { METRIC_INFO_STYLES, renderMetricHeading } from './render-metric-info'
import { formatDate, formatDuration, formatPercent } from './shared/formatting'
import {
    buildApiTestHistoryHrefFromBasePath,
    buildDashboardHrefFromBasePath,
    buildQueryString as buildSharedQueryString,
    buildTestHistoryHrefFromDashboardBasePath,
    normalizeOptionalFilter as normalizeSharedOptionalFilter,
} from './shared/navigation'
import {
    buildAttachmentHref as buildSharedAttachmentHref,
    buildHistoryRowAnchor as buildSharedHistoryRowAnchor,
    buildStepAnchor as buildSharedStepAnchor,
    canInlineMarkdownPreview as canInlineSharedMarkdownPreview,
    findCurrentStabilityStreak as findSharedCurrentStabilityStreak,
    findIncidentStepAnchor as findSharedIncidentStepAnchor,
    findLatestStableRecovery as findSharedLatestStableRecovery,
    findUnstableStreakBeforeRecovery as findSharedUnstableStreakBeforeRecovery,
    formatCurrentStabilityDescription as formatSharedCurrentStabilityDescription,
    formatRunsLabel as formatSharedRunsLabel,
    formatTemplate as formatSharedTemplate,
    getAttachmentReference as getSharedAttachmentReference,
    getRunWord as getSharedRunWord,
    getUnstableEventLabel as getSharedUnstableEventLabel,
    getUnstableHistoryItems as getSharedUnstableHistoryItems,
    isImageAttachment as isSharedImageAttachment,
    isMarkdownAttachment as isSharedMarkdownAttachment,
    isStableHistoryItem as isSharedStableHistoryItem,
    isUnstableHistoryItem as isSharedUnstableHistoryItem,
    normalizeAnchorLookupValue as normalizeSharedAnchorLookupValue,
} from './shared/test-history-helpers'
import { ru } from './shared/i18n/ru'
import { escapeHtml } from './shared/text-utils'

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

/**
 * Сворачивает последний инцидент в одну обзорную карточку, чтобы оператору не приходилось вручную собирать картину из timeline и diagnostics.
 */
export function renderIncidentSummary(
    incidentSummary: TestHistoryResponse['incidentSummary'],
    history: TestHistoryResponse['history'],
): string {
    if (!incidentSummary) {
        return ''
    }

    const formattedSummary = renderIncidentNarrative(incidentSummary.summary)
    const failureStepAnchor = findIncidentStepAnchor(history, incidentSummary.failureStepTitle)
    const insightsHtml = renderIncidentInsights(incidentSummary, failureStepAnchor)
    const severityDescription = HISTORY_TEXT.incident.severityDescription[incidentSummary.severity]
    const primarySignal = incidentSummary.failureStepErrorMessage ?? incidentSummary.latestErrorMessage ?? null
    const shouldRenderMessageBlock = Boolean(incidentSummary.latestErrorMessage && incidentSummary.latestErrorMessage !== primarySignal)

    return `
        <div class="notice-inline incident-card is-${escapeHtml(incidentSummary.severity)}">
            <div class="event-title">
                ${renderMetricHeading(HISTORY_TEXT.incident.title, HISTORY_TEXT.incident.tooltip, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${getIncidentStatusClass(incidentSummary.severity)}">${escapeHtml(HISTORY_TEXT.incident.severity[incidentSummary.severity])}</span>
            </div>
            <div class="incident-status-banner">
                <div class="incident-status-copy">
                    <div class="incident-status-label">${escapeHtml(HISTORY_TEXT.incident.severityLabel)}</div>
                    <div class="incident-status-text">${escapeHtml(severityDescription)}</div>
                </div>
            </div>
            ${formattedSummary}
            <div class="incident-section-title">${escapeHtml(HISTORY_TEXT.incident.detailsTitle)}</div>
            ${insightsHtml}
            <div class="incident-grid">
                <div class="incident-kpi">
                    <div class="incident-kpi-label">${escapeHtml(HISTORY_TEXT.incident.categoryLabel)}</div>
                    <div class="incident-kpi-value">${escapeHtml(HISTORY_TEXT.incident.category[incidentSummary.category])}</div>
                </div>
                <div class="incident-kpi">
                    <div class="incident-kpi-label">${escapeHtml(HISTORY_TEXT.incident.confidenceLabel)}</div>
                    <div class="incident-kpi-value">${escapeHtml(HISTORY_TEXT.incident.confidence[incidentSummary.confidence])}</div>
                </div>
                <div class="incident-kpi">
                    <div class="incident-kpi-label">${escapeHtml(HISTORY_TEXT.incident.unstableRunsLabel)}</div>
                    <div class="incident-kpi-value">${incidentSummary.unstableRuns}</div>
                </div>
                <div class="incident-kpi">
                    <div class="incident-kpi-label">${escapeHtml(HISTORY_TEXT.incident.matchingRunsLabel)}</div>
                    <div class="incident-kpi-value">${incidentSummary.matchingRuns}</div>
                </div>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.incident.firstSeenLabel)}: ${escapeHtml(incidentSummary.firstSeenAt ? formatDate(incidentSummary.firstSeenAt) : '—')}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.incident.latestSeenLabel)}: ${escapeHtml(incidentSummary.latestSeenAt ? formatDate(incidentSummary.latestSeenAt) : '—')}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.incident.recoveryLabel)}: ${escapeHtml(incidentSummary.latestRecoveryAt ? formatDate(incidentSummary.latestRecoveryAt) : '—')}</span>
                <span class="meta-badge">${escapeHtml(HISTORY_TEXT.incident.attemptsLabel)}: ${incidentSummary.affectedAttempts}</span>
                ${incidentSummary.failureStepTitle ? `<span class="meta-badge">${escapeHtml(HISTORY_TEXT.incident.failureStepLabel)}: ${escapeHtml(incidentSummary.failureStepTitle)}</span>` : ''}
            </div>
            ${shouldRenderMessageBlock ? `<div class="incident-message mono">${escapeHtml(incidentSummary.latestErrorMessage ?? '')}</div>` : ''}
            <div class="incident-section-title">${escapeHtml(HISTORY_TEXT.incident.evidenceTitle)}</div>
            <div class="incident-evidence-list">
                ${incidentSummary.evidence.map((item) => `<div class="incident-evidence-item">${escapeHtml(item)}</div>`).join('')}
            </div>
        </div>
    `
}

export function renderIncidentNarrative(summary: string): string {
    const parts = summary
        .split(/\.\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => part.endsWith('.') ? part : `${part}.`)

    if (parts.length === 0) {
        return ''
    }

    const [lead] = parts

    return `
        <div class="incident-summary-stack">
            <div class="incident-summary-lead">${escapeHtml(lead)}</div>
        </div>
    `
}

export function renderIncidentInsights(
    incidentSummary: NonNullable<TestHistoryResponse['incidentSummary']>,
    failureStepAnchor: string | null,
): string {
    const cards = [
        {
            label: HISTORY_TEXT.incident.categoryLabel,
            value: HISTORY_TEXT.incident.category[incidentSummary.category],
        },
        {
            label: HISTORY_TEXT.incident.failureStepLabel,
            value: incidentSummary.failureStepTitle ?? incidentSummary.failureStepCategory ?? HISTORY_TEXT.incident.notCaptured,
            empty: !incidentSummary.failureStepTitle && !incidentSummary.failureStepCategory,
            action: failureStepAnchor
                ? `<div class="incident-insight-action"><a class="incident-insight-link" href="#${escapeHtml(failureStepAnchor)}">${escapeHtml(HISTORY_TEXT.incident.jumpToFailureStep)}</a></div>`
                : '',
        },
        {
            label: HISTORY_TEXT.incident.primarySignalLabel,
            value: incidentSummary.failureStepErrorMessage ?? incidentSummary.latestErrorMessage ?? HISTORY_TEXT.incident.notCaptured,
            empty: !incidentSummary.failureStepErrorMessage && !incidentSummary.latestErrorMessage,
        },
    ]

    return `
        <div class="incident-insights-grid">
            ${cards.map((card) => `
                <div class="incident-insight-card${card.empty ? ' is-empty' : ''}">
                    <div class="incident-insight-label">${escapeHtml(card.label)}</div>
                    <div class="incident-insight-value">${escapeHtml(card.value)}</div>
                    ${card.action ?? ''}
                </div>
            `).join('')}
        </div>
    `
}

export function renderTestHistoryRow(item: TestHistoryResponse['history'][number]): string {
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

export function renderLatestUnstableEvent(history: TestHistoryResponse['history']): string {
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

export function renderPreviousUnstableEvents(history: TestHistoryResponse['history']): string {
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

export function renderPreviousUnstableEventItem(item: TestHistoryResponse['history'][number]): string {
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

export function renderLatestStableRecovery(history: TestHistoryResponse['history']): string {
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

export function renderCurrentStabilityStreak(history: TestHistoryResponse['history']): string {
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

export function renderUnstableStreakBeforeRecovery(history: TestHistoryResponse['history']): string {
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

export function renderAttemptDiagnostics(history: TestHistoryResponse['history'], artifactBasePath: string): string {
    if (history.length === 0) {
        return ''
    }

    const latestRun = history[0]
    const latestUnstable = getUnstableHistoryItems(history)[0]
    const cards: string[] = []

    if (latestRun) {
        cards.push(renderAttemptDiagnosticsCard(latestRun, HISTORY_TEXT.diagnostics.latestRunTitle, HISTORY_TEXT.diagnostics.latestRunDescription, artifactBasePath))
    }

    if (latestUnstable && latestUnstable.runId !== latestRun?.runId) {
        cards.push(renderAttemptDiagnosticsCard(latestUnstable, HISTORY_TEXT.diagnostics.latestUnstableTitle, HISTORY_TEXT.diagnostics.latestUnstableDescription, artifactBasePath))
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

/**
 * Карточка diagnostics намеренно рендерит и последний запуск, и последний нестабильный эпизод, чтобы можно было сравнить текущее состояние с последним плохим run без просмотра всей истории.
 */
export function renderAttemptDiagnosticsCard(
    item: TestHistoryResponse['history'][number],
    title: string,
    description: string,
    artifactBasePath: string,
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
            <div class="attempt-explainer">${escapeHtml(HISTORY_TEXT.diagnostics.retriesHint)}</div>
            <div class="attempt-list">
                ${attempts.map((attempt, index) => renderAttemptDetail(item.runId, attempt, index === 0, artifactBasePath)).join('')}
            </div>
            <div class="event-actions">
                <a class="event-link" href="#${escapeHtml(rowAnchor)}">${escapeHtml(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `
}

export function renderAttemptDetail(
    runId: string,
    attempt: TestHistoryResponse['history'][number]['attemptDetails'][number],
    isOpenByDefault: boolean,
    artifactBasePath: string,
): string {
    const hasSteps = attempt.steps.length > 0
    const hasAttachments = attempt.attachments.length > 0

    return `
        <details class="attempt-item"${isOpenByDefault ? ' open' : ''}>
            <summary class="attempt-summary">
                <div class="attempt-summary-main">
                    <span class="attempt-chevron">▶</span>
                    <div class="attempt-title">${escapeHtml(formatTemplate(HISTORY_TEXT.diagnostics.attemptTitle, { attempt: String(attempt.attempt) }))}</div>
                </div>
                <div class="attempt-header">
                    <div class="attempt-meta">
                        <span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.duration)}: ${escapeHtml(formatDuration(attempt.durationMs))}</span>
                        <span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.steps)}: ${attempt.steps.length}</span>
                        <span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.attachments)}: ${attempt.attachments.length}</span>
                    </div>
                    <span class="status-badge ${getStatusClass(attempt.status, false)}">${escapeHtml(formatStatusLabel(attempt.status, false))}</span>
                </div>
            </summary>
            <div class="attempt-body">
                <div class="attempt-meta" style="margin: 10px 0 8px;">
                    <span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.startTime)}: ${escapeHtml(attempt.startTime ? formatDate(attempt.startTime) : '—')}</span>
                </div>
                ${attempt.errorMessage ? `<div class="attempt-error mono">${escapeHtml(attempt.errorMessage)}</div>` : ''}
                ${hasSteps ? renderAttemptSteps(runId, attempt.attempt, attempt.steps, Boolean(attempt.errorMessage)) : ''}
                ${hasAttachments ? `
                    <div class="attempt-section-title">${escapeHtml(HISTORY_TEXT.diagnostics.attachmentsTitle)}</div>
                    <div class="attachment-list">
                        ${attempt.attachments.map((attachment) => renderAttachmentDetail(runId, attachment, artifactBasePath)).join('')}
                    </div>
                ` : ''}
                ${!attempt.errorMessage && !hasSteps && !hasAttachments ? `<div class="muted">${escapeHtml(HISTORY_TEXT.diagnostics.emptyAttempt)}</div>` : ''}
            </div>
        </details>
    `
}

export function renderAttemptSteps(
    runId: string,
    attemptNumber: number,
    steps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'],
    isOpenByDefault: boolean,
): string {
    return `
        <details class="attempt-step-group"${isOpenByDefault ? ' open' : ''}>
            <summary class="attempt-step-summary">
                <span class="attempt-section-title" style="margin: 0;">${escapeHtml(HISTORY_TEXT.diagnostics.stepsTitle)}</span>
                <span class="meta-badge">${steps.length}</span>
            </summary>
            <div class="attempt-step-body">
                <div class="step-list">
                    ${steps.map((step, index) => renderStepDetail(runId, attemptNumber, index, step)).join('')}
                </div>
            </div>
        </details>
    `
}

export function renderOverflowText(
    value: string | null | undefined,
    options: {
        className?: string
        displayValue?: string
    } = {},
): string {
    const fullValue = typeof value === 'string' && value.length > 0 ? value : '—'
    const displayValue = options.displayValue ?? fullValue
    const className = ['overflow-text', options.className].filter(Boolean).join(' ')

    return `<span class="${escapeHtml(className)}" title="${escapeHtml(fullValue)}">${escapeHtml(displayValue)}</span>`
}

export function renderStepDetail(
    runId: string,
    attemptNumber: number,
    stepIndex: number,
    step: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'][number],
): string {
    const statusBadge = step.status
        ? `<span class="status-badge ${getStatusClass(step.status, false)}">${escapeHtml(formatStatusLabel(step.status, false))}</span>`
        : ''
    const failureBadge = step.isFailurePoint
        ? `<span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.failedStepBadge)}</span>`
        : ''
    const stepAnchor = buildStepAnchor(runId, attemptNumber, stepIndex)

    return `
        <div id="${escapeHtml(stepAnchor)}" class="step-item${step.isFailurePoint ? ' step-item-failure' : ''}">
            <div class="step-item-header">
                <div class="step-title">${renderOverflowText(step.title, { className: 'step-title-text' })}</div>
                <div class="attempt-meta">
                    ${statusBadge}
                    <span class="meta-badge">${escapeHtml(formatDuration(step.durationMs))}</span>
                </div>
            </div>
            <div class="muted">${escapeHtml(step.category ?? HISTORY_TEXT.diagnostics.noCategory)}</div>
            ${(failureBadge || step.errorMessage) ? `
                <div class="step-meta-row">
                    ${failureBadge}
                </div>
            ` : ''}
            ${step.errorMessage ? `<div class="step-error mono">${escapeHtml(step.errorMessage)}</div>` : ''}
        </div>
    `
}

/**
 * Incident summary ссылается на шаг падения по title, поэтому поиск нормализует и payload, и шаги в рендере, чтобы anchor не ломался из-за регистра или пробелов.
 */
export function findIncidentStepAnchor(
    history: TestHistoryResponse['history'],
    failureStepTitle: string | null,
): string | null {
    return findSharedIncidentStepAnchor(history, failureStepTitle)
}

export function normalizeAnchorLookupValue(value: string | null | undefined): string | null {
    return normalizeSharedAnchorLookupValue(value)
}

export function buildStepAnchor(runId: string, attemptNumber: number, stepIndex: number): string {
    return buildSharedStepAnchor(runId, attemptNumber, stepIndex)
}

export function renderAttachmentDetail(
    runId: string,
    attachment: TestHistoryResponse['history'][number]['attemptDetails'][number]['attachments'][number],
    artifactBasePath: string,
): string {
    const href = buildAttachmentHref(runId, attachment, artifactBasePath)
    const location = attachment.url ?? attachment.path ?? HISTORY_TEXT.diagnostics.attachmentLocationMissing
    const imagePreviewHtml = href && isImageAttachment(attachment)
        ? `
            <details class="attachment-preview">
                <summary class="attachment-preview-summary">${escapeHtml(HISTORY_TEXT.diagnostics.inlineImagePreview)}</summary>
                <div class="attachment-preview-body">
                    <button
                        type="button"
                        class="attachment-image-trigger"
                        data-image-lightbox-trigger
                        data-image-lightbox-src="${escapeHtml(href)}"
                        data-image-lightbox-title="${escapeHtml(attachment.name)}"
                        aria-label="${escapeHtml(HISTORY_TEXT.diagnostics.expandImageHint)}"
                    >
                        <img class="attachment-image-preview" src="${escapeHtml(href)}" alt="${escapeHtml(attachment.name)}" loading="lazy">
                    </button>
                    <div class="attachment-image-hint">${escapeHtml(HISTORY_TEXT.diagnostics.expandImageHint)}</div>
                </div>
            </details>
        `
        : ''
    const markdownPreviewHtml = href && isMarkdownAttachment(attachment) && canInlineMarkdownPreview(href)
        ? `
            <details class="attachment-preview" data-markdown-preview data-preview-href="${escapeHtml(href)}">
                <summary class="attachment-preview-summary">${escapeHtml(HISTORY_TEXT.diagnostics.inlineMarkdownPreview)}</summary>
                <div class="attachment-preview-body">
                    <div class="attachment-preview-loading" data-markdown-loading>${escapeHtml(HISTORY_TEXT.diagnostics.loadingMarkdownPreview)}</div>
                    <pre class="attachment-markdown-preview" data-markdown-content hidden></pre>
                    <div class="attachment-preview-error" data-markdown-error hidden>${escapeHtml(HISTORY_TEXT.diagnostics.markdownPreviewUnavailable)}</div>
                </div>
            </details>
        `
        : ''

    return `
        <div class="attachment-item">
            <div class="attachment-item-header">
                <div class="attachment-title">${renderOverflowText(attachment.name, { className: 'attachment-title-text' })}</div>
                ${attachment.contentType ? `<span class="meta-badge">${escapeHtml(attachment.contentType)}</span>` : ''}
            </div>
            <div class="mono">${renderOverflowText(location, { className: 'attachment-location-text mono' })}</div>
            ${href ? `<div class="attachment-actions"><a class="attachment-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(HISTORY_TEXT.diagnostics.openAttachment)}</a></div>` : ''}
            ${imagePreviewHtml}
            ${markdownPreviewHtml}
        </div>
    `
}

export function buildAttachmentHref(
    runId: string,
    attachment: TestHistoryResponse['history'][number]['attemptDetails'][number]['attachments'][number],
    artifactBasePath: string,
): string | null {
    return buildSharedAttachmentHref(runId, attachment, artifactBasePath)
}

export function isImageAttachment(
    attachment: TestHistoryResponse['history'][number]['attemptDetails'][number]['attachments'][number],
): boolean {
    return isSharedImageAttachment(attachment)
}

export function isMarkdownAttachment(
    attachment: TestHistoryResponse['history'][number]['attemptDetails'][number]['attachments'][number],
): boolean {
    return isSharedMarkdownAttachment(attachment)
}

export function canInlineMarkdownPreview(href: string): boolean {
    return canInlineSharedMarkdownPreview(href)
}

export function getAttachmentReference(
    attachment: TestHistoryResponse['history'][number]['attemptDetails'][number]['attachments'][number],
): string {
    return getSharedAttachmentReference(attachment)
}

export function findLatestStableRecovery(history: TestHistoryResponse['history']): {
    recovery: TestHistoryResponse['history'][number]
    previousUnstable: TestHistoryResponse['history'][number]
} | null {
    return findSharedLatestStableRecovery(history)
}

export function findCurrentStabilityStreak(history: TestHistoryResponse['history']): {
    count: number
    latestStable: TestHistoryResponse['history'][number] | null
    oldestStable: TestHistoryResponse['history'][number] | null
    previousUnstable: TestHistoryResponse['history'][number] | null
} {
    return findSharedCurrentStabilityStreak(history)
}

export function findUnstableStreakBeforeRecovery(history: TestHistoryResponse['history']): {
    count: number
    recovery: TestHistoryResponse['history'][number]
    latestUnstable: TestHistoryResponse['history'][number]
    oldestUnstable: TestHistoryResponse['history'][number]
} | null {
    return findSharedUnstableStreakBeforeRecovery(history)
}

export function isStableHistoryItem(item: TestHistoryResponse['history'][number]): boolean {
    return isSharedStableHistoryItem(item)
}

export function getUnstableHistoryItems(history: TestHistoryResponse['history']): TestHistoryResponse['history'] {
    return getSharedUnstableHistoryItems(history)
}

export function getUnstableEventLabel(item: TestHistoryResponse['history'][number]): string {
    return getSharedUnstableEventLabel(item)
}

export function formatCurrentStabilityDescription(streak: ReturnType<typeof findCurrentStabilityStreak>): string {
    return formatSharedCurrentStabilityDescription(streak)
}

export function isUnstableHistoryItem(item: TestHistoryResponse['history'][number]): boolean {
    return isSharedUnstableHistoryItem(item)
}

export function renderStatePage(options: {
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

export function buildDashboardHref(
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    basePath: string,
): string {
    return buildDashboardHrefFromBasePath(filters, basePath)
}

export function buildTestHistoryHref(
    title: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    basePath: string,
): string {
    return buildTestHistoryHrefFromDashboardBasePath(title, filters, basePath)
}

export function buildApiTestHistoryHref(
    title: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    basePath: string,
): string {
    return buildApiTestHistoryHrefFromBasePath(title, filters, basePath)
}

export function buildQueryString(filters: { branch?: string | null; project?: string | null; file?: string | null }): string {
    return buildSharedQueryString(filters)
}

export function normalizeOptionalFilter(value: string | undefined): string | null {
    return normalizeSharedOptionalFilter(value)
}

export function normalizeBasePath(value: string | undefined): string {
    if (typeof value !== 'string') {
        return ''
    }

    const trimmedValue = value.trim()

    if (!trimmedValue || trimmedValue === '/') {
        return ''
    }

    return trimmedValue.endsWith('/') ? trimmedValue.slice(0, -1) : trimmedValue
}

export function getStatusClass(status: string, flaky: boolean): string {
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

export function getIncidentStatusClass(severity: 'active' | 'monitoring' | 'resolved'): string {
    if (severity === 'active') {
        return 'status-failed'
    }

    if (severity === 'monitoring') {
        return 'status-flaky'
    }

    return 'status-passed'
}

export function formatStatusLabel(status: string, flaky: boolean): string {
    if (flaky) {
        return HISTORY_TEXT.labels.flaky
    }

    if (status === 'unknown') {
        return HISTORY_TEXT.states.unknown
    }

    return ru.dashboard.statusLabels[status as keyof typeof ru.dashboard.statusLabels] ?? status
}

export function formatNullableNumber(value: number | null): string {
    return value === null ? '—' : value.toFixed(1)
}

export function formatNullableDays(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(2)} дн`
}

export function formatCommit(commit: string | null): string {
    if (!commit) {
        return '—'
    }

    return commit.slice(0, 8)
}

export function buildHistoryRowAnchor(runId: string): string {
    return buildSharedHistoryRowAnchor(runId)
}

export function formatRunsLabel(count: number): string {
    return formatSharedRunsLabel(count)
}

export function getRunWord(count: number): string {
    return getSharedRunWord(count)
}

export function formatTemplate(template: string, values: Record<string, string>): string {
    return formatSharedTemplate(template, values)
}


