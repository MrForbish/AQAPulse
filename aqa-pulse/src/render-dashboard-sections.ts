import type {
    DashboardDurationBreakdownItem,
    DashboardFlakyTestMetric,
    DashboardPhaseBreakdownItem,
    DashboardProblematicTest,
    DashboardSlowTest,
    DashboardSummary,
} from './dashboard-utils'
import { METRIC_INFO_STYLES, renderMetricHeading } from './render-metric-info'
import { formatDate, formatDuration, formatPercent } from './shared/formatting'
import {
    averageDashboardNumber as averageDashboardNumberShared,
    buildBusinessMetricReadiness as buildBusinessMetricReadinessShared,
    buildFlakyHistoryInsight as buildFlakyHistoryInsightShared,
    buildReleaseConfidenceBreakdown as buildReleaseConfidenceBreakdownShared,
    clampDashboardScore as clampDashboardScoreShared,
    formatAssumptionValue as formatAssumptionValueShared,
    formatCommit as formatCommitShared,
    formatCostShare as formatCostShareShared,
    formatCostShareWidth as formatCostShareWidthShared,
    formatCurrency as formatCurrencyShared,
    formatDailyRatio as formatDailyRatioShared,
    formatMinutes as formatMinutesShared,
    formatNullableDays as formatNullableDaysShared,
    formatNullableMinutes as formatNullableMinutesShared,
    formatNullablePercent as formatNullablePercentShared,
    formatPerformancePhaseLabel as formatPerformancePhaseLabelShared,
    formatScore as formatScoreShared,
    formatStatusLabel as formatStatusLabelShared,
    getBusinessAssumptionsState as getBusinessAssumptionsStateShared,
    getBusinessBreakdownItemClass as getBusinessBreakdownItemClassShared,
    getBusinessDriverInsightBody as getBusinessDriverInsightBodyShared,
    getBusinessDriverInsightTitle as getBusinessDriverInsightTitleShared,
    getBusinessDriverSignalClass as getBusinessDriverSignalClassShared,
    getBusinessDriverType as getBusinessDriverTypeShared,
    getBusinessImpactClass as getBusinessImpactClassShared,
    getBusinessImpactLabel as getBusinessImpactLabelShared,
    getBusinessImpactLevel as getBusinessImpactLevelShared,
    getBusinessReadinessStatusLabel as getBusinessReadinessStatusLabelShared,
    getBusinessScenarioStatusHint as getBusinessScenarioStatusHintShared,
    getBusinessScenarioStatusLabel as getBusinessScenarioStatusLabelShared,
    getDashboardScoreTone as getDashboardScoreToneShared,
    getFlakyTopTestsEmptyState as getFlakyTopTestsEmptyStateShared,
    getManagerChangeLabel as getManagerChangeLabelShared,
    getManagerReadinessLabel as getManagerReadinessLabelShared,
    getManagerRiskLabel as getManagerRiskLabelShared,
    roundToOneDigit as roundToOneDigitShared,
} from './shared/dashboard-helpers'
import {
    buildDashboardTabHref as buildSharedDashboardTabHref,
    buildQueryString as buildSharedQueryString,
    buildTestHistoryHrefFromTestDetailsBasePath,
} from './shared/navigation'
import { ru } from './shared/i18n/ru'
import { escapeHtml } from './shared/text-utils'

const DASHBOARD_TEXT = ru.dashboard
const METRIC_DESCRIPTIONS = DASHBOARD_TEXT.tooltips


export function renderProblematicTestRow(test: DashboardProblematicTest, filters: DashboardSummary['filters'], testDetailsBasePath: string): string {
    const statusClass = getStatusClass(test.status, test.flaky)
    const flakyLabel = test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no
    const testHref = buildTestHistoryHref(test.title, {
        branch: filters.branch,
        project: test.project,
        file: test.file,
    }, testDetailsBasePath)

    return `
        <tr>
            <td><a class="test-link" href="${escapeHtml(testHref)}">${renderOverflowText(test.title, { className: 'table-cell-text' })}</a></td>
            <td>${renderOverflowText(test.file, { className: 'table-cell-text' })}</td>
            <td><span class="status-badge ${statusClass}">${escapeHtml(formatStatusLabel(test.status, test.flaky))}</span></td>
            <td>${flakyLabel}</td>
            <td>${escapeHtml(formatPercent(test.failureRate))} (${test.attempts} попыток)</td>
            <td>${escapeHtml(formatDuration(test.durationMs))}</td>
            <td>${renderOverflowText(test.errorMessage, { className: 'table-cell-text-wide mono' })}</td>
        </tr>
    `
}

