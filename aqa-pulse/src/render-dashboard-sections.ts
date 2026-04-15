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
    if (label === 'Setup') {
        return 'Подготовка'
    }

    if (label === 'Teardown') {
        return 'Завершение'
    }

    return 'Тесты'
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
    if (flaky) {
        return DASHBOARD_TEXT.statusLabels.flaky
    }

    const normalizedStatus = status.toLowerCase()
    return DASHBOARD_TEXT.statusLabels[normalizedStatus as keyof typeof DASHBOARD_TEXT.statusLabels] ?? status
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
    if (!commit) {
        return '—'
    }

    return commit.slice(0, 8)
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
    if (value === null) {
        return '—'
    }

    return `${value.toFixed(2)} ₽`
}

export function formatMinutes(value: number): string {
    return `${value.toFixed(2)} мин`
}

export function formatNullableMinutes(value: number | null): string {
    return value === null ? '—' : formatMinutes(value)
}

export function formatDailyRatio(value: number): string {
    return `${value.toFixed(2)} / день`
}

export function formatScore(value: number): string {
    return `${value.toFixed(1)} / 100`
}

export function formatNullableDays(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(2)} дн`
}

export function formatNullablePercent(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)}%`
}

export function formatCostAssumptions(summary: DashboardSummary): string {
    const assumptions = summary.businessMetrics.costOfFlakiness.assumptions

    if (assumptions.ciMinuteCostRub === null && assumptions.developerHourlyCostRub === null) {
        return DASHBOARD_TEXT.business.assumptionsEmpty
    }

    return `${DASHBOARD_TEXT.business.ciMinuteCost} ${assumptions.ciMinuteCostRub ?? 0} ₽/мин • ${DASHBOARD_TEXT.business.devHourCost} ${assumptions.developerHourlyCostRub ?? 0} ₽/час • ${DASHBOARD_TEXT.business.analysisMinutes} ${assumptions.analysisMinutesPerUnstable ?? 0} мин/инцидент`
}

export function formatAssumptionValue(value: number | null, unit: string): string {
    if (value === null) {
        return DASHBOARD_TEXT.states.notSet
    }

    return `${value} ${unit}`
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
    if (level === 'healthy') {
        return DASHBOARD_TEXT.manager.readinessHealthy
    }

    if (level === 'warning') {
        return DASHBOARD_TEXT.manager.readinessWarning
    }

    return DASHBOARD_TEXT.manager.readinessCritical
}

export function getManagerRiskLabel(level: DashboardSummary['managerSummary']['qualityRisk']['level']): string {
    if (level === 'healthy') {
        return DASHBOARD_TEXT.manager.riskHealthy
    }

    if (level === 'warning') {
        return DASHBOARD_TEXT.manager.riskWarning
    }

    return DASHBOARD_TEXT.manager.riskCritical
}

export function getManagerChangeClass(direction: DashboardSummary['managerSummary']['changes'][number]['direction']): 'improving' | 'regressing' | 'stable' {
    return direction
}

export function getManagerChangeLabel(direction: DashboardSummary['managerSummary']['changes'][number]['direction']): string {
    if (direction === 'improving') {
        return 'Улучшается'
    }

    if (direction === 'regressing') {
        return 'Деградирует'
    }

    return 'Без сдвига'
}

export function renderFlakyHistoryInsight(summary: DashboardSummary): string {
    const hasHistoricalRanking = summary.flakyAnalytics.topFlakyTests.length > 0
    const noteClass = hasHistoricalRanking
        ? 'context-note is-info'
        : summary.kpis.flakyTests > 0
            ? 'context-note is-warning'
            : 'context-note'
    const currentRunLine = DASHBOARD_TEXT.flakyInsights.currentRunLine.replace('{count}', String(summary.kpis.flakyTests))
    const finalLine = hasHistoricalRanking
        ? DASHBOARD_TEXT.flakyInsights.historyReady
        : summary.kpis.flakyTests > 0
            ? DASHBOARD_TEXT.flakyInsights.historyMissing
            : DASHBOARD_TEXT.flakyInsights.historyLine

    return `
        <div class="${escapeHtml(noteClass)}">
            <div class="context-note-title">${escapeHtml(DASHBOARD_TEXT.flakyInsights.title)}</div>
            <div class="context-note-body">${escapeHtml(currentRunLine)} ${escapeHtml(DASHBOARD_TEXT.flakyInsights.historyLine)} ${escapeHtml(finalLine)}</div>
        </div>
    `
}

