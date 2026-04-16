"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderProblematicTestRow = renderProblematicTestRow;
exports.renderFlakyTestRow = renderFlakyTestRow;
exports.renderSlowTestRow = renderSlowTestRow;
exports.renderDurationBreakdownRow = renderDurationBreakdownRow;
exports.renderCurrentRunTestsBrowser = renderCurrentRunTestsBrowser;
exports.renderStatusDrilldown = renderStatusDrilldown;
exports.renderCurrentRunTestRow = renderCurrentRunTestRow;
exports.renderHistoryRow = renderHistoryRow;
exports.renderTabButton = renderTabButton;
exports.renderPhaseLegend = renderPhaseLegend;
exports.renderOverflowText = renderOverflowText;
exports.toPerformanceChartDataset = toPerformanceChartDataset;
exports.getLeadingPhase = getLeadingPhase;
exports.formatPerformancePhaseLabel = formatPerformancePhaseLabel;
exports.shortenChartLabel = shortenChartLabel;
exports.roundChartValue = roundChartValue;
exports.getStatusClass = getStatusClass;
exports.formatStatusLabel = formatStatusLabel;
exports.formatPassRateDelta = formatPassRateDelta;
exports.formatCountDelta = formatCountDelta;
exports.formatDurationDelta = formatDurationDelta;
exports.formatMetricDelta = formatMetricDelta;
exports.getTrendArrow = getTrendArrow;
exports.formatCommit = formatCommit;
exports.formatRunLabel = formatRunLabel;
exports.formatCurrency = formatCurrency;
exports.formatMinutes = formatMinutes;
exports.formatNullableMinutes = formatNullableMinutes;
exports.formatDailyRatio = formatDailyRatio;
exports.formatScore = formatScore;
exports.formatNullableDays = formatNullableDays;
exports.formatNullablePercent = formatNullablePercent;
exports.formatCostAssumptions = formatCostAssumptions;
exports.formatAssumptionValue = formatAssumptionValue;
exports.renderManagerOverview = renderManagerOverview;
exports.renderManagerSignalCard = renderManagerSignalCard;
exports.renderManagerBlocker = renderManagerBlocker;
exports.renderManagerChange = renderManagerChange;
exports.getManagerSignalClass = getManagerSignalClass;
exports.getManagerBlockerHref = getManagerBlockerHref;
exports.getManagerReadinessLabel = getManagerReadinessLabel;
exports.getManagerRiskLabel = getManagerRiskLabel;
exports.getManagerChangeClass = getManagerChangeClass;
exports.getManagerChangeLabel = getManagerChangeLabel;
exports.renderFlakyHistoryInsight = renderFlakyHistoryInsight;
exports.getFlakyTopTestsEmptyState = getFlakyTopTestsEmptyState;
exports.renderReleaseConfidenceBreakdown = renderReleaseConfidenceBreakdown;
exports.renderBusinessMetricReadiness = renderBusinessMetricReadiness;
exports.buildReleaseConfidenceBreakdown = buildReleaseConfidenceBreakdown;
exports.buildBusinessMetricReadiness = buildBusinessMetricReadiness;
exports.getBusinessReadinessStatusLabel = getBusinessReadinessStatusLabel;
exports.getDashboardScoreTone = getDashboardScoreTone;
exports.clampDashboardScore = clampDashboardScore;
exports.averageDashboardNumber = averageDashboardNumber;
exports.roundToOneDigit = roundToOneDigit;
exports.getBusinessAssumptionsState = getBusinessAssumptionsState;
exports.getBusinessScenarioStatusClass = getBusinessScenarioStatusClass;
exports.getBusinessScenarioStatusLabel = getBusinessScenarioStatusLabel;
exports.getBusinessScenarioStatusHint = getBusinessScenarioStatusHint;
exports.getBusinessImpactLevel = getBusinessImpactLevel;
exports.getBusinessImpactClass = getBusinessImpactClass;
exports.getBusinessImpactLabel = getBusinessImpactLabel;
exports.getBusinessDriverType = getBusinessDriverType;
exports.getBusinessBreakdownItemClass = getBusinessBreakdownItemClass;
exports.getBusinessDriverSignalClass = getBusinessDriverSignalClass;
exports.getBusinessDriverInsightTitle = getBusinessDriverInsightTitle;
exports.getBusinessDriverInsightBody = getBusinessDriverInsightBody;
exports.formatCostShare = formatCostShare;
exports.formatCostShareWidth = formatCostShareWidth;
exports.getTrendClass = getTrendClass;
exports.renderFilterSelect = renderFilterSelect;
exports.buildTestHistoryHref = buildTestHistoryHref;
exports.normalizeDashboardBasePath = normalizeDashboardBasePath;
exports.buildDashboardTabHref = buildDashboardTabHref;
exports.buildQueryString = buildQueryString;
exports.serializeForInlineScript = serializeForInlineScript;
const render_metric_info_1 = require("./render-metric-info");
const dashboard_metric_info_1 = require("./shared/dashboard-metric-info");
const formatting_1 = require("./shared/formatting");
const dashboard_helpers_1 = require("./shared/dashboard-helpers");
const navigation_1 = require("./shared/navigation");
const ru_1 = require("./shared/i18n/ru");
const text_utils_1 = require("./shared/text-utils");
const DASHBOARD_TEXT = ru_1.ru.dashboard;
function renderProblematicTestRow(test, filters, testDetailsBasePath) {
    const statusClass = getStatusClass(test.status, test.flaky);
    const flakyLabel = test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no;
    const testHref = buildTestHistoryHref(test.title, {
        branch: filters.branch,
        project: test.project,
        file: test.file,
    }, testDetailsBasePath);
    return `
        <tr>
            <td><a class="test-link" href="${(0, text_utils_1.escapeHtml)(testHref)}">${renderOverflowText(test.title, { className: 'table-cell-text' })}</a></td>
            <td>${renderOverflowText(test.file, { className: 'table-cell-text' })}</td>
            <td><span class="status-badge ${statusClass}">${(0, text_utils_1.escapeHtml)(formatStatusLabel(test.status, test.flaky))}</span></td>
            <td>${flakyLabel}</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatPercent)(test.failureRate))} (${test.attempts} попыток)</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDuration)(test.durationMs))}</td>
            <td>${renderOverflowText(test.errorMessage, { className: 'table-cell-text-wide mono' })}</td>
        </tr>
    `;
}
function renderFlakyTestRow(test, filters, testDetailsBasePath) {
    const testHref = buildTestHistoryHref(test.title, {
        branch: filters.branch,
        project: test.project,
        file: test.file,
    }, testDetailsBasePath);
    return `
        <tr>
            <td><a class="test-link" href="${(0, text_utils_1.escapeHtml)(testHref)}">${renderOverflowText(test.title, { className: 'table-cell-text' })}</a></td>
            <td>${renderOverflowText(test.file, { className: 'table-cell-text' })}</td>
            <td>${(0, text_utils_1.escapeHtml)(formatScore(test.flakyScore))}</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatPercent)(test.failRate))}</td>
            <td>${(0, text_utils_1.escapeHtml)(formatNullableDays(test.mtbfDays))}</td>
            <td>${test.unstableRuns} / ${test.totalRuns}</td>
            <td><span class="status-badge ${getStatusClass(test.latestStatus, false)}">${(0, text_utils_1.escapeHtml)(formatStatusLabel(test.latestStatus, false))}</span></td>
        </tr>
    `;
}
function renderSlowTestRow(test, filters, testDetailsBasePath) {
    const testHref = buildTestHistoryHref(test.title, {
        branch: filters.branch,
        project: test.project,
        file: test.file,
    }, testDetailsBasePath);
    return `
        <tr>
            <td><a class="test-link" href="${(0, text_utils_1.escapeHtml)(testHref)}">${renderOverflowText(test.title, { className: 'table-cell-text' })}</a></td>
            <td>${renderOverflowText(test.file, { className: 'table-cell-text' })}</td>
            <td><span class="status-badge ${getStatusClass(test.status, test.flaky)}">${(0, text_utils_1.escapeHtml)(formatStatusLabel(test.status, test.flaky))}</span></td>
            <td>${test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no}</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDuration)(test.durationMs))}</td>
            <td>${renderOverflowText(test.errorMessage ?? '—', { className: 'table-cell-text-wide mono' })}</td>
        </tr>
    `;
}
function renderDurationBreakdownRow(item) {
    return `
        <tr>
            <td>${renderOverflowText(item.label, { className: 'table-cell-text-wide' })}</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDuration)(item.durationMs))}</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatPercent)(item.sharePercent))}</td>
            <td>${item.tests}</td>
        </tr>
    `;
}
function renderCurrentRunTestsBrowser(summary, testDetailsBasePath) {
    const groups = [
        { id: 'all', label: DASHBOARD_TEXT.testsBrowser.all, tests: summary.currentRunTests.all },
        { id: 'passed', label: DASHBOARD_TEXT.testsBrowser.passed, tests: summary.currentRunTests.passed },
        { id: 'failed', label: DASHBOARD_TEXT.testsBrowser.failed, tests: summary.currentRunTests.failed },
        { id: 'flaky', label: DASHBOARD_TEXT.testsBrowser.flaky, tests: summary.currentRunTests.flaky },
        { id: 'skipped', label: DASHBOARD_TEXT.testsBrowser.skipped, tests: summary.currentRunTests.skipped },
        { id: 'timedOut', label: DASHBOARD_TEXT.testsBrowser.timedOut, tests: summary.currentRunTests.timedOut },
        { id: 'interrupted', label: DASHBOARD_TEXT.testsBrowser.interrupted, tests: summary.currentRunTests.interrupted },
    ];
    return `
        <div class="chart-card tests-browser-card" data-tab-section="current-run-tests">
            <div class="tests-browser-header">
                <div>
                    <div class="tests-browser-title">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.testsBrowser.title)}</div>
                    <div class="muted">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.testsBrowser.description)}</div>
                </div>
            </div>
            <div class="tests-browser-nav">
                ${groups.map((group, index) => `
                    <button class="tests-browser-button${index === 0 ? ' is-active' : ''}" type="button" data-tests-status-button="${(0, text_utils_1.escapeHtml)(group.id)}">
                        <span>${(0, text_utils_1.escapeHtml)(group.label)}</span>
                        <span class="tests-browser-count">${group.tests.length}</span>
                    </button>
                `).join('')}
            </div>
            ${groups.map((group, index) => `
                <div class="tests-browser-panel${index === 0 ? ' is-active' : ''}" data-tests-status-panel="${(0, text_utils_1.escapeHtml)(group.id)}">
                    <div class="table-container tests-browser-table-container" style="margin-bottom: 0;">
                        <table>
                            <thead>
                                <tr>
                                    <th>${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.tables.test)}</th>
                                    <th>${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.tables.file)}</th>
                                    <th>${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.filters.project)}</th>
                                    <th>${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.tables.status)}</th>
                                    <th>${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.tables.flaky)}</th>
                                    <th>${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.tables.duration)}</th>
                                    <th>${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.tables.lastError)}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${group.tests.length > 0
        ? group.tests.map((test) => renderCurrentRunTestRow(test, summary.filters, testDetailsBasePath)).join('')
        : `<tr><td colspan="7">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.testsBrowser.empty)}</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}
function renderStatusDrilldown(summary) {
    const items = [
        { id: 'passed', label: DASHBOARD_TEXT.testsBrowser.passed, count: summary.currentRunTests.passed.length },
        { id: 'failed', label: DASHBOARD_TEXT.testsBrowser.failed, count: summary.currentRunTests.failed.length },
        { id: 'flaky', label: DASHBOARD_TEXT.testsBrowser.flaky, count: summary.currentRunTests.flaky.length },
        { id: 'skipped', label: DASHBOARD_TEXT.testsBrowser.skipped, count: summary.currentRunTests.skipped.length },
        { id: 'timedOut', label: DASHBOARD_TEXT.testsBrowser.timedOut, count: summary.currentRunTests.timedOut.length },
        { id: 'interrupted', label: DASHBOARD_TEXT.testsBrowser.interrupted, count: summary.currentRunTests.interrupted.length },
    ];
    return `
        <div class="status-drilldown-grid">
            ${items.map((item) => `
                <button class="status-drilldown-button" type="button" data-open-tests-status="${(0, text_utils_1.escapeHtml)(item.id)}">
                    <span>${(0, text_utils_1.escapeHtml)(item.label)}</span>
                    <span class="status-drilldown-count">${item.count}</span>
                </button>
            `).join('')}
        </div>
    `;
}
function renderCurrentRunTestRow(test, filters, testDetailsBasePath) {
    const testHref = buildTestHistoryHref(test.title, {
        branch: filters.branch,
        project: test.project,
        file: test.file,
    }, testDetailsBasePath);
    return `
        <tr>
            <td><a class="test-link" href="${(0, text_utils_1.escapeHtml)(testHref)}">${renderOverflowText(test.title, { className: 'table-cell-text' })}</a></td>
            <td>${renderOverflowText(test.file, { className: 'table-cell-text' })}</td>
            <td>${renderOverflowText(test.project, { className: 'table-cell-text' })}</td>
            <td><span class="status-badge ${getStatusClass(test.status, test.flaky)}">${(0, text_utils_1.escapeHtml)(formatStatusLabel(test.status, test.flaky))}</span></td>
            <td>${test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no}</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDuration)(test.durationMs))}</td>
            <td>${renderOverflowText(test.errorMessage ?? '—', { className: 'table-cell-text-wide mono' })}</td>
        </tr>
    `;
}
function renderHistoryRow(run) {
    return `
        <tr>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDate)(run.reportTimestamp ?? run.generatedAt))}</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatPercent)(run.passRate))}</td>
            <td>${run.failedTests}</td>
            <td>${run.flakyTests}</td>
            <td>${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDuration)(run.totalDurationMs))}</td>
            <td>${renderOverflowText(run.branch ?? '—', { className: 'table-cell-text' })}</td>
            <td>${(0, text_utils_1.escapeHtml)(formatCommit(run.commit))}</td>
            <td>${renderOverflowText(run.author ?? '—', { className: 'table-cell-text' })}</td>
            <td>${renderOverflowText(run.sourceFile, { className: 'table-cell-text-wide' })}</td>
        </tr>
    `;
}
function renderTabButton(id, label, isActive = false) {
    return `<button class="tab-button${isActive ? ' is-active' : ''}" type="button" role="tab" aria-selected="${isActive ? 'true' : 'false'}" data-tab-button="${(0, text_utils_1.escapeHtml)(id)}">${(0, text_utils_1.escapeHtml)(label)}</button>`;
}
function renderPhaseLegend(items) {
    const visibleItems = items.filter((item) => item.durationMs > 0);
    if (visibleItems.length === 0) {
        return '';
    }
    return `
        <div class="phase-legend" aria-label="${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.performance.phaseLegendLabel)}">
            ${visibleItems.map((item) => `
                <div class="phase-legend-item">
                    <div class="phase-legend-label">${(0, text_utils_1.escapeHtml)(formatPerformancePhaseLabel(item.label))}</div>
                    <div class="phase-legend-value">${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDuration)(item.durationMs))} • ${(0, text_utils_1.escapeHtml)((0, formatting_1.formatPercent)(item.sharePercent))}</div>
                </div>
            `).join('')}
        </div>
    `;
}
function renderOverflowText(value, options = {}) {
    const tagName = options.tagName ?? 'span';
    const fullValue = typeof value === 'string' && value.length > 0 ? value : '—';
    const displayValue = options.displayValue ?? fullValue;
    const className = ['overflow-text', options.className].filter(Boolean).join(' ');
    return `<${tagName} class="${(0, text_utils_1.escapeHtml)(className)}" title="${(0, text_utils_1.escapeHtml)(fullValue)}">${(0, text_utils_1.escapeHtml)(displayValue)}</${tagName}>`;
}
function toPerformanceChartDataset(items, options = {}) {
    const labelFormatter = options.labelFormatter ?? ((label) => label);
    const fullLabelFormatter = options.fullLabelFormatter ?? ((label) => label);
    const divisor = options.unit === 'seconds' ? 1000 : 60000;
    const normalizedItems = items.filter((item) => item.durationMs > 0);
    return {
        labels: normalizedItems.map((item) => labelFormatter(item.label)),
        values: normalizedItems.map((item) => roundChartValue(item.durationMs / divisor)),
        fullLabels: normalizedItems.map((item) => fullLabelFormatter(item.label)),
    };
}
function getLeadingPhase(items) {
    if (items.length === 0) {
        return null;
    }
    return [...items].sort((left, right) => right.durationMs - left.durationMs)[0] ?? null;
}
function formatPerformancePhaseLabel(label) {
    return (0, dashboard_helpers_1.formatPerformancePhaseLabel)(label);
}
function shortenChartLabel(label, maxLength) {
    if (label.length <= maxLength) {
        return label;
    }
    return `${label.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`;
}
function roundChartValue(value) {
    return Math.round(value * 10) / 10;
}
function getStatusClass(status, flaky) {
    if (flaky) {
        return 'status-flaky';
    }
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'failed' || normalizedStatus === 'timedout' || normalizedStatus === 'timed out' || normalizedStatus === 'interrupted') {
        return 'status-failed';
    }
    if (normalizedStatus === 'passed') {
        return 'status-passed';
    }
    if (normalizedStatus === 'skipped') {
        return 'status-skipped';
    }
    return 'status-unknown';
}
function formatStatusLabel(status, flaky) {
    return (0, dashboard_helpers_1.formatStatusLabel)(status, flaky);
}
function formatPassRateDelta(delta) {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRun;
    }
    if (delta === 0) {
        return DASHBOARD_TEXT.states.noChanges;
    }
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)} п.п. к прошлому прогону`;
}
function formatCountDelta(label, delta) {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRun;
    }
    if (delta === 0) {
        return `Без изменений ${label}`;
    }
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta} ${label}`;
}
function formatDurationDelta(delta) {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRun;
    }
    if (delta === 0) {
        return DASHBOARD_TEXT.states.noChanges;
    }
    const sign = delta > 0 ? '+' : '-';
    return `${sign}${(0, formatting_1.formatDuration)(Math.abs(delta))} к прошлому прогону`;
}
function formatMetricDelta(delta, type, inverted) {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRunShort;
    }
    if (delta === 0) {
        return DASHBOARD_TEXT.states.noChangesShort;
    }
    const arrow = getTrendArrow(delta, inverted);
    if (type === 'pp') {
        const sign = delta > 0 ? '+' : '';
        return `${arrow} ${sign}${delta.toFixed(1)} п.п.`;
    }
    if (type === 'count') {
        const sign = delta > 0 ? '+' : '';
        return `${arrow} ${sign}${delta}`;
    }
    const sign = delta > 0 ? '+' : '-';
    return `${arrow} ${sign}${(0, formatting_1.formatDuration)(Math.abs(delta))}`;
}
function getTrendArrow(delta, inverted) {
    if (delta === null || delta === 0) {
        return '→';
    }
    if (inverted) {
        return delta < 0 ? '↑' : '↓';
    }
    return delta > 0 ? '↑' : '↓';
}
function formatCommit(commit) {
    return (0, dashboard_helpers_1.formatCommit)(commit);
}
function formatRunLabel(run) {
    if (!run) {
        return '—';
    }
    const dateLabel = (0, formatting_1.formatDate)(run.reportTimestamp ?? run.generatedAt);
    const branchLabel = run.branch ? ` • ${run.branch}` : '';
    const commitLabel = run.commit ? ` • ${formatCommit(run.commit)}` : '';
    return `${dateLabel}${branchLabel}${commitLabel}`;
}
function formatCurrency(value) {
    return (0, dashboard_helpers_1.formatCurrency)(value);
}
function formatMinutes(value) {
    return (0, dashboard_helpers_1.formatMinutes)(value);
}
function formatNullableMinutes(value) {
    return (0, dashboard_helpers_1.formatNullableMinutes)(value);
}
function formatDailyRatio(value) {
    return (0, dashboard_helpers_1.formatDailyRatio)(value);
}
function formatScore(value) {
    return (0, dashboard_helpers_1.formatScore)(value);
}
function formatNullableDays(value) {
    return (0, dashboard_helpers_1.formatNullableDays)(value);
}
function formatNullablePercent(value) {
    return (0, dashboard_helpers_1.formatNullablePercent)(value);
}
function formatCostAssumptions(summary) {
    const assumptions = summary.businessMetrics.costOfFlakiness.assumptions;
    if (assumptions.ciMinuteCostRub === null && assumptions.developerHourlyCostRub === null) {
        return DASHBOARD_TEXT.business.assumptionsEmpty;
    }
    return `${DASHBOARD_TEXT.business.ciMinuteCost} ${assumptions.ciMinuteCostRub ?? 0} ₽/мин • ${DASHBOARD_TEXT.business.devHourCost} ${assumptions.developerHourlyCostRub ?? 0} ₽/час • ${DASHBOARD_TEXT.business.analysisMinutes} ${assumptions.analysisMinutesPerUnstable ?? 0} мин/инцидент`;
}
function formatAssumptionValue(value, unit) {
    return (0, dashboard_helpers_1.formatAssumptionValue)(value, unit);
}
function renderManagerOverview(summary, dashboardActionPath) {
    return `
        <div class="manager-summary-card">
            <div class="manager-summary-header">
                <div>
                    <div class="manager-summary-title">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.summaryTitle)}</div>
                    <div class="manager-summary-description">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.summaryDescription)}</div>
                </div>
                <div class="manager-status-pill ${(0, text_utils_1.escapeHtml)(getManagerSignalClass(summary.managerSummary.releaseReadiness.level))}">${(0, text_utils_1.escapeHtml)(getManagerReadinessLabel(summary.managerSummary.releaseReadiness.level))}</div>
            </div>
            <div class="manager-signal-grid">
                ${renderManagerSignalCard(DASHBOARD_TEXT.manager.releaseReadiness, summary.managerSummary.releaseReadiness, getManagerReadinessLabel(summary.managerSummary.releaseReadiness.level), 'Рассчитано из release confidence, failed tests и динамики pass rate.')}
                ${renderManagerSignalCard(DASHBOARD_TEXT.manager.qualityRisk, summary.managerSummary.qualityRisk, getManagerRiskLabel(summary.managerSummary.qualityRisk.level), 'Учитывает pass rate, flaky ratio, кластеры ошибок и историческую нестабильность.')}
                ${renderManagerSignalCard(DASHBOARD_TEXT.manager.deliveryRisk, summary.managerSummary.deliveryRisk, getManagerRiskLabel(summary.managerSummary.deliveryRisk.level), 'Учитывает деградацию длительности, самые медленные тесты и трение команды от rerun/retry.')}
            </div>
        </div>

        <div class="manager-detail-grid">
            <div class="chart-card">
                <div class="chart-title">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.blockersTitle)}</div>
                <div class="muted">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.blockersDescription)}</div>
                <div class="manager-blocker-list">
                    ${summary.managerSummary.blockers.length > 0
        ? summary.managerSummary.blockers.map((blocker) => renderManagerBlocker(blocker, summary.filters, dashboardActionPath)).join('')
        : `<div class="manager-blocker-item"><div class="manager-blocker-body">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.noBlockers)}</div></div>`}
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.changesTitle)}</div>
                <div class="muted">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.changesDescription)}</div>
                <div class="muted" style="margin-top: 8px;">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.changesRunsMeta
        .replace('{current}', formatRunLabel(summary.comparison.currentRun))
        .replace('{previous}', formatRunLabel(summary.comparison.previousRun)))}</div>
                <div class="manager-change-list">
                    ${summary.managerSummary.changes.length > 0
        ? summary.managerSummary.changes.map((change) => renderManagerChange(change)).join('')
        : `<div class="manager-change-item"><div class="manager-change-body">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.noChanges)}</div></div>`}
                </div>
            </div>
        </div>
    `;
}
function renderManagerSignalCard(label, signal, levelLabel, hint) {
    return `
        <div class="manager-signal-card">
            <div class="manager-signal-label">${(0, text_utils_1.escapeHtml)(label)}</div>
            <div class="manager-signal-value">${(0, text_utils_1.escapeHtml)(formatScore(signal.score))}</div>
            <div class="manager-signal-meta">
                <span class="manager-item-pill ${(0, text_utils_1.escapeHtml)(getManagerSignalClass(signal.level))}">${(0, text_utils_1.escapeHtml)(levelLabel)}</span>
            </div>
            <div class="manager-signal-hint">${(0, text_utils_1.escapeHtml)(hint)}</div>
        </div>
    `;
}
function renderManagerBlocker(blocker, filters, dashboardActionPath) {
    const blockerHref = getManagerBlockerHref(blocker, filters, dashboardActionPath);
    return `
        <div class="manager-blocker-item">
            <div class="manager-blocker-head">
                <div class="manager-blocker-title">${(0, text_utils_1.escapeHtml)(blocker.title)}</div>
                <div class="manager-item-pill manager-item-${(0, text_utils_1.escapeHtml)(blocker.severity)}">${(0, text_utils_1.escapeHtml)(blocker.value)}</div>
            </div>
            <div class="manager-blocker-body">${(0, text_utils_1.escapeHtml)(blocker.details)}</div>
            ${blockerHref
        ? `<a class="manager-blocker-link" href="${(0, text_utils_1.escapeHtml)(blockerHref)}">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.manager.blockerAction)}</a>`
        : ''}
        </div>
    `;
}
function renderManagerChange(change) {
    return `
        <div class="manager-change-item">
            <div class="manager-change-head">
                <div class="manager-change-title">${(0, text_utils_1.escapeHtml)(change.label)}</div>
                <div class="manager-change-value">${(0, text_utils_1.escapeHtml)(change.value)}</div>
            </div>
            <div class="manager-change-body">${(0, text_utils_1.escapeHtml)(change.details)}</div>
            <div style="margin-top: 10px;"><span class="manager-item-pill manager-item-${(0, text_utils_1.escapeHtml)(getManagerChangeClass(change.direction))}">${(0, text_utils_1.escapeHtml)(getManagerChangeLabel(change.direction))}</span></div>
        </div>
    `;
}
function getManagerSignalClass(level) {
    return `manager-status-${level}`;
}
function getManagerBlockerHref(blocker, filters, dashboardActionPath) {
    if (blocker.kind === 'problematic-test') {
        return buildDashboardTabHref(dashboardActionPath, filters, 'flaky', 'problematic-tests');
    }
    if (blocker.kind === 'duration') {
        return buildDashboardTabHref(dashboardActionPath, filters, 'performance', 'slow-tests');
    }
    if (blocker.kind === 'flaky') {
        return buildDashboardTabHref(dashboardActionPath, filters, 'flaky', 'flaky-tests');
    }
    if (blocker.kind === 'error-cluster') {
        return buildDashboardTabHref(dashboardActionPath, filters, 'flaky', 'error-clusters');
    }
    return null;
}
function getManagerReadinessLabel(level) {
    return (0, dashboard_helpers_1.getManagerReadinessLabel)(level);
}
function getManagerRiskLabel(level) {
    return (0, dashboard_helpers_1.getManagerRiskLabel)(level);
}
function getManagerChangeClass(direction) {
    return direction;
}
function getManagerChangeLabel(direction) {
    return (0, dashboard_helpers_1.getManagerChangeLabel)(direction);
}
function renderFlakyHistoryInsight(summary) {
    const insight = (0, dashboard_helpers_1.buildFlakyHistoryInsight)(summary);
    const noteClass = insight.tone === 'info'
        ? 'context-note is-info'
        : insight.tone === 'warn'
            ? 'context-note is-warning'
            : 'context-note';
    return `
        <div class="${(0, text_utils_1.escapeHtml)(noteClass)}">
            <div class="context-note-title">${(0, text_utils_1.escapeHtml)(insight.title)}</div>
            <div class="context-note-body">${(0, text_utils_1.escapeHtml)(insight.body)}</div>
        </div>
    `;
}
function getFlakyTopTestsEmptyState(summary) {
    return (0, dashboard_helpers_1.getFlakyTopTestsEmptyState)(summary);
}
function renderReleaseConfidenceBreakdown(summary) {
    const breakdown = buildReleaseConfidenceBreakdown(summary);
    const thresholdHint = breakdown.total >= 75
        ? DASHBOARD_TEXT.business.releaseConfidenceHealthyThreshold
        : DASHBOARD_TEXT.business.releaseConfidenceRiskThreshold;
    return `
        <div class="chart-card">
            <div class="chart-title">${(0, render_metric_info_1.renderMetricHeading)(DASHBOARD_TEXT.business.releaseConfidenceBreakdownTitle, dashboard_metric_info_1.DASHBOARD_METRIC_DESCRIPTIONS.releaseConfidenceScore)}</div>
            <div class="muted">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.business.releaseConfidenceBreakdownDescription)}</div>
            <div class="business-component-list">
                ${breakdown.components.map((component) => `
                    <div class="business-component-item">
                        <div class="business-component-head">
                            <span class="business-component-label">${(0, text_utils_1.escapeHtml)(component.label)}</span>
                            <span class="business-component-formula">${(0, text_utils_1.escapeHtml)(component.formula)}</span>
                        </div>
                        <div class="business-component-progress"><div class="business-component-fill ${(0, text_utils_1.escapeHtml)(component.tone)}" style="width: ${(0, text_utils_1.escapeHtml)(component.width)};"></div></div>
                    </div>
                `).join('')}
            </div>
            <div class="business-component-total">
                <span class="business-component-total-label">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.business.releaseConfidenceTotal)}</span>
                <span class="business-component-total-value">${(0, text_utils_1.escapeHtml)(formatScore(summary.businessMetrics.releaseConfidenceScore))}</span>
            </div>
            <div class="muted" style="margin-top: 12px;">${(0, text_utils_1.escapeHtml)(thresholdHint)}</div>
        </div>
    `;
}
function renderBusinessMetricReadiness(summary) {
    return `
        <div class="chart-card">
            <div class="chart-title">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.business.readinessTitle)}</div>
            <div class="muted">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.business.readinessDescription)}</div>
            <div class="metric-readiness-list">
                ${buildBusinessMetricReadiness(summary).map((item) => `
                    <div class="metric-readiness-item">
                        <div class="metric-readiness-head">
                            <span class="metric-readiness-title">${(0, text_utils_1.escapeHtml)(item.label)}</span>
                            <span class="metric-readiness-pill is-${(0, text_utils_1.escapeHtml)(item.status)}">${(0, text_utils_1.escapeHtml)(item.statusLabel)}</span>
                        </div>
                        <div class="metric-readiness-body">${(0, text_utils_1.escapeHtml)(item.hint)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
function buildReleaseConfidenceBreakdown(summary) {
    return (0, dashboard_helpers_1.buildReleaseConfidenceBreakdown)(summary);
}
function buildBusinessMetricReadiness(summary) {
    return (0, dashboard_helpers_1.buildBusinessMetricReadiness)(summary);
}
function getBusinessReadinessStatusLabel(status) {
    return (0, dashboard_helpers_1.getBusinessReadinessStatusLabel)(status);
}
function getDashboardScoreTone(value) {
    return (0, dashboard_helpers_1.getDashboardScoreTone)(value);
}
function clampDashboardScore(value) {
    return (0, dashboard_helpers_1.clampDashboardScore)(value);
}
function averageDashboardNumber(values) {
    return (0, dashboard_helpers_1.averageDashboardNumber)(values);
}
function roundToOneDigit(value) {
    return (0, dashboard_helpers_1.roundToOneDigit)(value);
}
function getBusinessAssumptionsState(assumptions) {
    return (0, dashboard_helpers_1.getBusinessAssumptionsState)(assumptions);
}
function getBusinessScenarioStatusClass(assumptions) {
    return `scenario-status-${getBusinessAssumptionsState(assumptions)}`;
}
function getBusinessScenarioStatusLabel(assumptions) {
    return (0, dashboard_helpers_1.getBusinessScenarioStatusLabel)(assumptions);
}
function getBusinessScenarioStatusHint(assumptions) {
    return (0, dashboard_helpers_1.getBusinessScenarioStatusHint)(assumptions);
}
function getBusinessImpactLevel(totalCost, costPerDay) {
    return (0, dashboard_helpers_1.getBusinessImpactLevel)(totalCost, costPerDay);
}
function getBusinessImpactClass(totalCost, costPerDay) {
    return (0, dashboard_helpers_1.getBusinessImpactClass)(totalCost, costPerDay);
}
function getBusinessImpactLabel(totalCost, costPerDay) {
    return (0, dashboard_helpers_1.getBusinessImpactLabel)(totalCost, costPerDay);
}
function getBusinessDriverType(ciCost, developerCost, totalCost) {
    return (0, dashboard_helpers_1.getBusinessDriverType)(ciCost, developerCost, totalCost);
}
function getBusinessBreakdownItemClass(ciCost, developerCost, totalCost, target) {
    return (0, dashboard_helpers_1.getBusinessBreakdownItemClass)(ciCost, developerCost, totalCost, target);
}
function getBusinessDriverSignalClass(ciCost, developerCost, totalCost, target) {
    return (0, dashboard_helpers_1.getBusinessDriverSignalClass)(ciCost, developerCost, totalCost, target);
}
function getBusinessDriverInsightTitle(ciCost, developerCost, totalCost) {
    return (0, dashboard_helpers_1.getBusinessDriverInsightTitle)(ciCost, developerCost, totalCost);
}
function getBusinessDriverInsightBody(ciCost, developerCost, totalCost) {
    return (0, dashboard_helpers_1.getBusinessDriverInsightBody)(ciCost, developerCost, totalCost);
}
function formatCostShare(value, total) {
    return (0, dashboard_helpers_1.formatCostShare)(value, total);
}
function formatCostShareWidth(value, total) {
    return (0, dashboard_helpers_1.formatCostShareWidth)(value, total);
}
function getTrendClass(delta, inverted) {
    if (delta === null || delta === 0) {
        return 'trend-neutral';
    }
    if (inverted) {
        return delta < 0 ? 'trend-up' : 'trend-down';
    }
    return delta > 0 ? 'trend-up' : 'trend-down';
}
function renderFilterSelect(name, label, options, selectedValue) {
    return `
        <label class="filter-field">
            <span class="filter-label">${(0, text_utils_1.escapeHtml)(label)}</span>
            <select class="filter-select" name="${name}">
                <option value="">${(0, text_utils_1.escapeHtml)(DASHBOARD_TEXT.filters.all)}</option>
                ${options.map((option) => `<option value="${(0, text_utils_1.escapeHtml)(option)}"${option === selectedValue ? ' selected' : ''}>${(0, text_utils_1.escapeHtml)(option)}</option>`).join('')}
            </select>
        </label>
    `;
}
function buildTestHistoryHref(title, filters, testDetailsBasePath) {
    return (0, navigation_1.buildTestHistoryHrefFromTestDetailsBasePath)(title, filters, testDetailsBasePath);
}
function normalizeDashboardBasePath(basePath) {
    if (typeof basePath !== 'string') {
        return '';
    }
    const trimmedValue = basePath.trim();
    if (!trimmedValue || trimmedValue === '/') {
        return '';
    }
    return trimmedValue.endsWith('/') ? trimmedValue.slice(0, -1) : trimmedValue;
}
function buildDashboardTabHref(dashboardActionPath, filters, tabId, sectionId) {
    return (0, navigation_1.buildDashboardTabHref)(dashboardActionPath, filters, tabId, sectionId);
}
function buildQueryString(filters) {
    return (0, navigation_1.buildQueryString)(filters);
}
function serializeForInlineScript(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
