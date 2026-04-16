"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderIncidentSummary = renderIncidentSummary;
exports.renderIncidentNarrative = renderIncidentNarrative;
exports.renderIncidentInsights = renderIncidentInsights;
exports.renderTestHistoryRow = renderTestHistoryRow;
exports.renderLatestUnstableEvent = renderLatestUnstableEvent;
exports.renderPreviousUnstableEvents = renderPreviousUnstableEvents;
exports.renderPreviousUnstableEventItem = renderPreviousUnstableEventItem;
exports.renderLatestStableRecovery = renderLatestStableRecovery;
exports.renderCurrentStabilityStreak = renderCurrentStabilityStreak;
exports.renderUnstableStreakBeforeRecovery = renderUnstableStreakBeforeRecovery;
exports.renderAttemptDiagnostics = renderAttemptDiagnostics;
exports.renderAttemptDiagnosticsCard = renderAttemptDiagnosticsCard;
exports.renderAttemptDetail = renderAttemptDetail;
exports.renderOverflowText = renderOverflowText;
exports.findIncidentStepAnchor = findIncidentStepAnchor;
exports.normalizeAnchorLookupValue = normalizeAnchorLookupValue;
exports.findLatestStableRecovery = findLatestStableRecovery;
exports.findCurrentStabilityStreak = findCurrentStabilityStreak;
exports.findUnstableStreakBeforeRecovery = findUnstableStreakBeforeRecovery;
exports.isStableHistoryItem = isStableHistoryItem;
exports.getUnstableHistoryItems = getUnstableHistoryItems;
exports.getUnstableEventLabel = getUnstableEventLabel;
exports.formatCurrentStabilityDescription = formatCurrentStabilityDescription;
exports.isUnstableHistoryItem = isUnstableHistoryItem;
exports.renderStatePage = renderStatePage;
exports.buildDashboardHref = buildDashboardHref;
exports.buildTestHistoryHref = buildTestHistoryHref;
exports.buildApiTestHistoryHref = buildApiTestHistoryHref;
exports.buildQueryString = buildQueryString;
exports.normalizeOptionalFilter = normalizeOptionalFilter;
exports.normalizeBasePath = normalizeBasePath;
exports.getStatusClass = getStatusClass;
exports.getIncidentStatusClass = getIncidentStatusClass;
exports.formatStatusLabel = formatStatusLabel;
exports.formatNullableNumber = formatNullableNumber;
exports.formatNullableDays = formatNullableDays;
exports.formatCommit = formatCommit;
exports.buildHistoryRowAnchor = buildHistoryRowAnchor;
exports.formatRunsLabel = formatRunsLabel;
exports.getRunWord = getRunWord;
exports.formatTemplate = formatTemplate;
const render_metric_info_1 = require("./render-metric-info");
const render_test_history_compatibility_only_1 = require("./render-test-history-compatibility-only");
const formatting_1 = require("./shared/formatting");
const navigation_1 = require("./shared/navigation");
const test_history_helpers_1 = require("./shared/test-history-helpers");
const ru_1 = require("./shared/i18n/ru");
const test_history_metric_info_1 = require("./shared/test-history-metric-info");
const text_utils_1 = require("./shared/text-utils");
const HISTORY_TEXT = ru_1.ru.testHistory;
/**
 * Сворачивает последний инцидент в одну обзорную карточку, чтобы оператору не приходилось вручную собирать картину из timeline и diagnostics.
 */