export function getFlakyTopTestsEmptyState(summary: DashboardSummary): string {
    if (summary.kpis.flakyTests > 0) {
        return DASHBOARD_TEXT.states.flakyTestsHistoryMissing
    }

    return DASHBOARD_TEXT.states.flakyTestsEmpty
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
    const passRateValue = clampDashboardScore(summary.kpis.passRate)
    const inverseFlakyValue = clampDashboardScore(100 - summary.kpis.flakyRatio)
    const errorHealthValue = summary.kpis.totalTests === 0
        ? 100
        : clampDashboardScore(100 - ((summary.errorClusters.length / summary.kpis.totalTests) * 100))
    const recentRuns = summary.history.recentRuns.slice(-5)
    const historyConsistencyValue = recentRuns.length > 0
        ? clampDashboardScore(averageDashboardNumber(recentRuns.map((run) => run.passRate - run.flakyRatio)))
        : clampDashboardScore(summary.kpis.passRate - summary.kpis.flakyRatio)

    const componentDefinitions = [
        {
            label: DASHBOARD_TEXT.business.releaseConfidencePassRate,
            rawValue: passRateValue,
            weight: 0.4,
        },
        {
            label: DASHBOARD_TEXT.business.releaseConfidenceFlakyRatio,
            rawValue: inverseFlakyValue,
            weight: 0.3,
        },
        {
            label: DASHBOARD_TEXT.business.releaseConfidenceErrorHealth,
            rawValue: errorHealthValue,
            weight: 0.15,
        },
        {
            label: DASHBOARD_TEXT.business.releaseConfidenceHistoryConsistency,
            rawValue: historyConsistencyValue,
            weight: 0.15,
        },
    ]

    return {
        total: roundToOneDigit(componentDefinitions.reduce((total, component) => total + (component.rawValue * component.weight), 0)),
        components: componentDefinitions.map((component) => ({
            label: component.label,
            formula: `${roundToOneDigit(component.rawValue)} × ${component.weight} = ${roundToOneDigit(component.rawValue * component.weight)}`,
            width: `${roundToOneDigit(component.rawValue)}%`,
            tone: getDashboardScoreTone(component.rawValue),
        })),
    }
}

export function buildBusinessMetricReadiness(summary: DashboardSummary): Array<{
    label: string
    status: 'ready' | 'partial' | 'pending'
    statusLabel: string
    hint: string
}> {
    const costAssumptionsState = getBusinessAssumptionsState(summary.businessMetrics.costOfFlakiness.assumptions)
    const costStatus = costAssumptionsState === 'empty' ? 'pending' : costAssumptionsState
    const timeToFixStatus = summary.businessMetrics.timeToFixFlaky.averageDays === null ? 'pending' : 'ready'

    return [
        {
            label: DASHBOARD_TEXT.metrics.timeToDetect,
            status: 'pending',
            statusLabel: DASHBOARD_TEXT.business.readinessPending,
            hint: DASHBOARD_TEXT.business.readinessTimeToDetectHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.timeToFixFlaky,
            status: timeToFixStatus,
            statusLabel: getBusinessReadinessStatusLabel(timeToFixStatus),
            hint: DASHBOARD_TEXT.business.readinessTimeToFixHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.costOfFlakiness,
            status: costStatus,
            statusLabel: getBusinessReadinessStatusLabel(costStatus),
            hint: DASHBOARD_TEXT.business.readinessCostHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.developerFriction,
            status: 'ready',
            statusLabel: DASHBOARD_TEXT.business.readinessReady,
            hint: DASHBOARD_TEXT.business.readinessDeveloperFrictionHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.releaseConfidenceScore,
            status: 'ready',
            statusLabel: DASHBOARD_TEXT.business.readinessReady,
            hint: DASHBOARD_TEXT.business.readinessReleaseConfidenceHint,
        },
        {
            label: DASHBOARD_TEXT.metrics.automationRoi,
            status: 'pending',
            statusLabel: DASHBOARD_TEXT.business.readinessPending,
            hint: DASHBOARD_TEXT.business.readinessAutomationRoiHint,
        },
    ]
}