export function renderFlakyTestRow(test: DashboardFlakyTestMetric, filters: DashboardSummary['filters'], testDetailsBasePath: string): string {
    const testHref = buildTestHistoryHref(test.title, {
        branch: filters.branch,
        project: test.project,
        file: test.file,
    }, testDetailsBasePath)

    return `
        <tr>
            <td><a class="test-link" href="${escapeHtml(testHref)}">${renderOverflowText(test.title, { className: 'table-cell-text' })}</a></td>
            <td>${renderOverflowText(test.file, { className: 'table-cell-text' })}</td>
            <td>${escapeHtml(formatScore(test.flakyScore))}</td>
            <td>${escapeHtml(formatPercent(test.failRate))}</td>
            <td>${escapeHtml(formatNullableDays(test.mtbfDays))}</td>
            <td>${test.unstableRuns} / ${test.totalRuns}</td>
            <td><span class="status-badge ${getStatusClass(test.latestStatus, false)}">${escapeHtml(formatStatusLabel(test.latestStatus, false))}</span></td>
        </tr>
    `
}

export function renderSlowTestRow(test: DashboardSlowTest, filters: DashboardSummary['filters'], testDetailsBasePath: string): string {
    const testHref = buildTestHistoryHref(test.title, {
        branch: filters.branch,
        project: test.project,
        file: test.file,
    }, testDetailsBasePath)

    return `
        <tr>
            <td><a class="test-link" href="${escapeHtml(testHref)}">${renderOverflowText(test.title, { className: 'table-cell-text' })}</a></td>
            <td>${renderOverflowText(test.file, { className: 'table-cell-text' })}</td>
            <td><span class="status-badge ${getStatusClass(test.status, test.flaky)}">${escapeHtml(formatStatusLabel(test.status, test.flaky))}</span></td>
            <td>${test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no}</td>
            <td>${escapeHtml(formatDuration(test.durationMs))}</td>
            <td>${renderOverflowText(test.errorMessage ?? '—', { className: 'table-cell-text-wide mono' })}</td>
        </tr>
    `
}

export function renderDurationBreakdownRow(item: DashboardDurationBreakdownItem): string {
    return `
        <tr>
            <td>${renderOverflowText(item.label, { className: 'table-cell-text-wide' })}</td>
            <td>${escapeHtml(formatDuration(item.durationMs))}</td>
            <td>${escapeHtml(formatPercent(item.sharePercent))}</td>
            <td>${item.tests}</td>
        </tr>
    `
}