function renderIncidentSummary(incidentSummary, history) {
    if (!incidentSummary) {
        return '';
    }
    const formattedSummary = renderIncidentNarrative(incidentSummary.summary);
    const failureStepAnchor = findIncidentStepAnchor(history, incidentSummary.failureStepTitle);
    const insightsHtml = renderIncidentInsights(incidentSummary, failureStepAnchor);
    const severityDescription = HISTORY_TEXT.incident.severityDescription[incidentSummary.severity];
    const primarySignal = incidentSummary.failureStepErrorMessage ?? incidentSummary.latestErrorMessage ?? null;
    const shouldRenderMessageBlock = Boolean(incidentSummary.latestErrorMessage && incidentSummary.latestErrorMessage !== primarySignal);
    return `
        <div class="notice-inline incident-card is-${(0, text_utils_1.escapeHtml)(incidentSummary.severity)}">
            <div class="event-title">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.incident.title, HISTORY_TEXT.incident.tooltip, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${getIncidentStatusClass(incidentSummary.severity)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.severity[incidentSummary.severity])}</span>
            </div>
            <div class="incident-status-banner">
                <div class="incident-status-copy">
                    <div class="incident-status-label">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.severityLabel)}</div>
                    <div class="incident-status-text">${(0, text_utils_1.escapeHtml)(severityDescription)}</div>
                </div>
            </div>
            ${formattedSummary}
            <div class="incident-section-title">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.detailsTitle)}</div>
            ${insightsHtml}
            <div class="incident-grid">
                <div class="incident-kpi">
                    <div class="incident-kpi-label">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.categoryLabel)}</div>
                    <div class="incident-kpi-value">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.category[incidentSummary.category])}</div>
                </div>
                <div class="incident-kpi">
                    <div class="incident-kpi-label">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.confidenceLabel)}</div>
                    <div class="incident-kpi-value">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.confidence[incidentSummary.confidence])}</div>
                </div>
                <div class="incident-kpi">
                    <div class="incident-kpi-label">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.unstableRunsLabel)}</div>
                    <div class="incident-kpi-value">${incidentSummary.unstableRuns}</div>
                </div>
                <div class="incident-kpi">
                    <div class="incident-kpi-label">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.matchingRunsLabel)}</div>
                    <div class="incident-kpi-value">${incidentSummary.matchingRuns}</div>
                </div>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.firstSeenLabel)}: ${(0, text_utils_1.escapeHtml)(incidentSummary.firstSeenAt ? (0, formatting_1.formatDate)(incidentSummary.firstSeenAt) : '—')}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.latestSeenLabel)}: ${(0, text_utils_1.escapeHtml)(incidentSummary.latestSeenAt ? (0, formatting_1.formatDate)(incidentSummary.latestSeenAt) : '—')}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.recoveryLabel)}: ${(0, text_utils_1.escapeHtml)(incidentSummary.latestRecoveryAt ? (0, formatting_1.formatDate)(incidentSummary.latestRecoveryAt) : '—')}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.attemptsLabel)}: ${incidentSummary.affectedAttempts}</span>
                ${incidentSummary.failureStepTitle ? `<span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.failureStepLabel)}: ${(0, text_utils_1.escapeHtml)(incidentSummary.failureStepTitle)}</span>` : ''}
            </div>
            ${shouldRenderMessageBlock ? `<div class="incident-message mono">${(0, text_utils_1.escapeHtml)(incidentSummary.latestErrorMessage ?? '')}</div>` : ''}
            <div class="incident-section-title">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.evidenceTitle)}</div>
            <div class="incident-evidence-list">
                ${incidentSummary.evidence.map((item) => `<div class="incident-evidence-item">${(0, text_utils_1.escapeHtml)(item)}</div>`).join('')}
            </div>
        </div>
    `;
}
function renderIncidentNarrative(summary) {
    const parts = summary
        .split(/\.\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => part.endsWith('.') ? part : `${part}.`);
    if (parts.length === 0) {
        return '';
    }
    const [lead] = parts;
    return `
        <div class="incident-summary-stack">
            <div class="incident-summary-lead">${(0, text_utils_1.escapeHtml)(lead)}</div>
        </div>
    `;
}
function renderIncidentInsights(incidentSummary, failureStepAnchor) {
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
                ? `<div class="incident-insight-action"><a class="incident-insight-link" href="#${(0, text_utils_1.escapeHtml)(failureStepAnchor)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.incident.jumpToFailureStep)}</a></div>`
                : '',
        },
        {
            label: HISTORY_TEXT.incident.primarySignalLabel,
            value: incidentSummary.failureStepErrorMessage ?? incidentSummary.latestErrorMessage ?? HISTORY_TEXT.incident.notCaptured,
            empty: !incidentSummary.failureStepErrorMessage && !incidentSummary.latestErrorMessage,
        },
    ];
    return `
        <div class="incident-insights-grid">
            ${cards.map((card) => `
                <div class="incident-insight-card${card.empty ? ' is-empty' : ''}">
                    <div class="incident-insight-label">${(0, text_utils_1.escapeHtml)(card.label)}</div>
                    <div class="incident-insight-value">${(0, text_utils_1.escapeHtml)(card.value)}</div>
                    ${card.action ?? ''}
                </div>
            `).join('')}
        </div>
    `;
}
function renderTestHistoryRow(item) {
    const rowAnchor = buildHistoryRowAnchor(item.runId);
    return `
        <tr id="${(0, text_utils_1.escapeHtml)(rowAnchor)}" class="history-row">
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDate)(item.reportTimestamp ?? item.generatedAt))}</td>
            <td>${(0, text_utils_1.escapeHtml)(item.branch ?? '—')}</td>
            <td>${(0, text_utils_1.escapeHtml)(formatCommit(item.commit))}</td>
            <td>${(0, text_utils_1.escapeHtml)(item.author ?? '—')}</td>
            <td><span class="status-badge ${getStatusClass(item.status, item.flaky)}">${(0, text_utils_1.escapeHtml)(formatStatusLabel(item.status, item.flaky))}</span></td>
            <td>${item.flaky ? HISTORY_TEXT.states.yes : HISTORY_TEXT.states.no}</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDuration)(item.durationMs))}</td>
            <td>${item.retries}</td>
            <td>${item.attempts}</td>
            <td class="mono">${(0, text_utils_1.escapeHtml)(item.errorMessage ?? '—')}</td>
        </tr>
    `;
}
function renderLatestUnstableEvent(history) {
    const [latestEvent] = getUnstableHistoryItems(history);
    if (!latestEvent) {
        return '';
    }
    const isErrorEvent = Boolean(latestEvent.errorMessage);
    const label = isErrorEvent ? HISTORY_TEXT.metrics.latestError : HISTORY_TEXT.metrics.latestFlakyEvent;
    const cardClass = isErrorEvent ? 'event-card-error' : 'event-card-flaky';
    const description = isErrorEvent
        ? latestEvent.errorMessage ?? HISTORY_TEXT.texts.errorMissing
        : HISTORY_TEXT.texts.latestFlakyDescription;
    const rowAnchor = buildHistoryRowAnchor(latestEvent.runId);
    return `
        <div class="notice-inline event-card ${cardClass}">
            <div class="event-title">
                ${(0, render_metric_info_1.renderMetricHeading)(label, test_history_metric_info_1.TEST_HISTORY_METRIC_DESCRIPTIONS.latestEvent, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${getStatusClass(latestEvent.status, latestEvent.flaky)}">${(0, text_utils_1.escapeHtml)(formatStatusLabel(latestEvent.status, latestEvent.flaky))}</span>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.time)}: ${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDate)(latestEvent.reportTimestamp ?? latestEvent.generatedAt))}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.branch)}: ${(0, text_utils_1.escapeHtml)(latestEvent.branch ?? '—')}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.commit)}: ${(0, text_utils_1.escapeHtml)(formatCommit(latestEvent.commit))}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.retries)}: ${latestEvent.retries}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.attempts)}: ${latestEvent.attempts}</span>
            </div>
            <div class="event-body${isErrorEvent ? ' mono' : ''}">${(0, text_utils_1.escapeHtml)(description)}</div>
            <div class="event-actions">
                <a class="event-link" href="#${(0, text_utils_1.escapeHtml)(rowAnchor)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `;
}
function renderPreviousUnstableEvents(history) {
    const previousEvents = getUnstableHistoryItems(history).slice(1, 4);
    if (previousEvents.length === 0) {
        return '';
    }
    return `
        <div class="notice-inline event-card">
            ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.previousUnstableEvents, test_history_metric_info_1.TEST_HISTORY_METRIC_DESCRIPTIONS.previousUnstableEvents, { className: 'inline-heading', tagName: 'div' })}
            <div class="event-list">
                ${previousEvents.map((item) => renderPreviousUnstableEventItem(item)).join('')}
            </div>
        </div>
    `;
}
function renderPreviousUnstableEventItem(item) {
    const rowAnchor = buildHistoryRowAnchor(item.runId);
    const label = item.errorMessage
        ? HISTORY_TEXT.labels.error
        : (item.flaky ? HISTORY_TEXT.labels.flaky : formatStatusLabel(item.status, false));
    const description = item.errorMessage
        ? item.errorMessage
        : (item.flaky ? HISTORY_TEXT.texts.retryFlakyDescription : `Статус: ${formatStatusLabel(item.status, false)}.`);
    return `
        <div class="event-list-item">
            <div class="event-list-header">
                <div>
                    <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.time)}: ${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDate)(item.reportTimestamp ?? item.generatedAt))}</span>
                    <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.branch)}: ${(0, text_utils_1.escapeHtml)(item.branch ?? '—')}</span>
                    <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.commit)}: ${(0, text_utils_1.escapeHtml)(formatCommit(item.commit))}</span>
                </div>
                <span class="status-badge ${getStatusClass(item.status, item.flaky)}">${(0, text_utils_1.escapeHtml)(label)}</span>
            </div>
            <div class="event-list-description${item.errorMessage ? ' mono' : ''}">${(0, text_utils_1.escapeHtml)(description)}</div>
            <div class="event-actions">
                <span class="muted">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.retries)}: ${item.retries} • ${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.attempts)}: ${item.attempts}</span>
                <a class="event-link" href="#${(0, text_utils_1.escapeHtml)(rowAnchor)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `;
}
function renderLatestStableRecovery(history) {
    const recoveryPair = findLatestStableRecovery(history);
    if (!recoveryPair) {
        return '';
    }
    const rowAnchor = buildHistoryRowAnchor(recoveryPair.recovery.runId);
    const recoveredFromLabel = recoveryPair.previousUnstable.errorMessage
        ? HISTORY_TEXT.texts.recoveryFromError
        : (recoveryPair.previousUnstable.flaky
            ? HISTORY_TEXT.texts.recoveryFromFlaky
            : formatTemplate(HISTORY_TEXT.texts.statusPrefix, { status: formatStatusLabel(recoveryPair.previousUnstable.status, false) }));
    return `
        <div class="notice-inline event-card event-card-recovery">
            <div class="event-title">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.latestStableRecovery, test_history_metric_info_1.TEST_HISTORY_METRIC_DESCRIPTIONS.latestRecovery, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${getStatusClass(recoveryPair.recovery.status, recoveryPair.recovery.flaky)}">${(0, text_utils_1.escapeHtml)(formatStatusLabel(recoveryPair.recovery.status, recoveryPair.recovery.flaky))}</span>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.time)}: ${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDate)(recoveryPair.recovery.reportTimestamp ?? recoveryPair.recovery.generatedAt))}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.branch)}: ${(0, text_utils_1.escapeHtml)(recoveryPair.recovery.branch ?? '—')}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.commit)}: ${(0, text_utils_1.escapeHtml)(formatCommit(recoveryPair.recovery.commit))}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.retries)}: ${recoveryPair.recovery.retries}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.attempts)}: ${recoveryPair.recovery.attempts}</span>
            </div>
            <div class="event-body">${(0, text_utils_1.escapeHtml)(formatTemplate(HISTORY_TEXT.texts.recoveryAfter, {
        source: recoveredFromLabel,
        date: (0, formatting_1.formatDate)(recoveryPair.previousUnstable.reportTimestamp ?? recoveryPair.previousUnstable.generatedAt),
    }))}</div>
            <div class="event-actions">
                <a class="event-link" href="#${(0, text_utils_1.escapeHtml)(rowAnchor)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `;
}
function renderCurrentStabilityStreak(history) {
    const streak = findCurrentStabilityStreak(history);
    const rowAnchor = streak.latestStable ? buildHistoryRowAnchor(streak.latestStable.runId) : null;
    const afterUnstableLabel = streak.previousUnstable ? getUnstableEventLabel(streak.previousUnstable) : null;
    return `
        <div class="notice-inline event-card${streak.count > 0 ? ' event-card-recovery' : ''}">
            <div class="event-title">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.currentStabilityStreak, test_history_metric_info_1.TEST_HISTORY_METRIC_DESCRIPTIONS.currentStabilityStreak, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${streak.count > 0 ? 'status-passed' : 'status-unknown'}">${(0, text_utils_1.escapeHtml)(formatRunsLabel(streak.count))}</span>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.latestStable)}: ${(0, text_utils_1.escapeHtml)(streak.latestStable ? (0, formatting_1.formatDate)(streak.latestStable.reportTimestamp ?? streak.latestStable.generatedAt) : '—')}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.streakStart)}: ${(0, text_utils_1.escapeHtml)(streak.oldestStable ? (0, formatting_1.formatDate)(streak.oldestStable.reportTimestamp ?? streak.oldestStable.generatedAt) : '—')}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.currentLatestRun)}: ${(0, text_utils_1.escapeHtml)(history[0] ? (0, formatting_1.formatDate)(history[0].reportTimestamp ?? history[0].generatedAt) : '—')}</span>
            </div>
            <div class="event-body">${(0, text_utils_1.escapeHtml)(formatCurrentStabilityDescription(streak))}</div>
            ${afterUnstableLabel
        ? `<div class="event-actions"><span class="muted">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.afterUnstableEvent)}: ${(0, text_utils_1.escapeHtml)(afterUnstableLabel)}</span>${rowAnchor ? `<a class="event-link" href="#${(0, text_utils_1.escapeHtml)(rowAnchor)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.actions.jumpToRow)}</a>` : ''}</div>`
        : (rowAnchor ? `<div class="event-actions"><a class="event-link" href="#${(0, text_utils_1.escapeHtml)(rowAnchor)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.actions.jumpToRow)}</a></div>` : '')}
        </div>
    `;
}
function renderUnstableStreakBeforeRecovery(history) {
    const streak = findUnstableStreakBeforeRecovery(history);
    if (!streak) {
        return '';
    }
    const rowAnchor = buildHistoryRowAnchor(streak.latestUnstable.runId);
    const nearestLabel = getUnstableEventLabel(streak.latestUnstable);
    const cardClass = streak.latestUnstable.errorMessage ? 'event-card-error' : 'event-card-flaky';
    return `
        <div class="notice-inline event-card ${cardClass}">
            <div class="event-title">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.unstableStreakBeforeRecovery, test_history_metric_info_1.TEST_HISTORY_METRIC_DESCRIPTIONS.unstableStreakBeforeRecovery, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge status-flaky">${(0, text_utils_1.escapeHtml)(formatRunsLabel(streak.count))}</span>
            </div>
            <div class="event-meta">
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.recoveryAt)}: ${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDate)(streak.recovery.reportTimestamp ?? streak.recovery.generatedAt))}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.latestUnstable)}: ${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDate)(streak.latestUnstable.reportTimestamp ?? streak.latestUnstable.generatedAt))}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.oldestUnstable)}: ${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDate)(streak.oldestUnstable.reportTimestamp ?? streak.oldestUnstable.generatedAt))}</span>
            </div>
            <div class="event-body">${(0, text_utils_1.escapeHtml)(formatTemplate(HISTORY_TEXT.texts.unstableStreakBeforeRecovery, {
        count: String(streak.count),
        label: nearestLabel,
    }))}</div>
            <div class="event-actions">
                <a class="event-link" href="#${(0, text_utils_1.escapeHtml)(rowAnchor)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `;
}
function renderAttemptDiagnostics(history, artifactBasePath) {
    if (history.length === 0) {
        return '';
    }
    const latestRun = history[0];
    const latestUnstable = getUnstableHistoryItems(history)[0];
    const cards = [];
    if (latestRun) {
        cards.push(renderAttemptDiagnosticsCard(latestRun, HISTORY_TEXT.diagnostics.latestRunTitle, HISTORY_TEXT.diagnostics.latestRunDescription, artifactBasePath));
    }
    if (latestUnstable && latestUnstable.runId !== latestRun?.runId) {
        cards.push(renderAttemptDiagnosticsCard(latestUnstable, HISTORY_TEXT.diagnostics.latestUnstableTitle, HISTORY_TEXT.diagnostics.latestUnstableDescription, artifactBasePath));
    }
    if (cards.length === 0) {
        return '';
    }
    return `
        <div class="diagnostics-shell">
            ${cards.join('')}
        </div>
    `;
}
/**
 * Карточка diagnostics намеренно рендерит и последний запуск, и последний нестабильный эпизод, чтобы можно было сравнить текущее состояние с последним плохим run без просмотра всей истории.
 */