export function getBusinessReadinessStatusLabel(status: 'ready' | 'partial' | 'pending'): string {
    if (status === 'ready') {
        return DASHBOARD_TEXT.business.readinessReady
    }

    if (status === 'partial') {
        return DASHBOARD_TEXT.business.readinessPartial
    }

    return DASHBOARD_TEXT.business.readinessPending
}

export function getDashboardScoreTone(value: number): string {
    if (value >= 80) {
        return ''
    }

    if (value >= 60) {
        return 'warning'
    }

    return 'danger'
}

export function clampDashboardScore(value: number): number {
    return Math.min(Math.max(value, 0), 100)
}

export function averageDashboardNumber(values: number[]): number {
    if (values.length === 0) {
        return 0
    }

    return values.reduce((total, value) => total + value, 0) / values.length
}

export function roundToOneDigit(value: number): number {
    return Math.round(value * 10) / 10
}

export function getBusinessAssumptionsState(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): 'ready' | 'partial' | 'empty' {
    const isCiConfigured = assumptions.ciMinuteCostRub !== null
    const isDeveloperConfigured = assumptions.developerHourlyCostRub !== null && assumptions.analysisMinutesPerUnstable !== null
    const hasAnyValue = isCiConfigured || assumptions.developerHourlyCostRub !== null || assumptions.analysisMinutesPerUnstable !== null

    if (isCiConfigured && isDeveloperConfigured) {
        return 'ready'
    }

    if (hasAnyValue) {
        return 'partial'
    }

    return 'empty'
}

export function getBusinessScenarioStatusClass(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    return `scenario-status-${getBusinessAssumptionsState(assumptions)}`
}

export function getBusinessScenarioStatusLabel(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    const state = getBusinessAssumptionsState(assumptions)

    if (state === 'ready') {
        return DASHBOARD_TEXT.business.scenarioStatusReady
    }

    if (state === 'partial') {
        return DASHBOARD_TEXT.business.scenarioStatusPartial
    }

    return DASHBOARD_TEXT.business.scenarioStatusEmpty
}

export function getBusinessScenarioStatusHint(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    const state = getBusinessAssumptionsState(assumptions)

    if (state === 'ready') {
        return DASHBOARD_TEXT.business.scenarioStatusReadyHint
    }

    if (state === 'partial') {
        return DASHBOARD_TEXT.business.scenarioStatusPartialHint
    }

    return DASHBOARD_TEXT.business.scenarioStatusEmptyHint
}

export function getBusinessImpactLevel(totalCost: number | null, costPerDay: number | null): 'high' | 'medium' | 'low' | 'unknown' {
    if (totalCost === null) {
        return 'unknown'
    }

    if (totalCost >= 50000 || (costPerDay !== null && costPerDay >= 10000)) {
        return 'high'
    }

    if (totalCost >= 15000 || (costPerDay !== null && costPerDay >= 3000)) {
        return 'medium'
    }

    return 'low'
}

export function getBusinessImpactClass(totalCost: number | null, costPerDay: number | null): string {
    return `impact-${getBusinessImpactLevel(totalCost, costPerDay)}`
}