export function renderCurrentRunTestsBrowser(summary: DashboardSummary, testDetailsBasePath: string): string {
    const groups = [
        { id: 'all', label: DASHBOARD_TEXT.testsBrowser.all, tests: summary.currentRunTests.all },
        { id: 'passed', label: DASHBOARD_TEXT.testsBrowser.passed, tests: summary.currentRunTests.passed },
        { id: 'failed', label: DASHBOARD_TEXT.testsBrowser.failed, tests: summary.currentRunTests.failed },
        { id: 'flaky', label: DASHBOARD_TEXT.testsBrowser.flaky, tests: summary.currentRunTests.flaky },
        { id: 'skipped', label: DASHBOARD_TEXT.testsBrowser.skipped, tests: summary.currentRunTests.skipped },
        { id: 'timedOut', label: DASHBOARD_TEXT.testsBrowser.timedOut, tests: summary.currentRunTests.timedOut },
        { id: 'interrupted', label: DASHBOARD_TEXT.testsBrowser.interrupted, tests: summary.currentRunTests.interrupted },
    ]

    return `
        <div class="chart-card tests-browser-card" data-tab-section="current-run-tests">
            <div class="tests-browser-header">
                <div>
                    <div class="tests-browser-title">${escapeHtml(DASHBOARD_TEXT.testsBrowser.title)}</div>
                    <div class="muted">${escapeHtml(DASHBOARD_TEXT.testsBrowser.description)}</div>
                </div>
            </div>
            <div class="tests-browser-nav">
                ${groups.map((group, index) => `
                    <button class="tests-browser-button${index === 0 ? ' is-active' : ''}" type="button" data-tests-status-button="${escapeHtml(group.id)}">
                        <span>${escapeHtml(group.label)}</span>
                        <span class="tests-browser-count">${group.tests.length}</span>
                    </button>
                `).join('')}
            </div>
            ${groups.map((group, index) => `
                <div class="tests-browser-panel${index === 0 ? ' is-active' : ''}" data-tests-status-panel="${escapeHtml(group.id)}">
                    <div class="table-container tests-browser-table-container" style="margin-bottom: 0;">
                        <table>
                            <thead>
                                <tr>
                                    <th>${escapeHtml(DASHBOARD_TEXT.tables.test)}</th>
                                    <th>${escapeHtml(DASHBOARD_TEXT.tables.file)}</th>
                                    <th>${escapeHtml(DASHBOARD_TEXT.filters.project)}</th>
                                    <th>${escapeHtml(DASHBOARD_TEXT.tables.status)}</th>
                                    <th>${escapeHtml(DASHBOARD_TEXT.tables.flaky)}</th>
                                    <th>${escapeHtml(DASHBOARD_TEXT.tables.duration)}</th>
                                    <th>${escapeHtml(DASHBOARD_TEXT.tables.lastError)}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${group.tests.length > 0
                                    ? group.tests.map((test) => renderCurrentRunTestRow(test, summary.filters, testDetailsBasePath)).join('')
                                    : `<tr><td colspan="7">${escapeHtml(DASHBOARD_TEXT.testsBrowser.empty)}</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            `).join('')}
        </div>
    `
}

export function renderStatusDrilldown(summary: DashboardSummary): string {
    const items = [
        { id: 'passed', label: DASHBOARD_TEXT.testsBrowser.passed, count: summary.currentRunTests.passed.length },
        { id: 'failed', label: DASHBOARD_TEXT.testsBrowser.failed, count: summary.currentRunTests.failed.length },
        { id: 'flaky', label: DASHBOARD_TEXT.testsBrowser.flaky, count: summary.currentRunTests.flaky.length },
        { id: 'skipped', label: DASHBOARD_TEXT.testsBrowser.skipped, count: summary.currentRunTests.skipped.length },
        { id: 'timedOut', label: DASHBOARD_TEXT.testsBrowser.timedOut, count: summary.currentRunTests.timedOut.length },
        { id: 'interrupted', label: DASHBOARD_TEXT.testsBrowser.interrupted, count: summary.currentRunTests.interrupted.length },
    ]

    return `
        <div class="status-drilldown-grid">
            ${items.map((item) => `
                <button class="status-drilldown-button" type="button" data-open-tests-status="${escapeHtml(item.id)}">
                    <span>${escapeHtml(item.label)}</span>
                    <span class="status-drilldown-count">${item.count}</span>
                </button>
            `).join('')}
        </div>
    `
}

export function renderCurrentRunTestRow(
    test: DashboardSummary['currentRunTests']['all'][number],
    filters: DashboardSummary['filters'],
    testDetailsBasePath: string,
): string {
    const testHref = buildTestHistoryHref(test.title, {
        branch: filters.branch,
        project: test.project,
        file: test.file,
    }, testDetailsBasePath)

    return `
        <tr>
            <td><a class="test-link" href="${escapeHtml(testHref)}">${renderOverflowText(test.title, { className: 'table-cell-text' })}</a></td>
            <td>${renderOverflowText(test.file, { className: 'table-cell-text' })}</td>
            <td>${renderOverflowText(test.project, { className: 'table-cell-text' })}</td>
            <td><span class="status-badge ${getStatusClass(test.status, test.flaky)}">${escapeHtml(formatStatusLabel(test.status, test.flaky))}</span></td>
            <td>${test.flaky ? DASHBOARD_TEXT.states.yes : DASHBOARD_TEXT.states.no}</td>
            <td>${escapeHtml(formatDuration(test.durationMs))}</td>
            <td>${renderOverflowText(test.errorMessage ?? '—', { className: 'table-cell-text-wide mono' })}</td>
        </tr>
    `
}

export function renderHistoryRow(run: DashboardSummary['history']['recentRuns'][number]): string {
    return `
        <tr>
            <td>${escapeHtml(formatDate(run.reportTimestamp ?? run.generatedAt))}</td>
            <td>${escapeHtml(formatPercent(run.passRate))}</td>
            <td>${run.failedTests}</td>
            <td>${run.flakyTests}</td>
            <td>${escapeHtml(formatDuration(run.totalDurationMs))}</td>
            <td>${renderOverflowText(run.branch ?? '—', { className: 'table-cell-text' })}</td>
            <td>${escapeHtml(formatCommit(run.commit))}</td>
            <td>${renderOverflowText(run.author ?? '—', { className: 'table-cell-text' })}</td>
            <td>${renderOverflowText(run.sourceFile, { className: 'table-cell-text-wide' })}</td>
        </tr>
    `
}

export function renderTabButton(id: string, label: string, isActive = false): string {
    return `<button class="tab-button${isActive ? ' is-active' : ''}" type="button" role="tab" aria-selected="${isActive ? 'true' : 'false'}" data-tab-button="${escapeHtml(id)}">${escapeHtml(label)}</button>`
}

export function renderPlaceholderPanel(title: string, description: string, metrics: readonly string[]): string {
    return `
        <div class="placeholder-card">
            <div class="placeholder-title">${escapeHtml(title)}</div>
            <div class="muted">${escapeHtml(description)}</div>
            <ul class="placeholder-list">
                ${metrics.map((metric) => `<li>${escapeHtml(metric)}</li>`).join('')}
            </ul>
        </div>
    `
}

export function renderPhaseLegend(items: DashboardPhaseBreakdownItem[]): string {
    const visibleItems = items.filter((item) => item.durationMs > 0)

    if (visibleItems.length === 0) {
        return ''
    }

    return `
        <div class="phase-legend" aria-label="${escapeHtml(DASHBOARD_TEXT.performance.phaseLegendLabel)}">
            ${visibleItems.map((item) => `
                <div class="phase-legend-item">
                    <div class="phase-legend-label">${escapeHtml(formatPerformancePhaseLabel(item.label))}</div>
                    <div class="phase-legend-value">${escapeHtml(formatDuration(item.durationMs))} • ${escapeHtml(formatPercent(item.sharePercent))}</div>
                </div>
            `).join('')}
        </div>
    `
}

export function renderOverflowText(
    value: string | null | undefined,
    options: {
        displayValue?: string
        className?: string
        tagName?: 'span' | 'div'
    } = {},
): string {
    const tagName = options.tagName ?? 'span'
    const fullValue = typeof value === 'string' && value.length > 0 ? value : '—'
    const displayValue = options.displayValue ?? fullValue
    const className = ['overflow-text', options.className].filter(Boolean).join(' ')

    return `<${tagName} class="${escapeHtml(className)}" title="${escapeHtml(fullValue)}">${escapeHtml(displayValue)}</${tagName}>`
}

export function toPerformanceChartDataset<T extends DashboardPhaseBreakdownItem | DashboardDurationBreakdownItem>(
    items: T[],
    options: {
        labelFormatter?: (label: string) => string
        fullLabelFormatter?: (label: string) => string
        unit?: 'minutes' | 'seconds'
    } = {},
): { labels: string[]; values: number[]; fullLabels: string[] } {
    const labelFormatter = options.labelFormatter ?? ((label: string) => label)
    const fullLabelFormatter = options.fullLabelFormatter ?? ((label: string) => label)
    const divisor = options.unit === 'seconds' ? 1000 : 60000
    const normalizedItems = items.filter((item) => item.durationMs > 0)

    return {
        labels: normalizedItems.map((item) => labelFormatter(item.label)),
        values: normalizedItems.map((item) => roundChartValue(item.durationMs / divisor)),
        fullLabels: normalizedItems.map((item) => fullLabelFormatter(item.label)),
    }
}

export function getLeadingPhase(items: DashboardPhaseBreakdownItem[]): DashboardPhaseBreakdownItem | null {
    if (items.length === 0) {
        return null
    }

    return [...items].sort((left, right) => right.durationMs - left.durationMs)[0] ?? null
}

export function formatPerformancePhaseLabel(label: string): string {
    return formatPerformancePhaseLabelShared(label)
}

export function shortenChartLabel(label: string, maxLength: number): string {
    if (label.length <= maxLength) {
        return label
    }

    return `${label.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`
}

export function roundChartValue(value: number): number {
    return Math.round(value * 10) / 10
}

export function getStatusClass(status: string, flaky: boolean): string {
    if (flaky) {
        return 'status-flaky'
    }

    const normalizedStatus = status.toLowerCase()

    if (normalizedStatus === 'failed' || normalizedStatus === 'timedout' || normalizedStatus === 'timed out' || normalizedStatus === 'interrupted') {
        return 'status-failed'
    }

    if (normalizedStatus === 'passed') {
        return 'status-passed'
    }

    if (normalizedStatus === 'skipped') {
        return 'status-skipped'
    }

    return 'status-unknown'
}

export function formatStatusLabel(status: string, flaky: boolean): string {
    return formatStatusLabelShared(status, flaky)
}

export function formatPassRateDelta(delta: number | null): string {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRun
    }

    if (delta === 0) {
        return DASHBOARD_TEXT.states.noChanges
    }

    const sign = delta > 0 ? '+' : ''
    return `${sign}${delta.toFixed(1)} п.п. к прошлому прогону`
}

export function formatCountDelta(label: string, delta: number | null): string {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRun
    }

    if (delta === 0) {
        return `Без изменений ${label}`
    }

    const sign = delta > 0 ? '+' : ''
    return `${sign}${delta} ${label}`
}

export function formatDurationDelta(delta: number | null): string {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRun
    }

    if (delta === 0) {
        return DASHBOARD_TEXT.states.noChanges
    }

    const sign = delta > 0 ? '+' : '-'
    return `${sign}${formatDuration(Math.abs(delta))} к прошлому прогону`
}

export function formatMetricDelta(delta: number | null, type: 'pp' | 'count' | 'duration', inverted: boolean): string {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRunShort
    }

    if (delta === 0) {
        return DASHBOARD_TEXT.states.noChangesShort
    }

    const arrow = getTrendArrow(delta, inverted)

    if (type === 'pp') {
        const sign = delta > 0 ? '+' : ''
        return `${arrow} ${sign}${delta.toFixed(1)} п.п.`
    }

    if (type === 'count') {
        const sign = delta > 0 ? '+' : ''
        return `${arrow} ${sign}${delta}`
    }

    const sign = delta > 0 ? '+' : '-'
    return `${arrow} ${sign}${formatDuration(Math.abs(delta))}`
}

export function getTrendArrow(delta: number | null, inverted: boolean): string {
    if (delta === null || delta === 0) {
        return '→'
    }

    if (inverted) {
        return delta < 0 ? '↑' : '↓'
    }

    return delta > 0 ? '↑' : '↓'
}

export function formatCommit(commit: string | null): string {
    return formatCommitShared(commit)
}

export function formatRunLabel(run: DashboardSummary['comparison']['currentRun']): string {
    if (!run) {
        return '—'
    }

    const dateLabel = formatDate(run.reportTimestamp ?? run.generatedAt)
    const branchLabel = run.branch ? ` • ${run.branch}` : ''
    const commitLabel = run.commit ? ` • ${formatCommit(run.commit)}` : ''

    return `${dateLabel}${branchLabel}${commitLabel}`
}

export function formatCurrency(value: number | null): string {
    return formatCurrencyShared(value)
}

export function formatMinutes(value: number): string {
    return formatMinutesShared(value)
}

export function formatNullableMinutes(value: number | null): string {
    return formatNullableMinutesShared(value)
}

export function formatDailyRatio(value: number): string {
    return formatDailyRatioShared(value)
}

export function formatScore(value: number): string {
    return formatScoreShared(value)
}

export function formatNullableDays(value: number | null): string {
    return formatNullableDaysShared(value)
}

export function formatNullablePercent(value: number | null): string {
    return formatNullablePercentShared(value)
}

export function formatCostAssumptions(summary: DashboardSummary): string {
    const assumptions = summary.businessMetrics.costOfFlakiness.assumptions

    if (assumptions.ciMinuteCostRub === null && assumptions.developerHourlyCostRub === null) {
        return DASHBOARD_TEXT.business.assumptionsEmpty
    }

    return `${DASHBOARD_TEXT.business.ciMinuteCost} ${assumptions.ciMinuteCostRub ?? 0} ₽/мин • ${DASHBOARD_TEXT.business.devHourCost} ${assumptions.developerHourlyCostRub ?? 0} ₽/час • ${DASHBOARD_TEXT.business.analysisMinutes} ${assumptions.analysisMinutesPerUnstable ?? 0} мин/инцидент`
}

export function formatAssumptionValue(value: number | null, unit: string): string {
    return formatAssumptionValueShared(value, unit)
}

export function renderManagerOverview(summary: DashboardSummary, dashboardActionPath: string): string {
    return `
        <div class="manager-summary-card">
            <div class="manager-summary-header">
                <div>
                    <div class="manager-summary-title">${escapeHtml(DASHBOARD_TEXT.manager.summaryTitle)}</div>
                    <div class="manager-summary-description">${escapeHtml(DASHBOARD_TEXT.manager.summaryDescription)}</div>
                </div>
                <div class="manager-status-pill ${escapeHtml(getManagerSignalClass(summary.managerSummary.releaseReadiness.level))}">${escapeHtml(getManagerReadinessLabel(summary.managerSummary.releaseReadiness.level))}</div>
            </div>
            <div class="manager-signal-grid">
                ${renderManagerSignalCard(
                    DASHBOARD_TEXT.manager.releaseReadiness,
                    summary.managerSummary.releaseReadiness,
                    getManagerReadinessLabel(summary.managerSummary.releaseReadiness.level),
                    'Рассчитано из release confidence, failed tests и динамики pass rate.',
                )}
                ${renderManagerSignalCard(
                    DASHBOARD_TEXT.manager.qualityRisk,
                    summary.managerSummary.qualityRisk,
                    getManagerRiskLabel(summary.managerSummary.qualityRisk.level),
                    'Учитывает pass rate, flaky ratio, кластеры ошибок и историческую нестабильность.',
                )}
                ${renderManagerSignalCard(
                    DASHBOARD_TEXT.manager.deliveryRisk,
                    summary.managerSummary.deliveryRisk,
                    getManagerRiskLabel(summary.managerSummary.deliveryRisk.level),
                    'Учитывает деградацию длительности, самые медленные тесты и трение команды от rerun/retry.',
                )}
            </div>
        </div>

        <div class="manager-detail-grid">
            <div class="chart-card">
                <div class="chart-title">${escapeHtml(DASHBOARD_TEXT.manager.blockersTitle)}</div>
                <div class="muted">${escapeHtml(DASHBOARD_TEXT.manager.blockersDescription)}</div>
                <div class="manager-blocker-list">
                    ${summary.managerSummary.blockers.length > 0
                        ? summary.managerSummary.blockers.map((blocker) => renderManagerBlocker(blocker, summary.filters, dashboardActionPath)).join('')
                        : `<div class="manager-blocker-item"><div class="manager-blocker-body">${escapeHtml(DASHBOARD_TEXT.manager.noBlockers)}</div></div>`}
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">${escapeHtml(DASHBOARD_TEXT.manager.changesTitle)}</div>
                <div class="muted">${escapeHtml(DASHBOARD_TEXT.manager.changesDescription)}</div>
                <div class="muted" style="margin-top: 8px;">${escapeHtml(DASHBOARD_TEXT.manager.changesRunsMeta
                    .replace('{current}', formatRunLabel(summary.comparison.currentRun))
                    .replace('{previous}', formatRunLabel(summary.comparison.previousRun)))}</div>
                <div class="manager-change-list">
                    ${summary.managerSummary.changes.length > 0
                        ? summary.managerSummary.changes.map((change) => renderManagerChange(change)).join('')
                        : `<div class="manager-change-item"><div class="manager-change-body">${escapeHtml(DASHBOARD_TEXT.manager.noChanges)}</div></div>`}
                </div>
            </div>
        </div>
    `
}

export function renderManagerSignalCard(label: string, signal: DashboardSummary['managerSummary']['releaseReadiness'], levelLabel: string, hint: string): string {
    return `
        <div class="manager-signal-card">
            <div class="manager-signal-label">${escapeHtml(label)}</div>
            <div class="manager-signal-value">${escapeHtml(formatScore(signal.score))}</div>
            <div class="manager-signal-meta">
                <span class="manager-item-pill ${escapeHtml(getManagerSignalClass(signal.level))}">${escapeHtml(levelLabel)}</span>
            </div>
            <div class="manager-signal-hint">${escapeHtml(hint)}</div>
        </div>
    `
}

export function renderManagerBlocker(
    blocker: DashboardSummary['managerSummary']['blockers'][number],
    filters: DashboardSummary['filters'],
    dashboardActionPath: string,
): string {
    const blockerHref = getManagerBlockerHref(blocker, filters, dashboardActionPath)

    return `
        <div class="manager-blocker-item">
            <div class="manager-blocker-head">
                <div class="manager-blocker-title">${escapeHtml(blocker.title)}</div>
                <div class="manager-item-pill manager-item-${escapeHtml(blocker.severity)}">${escapeHtml(blocker.value)}</div>
            </div>
            <div class="manager-blocker-body">${escapeHtml(blocker.details)}</div>
            ${blockerHref
                ? `<a class="manager-blocker-link" href="${escapeHtml(blockerHref)}">${escapeHtml(DASHBOARD_TEXT.manager.blockerAction)}</a>`
                : ''}
        </div>
    `
}

export function renderManagerChange(change: DashboardSummary['managerSummary']['changes'][number]): string {
    return `
        <div class="manager-change-item">
            <div class="manager-change-head">
                <div class="manager-change-title">${escapeHtml(change.label)}</div>
                <div class="manager-change-value">${escapeHtml(change.value)}</div>
            </div>
            <div class="manager-change-body">${escapeHtml(change.details)}</div>
            <div style="margin-top: 10px;"><span class="manager-item-pill manager-item-${escapeHtml(getManagerChangeClass(change.direction))}">${escapeHtml(getManagerChangeLabel(change.direction))}</span></div>
        </div>
    `
}

export function getManagerSignalClass(level: DashboardSummary['managerSummary']['releaseReadiness']['level']): string {
    return `manager-status-${level}`
}

export function getManagerBlockerHref(
    blocker: DashboardSummary['managerSummary']['blockers'][number],
    filters: DashboardSummary['filters'],
    dashboardActionPath: string,
): string | null {
    if (blocker.kind === 'problematic-test') {
        return buildDashboardTabHref(dashboardActionPath, filters, 'flaky', 'problematic-tests')
    }

    if (blocker.kind === 'duration') {
        return buildDashboardTabHref(dashboardActionPath, filters, 'performance', 'slow-tests')
    }

    if (blocker.kind === 'flaky') {
        return buildDashboardTabHref(dashboardActionPath, filters, 'flaky', 'flaky-tests')
    }

    if (blocker.kind === 'error-cluster') {
        return buildDashboardTabHref(dashboardActionPath, filters, 'flaky', 'error-clusters')
    }

    return null
}

export function getManagerReadinessLabel(level: DashboardSummary['managerSummary']['releaseReadiness']['level']): string {
    return getManagerReadinessLabelShared(level)
}

export function getManagerRiskLabel(level: DashboardSummary['managerSummary']['qualityRisk']['level']): string {
    return getManagerRiskLabelShared(level)
}

export function getManagerChangeClass(direction: DashboardSummary['managerSummary']['changes'][number]['direction']): 'improving' | 'regressing' | 'stable' {
    return direction
}

export function getManagerChangeLabel(direction: DashboardSummary['managerSummary']['changes'][number]['direction']): string {
    return getManagerChangeLabelShared(direction)
}

export function renderFlakyHistoryInsight(summary: DashboardSummary): string {
    const insight = buildFlakyHistoryInsightShared(summary)
    const noteClass = insight.tone === 'info'
        ? 'context-note is-info'
        : insight.tone === 'warn'
            ? 'context-note is-warning'
            : 'context-note'

    return `
        <div class="${escapeHtml(noteClass)}">
            <div class="context-note-title">${escapeHtml(insight.title)}</div>
            <div class="context-note-body">${escapeHtml(insight.body)}</div>
        </div>
    `
}

export function getFlakyTopTestsEmptyState(summary: DashboardSummary): string {
    return getFlakyTopTestsEmptyStateShared(summary)
}

export function renderReleaseConfidenceBreakdown(summary: DashboardSummary): string {
    const breakdown = buildReleaseConfidenceBreakdown(summary)
    const thresholdHint = breakdown.total >= 75
        ? DASHBOARD_TEXT.business.releaseConfidenceHealthyThreshold
        : DASHBOARD_TEXT.business.releaseConfidenceRiskThreshold

    return `
        <div class="chart-card">
            <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.business.releaseConfidenceBreakdownTitle, METRIC_DESCRIPTIONS.releaseConfidenceScore)}</div>
            <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.releaseConfidenceBreakdownDescription)}</div>
            <div class="business-component-list">
                ${breakdown.components.map((component) => `
                    <div class="business-component-item">
                        <div class="business-component-head">
                            <span class="business-component-label">${escapeHtml(component.label)}</span>
                            <span class="business-component-formula">${escapeHtml(component.formula)}</span>
                        </div>
                        <div class="business-component-progress"><div class="business-component-fill ${escapeHtml(component.tone)}" style="width: ${escapeHtml(component.width)};"></div></div>
                    </div>
                `).join('')}
            </div>
            <div class="business-component-total">
                <span class="business-component-total-label">${escapeHtml(DASHBOARD_TEXT.business.releaseConfidenceTotal)}</span>
                <span class="business-component-total-value">${escapeHtml(formatScore(summary.businessMetrics.releaseConfidenceScore))}</span>
            </div>
            <div class="muted" style="margin-top: 12px;">${escapeHtml(thresholdHint)}</div>
        </div>
    `
}

export function renderBusinessMetricReadiness(summary: DashboardSummary): string {
    return `
        <div class="chart-card">
            <div class="chart-title">${escapeHtml(DASHBOARD_TEXT.business.readinessTitle)}</div>
            <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.readinessDescription)}</div>
            <div class="metric-readiness-list">
                ${buildBusinessMetricReadiness(summary).map((item) => `
                    <div class="metric-readiness-item">
                        <div class="metric-readiness-head">
                            <span class="metric-readiness-title">${escapeHtml(item.label)}</span>
                            <span class="metric-readiness-pill is-${escapeHtml(item.status)}">${escapeHtml(item.statusLabel)}</span>
                        </div>
                        <div class="metric-readiness-body">${escapeHtml(item.hint)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `
}

export function buildReleaseConfidenceBreakdown(summary: DashboardSummary): {
    total: number
    components: Array<{
        label: string
        formula: string
        width: string
        tone: string
    }>
} {
    return buildReleaseConfidenceBreakdownShared(summary)
}

export function buildBusinessMetricReadiness(summary: DashboardSummary): Array<{
    label: string
    status: 'ready' | 'partial' | 'pending'
    statusLabel: string
    hint: string
}> {
    return buildBusinessMetricReadinessShared(summary)
}

export function getBusinessReadinessStatusLabel(status: 'ready' | 'partial' | 'pending'): string {
    return getBusinessReadinessStatusLabelShared(status)
}

export function getDashboardScoreTone(value: number): string {
    return getDashboardScoreToneShared(value)
}

export function clampDashboardScore(value: number): number {
    return clampDashboardScoreShared(value)
}

export function averageDashboardNumber(values: number[]): number {
    return averageDashboardNumberShared(values)
}

export function roundToOneDigit(value: number): number {
    return roundToOneDigitShared(value)
}

export function getBusinessAssumptionsState(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): 'ready' | 'partial' | 'empty' {
    return getBusinessAssumptionsStateShared(assumptions)
}

export function getBusinessScenarioStatusClass(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    return `scenario-status-${getBusinessAssumptionsState(assumptions)}`
}

export function getBusinessScenarioStatusLabel(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    return getBusinessScenarioStatusLabelShared(assumptions)
}

export function getBusinessScenarioStatusHint(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    return getBusinessScenarioStatusHintShared(assumptions)
}

export function getBusinessImpactLevel(totalCost: number | null, costPerDay: number | null): 'high' | 'medium' | 'low' | 'unknown' {
    return getBusinessImpactLevelShared(totalCost, costPerDay)
}

export function getBusinessImpactClass(totalCost: number | null, costPerDay: number | null): string {
    return getBusinessImpactClassShared(totalCost, costPerDay)
}

export function getBusinessImpactLabel(totalCost: number | null, costPerDay: number | null): string {
    return getBusinessImpactLabelShared(totalCost, costPerDay)
}

export function getBusinessDriverType(ciCost: number | null, developerCost: number | null, totalCost: number | null): 'ci' | 'development' | 'balanced' | 'missing' {
    return getBusinessDriverTypeShared(ciCost, developerCost, totalCost)
}

export function getBusinessBreakdownItemClass(ciCost: number | null, developerCost: number | null, totalCost: number | null, target: 'ci' | 'development'): string {
    return getBusinessBreakdownItemClassShared(ciCost, developerCost, totalCost, target)
}

export function getBusinessDriverSignalClass(ciCost: number | null, developerCost: number | null, totalCost: number | null, target: 'ci' | 'development'): string {
    return getBusinessDriverSignalClassShared(ciCost, developerCost, totalCost, target)
}

export function getBusinessDriverInsightTitle(ciCost: number | null, developerCost: number | null, totalCost: number | null): string {
    return getBusinessDriverInsightTitleShared(ciCost, developerCost, totalCost)
}

export function getBusinessDriverInsightBody(ciCost: number | null, developerCost: number | null, totalCost: number | null): string {
    return getBusinessDriverInsightBodyShared(ciCost, developerCost, totalCost)
}

export function formatCostShare(value: number | null, total: number | null): string {
    return formatCostShareShared(value, total)
}

export function formatCostShareWidth(value: number | null, total: number | null): string {
    return formatCostShareWidthShared(value, total)
}

export function getTrendClass(delta: number | null, inverted: boolean): string {
    if (delta === null || delta === 0) {
        return 'trend-neutral'
    }

    if (inverted) {
        return delta < 0 ? 'trend-up' : 'trend-down'
    }

    return delta > 0 ? 'trend-up' : 'trend-down'
}

export function renderFilterSelect(name: 'branch' | 'project' | 'file', label: string, options: string[], selectedValue: string | null): string {
    return `
        <label class="filter-field">
            <span class="filter-label">${escapeHtml(label)}</span>
            <select class="filter-select" name="${name}">
                <option value="">${escapeHtml(DASHBOARD_TEXT.filters.all)}</option>
                ${options.map((option) => `<option value="${escapeHtml(option)}"${option === selectedValue ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}
            </select>
        </label>
    `
}

export function buildTestHistoryHref(
    title: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    testDetailsBasePath: string,
): string {
    return buildTestHistoryHrefFromTestDetailsBasePath(title, filters, testDetailsBasePath)
}

export function normalizeDashboardBasePath(basePath: string | undefined): string {
    if (typeof basePath !== 'string') {
        return ''
    }

    const trimmedValue = basePath.trim()

    if (!trimmedValue || trimmedValue === '/') {
        return ''
    }

    return trimmedValue.endsWith('/') ? trimmedValue.slice(0, -1) : trimmedValue
}

export function buildDashboardTabHref(
    dashboardActionPath: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    tabId: string,
    sectionId?: string,
): string {
    return buildSharedDashboardTabHref(dashboardActionPath, filters, tabId, sectionId)
}

export function buildQueryString(filters: { branch?: string | null; project?: string | null; file?: string | null }): string {
    return buildSharedQueryString(filters)
}

export function serializeForInlineScript(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}