function renderAttemptDiagnosticsCard(item, title, description, artifactBasePath) {
    const rowAnchor = buildHistoryRowAnchor(item.runId);
    const attempts = item.attemptDetails ?? [];
    return `
        <div class="notice-inline diagnostics-card">
            <div class="diagnostics-card-header">
                ${(0, render_metric_info_1.renderMetricHeading)(title, test_history_metric_info_1.TEST_HISTORY_METRIC_DESCRIPTIONS.timeline, { className: 'inline-heading', tagName: 'div' })}
                <span class="status-badge ${getStatusClass(item.status, item.flaky)}">${(0, text_utils_1.escapeHtml)(formatStatusLabel(item.status, item.flaky))}</span>
            </div>
            <div class="diagnostics-card-description">${(0, text_utils_1.escapeHtml)(description)}</div>
            <div class="event-meta">
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.time)}: ${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDate)(item.reportTimestamp ?? item.generatedAt))}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.branch)}: ${(0, text_utils_1.escapeHtml)(item.branch ?? '—')}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.retries)}: ${item.retries}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.meta.attempts)}: ${item.attempts}</span>
            </div>
            <div class="attempt-explainer">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.retriesHint)}</div>
            <div class="attempt-list">
                ${attempts.map((attempt, index) => renderAttemptDetail(item.runId, attempt, index === 0, artifactBasePath)).join('')}
            </div>
            <div class="event-actions">
                <a class="event-link" href="#${(0, text_utils_1.escapeHtml)(rowAnchor)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.actions.jumpToRow)}</a>
            </div>
        </div>
    `;
}
function renderAttemptDetail(runId, attempt, isOpenByDefault, artifactBasePath) {
    const hasSteps = attempt.steps.length > 0;
    const hasAttachments = attempt.attachments.length > 0;
    return `
        <details class="attempt-item"${isOpenByDefault ? ' open' : ''}>
            <summary class="attempt-summary">
                <div class="attempt-summary-main">
                    <span class="attempt-chevron">▶</span>
                    <div class="attempt-title">${(0, text_utils_1.escapeHtml)(formatTemplate(HISTORY_TEXT.diagnostics.attemptTitle, { attempt: String(attempt.attempt) }))}</div>
                </div>
                <div class="attempt-header">
                    <div class="attempt-meta">
                        <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.duration)}: ${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDuration)(attempt.durationMs))}</span>
                        <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.steps)}: ${attempt.steps.length}</span>
                        <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.attachments)}: ${attempt.attachments.length}</span>
                    </div>
                    <span class="status-badge ${getStatusClass(attempt.status, false)}">${(0, text_utils_1.escapeHtml)(formatStatusLabel(attempt.status, false))}</span>
                </div>
            </summary>
            <div class="attempt-body">
                <div class="attempt-meta" style="margin: 10px 0 8px;">
                    <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.startTime)}: ${(0, text_utils_1.escapeHtml)(attempt.startTime ? (0, formatting_1.formatDate)(attempt.startTime) : '—')}</span>
                </div>
                ${attempt.errorMessage ? `<div class="attempt-error mono">${(0, text_utils_1.escapeHtml)(attempt.errorMessage)}</div>` : ''}
                ${hasSteps ? (0, render_test_history_compatibility_only_1.renderCompatibilityAttemptSteps)(runId, attempt.attempt, attempt.steps, Boolean(attempt.errorMessage)) : ''}
                ${hasAttachments ? `
                    <div class="attempt-section-title">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.attachmentsTitle)}</div>
                    <div class="attachment-list">
                        ${attempt.attachments.map((attachment) => (0, render_test_history_compatibility_only_1.renderCompatibilityAttachmentDetail)(runId, attachment, artifactBasePath)).join('')}
                    </div>
                ` : ''}
                ${!attempt.errorMessage && !hasSteps && !hasAttachments ? `<div class="muted">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.emptyAttempt)}</div>` : ''}
            </div>
        </details>
    `;
}
function renderOverflowText(value, options = {}) {
    const fullValue = typeof value === 'string' && value.length > 0 ? value : '—';
    const displayValue = options.displayValue ?? fullValue;
    const className = ['overflow-text', options.className].filter(Boolean).join(' ');
    return `<span class="${(0, text_utils_1.escapeHtml)(className)}" title="${(0, text_utils_1.escapeHtml)(fullValue)}">${(0, text_utils_1.escapeHtml)(displayValue)}</span>`;
}
/**
 * Incident summary ссылается на шаг падения по title, поэтому поиск нормализует и payload, и шаги в рендере, чтобы anchor не ломался из-за регистра или пробелов.
 */