export function getBusinessImpactLabel(totalCost: number | null, costPerDay: number | null): string {
    const impactLevel = getBusinessImpactLevel(totalCost, costPerDay)

    if (impactLevel === 'high') {
        return DASHBOARD_TEXT.business.impactHigh
    }

    if (impactLevel === 'medium') {
        return DASHBOARD_TEXT.business.impactMedium
    }

    if (impactLevel === 'low') {
        return DASHBOARD_TEXT.business.impactLow
    }

    return DASHBOARD_TEXT.business.impactUnknown
}

export function getBusinessDriverType(ciCost: number | null, developerCost: number | null, totalCost: number | null): 'ci' | 'development' | 'balanced' | 'missing' {
    if (totalCost === null || totalCost <= 0) {
        return 'missing'
    }

    const normalizedCiCost = ciCost ?? 0
    const normalizedDeveloperCost = developerCost ?? 0
    const delta = Math.abs(normalizedCiCost - normalizedDeveloperCost)

    if (delta <= totalCost * 0.15) {
        return 'balanced'
    }

    return normalizedCiCost > normalizedDeveloperCost ? 'ci' : 'development'
}

export function getBusinessBreakdownItemClass(ciCost: number | null, developerCost: number | null, totalCost: number | null, target: 'ci' | 'development'): string {
    return getBusinessDriverType(ciCost, developerCost, totalCost) === target ? 'is-dominant' : ''
}

export function getBusinessDriverSignalClass(ciCost: number | null, developerCost: number | null, totalCost: number | null, target: 'ci' | 'development'): string {
    return getBusinessDriverType(ciCost, developerCost, totalCost) === target ? 'is-dominant' : ''
}

export function getBusinessDriverInsightTitle(ciCost: number | null, developerCost: number | null, totalCost: number | null): string {
    const driverType = getBusinessDriverType(ciCost, developerCost, totalCost)

    if (driverType === 'ci') {
        return DASHBOARD_TEXT.business.topDriverCiTitle
    }

    if (driverType === 'development') {
        return DASHBOARD_TEXT.business.topDriverDevelopmentTitle
    }

    if (driverType === 'balanced') {
        return DASHBOARD_TEXT.business.topDriverBalancedTitle
    }

    return DASHBOARD_TEXT.business.topDriverMissingTitle
}

export function getBusinessDriverInsightBody(ciCost: number | null, developerCost: number | null, totalCost: number | null): string {
    const driverType = getBusinessDriverType(ciCost, developerCost, totalCost)

    if (driverType === 'ci') {
        return DASHBOARD_TEXT.business.topDriverCiBody
    }

    if (driverType === 'development') {
        return DASHBOARD_TEXT.business.topDriverDevelopmentBody
    }

    if (driverType === 'balanced') {
        return DASHBOARD_TEXT.business.topDriverBalancedBody
    }

    return DASHBOARD_TEXT.business.topDriverMissingBody
}

export function formatCostShare(value: number | null, total: number | null): string {
    if (value === null || total === null || total <= 0) {
        return '—'
    }

    return `${((value / total) * 100).toFixed(1)}%`
}

export function formatCostShareWidth(value: number | null, total: number | null): string {
    if (value === null || total === null || total <= 0) {
        return '0%'
    }

    return `${Math.max(0, Math.min(100, (value / total) * 100)).toFixed(1)}%`
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
    const query = buildQueryString(filters)
    const basePath = `${testDetailsBasePath}/${encodeURIComponent(title)}`
    return query ? `${basePath}?${query}` : basePath
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
    const query = buildQueryString(filters)
    const hash = sectionId ? `#${tabId}:${sectionId}` : `#${tabId}`
    return query ? `${dashboardActionPath}?${query}${hash}` : `${dashboardActionPath}${hash}`
}

export function buildQueryString(filters: { branch?: string | null; project?: string | null; file?: string | null }): string {
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

export function serializeForInlineScript(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}