function findIncidentStepAnchor(history, failureStepTitle) {
    return (0, test_history_helpers_1.findIncidentStepAnchor)(history, failureStepTitle);
}
function normalizeAnchorLookupValue(value) {
    return (0, test_history_helpers_1.normalizeAnchorLookupValue)(value);
}
function findLatestStableRecovery(history) {
    return (0, test_history_helpers_1.findLatestStableRecovery)(history);
}
function findCurrentStabilityStreak(history) {
    return (0, test_history_helpers_1.findCurrentStabilityStreak)(history);
}
function findUnstableStreakBeforeRecovery(history) {
    return (0, test_history_helpers_1.findUnstableStreakBeforeRecovery)(history);
}
function isStableHistoryItem(item) {
    return (0, test_history_helpers_1.isStableHistoryItem)(item);
}
function getUnstableHistoryItems(history) {
    return (0, test_history_helpers_1.getUnstableHistoryItems)(history);
}
function getUnstableEventLabel(item) {
    return (0, test_history_helpers_1.getUnstableEventLabel)(item);
}
function formatCurrentStabilityDescription(streak) {
    return (0, test_history_helpers_1.formatCurrentStabilityDescription)(streak);
}
function isUnstableHistoryItem(item) {
    return (0, test_history_helpers_1.isUnstableHistoryItem)(item);
}
function renderStatePage(options) {
    const dashboardHref = buildDashboardHref(options.filters, options.basePath);
    const apiHref = buildApiTestHistoryHref(options.title, options.filters, options.apiBasePath);
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${(0, text_utils_1.escapeHtml)(options.heading)}</title>
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
            <span class="state-code status-badge ${options.toneClass}">${(0, text_utils_1.escapeHtml)(options.statusCode)}</span>
            <div class="state-title">${(0, text_utils_1.escapeHtml)(options.heading)}</div>
            <div class="subtle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.statePages.testLabel)}: ${(0, text_utils_1.escapeHtml)(options.title)}</div>
            <div class="subtle" style="margin-top: 12px;">${(0, text_utils_1.escapeHtml)(options.message)}</div>
            <div>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.filters.branch)}: ${(0, text_utils_1.escapeHtml)(options.filters.branch ?? HISTORY_TEXT.filters.all)}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.filters.project)}: ${(0, text_utils_1.escapeHtml)(options.filters.project ?? HISTORY_TEXT.filters.all)}</span>
                <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.filters.file)}: ${(0, text_utils_1.escapeHtml)(options.filters.file ?? HISTORY_TEXT.filters.all)}</span>
            </div>
            ${options.extraContent ?? ''}
            <div class="page-actions">
                <a class="page-link page-link-secondary" href="${(0, text_utils_1.escapeHtml)(dashboardHref)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.backToDashboard)}</a>
                <a class="page-link page-link-primary" href="${(0, text_utils_1.escapeHtml)(apiHref)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.openJson)}</a>
            </div>
        </div>
    </div>
</body>
</html>`;
}
function buildDashboardHref(filters, basePath) {
    return (0, navigation_1.buildDashboardHrefFromBasePath)(filters, basePath);
}
function buildTestHistoryHref(title, filters, basePath) {
    return (0, navigation_1.buildTestHistoryHrefFromDashboardBasePath)(title, filters, basePath);
}
function buildApiTestHistoryHref(title, filters, basePath) {
    return (0, navigation_1.buildApiTestHistoryHrefFromBasePath)(title, filters, basePath);
}
function buildQueryString(filters) {
    return (0, navigation_1.buildQueryString)(filters);
}
function normalizeOptionalFilter(value) {
    return (0, navigation_1.normalizeOptionalFilter)(value);
}
function normalizeBasePath(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmedValue = value.trim();
    if (!trimmedValue || trimmedValue === '/') {
        return '';
    }
    return trimmedValue.endsWith('/') ? trimmedValue.slice(0, -1) : trimmedValue;
}
function getStatusClass(status, flaky) {
    if (flaky) {
        return 'status-flaky';
    }
    if (status === 'failed' || status === 'timedout' || status === 'interrupted') {
        return 'status-failed';
    }
    if (status === 'passed') {
        return 'status-passed';
    }
    if (status === 'skipped') {
        return 'status-skipped';
    }
    return 'status-unknown';
}
function getIncidentStatusClass(severity) {
    if (severity === 'active') {
        return 'status-failed';
    }
    if (severity === 'monitoring') {
        return 'status-flaky';
    }
    return 'status-passed';
}
function formatStatusLabel(status, flaky) {
    if (flaky) {
        return HISTORY_TEXT.labels.flaky;
    }
    if (status === 'unknown') {
        return HISTORY_TEXT.states.unknown;
    }
    return ru_1.ru.dashboard.statusLabels[status] ?? status;
}
function formatNullableNumber(value) {
    return value === null ? '—' : value.toFixed(1);
}
function formatNullableDays(value) {
    return value === null ? '—' : `${value.toFixed(2)} дн`;
}
function formatCommit(commit) {
    if (!commit) {
        return '—';
    }
    return commit.slice(0, 8);
}
function buildHistoryRowAnchor(runId) {
    return (0, test_history_helpers_1.buildHistoryRowAnchor)(runId);
}
function formatRunsLabel(count) {
    return (0, test_history_helpers_1.formatRunsLabel)(count);
}
function getRunWord(count) {
    return (0, test_history_helpers_1.getRunWord)(count);
}
function formatTemplate(template, values) {
    return (0, test_history_helpers_1.formatTemplate)(template, values);
}
