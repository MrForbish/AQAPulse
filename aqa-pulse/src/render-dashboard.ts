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

const DASHBOARD_TEXT = ru.dashboard
const METRIC_DESCRIPTIONS = DASHBOARD_TEXT.tooltips

export function renderDashboardHtml(
    summary: DashboardSummary,
    options: {
        basePath?: string
    } = {},
): string {
    const normalizedBasePath = normalizeDashboardBasePath(options.basePath)
    const dashboardActionPath = normalizedBasePath || '/'
    const testDetailsBasePath = normalizedBasePath ? `${normalizedBasePath}/test` : '/test'
    const previousRunLabel = formatRunLabel(summary.comparison.previousRun)

    const availableFiltersData = serializeForInlineScript(summary.availableFilters)
    const passRateTrendData = serializeForInlineScript(summary.charts.passRateTrend)
    const durationTrendData = serializeForInlineScript(summary.charts.durationTrend)
    const flakyTrendData = serializeForInlineScript(summary.charts.flakyTrend)
    const statusChartData = serializeForInlineScript(summary.charts.statusDistribution)
    const errorChartData = serializeForInlineScript({
        ...summary.charts.errorClusters,
        fullLabels: summary.errorClusters.length > 0
            ? summary.errorClusters.map((cluster) => cluster.message)
            : summary.charts.errorClusters.labels,
    })
    const slowestChartData = serializeForInlineScript({
        ...summary.charts.slowestTests,
        fullLabels: summary.performance.slowestTests.length > 0
            ? summary.performance.slowestTests.map((test) => test.title)
            : summary.charts.slowestTests.labels,
    })
    const phaseBreakdownChartData = serializeForInlineScript(toPerformanceChartDataset(summary.performance.phaseBreakdown, {
        labelFormatter: (label) => formatPerformancePhaseLabel(label),
        fullLabelFormatter: (label) => formatPerformancePhaseLabel(label),
        unit: 'minutes',
    }))
    const suiteDurationChartData = serializeForInlineScript(toPerformanceChartDataset(summary.performance.suiteDuration, {
        labelFormatter: (label) => shortenChartLabel(label, 28),
        unit: 'minutes',
    }))
    const browserDurationChartData = serializeForInlineScript(toPerformanceChartDataset(summary.performance.durationPerBrowser, {
        labelFormatter: (label) => shortenChartLabel(label, 24),
        unit: 'minutes',
    }))
    const dashboardTextData = serializeForInlineScript({
        filters: DASHBOARD_TEXT.filters,
        charts: DASHBOARD_TEXT.charts,
        statusLabels: DASHBOARD_TEXT.statusLabels,
        business: DASHBOARD_TEXT.business,
        performance: DASHBOARD_TEXT.performance,
        states: DASHBOARD_TEXT.states,
    })
    const businessCostConfigData = serializeForInlineScript({
        assumptions: summary.businessMetrics.costOfFlakiness.assumptions,
        baseMetrics: {
            extraRetryMinutes: summary.businessMetrics.costOfFlakiness.extraRetryMinutes,
            unstableRuns: summary.businessMetrics.costOfFlakiness.unstableRuns,
            activeDays: summary.businessMetrics.costOfFlakiness.activeDays,
        },
    })
    const leadingPhase = getLeadingPhase(summary.performance.phaseBreakdown)
    const topSuite = summary.performance.suiteDuration[0] ?? null
    const topBrowser = summary.performance.durationPerBrowser[0] ?? null

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(DASHBOARD_TEXT.title)}</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='42' fill='%232f81f7'/%3E%3C/svg%3E">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="/assets/chart.umd.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Inter', sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            padding: 24px;
        }
        * {
            scrollbar-width: thin;
            scrollbar-color: #3d444d #161b22;
        }
        *::-webkit-scrollbar {
            width: 12px;
            height: 12px;
        }
        *::-webkit-scrollbar-track {
            background: #161b22;
            border-radius: 999px;
        }
        *::-webkit-scrollbar-thumb {
            background: #3d444d;
            border: 2px solid #161b22;
            border-radius: 999px;
        }
        *::-webkit-scrollbar-thumb:hover {
            background: #57606a;
        }
        .dashboard {
            max-width: 1600px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 24px;
            flex-wrap: wrap;
        }
        h1 {
            font-weight: 600;
            font-size: 28px;
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            color: white;
        }
        .subtle {
            color: #8b949e;
            font-size: 13px;
        }
        .notice {
            background: rgba(47, 129, 247, 0.12);
            border: 1px solid rgba(47, 129, 247, 0.35);
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 24px;
            color: #c9d1d9;
        }
        .filters-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
        }
        .filters-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
            flex-wrap: wrap;
            margin-bottom: 14px;
        }
        .filters-title {
            font-size: 16px;
            font-weight: 500;
            color: #ffffff;
            margin-bottom: 4px;
        }
        .filters-form {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            align-items: end;
        }
        .filter-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .filter-label {
            color: #8b949e;
            font-size: 12px;
        }
        .filter-select {
            width: 100%;
            min-height: 40px;
            border-radius: 6px;
            border: 1px solid #30363d;
            background: #0d1117;
            color: #c9d1d9;
            padding: 0 12px;
        }
        .filter-actions {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        .action-button,
        .action-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 40px;
            padding: 0 16px;
            border-radius: 6px;
            border: 1px solid #30363d;
            font-size: 13px;
            text-decoration: none;
            cursor: pointer;
        }
        .action-button {
            background: #2f81f7;
            color: #ffffff;
        }
        .action-link {
            background: #21262d;
            color: #c9d1d9;
        }
        .tabs-nav {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 24px;
        }
        .tab-button {
            min-height: 38px;
            padding: 0 14px;
            border-radius: 999px;
            border: 1px solid #30363d;
            background: #161b22;
            color: #c9d1d9;
            cursor: pointer;
            font-size: 13px;
        }
        .tab-button.is-active {
            background: #2f81f7;
            border-color: #2f81f7;
            color: #ffffff;
        }
        .tab-panel {
            display: none;
        }
        .tab-panel.is-active {
            display: block;
        }
        .placeholder-card {
            background: #161b22;
            border: 1px dashed #30363d;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }
        .placeholder-title {
            font-size: 18px;
            color: #ffffff;
            margin-bottom: 10px;
        }
        .placeholder-list {
            margin-top: 12px;
            padding-left: 18px;
            color: #8b949e;
            font-size: 13px;
            line-height: 1.6;
        }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 24px;
        }
        .business-kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .kpi-card,
        .chart-card,
        .table-container {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
        }
        .kpi-card {
            padding: 16px;
        }
        .kpi-label {
            font-size: 12px;
            color: #8b949e;
            margin-bottom: 8px;
        }
        .kpi-value {
            font-size: 28px;
            font-weight: 600;
            color: #9fd3ff;
            text-shadow: 0 0 18px rgba(88, 166, 255, 0.12);
            margin-bottom: 8px;
            min-width: 0;
        }
        .kpi-value-text {
            font-size: 20px;
            line-height: 1.25;
            text-shadow: none;
        }
        .trend-neutral {
            color: #8b949e;
            font-size: 12px;
        }
        .trend-up {
            color: #3fb950;
            font-size: 12px;
        }
        .trend-down {
            color: #f85149;
            font-size: 12px;
        }
        ${METRIC_INFO_STYLES}
        .charts-grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
        }
        .chart-card {
            padding: 20px;
        }
        .chart-title {
            font-weight: 500;
            margin-bottom: 16px;
            color: #ffffff;
        }
        .chart-subtitle {
            margin: -6px 0 14px;
            color: #8b949e;
            font-size: 12px;
            line-height: 1.5;
        }
        .phase-legend {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            margin-top: 14px;
        }
        .phase-legend-item {
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 10px 12px;
            background: #0d1117;
        }
        .phase-legend-label {
            color: #8b949e;
            font-size: 12px;
            margin-bottom: 4px;
        }
        .phase-legend-value {
            color: #c9d1d9;
            font-size: 14px;
            font-weight: 600;
        }
        .overflow-text {
            display: block;
            min-width: 0;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .overflow-text-inline {
            display: inline-block;
            vertical-align: bottom;
        }
        .table-cell-text {
            max-width: 280px;
        }
        .table-cell-text-wide {
            max-width: 420px;
        }
        .summary-text {
            max-width: 100%;
        }
        .manager-summary-card {
            padding: 20px;
            margin-bottom: 24px;
            background:
                radial-gradient(circle at top right, rgba(47, 129, 247, 0.16), transparent 28%),
                linear-gradient(180deg, rgba(88, 166, 255, 0.06) 0%, #161b22 100%);
            border: 1px solid #30363d;
            border-radius: 8px;
        }
        .manager-summary-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 16px;
        }
        .manager-summary-title {
            font-size: 20px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 8px;
        }
        .manager-summary-description {
            max-width: 860px;
            color: #8b949e;
            font-size: 13px;
            line-height: 1.6;
        }
        .manager-status-pill,
        .manager-item-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 34px;
            padding: 0 12px;
            border-radius: 999px;
            border: 1px solid #30363d;
            font-size: 12px;
            font-weight: 600;
            background: #21262d;
            color: #c9d1d9;
        }
        .manager-status-pill::before,
        .manager-item-pill::before {
            content: '';
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: currentColor;
            box-shadow: 0 0 10px currentColor;
        }
        .manager-status-healthy,
        .manager-item-healthy,
        .manager-item-improving,
        .manager-item-info {
            color: #3fb950;
            border-color: rgba(63, 185, 80, 0.35);
            background: rgba(63, 185, 80, 0.12);
        }
        .manager-status-warning,
        .manager-item-warning,
        .manager-item-stable {
            color: #d29922;
            border-color: rgba(210, 153, 34, 0.35);
            background: rgba(210, 153, 34, 0.12);
        }
        .manager-status-critical,
        .manager-item-critical,
        .manager-item-regressing {
            color: #f85149;
            border-color: rgba(248, 81, 73, 0.35);
            background: rgba(248, 81, 73, 0.12);
        }
        .manager-signal-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
        }
        .manager-signal-card {
            background: rgba(13, 17, 23, 0.72);
            border: 1px solid #30363d;
            border-radius: 10px;
            padding: 14px;
        }
        .manager-signal-label {
            color: #8b949e;
            font-size: 12px;
            margin-bottom: 8px;
        }
        .manager-signal-value {
            color: #ffffff;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .manager-signal-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }
        .manager-signal-hint {
            color: #8b949e;
            font-size: 12px;
            line-height: 1.5;
            margin-top: 8px;
        }
        .manager-detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .manager-blocker-list,
        .manager-change-list {
            display: grid;
            gap: 12px;
            margin-top: 16px;
        }
        .manager-blocker-item,
        .manager-change-item {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 10px;
            padding: 14px;
        }
        .manager-blocker-head,
        .manager-change-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }
        .manager-blocker-title,
        .manager-change-title {
            color: #ffffff;
            font-size: 14px;
            font-weight: 500;
        }
        .manager-blocker-value,
        .manager-change-value {
            color: #ffffff;
            font-size: 13px;
            font-weight: 600;
        }
        .manager-blocker-body,
        .manager-change-body {
            color: #8b949e;
            font-size: 12px;
            line-height: 1.6;
        }
        .manager-blocker-link {
            display: inline-flex;
            margin-top: 10px;
            color: #58a6ff;
            text-decoration: none;
            font-size: 12px;
        }
        .manager-blocker-link:hover {
            text-decoration: underline;
        }
        .tests-browser-card {
            padding: 20px;
            margin-bottom: 24px;
            display: flex;
            flex-direction: column;
            max-height: min(75vh, 960px);
            min-height: 520px;
            overflow: hidden;
        }
        .tests-browser-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 16px;
        }
        .tests-browser-title {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 8px;
        }
        .tests-browser-nav {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 16px;
        }
        .tests-browser-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 36px;
            padding: 0 12px;
            border-radius: 999px;
            border: 1px solid #30363d;
            background: #0d1117;
            color: #c9d1d9;
            cursor: pointer;
            font-size: 12px;
        }
        .tests-browser-button.is-active {
            background: #2f81f7;
            border-color: #2f81f7;
            color: #ffffff;
        }
        .tests-browser-count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            min-height: 24px;
            padding: 0 6px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.08);
            color: inherit;
            font-weight: 600;
        }
        .tests-browser-panel {
            display: none;
            flex: 1 1 auto;
            min-height: 0;
        }
        .tests-browser-panel.is-active {
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .tests-browser-table-container {
            flex: 1 1 auto;
            max-height: 100%;
            min-height: 0;
            overflow-y: auto;
            overflow-x: auto;
            scrollbar-gutter: stable;
        }
        .status-drilldown-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            margin-top: 16px;
        }
        .status-drilldown-button {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            min-height: 40px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid #30363d;
            background: #0d1117;
            color: #c9d1d9;
            cursor: pointer;
            text-align: left;
            font-size: 12px;
        }
        .status-drilldown-button:hover {
            border-color: rgba(88, 166, 255, 0.45);
            box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.12);
        }
        .status-drilldown-count {
            color: #9fd3ff;
            font-weight: 600;
        }
        .value-accent,
        .manager-signal-value,
        .business-signal-value,
        .business-component-total-value {
            color: #9fd3ff;
            text-shadow: 0 0 16px rgba(88, 166, 255, 0.12);
        }
        .meta-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 999px;
            background: #21262d;
            color: #c9d1d9;
            font-size: 12px;
            margin-right: 8px;
            margin-top: 6px;
        }
        .table-title {
            font-weight: 500;
            margin-bottom: 12px;
            color: #ffffff;
            font-size: 18px;
        }
        .runs-summary-strip {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }
        .runs-summary-item {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 12px 14px;
        }
        .runs-summary-label {
            color: #8b949e;
            font-size: 12px;
            margin-bottom: 6px;
        }
        .runs-summary-value {
            color: #c9d1d9;
            font-size: 13px;
            line-height: 1.5;
            word-break: break-word;
        }
        .table-container {
            padding: 8px;
            overflow-x: auto;
            margin-bottom: 24px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            text-align: left;
            padding: 12px 16px;
            font-weight: 500;
            color: #8b949e;
            border-bottom: 1px solid #30363d;
            font-size: 13px;
        }
        td {
            padding: 12px 16px;
            border-bottom: 1px solid #21262d;
            font-size: 13px;
            vertical-align: top;
        }
        tr:last-child td {
            border-bottom: none;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }
        .status-failed { background: #da3633; color: #fff; }
        .status-flaky { background: #d29922; color: #000; }
        .status-passed { background: #1a7f37; color: #fff; }
        .status-skipped { background: #6e7681; color: #fff; }
        .status-unknown { background: #21262d; color: #fff; }
        .mono {
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 12px;
            color: #ff7b72;
            word-break: break-word;
        }
        .list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .list-item {
            padding: 10px 12px;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
        }
        .list-item-title {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 6px;
            font-size: 13px;
            color: #ffffff;
        }
        .muted {
            color: #8b949e;
            font-size: 12px;
        }
        .test-link {
            color: #58a6ff;
            text-decoration: none;
        }
        .test-link:hover {
            text-decoration: underline;
        }
        .assumptions-editor {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #30363d;
        }
        .assumptions-editor-title {
            font-size: 14px;
            font-weight: 500;
            color: #ffffff;
            margin-bottom: 10px;
        }
        .assumptions-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 12px;
        }
        .assumption-input {
            width: 100%;
            min-height: 40px;
            border-radius: 6px;
            border: 1px solid #30363d;
            background: #0d1117;
            color: #c9d1d9;
            padding: 0 12px;
        }
        .assumption-input::-webkit-outer-spin-button,
        .assumption-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        .assumption-input[type=number] {
            -moz-appearance: textfield;
        }
        .assumptions-actions {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        .business-summary-card {
            padding: 20px;
            margin-bottom: 24px;
            background:
                radial-gradient(circle at top right, rgba(47, 129, 247, 0.16), transparent 28%),
                linear-gradient(180deg, rgba(88, 166, 255, 0.06) 0%, #161b22 100%);
        }
        .business-summary-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            flex-wrap: wrap;
            margin-bottom: 16px;
        }
        .business-summary-title {
            font-size: 20px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 8px;
        }
        .business-summary-description {
            max-width: 820px;
            color: #8b949e;
            font-size: 13px;
            line-height: 1.6;
        }
        .scenario-status-box {
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: flex-start;
        }
        .scenario-status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 34px;
            padding: 0 12px;
            border-radius: 999px;
            border: 1px solid #30363d;
            font-size: 12px;
            font-weight: 600;
            background: #21262d;
            color: #c9d1d9;
        }
        .scenario-status-pill::before {
            content: '';
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: currentColor;
            box-shadow: 0 0 10px currentColor;
        }
        .scenario-status-ready {
            color: #3fb950;
            border-color: rgba(63, 185, 80, 0.35);
            background: rgba(63, 185, 80, 0.12);
        }
        .scenario-status-partial {
            color: #d29922;
            border-color: rgba(210, 153, 34, 0.35);
            background: rgba(210, 153, 34, 0.12);
        }
        .scenario-status-empty {
            color: #8b949e;
            border-color: rgba(139, 148, 158, 0.35);
            background: rgba(139, 148, 158, 0.12);
        }
        .impact-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 34px;
            padding: 0 12px;
            border-radius: 999px;
            border: 1px solid #30363d;
            font-size: 12px;
            font-weight: 600;
            background: #21262d;
            color: #c9d1d9;
        }
        .impact-pill::before {
            content: '';
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: currentColor;
            box-shadow: 0 0 10px currentColor;
        }
        .impact-high {
            color: #f85149;
            border-color: rgba(248, 81, 73, 0.35);
            background: rgba(248, 81, 73, 0.12);
        }
        .impact-medium {
            color: #d29922;
            border-color: rgba(210, 153, 34, 0.35);
            background: rgba(210, 153, 34, 0.12);
        }
        .impact-low {
            color: #3fb950;
            border-color: rgba(63, 185, 80, 0.35);
            background: rgba(63, 185, 80, 0.12);
        }
        .impact-unknown {
            color: #8b949e;
            border-color: rgba(139, 148, 158, 0.35);
            background: rgba(139, 148, 158, 0.12);
        }
        .business-signal-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 14px;
        }
        .business-signal-card {
            background: rgba(13, 17, 23, 0.72);
            border: 1px solid #30363d;
            border-radius: 10px;
            padding: 14px;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .business-signal-card.is-dominant {
            border-color: rgba(88, 166, 255, 0.45);
            box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.16);
            transform: translateY(-1px);
        }
        .business-signal-label {
            color: #8b949e;
            font-size: 12px;
            margin-bottom: 8px;
        }
        .business-signal-value {
            color: #ffffff;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 6px;
        }
        .business-signal-hint {
            color: #8b949e;
            font-size: 12px;
            line-height: 1.5;
        }
        .formula-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin: 16px 0;
        }
        .formula-card {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 10px;
            padding: 14px;
        }
        .formula-card-title {
            color: #ffffff;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .formula-card-body {
            color: #8b949e;
            font-size: 12px;
            line-height: 1.6;
        }
        .cost-breakdown-stack {
            display: grid;
            gap: 12px;
            margin-top: 16px;
        }
        .cost-breakdown-item {
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid #30363d;
            background: #0d1117;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .cost-breakdown-item.is-dominant {
            border-color: rgba(88, 166, 255, 0.45);
            box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.16);
        }
        .cost-breakdown-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }
        .cost-breakdown-title {
            color: #ffffff;
            font-size: 13px;
            font-weight: 500;
        }
        .cost-breakdown-meta {
            color: #8b949e;
            font-size: 12px;
        }
        .cost-breakdown-bar {
            width: 100%;
            height: 10px;
            border-radius: 999px;
            background: #21262d;
            overflow: hidden;
        }
        .cost-breakdown-fill {
            height: 100%;
            width: 0%;
            border-radius: inherit;
            transition: width 0.2s ease;
        }
        .cost-breakdown-fill-ci {
            background: linear-gradient(90deg, #2f81f7 0%, #58a6ff 100%);
        }
        .cost-breakdown-fill-dev {
            background: linear-gradient(90deg, #d29922 0%, #f2cc60 100%);
        }
        .assumptions-note {
            margin-top: 14px;
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid #30363d;
            background: #0d1117;
        }
        .assumptions-note-title {
            color: #ffffff;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 6px;
        }
        .assumptions-note-body {
            color: #8b949e;
            font-size: 12px;
            line-height: 1.6;
        }
        .business-insight-card {
            margin-top: 16px;
            padding: 14px 16px;
            border-radius: 10px;
            border: 1px solid #30363d;
            background: #0d1117;
        }
        .business-insight-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }
        .business-insight-title {
            font-size: 13px;
            font-weight: 600;
            color: #ffffff;
        }
        .business-insight-body {
            color: #c9d1d9;
            font-size: 13px;
            line-height: 1.6;
        }
        .cost-kpi-card {
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .cost-kpi-card.impact-high {
            box-shadow: 0 0 0 1px rgba(248, 81, 73, 0.16);
        }
        .cost-kpi-card.impact-medium {
            box-shadow: 0 0 0 1px rgba(210, 153, 34, 0.16);
        }
        .cost-kpi-card.impact-low {
            box-shadow: 0 0 0 1px rgba(63, 185, 80, 0.16);
        }
        .preset-buttons {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 12px;
        }
        .preset-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 34px;
            padding: 0 12px;
            border-radius: 999px;
            border: 1px solid #30363d;
            background: #21262d;
            color: #c9d1d9;
            cursor: pointer;
            font-size: 12px;
            transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
        }
        .preset-button.is-active {
            background: rgba(47, 129, 247, 0.16);
            border-color: rgba(47, 129, 247, 0.45);
            color: #ffffff;
        }
        .context-note {
            margin-bottom: 12px;
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid #30363d;
            background: #0d1117;
        }
        .context-note.is-info {
            border-color: rgba(47, 129, 247, 0.35);
            background: rgba(47, 129, 247, 0.08);
        }
        .context-note.is-warning {
            border-color: rgba(210, 153, 34, 0.35);
            background: rgba(210, 153, 34, 0.08);
        }
        .context-note-title {
            color: #ffffff;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 6px;
        }
        .context-note-body {
            color: #c9d1d9;
            font-size: 12px;
            line-height: 1.6;
        }
        .business-details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
        }
        .business-component-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
            margin-top: 16px;
        }
        .business-component-item {
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid #30363d;
            background: #0d1117;
        }
        .business-component-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }
        .business-component-label {
            color: #ffffff;
            font-size: 13px;
            font-weight: 500;
        }
        .business-component-formula {
            color: #8b949e;
            font-size: 12px;
        }
        .business-component-progress {
            width: 100%;
            height: 8px;
            border-radius: 999px;
            background: #21262d;
            overflow: hidden;
        }
        .business-component-fill {
            height: 100%;
            border-radius: inherit;
            background: #3fb950;
        }
        .business-component-fill.warning {
            background: #d29922;
        }
        .business-component-fill.danger {
            background: #f85149;
        }
        .business-component-total {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #30363d;
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
        }
        .business-component-total-label {
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
        }
        .business-component-total-value {
            color: #ffffff;
            font-size: 24px;
            font-weight: 600;
        }
        .metric-readiness-list {
            display: grid;
            gap: 10px;
            margin-top: 16px;
        }
        .metric-readiness-item {
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid #30363d;
            background: #0d1117;
        }
        .metric-readiness-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
            flex-wrap: wrap;
            margin-bottom: 6px;
        }
        .metric-readiness-title {
            color: #ffffff;
            font-size: 13px;
            font-weight: 500;
        }
        .metric-readiness-pill {
            display: inline-flex;
            align-items: center;
            min-height: 26px;
            padding: 0 10px;
            border-radius: 999px;
            border: 1px solid #30363d;
            font-size: 11px;
            font-weight: 600;
            background: #21262d;
            color: #c9d1d9;
        }
        .metric-readiness-pill.is-ready {
            color: #3fb950;
            border-color: rgba(63, 185, 80, 0.35);
            background: rgba(63, 185, 80, 0.12);
        }
        .metric-readiness-pill.is-partial {
            color: #d29922;
            border-color: rgba(210, 153, 34, 0.35);
            background: rgba(210, 153, 34, 0.12);
        }
        .metric-readiness-pill.is-pending {
            color: #8b949e;
            border-color: rgba(139, 148, 158, 0.35);
            background: rgba(139, 148, 158, 0.12);
        }
        .metric-readiness-body {
            color: #8b949e;
            font-size: 12px;
            line-height: 1.6;
        }
        canvas {
            max-height: 280px;
        }
        @media (max-width: 1200px) {
            .filters-form {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .kpi-grid {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }
            .business-kpi-grid,
            .business-details-grid,
            .assumptions-grid,
            .business-signal-grid,
            .formula-grid,
            .runs-summary-strip {
                grid-template-columns: 1fr;
            }
        }
        @media (max-width: 900px) {
            .filters-form,
            .kpi-grid,
            .business-kpi-grid,
            .charts-grid-2 {
                grid-template-columns: 1fr;
            }
            .phase-legend {
                grid-template-columns: 1fr;
            }
            .status-drilldown-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <div>
                <h1>
                    <span style="color: #2f81f7;">◉</span>
                    AQA Pulse
                    <span class="badge">${escapeHtml(DASHBOARD_TEXT.badge)}</span>
                </h1>
                <div class="subtle" style="margin-top: 10px;">
                    ${escapeHtml(DASHBOARD_TEXT.sourceHint)} ${escapeHtml(summary.sourceFile)}
                </div>
                    <div class="table-container tests-browser-table-container" style="margin-bottom: 0;">
            <div class="subtle">
                <div>${escapeHtml(DASHBOARD_TEXT.generatedAt)}: ${escapeHtml(formatDate(summary.generatedAt))}</div>
                <div>${escapeHtml(DASHBOARD_TEXT.runTime)}: ${escapeHtml(formatDuration(summary.kpis.totalDurationMs))}</div>
                <div>${escapeHtml(DASHBOARD_TEXT.projects)}: ${escapeHtml(summary.environment.projects.join(', ') || '—')}</div>
                <div>
                    <span class="meta-badge">${escapeHtml(DASHBOARD_TEXT.branchMeta)}: ${escapeHtml(summary.runMetadata.branch ?? '—')}</span>
                    <span class="meta-badge">${escapeHtml(DASHBOARD_TEXT.commitMeta)}: ${escapeHtml(formatCommit(summary.runMetadata.commit))}</span>
                    <span class="meta-badge">${escapeHtml(DASHBOARD_TEXT.authorMeta)}: ${escapeHtml(summary.runMetadata.author ?? '—')}</span>
                </div>
            </div>
        </div>

        <div class="filters-card">
            <div class="filters-header">
                <div>
                    <div class="filters-title">${escapeHtml(DASHBOARD_TEXT.filters.title)}</div>
                    <div class="subtle">${escapeHtml(DASHBOARD_TEXT.filters.description)}</div>
                </div>
                <div class="subtle">
                    <span class="meta-badge">${escapeHtml(DASHBOARD_TEXT.branchMeta)}: ${escapeHtml(summary.filters.branch ?? DASHBOARD_TEXT.filters.all)}</span>
                    <span class="meta-badge">${escapeHtml(DASHBOARD_TEXT.filters.project.toLowerCase())}: ${escapeHtml(summary.filters.project ?? DASHBOARD_TEXT.filters.all)}</span>
                    <span class="meta-badge">${escapeHtml(DASHBOARD_TEXT.filters.file.toLowerCase())}: ${escapeHtml(summary.filters.file ?? DASHBOARD_TEXT.filters.all)}</span>
                </div>
            </div>
            <form class="filters-form" method="get" action="${escapeHtml(dashboardActionPath)}">
                ${renderFilterSelect('branch', DASHBOARD_TEXT.filters.branch, summary.availableFilters.branches, summary.filters.branch)}
                ${renderFilterSelect('project', DASHBOARD_TEXT.filters.project, summary.availableFilters.projects, summary.filters.project)}
                ${renderFilterSelect('file', DASHBOARD_TEXT.filters.file, summary.availableFilters.files, summary.filters.file)}
                <div class="filter-actions">
                    <button class="action-button" type="submit">${escapeHtml(DASHBOARD_TEXT.filters.apply)}</button>
                    <a class="action-link" href="${escapeHtml(dashboardActionPath)}">${escapeHtml(DASHBOARD_TEXT.filters.reset)}</a>
                </div>
            </form>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.passRate, METRIC_DESCRIPTIONS.passRate)}</div>
                <div class="kpi-value">${escapeHtml(formatPercent(summary.kpis.passRate))}</div>
                <div class="trend-neutral">${summary.kpis.passedTests} / ${summary.kpis.totalTests} тестов прошли</div>
                <div class="${getTrendClass(summary.trend.passRateDelta, false)}">${escapeHtml(formatPassRateDelta(summary.trend.passRateDelta))}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.failedTests, METRIC_DESCRIPTIONS.failedTests)}</div>
                <div class="kpi-value">${summary.kpis.failedTests}</div>
                <div class="trend-neutral">Таймауты: ${summary.kpis.timedOutTests} • Прерванные: ${summary.kpis.interruptedTests}</div>
                <div class="${getTrendClass(summary.trend.failedTestsDelta, true)}">${escapeHtml(formatCountDelta('к прошлому прогону', summary.trend.failedTestsDelta))}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.flakyTests, METRIC_DESCRIPTIONS.flakyTests)}</div>
                <div class="kpi-value">${summary.kpis.flakyTests}</div>
                <div class="trend-neutral">${escapeHtml(formatPercent(summary.kpis.flakyRatio))} от общего количества</div>
                <div class="${getTrendClass(summary.trend.flakyTestsDelta, true)}">${escapeHtml(formatCountDelta('к прошлому прогону', summary.trend.flakyTestsDelta))}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.runDuration, `${METRIC_DESCRIPTIONS.runDuration} ${METRIC_DESCRIPTIONS.medianDuration}`)}</div>
                <div class="kpi-value">${escapeHtml(formatDuration(summary.kpis.totalDurationMs))}</div>
                <div class="trend-neutral">Медиана: ${escapeHtml(formatDuration(summary.kpis.medianDurationMs))}</div>
                <div class="${getTrendClass(summary.trend.durationMsDelta, true)}">${escapeHtml(formatDurationDelta(summary.trend.durationMsDelta))}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.errorClusters, METRIC_DESCRIPTIONS.errorClusters)}</div>
                <div class="kpi-value">${summary.kpis.errorClusterCount}</div>
                <div class="trend-neutral">Уникальные группы падений</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.environment, METRIC_DESCRIPTIONS.environment)}</div>
                <div class="kpi-value">${escapeHtml(summary.environment.os)}</div>
                <div class="trend-neutral">PW ${escapeHtml(summary.environment.playwrightVersion)} • Node ${escapeHtml(summary.environment.nodeVersion)}</div>
            </div>
        </div>

        <div class="tabs-nav" role="tablist" aria-label="${escapeHtml(DASHBOARD_TEXT.tabs.ariaLabel)}">
            ${renderTabButton('overview', DASHBOARD_TEXT.tabs.overview, true)}
            ${renderTabButton('performance', DASHBOARD_TEXT.tabs.performance)}
            ${renderTabButton('flaky', DASHBOARD_TEXT.tabs.flaky)}
            ${renderTabButton('code-quality', DASHBOARD_TEXT.tabs.codeQuality)}
            ${renderTabButton('business', DASHBOARD_TEXT.tabs.business)}
            ${renderTabButton('team', DASHBOARD_TEXT.tabs.team)}
            ${renderTabButton('ai', DASHBOARD_TEXT.tabs.ai)}
        </div>

        <section class="tab-panel is-active" data-tab-panel="overview">
            ${renderManagerOverview(summary, dashboardActionPath)}

            <div class="charts-grid-2">
                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.passRateTrend, METRIC_DESCRIPTIONS.passRateTrend)}</div>
                    <canvas id="passRateTrendChart"></canvas>
                </div>

                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.statusDistribution, METRIC_DESCRIPTIONS.statusDistribution)}</div>
                    <canvas id="statusChart"></canvas>
                    ${renderStatusDrilldown(summary)}
                </div>
            </div>

            ${renderCurrentRunTestsBrowser(summary, testDetailsBasePath)}

            <div class="table-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.latestRuns, METRIC_DESCRIPTIONS.recentRuns)}</div>
            <div class="runs-summary-strip">
                <div class="runs-summary-item">
                    <div class="runs-summary-label">${escapeHtml(DASHBOARD_TEXT.history.totalRuns)}</div>
                    <div class="runs-summary-value">${summary.history.totalRuns}</div>
                </div>
                <div class="runs-summary-item">
                    <div class="runs-summary-label">${escapeHtml(DASHBOARD_TEXT.history.previousRun)}</div>
                    <div class="runs-summary-value">${escapeHtml(previousRunLabel)}</div>
                </div>
                <div class="runs-summary-item">
                    <div class="runs-summary-label">${escapeHtml(DASHBOARD_TEXT.history.latestSource)}</div>
                    <div class="runs-summary-value">${renderOverflowText(summary.sourceFile, { className: 'summary-text' })}</div>
                </div>
                <div class="runs-summary-item">
                    <div class="runs-summary-label">${escapeHtml(DASHBOARD_TEXT.history.currentBranch)}</div>
                    <div class="runs-summary-value">${renderOverflowText(`${summary.runMetadata.branch ?? '—'} • ${DASHBOARD_TEXT.commitMeta}: ${formatCommit(summary.runMetadata.commit)} • ${DASHBOARD_TEXT.authorMeta}: ${summary.runMetadata.author ?? '—'}`, { className: 'summary-text' })}</div>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.time)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.metrics.passRate)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.metrics.failures)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.metrics.flakyShort)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.duration)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.branch)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.commit)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.author)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.source)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.history.recentRuns.length > 0
                            ? summary.history.recentRuns.map(renderHistoryRow).join('')
                            : `<tr><td colspan="9">${escapeHtml(DASHBOARD_TEXT.states.historyEmpty)}</td></tr>`}
                    </tbody>
                </table>
            </div>
        </section>

        <section class="tab-panel" data-tab-panel="performance">
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.p95Duration, METRIC_DESCRIPTIONS.p95Duration)}</div>
                    <div class="kpi-value">${escapeHtml(formatDuration(summary.performance.p95DurationMs))}</div>
                    <div class="trend-neutral">95% тестов укладываются в это значение или быстрее</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.p99Duration, METRIC_DESCRIPTIONS.p99Duration)}</div>
                    <div class="kpi-value">${escapeHtml(formatDuration(summary.performance.p99DurationMs))}</div>
                    <div class="trend-neutral">Хвост самых долгих 1% тестов текущего среза</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.leadingPhase, METRIC_DESCRIPTIONS.phaseBreakdown)}</div>
                    <div class="kpi-value">${escapeHtml(leadingPhase ? formatPerformancePhaseLabel(leadingPhase.label) : '—')}</div>
                    <div class="trend-neutral">${escapeHtml(leadingPhase ? `${formatPercent(leadingPhase.sharePercent)} от длительности прогона` : 'Нет данных по фазам')}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.durationPerBrowser, METRIC_DESCRIPTIONS.durationPerBrowser)}</div>
                    <div class="kpi-value kpi-value-text">${renderOverflowText(topBrowser ? topBrowser.label : '—', { className: 'overflow-text-inline' })}</div>
                    <div class="trend-neutral">${escapeHtml(topBrowser ? `${formatDuration(topBrowser.durationMs)} • ${topBrowser.tests} тестов` : 'Нет данных по браузерам / проектам')}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.suiteDuration, METRIC_DESCRIPTIONS.suiteDuration)}</div>
                    <div class="kpi-value kpi-value-text">${topSuite ? renderOverflowText(topSuite.label, { displayValue: shortenChartLabel(topSuite.label, 20), className: 'overflow-text-inline' }) : '—'}</div>
                    <div class="trend-neutral">${escapeHtml(topSuite ? `${formatDuration(topSuite.durationMs)} • ${topSuite.tests} тестов` : 'Нет данных по наборам')}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.durationTrend, METRIC_DESCRIPTIONS.durationTrend)}</div>
                    <div class="kpi-value">${escapeHtml(formatDuration(summary.performance.durationTrend.currentDurationMs))}</div>
                    <div class="${summary.performance.durationTrend.deltaPercent === null ? 'trend-neutral' : summary.performance.durationTrend.deltaPercent <= 0 ? 'trend-up' : 'trend-down'}">${escapeHtml(formatDurationDelta(summary.performance.durationTrend.deltaPercent))}</div>
                </div>
            </div>

            <div class="charts-grid-2">
                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.durationTrend, METRIC_DESCRIPTIONS.durationTrend)}</div>
                    <canvas id="durationTrendChart"></canvas>
                </div>
                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.topSlowestTests, METRIC_DESCRIPTIONS.topSlowestTests)}</div>
                    <canvas id="slowestChart"></canvas>
                </div>
            </div>

            <div class="charts-grid-2">
                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.phaseBreakdown, METRIC_DESCRIPTIONS.phaseBreakdown)}</div>
                    <div class="chart-subtitle">${escapeHtml(DASHBOARD_TEXT.performance.phaseBreakdownDescription)}</div>
                    <canvas id="phaseBreakdownChart"></canvas>
                    ${renderPhaseLegend(summary.performance.phaseBreakdown)}
                </div>
                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.suiteDuration, METRIC_DESCRIPTIONS.suiteDuration)}</div>
                    <div class="chart-subtitle">${escapeHtml(DASHBOARD_TEXT.performance.suiteDurationDescription)}</div>
                    <canvas id="suiteDurationChart"></canvas>
                </div>
            </div>

            <div class="table-title" data-tab-section="browser-duration">${escapeHtml(DASHBOARD_TEXT.performance.runtimeBreakdownTitle)}</div>
            <div class="charts-grid-2">
                <div class="chart-card">
                    <div class="chart-subtitle">${escapeHtml(DASHBOARD_TEXT.performance.durationPerBrowserDescription)}</div>
                    <canvas id="browserDurationChart"></canvas>
                </div>
                <div class="table-container" style="margin-bottom: 0;">
                    <table>
                        <thead>
                            <tr>
                                <th>${escapeHtml(DASHBOARD_TEXT.filters.project)}</th>
                                <th>${escapeHtml(DASHBOARD_TEXT.tables.duration)}</th>
                                <th>${escapeHtml(DASHBOARD_TEXT.tables.share)}</th>
                                <th>${escapeHtml(DASHBOARD_TEXT.tables.tests)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${summary.performance.durationPerBrowser.length > 0
                                ? summary.performance.durationPerBrowser.map((item) => renderDurationBreakdownRow(item)).join('')
                                : `<tr><td colspan="4">${escapeHtml(DASHBOARD_TEXT.states.performanceBreakdownEmpty)}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="table-title" data-tab-section="suite-duration">${renderMetricHeading(DASHBOARD_TEXT.metrics.suiteDuration, METRIC_DESCRIPTIONS.suiteDuration)}</div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                                <th>${escapeHtml(DASHBOARD_TEXT.tables.group)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.duration)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.share)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.tests)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.performance.suiteDuration.length > 0
                            ? summary.performance.suiteDuration.map((item) => renderDurationBreakdownRow(item)).join('')
                            : `<tr><td colspan="4">${escapeHtml(DASHBOARD_TEXT.states.performanceBreakdownEmpty)}</td></tr>`}
                    </tbody>
                </table>
            </div>

            <div class="table-title" data-tab-section="slow-tests">${renderMetricHeading(DASHBOARD_TEXT.metrics.topSlowestTestsP1, METRIC_DESCRIPTIONS.topSlowestTests)}</div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.test)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.file)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.status)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.flaky)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.duration)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.lastError)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.performance.slowestTests.length > 0
                            ? summary.performance.slowestTests.map((test) => renderSlowTestRow(test, summary.filters, testDetailsBasePath)).join('')
                            : `<tr><td colspan="6">${escapeHtml(DASHBOARD_TEXT.states.slowTestsEmpty)}</td></tr>`}
                    </tbody>
                </table>
            </div>
        </section>

        <section class="tab-panel" data-tab-panel="flaky">
            <div class="charts-grid-2">
                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.flakyTrend, METRIC_DESCRIPTIONS.flakyTrend)}</div>
                    <canvas id="flakyTrendChart"></canvas>
                </div>
                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.clusterDistribution, METRIC_DESCRIPTIONS.clusterList)}</div>
                    <canvas id="clusterChart"></canvas>
                </div>
            </div>

            <div class="table-title" data-tab-section="problematic-tests">${renderMetricHeading(DASHBOARD_TEXT.metrics.problematicTests, METRIC_DESCRIPTIONS.problematicTests)}</div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.test)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.file)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.status)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.flaky)}</th>
                            <th>${renderMetricHeading('Доля падений', METRIC_DESCRIPTIONS.failureRate)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.duration)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.reason)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.topProblematicTests.length > 0
                            ? summary.topProblematicTests.map((test) => renderProblematicTestRow(test, summary.filters, testDetailsBasePath)).join('')
                            : `<tr><td colspan="7">${escapeHtml(DASHBOARD_TEXT.states.problematicTestsEmpty)}</td></tr>`}
                    </tbody>
                </table>
            </div>

            <div class="table-title" data-tab-section="flaky-tests">${renderMetricHeading(DASHBOARD_TEXT.metrics.topFlakyTests, METRIC_DESCRIPTIONS.topFlakyTests)}</div>
            ${renderFlakyHistoryInsight(summary)}
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.test)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.file)}</th>
                            <th>${renderMetricHeading(DASHBOARD_TEXT.metrics.flakyScore, METRIC_DESCRIPTIONS.flakyScore)}</th>
                            <th>${renderMetricHeading('Доля падений', METRIC_DESCRIPTIONS.failureRate)}</th>
                            <th>${renderMetricHeading('MTBF', METRIC_DESCRIPTIONS.mtbf)}</th>
                            <th>${renderMetricHeading(DASHBOARD_TEXT.metrics.unstableRuns, METRIC_DESCRIPTIONS.unstableRuns)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.metrics.lastStatus)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.flakyAnalytics.topFlakyTests.length > 0
                            ? summary.flakyAnalytics.topFlakyTests.map((test) => renderFlakyTestRow(test, summary.filters, testDetailsBasePath)).join('')
                            : `<tr><td colspan="7">${escapeHtml(getFlakyTopTestsEmptyState(summary))}</td></tr>`}
                    </tbody>
                </table>
            </div>

            <div class="table-title" data-tab-section="error-clusters">${renderMetricHeading(DASHBOARD_TEXT.metrics.errorClusters, METRIC_DESCRIPTIONS.clusterList)}</div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.error)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.count)}</th>
                            <th>${escapeHtml(DASHBOARD_TEXT.tables.testExamples)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.errorClusters.length > 0
                            ? summary.errorClusters.map((cluster) => `
                                <tr>
                                    <td class="mono">${escapeHtml(cluster.message)}</td>
                                    <td>${cluster.count}</td>
                                    <td>${escapeHtml(cluster.tests.join(' • '))}</td>
                                </tr>
                            `).join('')
                            : `<tr><td colspan="3">${escapeHtml(DASHBOARD_TEXT.states.failuresEmpty)}</td></tr>`}
                    </tbody>
                </table>
            </div>
        </section>

        <section class="tab-panel" data-tab-panel="code-quality">
            ${renderPlaceholderPanel(DASHBOARD_TEXT.metrics.codeQuality, METRIC_DESCRIPTIONS.codeQuality, DASHBOARD_TEXT.placeholderMetrics.codeQuality)}
        </section>

        <section class="tab-panel" data-tab-panel="business">
            <div class="chart-card business-summary-card">
                <div class="business-summary-header">
                    <div>
                        <div class="business-summary-title">${escapeHtml(DASHBOARD_TEXT.business.summaryTitle)}</div>
                        <div class="business-summary-description">${escapeHtml(DASHBOARD_TEXT.business.summaryDescription)}</div>
                    </div>
                    <div class="scenario-status-box">
                        <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.scenarioSummaryTitle)}</div>
                        <span class="scenario-status-pill ${escapeHtml(getBusinessScenarioStatusClass(summary.businessMetrics.costOfFlakiness.assumptions))}" data-assumptions-status-pill>${escapeHtml(getBusinessScenarioStatusLabel(summary.businessMetrics.costOfFlakiness.assumptions))}</span>
                        <span class="impact-pill ${escapeHtml(getBusinessImpactClass(summary.businessMetrics.costOfFlakiness.totalRub, summary.businessMetrics.costOfFlakiness.costPerActiveDayRub))}" data-cost-impact-pill>${escapeHtml(getBusinessImpactLabel(summary.businessMetrics.costOfFlakiness.totalRub, summary.businessMetrics.costOfFlakiness.costPerActiveDayRub))}</span>
                    </div>
                </div>
                <div class="business-signal-grid">
                    <div class="business-signal-card">
                        <div class="business-signal-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.timeToDetect, METRIC_DESCRIPTIONS.timeToDetect)}</div>
                        <div class="business-signal-value">${escapeHtml(formatNullableMinutes(summary.businessMetrics.timeToDetect.minutes))}</div>
                        <div class="business-signal-hint">${escapeHtml(DASHBOARD_TEXT.business.timeToDetectHint)}</div>
                    </div>
                    <div class="business-signal-card">
                        <div class="business-signal-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.timeToFixFlaky, METRIC_DESCRIPTIONS.timeToFixFlaky)}</div>
                        <div class="business-signal-value">${escapeHtml(formatNullableDays(summary.businessMetrics.timeToFixFlaky.averageDays))}</div>
                        <div class="business-signal-hint">${escapeHtml(DASHBOARD_TEXT.business.timeToFixHintPrefix)}: ${summary.businessMetrics.timeToFixFlaky.resolvedIncidents}</div>
                    </div>
                    <div class="business-signal-card">
                        <div class="business-signal-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.releaseConfidenceScore, METRIC_DESCRIPTIONS.releaseConfidenceScore)}</div>
                        <div class="business-signal-value">${escapeHtml(formatScore(summary.businessMetrics.releaseConfidenceScore))}</div>
                        <div class="business-signal-hint">${escapeHtml(DASHBOARD_TEXT.business.releaseConfidenceHint)}</div>
                    </div>
                    <div class="business-signal-card">
                        <div class="business-signal-label">${escapeHtml(DASHBOARD_TEXT.business.costPerActiveDay)}</div>
                        <div class="business-signal-value" data-cost-per-day-hero>${escapeHtml(formatCurrency(summary.businessMetrics.costOfFlakiness.costPerActiveDayRub))}</div>
                        <div class="business-signal-hint">${escapeHtml(DASHBOARD_TEXT.business.costScenarioDescription)}</div>
                    </div>
                </div>
                <div class="muted" data-assumptions-status-hint>${escapeHtml(getBusinessScenarioStatusHint(summary.businessMetrics.costOfFlakiness.assumptions))}</div>
                <div class="business-insight-card ${escapeHtml(getBusinessImpactClass(summary.businessMetrics.costOfFlakiness.totalRub, summary.businessMetrics.costOfFlakiness.costPerActiveDayRub))}" data-cost-driver-card>
                    <div class="business-insight-header">
                        <div class="business-insight-title" data-cost-driver-title>${escapeHtml(getBusinessDriverInsightTitle(summary.businessMetrics.costOfFlakiness.ciCostRub, summary.businessMetrics.costOfFlakiness.developerCostRub, summary.businessMetrics.costOfFlakiness.totalRub))}</div>
                        <span class="muted">${escapeHtml(DASHBOARD_TEXT.business.topDriverTitle)}</span>
                    </div>
                    <div class="business-insight-body" data-cost-driver-body>${escapeHtml(getBusinessDriverInsightBody(summary.businessMetrics.costOfFlakiness.ciCostRub, summary.businessMetrics.costOfFlakiness.developerCostRub, summary.businessMetrics.costOfFlakiness.totalRub))}</div>
                </div>
            </div>

            <div class="table-title">${escapeHtml(DASHBOARD_TEXT.business.businessOverviewTitle)}</div>
            <div class="muted" style="margin-bottom: 16px;">${escapeHtml(DASHBOARD_TEXT.business.businessOverviewDescription)}</div>
            <div class="kpi-grid business-kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.timeToDetect, METRIC_DESCRIPTIONS.timeToDetect)}</div>
                    <div class="kpi-value">${escapeHtml(formatNullableMinutes(summary.businessMetrics.timeToDetect.minutes))}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.timeToDetectPending)}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.timeToDetectHint)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.timeToFixFlaky, METRIC_DESCRIPTIONS.timeToFixFlaky)}</div>
                    <div class="kpi-value">${escapeHtml(formatNullableDays(summary.businessMetrics.timeToFixFlaky.averageDays))}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.timeToFixHintPrefix)}: ${summary.businessMetrics.timeToFixFlaky.resolvedIncidents}</div>
                    <div class="trend-neutral">${escapeHtml(summary.businessMetrics.timeToFixFlaky.averageDays === null ? DASHBOARD_TEXT.business.timeToFixPending : 'Среднее по восстановленным flaky-инцидентам из истории.')}</div>
                </div>
                <div class="kpi-card cost-kpi-card ${escapeHtml(getBusinessImpactClass(summary.businessMetrics.costOfFlakiness.totalRub, summary.businessMetrics.costOfFlakiness.costPerActiveDayRub))}" data-cost-kpi-card>
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.costOfFlakiness, METRIC_DESCRIPTIONS.costOfFlakiness)}</div>
                    <div class="kpi-value" data-cost-total>${escapeHtml(formatCurrency(summary.businessMetrics.costOfFlakiness.totalRub))}</div>
                    <div class="trend-neutral" data-cost-breakdown>${escapeHtml(DASHBOARD_TEXT.business.ciBreakdown)}: ${escapeHtml(formatCurrency(summary.businessMetrics.costOfFlakiness.ciCostRub))} • ${escapeHtml(DASHBOARD_TEXT.business.developerBreakdown)}: ${escapeHtml(formatCurrency(summary.businessMetrics.costOfFlakiness.developerCostRub))}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.extraRetryTime)}: ${escapeHtml(formatMinutes(summary.businessMetrics.costOfFlakiness.extraRetryMinutes))} • ${escapeHtml(DASHBOARD_TEXT.business.unstableRuns)}: ${summary.businessMetrics.costOfFlakiness.unstableRuns}</div>
                    <div class="trend-neutral" data-cost-assumptions-summary>${escapeHtml(formatCostAssumptions(summary))}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.developerFriction, METRIC_DESCRIPTIONS.developerFriction)}</div>
                    <div class="kpi-value">${escapeHtml(formatDailyRatio(summary.businessMetrics.developerFriction.rerunProxyPerActiveDay))}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.extraRetries)}: ${summary.businessMetrics.developerFriction.extraRetries} • ${escapeHtml(DASHBOARD_TEXT.business.unstableRuns)}: ${summary.businessMetrics.developerFriction.unstableRuns}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.activeDays)}: ${summary.businessMetrics.developerFriction.activeDays}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.releaseConfidenceScore, METRIC_DESCRIPTIONS.releaseConfidenceScore)}</div>
                    <div class="kpi-value">${escapeHtml(formatScore(summary.businessMetrics.releaseConfidenceScore))}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.releaseConfidenceDetails)}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.releaseConfidenceHint)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${renderMetricHeading(DASHBOARD_TEXT.metrics.automationRoi, METRIC_DESCRIPTIONS.automationRoi)}</div>
                    <div class="kpi-value">${escapeHtml(formatNullablePercent(summary.businessMetrics.automationRoi.percent))}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.automationRoiPending)}</div>
                    <div class="trend-neutral">${escapeHtml(DASHBOARD_TEXT.business.automationRoiHint)}</div>
                </div>
            </div>

            <div class="business-details-grid">
                ${renderReleaseConfidenceBreakdown(summary)}
                ${renderBusinessMetricReadiness(summary)}
            </div>

            <div class="table-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.costSection, METRIC_DESCRIPTIONS.costOfFlakiness)}</div>
            <div class="muted" style="margin-bottom: 16px;">${escapeHtml(DASHBOARD_TEXT.business.costScenarioDescription)}</div>
            <div class="charts-grid-2">
                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.costStructure, METRIC_DESCRIPTIONS.costOfFlakiness)}</div>
                    <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.formulaDescription)}</div>
                    <div class="formula-grid">
                        <div class="formula-card">
                            <div class="formula-card-title">${escapeHtml(DASHBOARD_TEXT.business.ciCost)}</div>
                            <div class="formula-card-body">${escapeHtml(DASHBOARD_TEXT.business.ciFormula)}</div>
                        </div>
                        <div class="formula-card">
                            <div class="formula-card-title">${escapeHtml(DASHBOARD_TEXT.business.developmentCost)}</div>
                            <div class="formula-card-body">${escapeHtml(DASHBOARD_TEXT.business.developerFormula)}</div>
                        </div>
                        <div class="formula-card">
                            <div class="formula-card-title">${escapeHtml(DASHBOARD_TEXT.business.overallCost)}</div>
                            <div class="formula-card-body">${escapeHtml(DASHBOARD_TEXT.business.totalFormula)}</div>
                        </div>
                    </div>
                    <div class="list">
                        <div class="list-item">
                            <div class="list-item-title"><span>${escapeHtml(DASHBOARD_TEXT.business.overallCost)}</span><span data-cost-total-breakdown>${escapeHtml(formatCurrency(summary.businessMetrics.costOfFlakiness.totalRub))}</span></div>
                            <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.totalCostHint)}</div>
                        </div>
                        <div class="list-item">
                            <div class="list-item-title"><span>${escapeHtml(DASHBOARD_TEXT.business.ciCost)}</span><span data-cost-ci>${escapeHtml(formatCurrency(summary.businessMetrics.costOfFlakiness.ciCostRub))}</span></div>
                            <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.ciCostHintPrefix)}: ${escapeHtml(formatMinutes(summary.businessMetrics.costOfFlakiness.extraRetryMinutes))}</div>
                        </div>
                        <div class="list-item">
                            <div class="list-item-title"><span>${escapeHtml(DASHBOARD_TEXT.business.developmentCost)}</span><span data-cost-developer>${escapeHtml(formatCurrency(summary.businessMetrics.costOfFlakiness.developerCostRub))}</span></div>
                            <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.developmentCostHintPrefix)}: ${summary.businessMetrics.costOfFlakiness.unstableRuns} • ${escapeHtml(DASHBOARD_TEXT.business.activeDaysHintPrefix)}: ${summary.businessMetrics.costOfFlakiness.activeDays}</div>
                        </div>
                        <div class="list-item">
                            <div class="list-item-title"><span>${escapeHtml(DASHBOARD_TEXT.business.costPerActiveDay)}</span><span data-cost-per-day>${escapeHtml(formatCurrency(summary.businessMetrics.costOfFlakiness.costPerActiveDayRub))}</span></div>
                            <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.costPerActiveDayHint)}</div>
                        </div>
                    </div>
                    <div class="cost-breakdown-stack">
                        <div class="cost-breakdown-item ${escapeHtml(getBusinessBreakdownItemClass(summary.businessMetrics.costOfFlakiness.ciCostRub, summary.businessMetrics.costOfFlakiness.developerCostRub, summary.businessMetrics.costOfFlakiness.totalRub, 'ci'))}" data-cost-breakdown-item="ci">
                            <div class="cost-breakdown-head">
                                <span class="cost-breakdown-title">${escapeHtml(DASHBOARD_TEXT.business.ciShare)}</span>
                                <span class="cost-breakdown-meta" data-cost-ci-share-label>${escapeHtml(formatCostShare(summary.businessMetrics.costOfFlakiness.ciCostRub, summary.businessMetrics.costOfFlakiness.totalRub))}</span>
                            </div>
                            <div class="cost-breakdown-bar"><div class="cost-breakdown-fill cost-breakdown-fill-ci" data-cost-ci-share-bar style="width: ${escapeHtml(formatCostShareWidth(summary.businessMetrics.costOfFlakiness.ciCostRub, summary.businessMetrics.costOfFlakiness.totalRub))};"></div></div>
                        </div>
                        <div class="cost-breakdown-item ${escapeHtml(getBusinessBreakdownItemClass(summary.businessMetrics.costOfFlakiness.ciCostRub, summary.businessMetrics.costOfFlakiness.developerCostRub, summary.businessMetrics.costOfFlakiness.totalRub, 'development'))}" data-cost-breakdown-item="development">
                            <div class="cost-breakdown-head">
                                <span class="cost-breakdown-title">${escapeHtml(DASHBOARD_TEXT.business.developmentShare)}</span>
                                <span class="cost-breakdown-meta" data-cost-dev-share-label>${escapeHtml(formatCostShare(summary.businessMetrics.costOfFlakiness.developerCostRub, summary.businessMetrics.costOfFlakiness.totalRub))}</span>
                            </div>
                            <div class="cost-breakdown-bar"><div class="cost-breakdown-fill cost-breakdown-fill-dev" data-cost-dev-share-bar style="width: ${escapeHtml(formatCostShareWidth(summary.businessMetrics.costOfFlakiness.developerCostRub, summary.businessMetrics.costOfFlakiness.totalRub))};"></div></div>
                        </div>
                    </div>
                </div>
                <div class="chart-card">
                    <div class="chart-title">${renderMetricHeading(DASHBOARD_TEXT.metrics.configAssumptions, METRIC_DESCRIPTIONS.configAssumptions)}</div>
                    <div class="list">
                        <div class="list-item">
                            <div class="list-item-title"><span>${escapeHtml(DASHBOARD_TEXT.business.ciMinuteCost)}</span><span data-assumption-ci-label>${escapeHtml(formatAssumptionValue(summary.businessMetrics.costOfFlakiness.assumptions.ciMinuteCostRub, '₽/мин'))}</span></div>
                        </div>
                        <div class="list-item">
                            <div class="list-item-title"><span>${escapeHtml(DASHBOARD_TEXT.business.devHourCost)}</span><span data-assumption-dev-label>${escapeHtml(formatAssumptionValue(summary.businessMetrics.costOfFlakiness.assumptions.developerHourlyCostRub, '₽/час'))}</span></div>
                        </div>
                        <div class="list-item">
                            <div class="list-item-title"><span>${escapeHtml(DASHBOARD_TEXT.business.analysisMinutes)}</span><span data-assumption-analysis-label>${escapeHtml(formatAssumptionValue(summary.businessMetrics.costOfFlakiness.assumptions.analysisMinutesPerUnstable, 'мин/инцидент'))}</span></div>
                        </div>
                        <div class="list-item">
                            <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.assumptionsMissing)}</div>
                        </div>
                    </div>
                    <div class="assumptions-note">
                        <div class="assumptions-note-title">${escapeHtml(DASHBOARD_TEXT.business.assumptionsConfiguredTitle)}</div>
                        <div class="assumptions-note-body" data-assumptions-note>${escapeHtml(DASHBOARD_TEXT.business.assumptionsConfiguredHint)}</div>
                    </div>
                    <div class="assumptions-editor">
                        <div class="assumptions-editor-title">${escapeHtml(DASHBOARD_TEXT.business.scenarioRecalculation)}</div>
                        <div class="muted" style="margin-bottom: 12px;">${escapeHtml(DASHBOARD_TEXT.business.editorHint)}</div>
                        <div class="muted" style="margin-bottom: 8px;">${escapeHtml(DASHBOARD_TEXT.business.presetDescription)}</div>
                        <div class="preset-buttons">
                            <button class="preset-button" type="button" data-assumption-preset="conservative">${escapeHtml(DASHBOARD_TEXT.business.presetConservative)}</button>
                            <button class="preset-button" type="button" data-assumption-preset="realistic">${escapeHtml(DASHBOARD_TEXT.business.presetRealistic)}</button>
                            <button class="preset-button" type="button" data-assumption-preset="enterprise">${escapeHtml(DASHBOARD_TEXT.business.presetEnterprise)}</button>
                        </div>
                        <div class="assumptions-grid">
                            <label class="filter-field">
                                <span class="filter-label">${escapeHtml(DASHBOARD_TEXT.business.ciMinuteCost)}, ₽</span>
                                <input class="assumption-input" type="number" step="0.01" min="0" inputmode="decimal" data-assumption-input="ciMinuteCost">
                            </label>
                            <label class="filter-field">
                                <span class="filter-label">${escapeHtml(DASHBOARD_TEXT.business.devHourCost)}, ₽</span>
                                <input class="assumption-input" type="number" step="0.01" min="0" inputmode="decimal" data-assumption-input="developerHourlyCost">
                            </label>
                            <label class="filter-field">
                                <span class="filter-label">${escapeHtml(DASHBOARD_TEXT.business.analysisMinutes)}</span>
                                <input class="assumption-input" type="number" step="0.01" min="0" inputmode="decimal" data-assumption-input="analysisMinutesPerIncident">
                            </label>
                        </div>
                        <div class="assumptions-actions">
                            <button class="action-button" type="button" data-assumption-reset>${escapeHtml(DASHBOARD_TEXT.business.resetAssumptions)}</button>
                            <div class="muted">${escapeHtml(DASHBOARD_TEXT.business.recalcHint)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="tab-panel" data-tab-panel="team">
            ${renderPlaceholderPanel(DASHBOARD_TEXT.metrics.team, METRIC_DESCRIPTIONS.teamMetrics, DASHBOARD_TEXT.placeholderMetrics.team)}
        </section>

        <section class="tab-panel" data-tab-panel="ai">
            ${renderPlaceholderPanel(DASHBOARD_TEXT.metrics.ai, METRIC_DESCRIPTIONS.aiMetrics, DASHBOARD_TEXT.placeholderMetrics.ai)}
        </section>
    </div>

    <script>
        const dashboardText = ${dashboardTextData};
        const availableFilters = ${availableFiltersData};
        const passRateTrendDataset = ${passRateTrendData};
        const durationTrendDataset = ${durationTrendData};
        const flakyTrendDataset = ${flakyTrendData};
        const statusDataset = ${statusChartData};
        const errorDataset = ${errorChartData};
        const slowestDataset = ${slowestChartData};
        const phaseBreakdownDataset = ${phaseBreakdownChartData};
        const suiteDurationDataset = ${suiteDurationChartData};
        const browserDurationDataset = ${browserDurationChartData};
        const businessCostConfig = ${businessCostConfigData};

        const filtersForm = document.querySelector('.filters-form');
        const branchSelect = filtersForm ? filtersForm.querySelector('select[name="branch"]') : null;
        const projectSelect = filtersForm ? filtersForm.querySelector('select[name="project"]') : null;
        const fileSelect = filtersForm ? filtersForm.querySelector('select[name="file"]') : null;

        if (branchSelect instanceof HTMLSelectElement && projectSelect instanceof HTMLSelectElement && fileSelect instanceof HTMLSelectElement) {
            const setSelectOptions = function (selectElement, options, selectedValue) {
                const normalizedSelectedValue = typeof selectedValue === 'string' ? selectedValue : '';
                selectElement.innerHTML = '';

                const emptyOption = new Option(dashboardText.filters.all, '');
                selectElement.appendChild(emptyOption);

                options.forEach(function (option) {
                    const nextOption = new Option(option, option, option === normalizedSelectedValue, option === normalizedSelectedValue);
                    selectElement.appendChild(nextOption);
                });

                if (!options.includes(normalizedSelectedValue)) {
                    selectElement.value = '';
                }
            };

            const getProjectOptions = function (branch) {
                if (!branch) {
                    return availableFilters.projects || [];
                }

                return (availableFilters.projectsByBranch && availableFilters.projectsByBranch[branch]) || [];
            };

            const getFileOptions = function (branch, project) {
                if (branch && project) {
                    return (((availableFilters.filesByBranchProject || {})[branch] || {})[project]) || [];
                }

                if (project) {
                    return ((availableFilters.filesByProject || {})[project]) || [];
                }

                if (branch) {
                    return ((availableFilters.filesByBranch || {})[branch]) || [];
                }

                return availableFilters.files || [];
            };

            const syncProjectOptions = function () {
                const nextProjectOptions = getProjectOptions(branchSelect.value);
                const selectedProjectValue = projectSelect.value;
                setSelectOptions(projectSelect, nextProjectOptions, selectedProjectValue);
                syncFileOptions();
            };

            const syncFileOptions = function () {
                const nextFileOptions = getFileOptions(branchSelect.value, projectSelect.value);
                const selectedFileValue = fileSelect.value;
                setSelectOptions(fileSelect, nextFileOptions, selectedFileValue);
            };

            branchSelect.addEventListener('change', syncProjectOptions);
            projectSelect.addEventListener('change', syncFileOptions);
            syncProjectOptions();
        }

        const localizedStatusDataset = {
            labels: (statusDataset.labels || []).map(localizeStatusLabel),
            values: statusDataset.values || [],
        };

        const tabButtons = Array.from(document.querySelectorAll('[data-tab-button]'));
        const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));
        const testStatusButtons = Array.from(document.querySelectorAll('[data-tests-status-button]'));
        const testStatusPanels = Array.from(document.querySelectorAll('[data-tests-status-panel]'));
        const statusDrilldownButtons = Array.from(document.querySelectorAll('[data-open-tests-status]'));
        const chartInstances = {};
        const chartTabs = {
            overview: ['passRateTrendChart', 'statusChart'],
            performance: ['durationTrendChart', 'slowestChart', 'phaseBreakdownChart', 'suiteDurationChart', 'browserDurationChart'],
            flaky: ['flakyTrendChart', 'clusterChart'],
            'code-quality': [],
            business: [],
            team: [],
            ai: [],
        };

        const createChartById = function (chartId) {
            const chartElement = document.getElementById(chartId);
            if (!chartElement || typeof Chart === 'undefined') {
                return null;
            }

            if (chartId === 'passRateTrendChart') {
                return new Chart(chartElement, {
                    type: 'line',
                    data: {
                        labels: passRateTrendDataset.labels,
                        datasets: [{
                            label: dashboardText.charts.passRateDataset,
                            data: passRateTrendDataset.values,
                            borderColor: '#3fb950',
                            backgroundColor: 'rgba(63, 185, 80, 0.15)',
                            fill: true,
                            tension: 0.2,
                        }],
                    },
                    options: buildLineChartOptions(0, 100),
                });
            }

            if (chartId === 'durationTrendChart') {
                return new Chart(chartElement, {
                    type: 'line',
                    data: {
                        labels: durationTrendDataset.labels,
                        datasets: [{
                            label: dashboardText.charts.durationDataset,
                            data: durationTrendDataset.values,
                            borderColor: '#f0883e',
                            backgroundColor: 'rgba(240, 136, 62, 0.15)',
                            fill: true,
                            tension: 0.2,
                        }],
                    },
                    options: buildLineChartOptions(),
                });
            }

            if (chartId === 'flakyTrendChart') {
                return new Chart(chartElement, {
                    type: 'line',
                    data: {
                        labels: flakyTrendDataset.labels,
                        datasets: [{
                            label: dashboardText.charts.flakyDataset,
                            data: flakyTrendDataset.values,
                            borderColor: '#d29922',
                            backgroundColor: 'rgba(210, 153, 34, 0.15)',
                            fill: true,
                            tension: 0.2,
                        }],
                    },
                    options: buildLineChartOptions(),
                });
            }

            if (chartId === 'statusChart') {
                return new Chart(chartElement, {
                    type: 'doughnut',
                    data: {
                        labels: localizedStatusDataset.labels,
                        datasets: [{
                            data: localizedStatusDataset.values,
                            backgroundColor: ['#3fb950', '#f85149', '#d29922', '#8b949e', '#a371f7', '#2f81f7'],
                            borderColor: '#161b22',
                            borderWidth: 2,
                        }],
                    },
                    options: buildDoughnutChartOptions(),
                });
            }

            if (chartId === 'clusterChart') {
                return new Chart(chartElement, {
                    type: 'doughnut',
                    data: {
                        labels: errorDataset.labels,
                        datasets: [{
                            data: errorDataset.values,
                            backgroundColor: ['#f0883e', '#f85149', '#a371f7', '#2f81f7', '#3fb950', '#8b949e'],
                            borderColor: '#161b22',
                            borderWidth: 2,
                        }],
                    },
                    options: buildDoughnutChartOptions(errorDataset.fullLabels),
                });
            }

            if (chartId === 'phaseBreakdownChart') {
                return new Chart(chartElement, {
                    type: 'doughnut',
                    data: {
                        labels: phaseBreakdownDataset.labels,
                        datasets: [{
                            data: phaseBreakdownDataset.values,
                            backgroundColor: ['#2f81f7', '#3fb950', '#f0883e'],
                            borderColor: '#161b22',
                            borderWidth: 2,
                        }],
                    },
                    options: buildDoughnutChartOptions(phaseBreakdownDataset.fullLabels),
                });
            }

            if (chartId === 'slowestChart') {
                return new Chart(chartElement, {
                    type: 'bar',
                    data: {
                        labels: slowestDataset.labels,
                        datasets: [{
                            label: dashboardText.charts.slowestDataset,
                            data: slowestDataset.values,
                            backgroundColor: '#2f81f7',
                            borderRadius: 6,
                        }],
                    },
                    options: buildBarChartOptions(false, slowestDataset.fullLabels),
                });
            }

            if (chartId === 'suiteDurationChart') {
                return new Chart(chartElement, {
                    type: 'bar',
                    data: {
                        labels: suiteDurationDataset.labels,
                        datasets: [{
                            label: dashboardText.charts.durationDataset,
                            data: suiteDurationDataset.values,
                            backgroundColor: '#58a6ff',
                            borderRadius: 6,
                        }],
                    },
                    options: buildBarChartOptions(true, suiteDurationDataset.fullLabels),
                });
            }

            if (chartId === 'browserDurationChart') {
                return new Chart(chartElement, {
                    type: 'bar',
                    data: {
                        labels: browserDurationDataset.labels,
                        datasets: [{
                            label: dashboardText.charts.durationDataset,
                            data: browserDurationDataset.values,
                            backgroundColor: '#d29922',
                            borderRadius: 6,
                        }],
                    },
                    options: buildBarChartOptions(true, browserDurationDataset.fullLabels),
                });
            }

            return null;
        };

        const ensureChartsForTab = function (tabId) {
            (chartTabs[tabId] || []).forEach(function (chartId) {
                if (chartInstances[chartId]) {
                    chartInstances[chartId].resize();
                    return;
                }

                const instance = createChartById(chartId);
                if (instance) {
                    chartInstances[chartId] = instance;
                }
            });
        };

        const activateTestsStatus = function (statusId) {
            testStatusButtons.forEach(function (button) {
                button.classList.toggle('is-active', button.dataset.testsStatusButton === statusId);
            });

            testStatusPanels.forEach(function (panel) {
                panel.classList.toggle('is-active', panel.dataset.testsStatusPanel === statusId);
            });
        };

        const scrollToTabSection = function (sectionId) {
            if (!sectionId) {
                return;
            }

            const target = Array.from(document.querySelectorAll('[data-tab-section]')).find(function (element) {
                return element.getAttribute('data-tab-section') === sectionId;
            });

            if (target) {
                target.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
        };

        const parseHashRoute = function (hashValue) {
            const normalizedHash = String(hashValue || '').replace('#', '');

            if (!normalizedHash) {
                return { tabId: 'overview', sectionId: '' };
            }

            const parts = normalizedHash.split(':');
            const tabId = parts[0];
            const sectionId = parts[1] || '';

            if (Object.prototype.hasOwnProperty.call(chartTabs, tabId)) {
                return { tabId: tabId, sectionId: sectionId };
            }

            return { tabId: 'overview', sectionId: '' };
        };

        const activateTab = function (tabId, sectionId) {
            tabButtons.forEach(function (button) {
                const isActive = button.dataset.tabButton === tabId;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-selected', String(isActive));
            });

            tabPanels.forEach(function (panel) {
                panel.classList.toggle('is-active', panel.dataset.tabPanel === tabId);
            });

            ensureChartsForTab(tabId);
            const nextHash = '#' + tabId + (sectionId ? ':' + sectionId : '');
            if (window.location.hash !== nextHash) {
                history.replaceState(null, '', nextHash);
            }

            if (sectionId) {
                window.setTimeout(function () {
                    scrollToTabSection(sectionId);
                }, 0);
            }
        };

        tabButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                activateTab(button.dataset.tabButton || 'overview', '');
            });
        });

        testStatusButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                activateTestsStatus(button.dataset.testsStatusButton || 'all');
            });
        });

        statusDrilldownButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                const targetStatus = button.getAttribute('data-open-tests-status') || 'all';
                activateTab('overview', 'current-run-tests');
                activateTestsStatus(targetStatus);
            });
        });

        if (testStatusButtons.length > 0) {
            activateTestsStatus(testStatusButtons[0].getAttribute('data-tests-status-button') || 'all');
        }

        const initialRoute = parseHashRoute(window.location.hash);
        activateTab(initialRoute.tabId, initialRoute.sectionId);

        window.addEventListener('hashchange', function () {
            const route = parseHashRoute(window.location.hash);
            activateTab(route.tabId, route.sectionId);
        });

        const businessCostStorageKey = 'aqa-pulse.cost-assumptions.v1';
        const assumptionInputs = {
            ciMinuteCost: document.querySelector('[data-assumption-input="ciMinuteCost"]'),
            developerHourlyCost: document.querySelector('[data-assumption-input="developerHourlyCost"]'),
            analysisMinutesPerIncident: document.querySelector('[data-assumption-input="analysisMinutesPerIncident"]'),
        };
        const assumptionResetButton = document.querySelector('[data-assumption-reset]');
        const assumptionPresetButtons = Array.from(document.querySelectorAll('[data-assumption-preset]'));
        const businessCostTargets = {
            total: document.querySelector('[data-cost-total]'),
            breakdown: document.querySelector('[data-cost-breakdown]'),
            summary: document.querySelector('[data-cost-assumptions-summary]'),
            totalBreakdown: document.querySelector('[data-cost-total-breakdown]'),
            ci: document.querySelector('[data-cost-ci]'),
            developer: document.querySelector('[data-cost-developer]'),
            perDay: document.querySelector('[data-cost-per-day]'),
            perDayHero: document.querySelector('[data-cost-per-day-hero]'),
            assumptionCi: document.querySelector('[data-assumption-ci-label]'),
            assumptionDev: document.querySelector('[data-assumption-dev-label]'),
            assumptionAnalysis: document.querySelector('[data-assumption-analysis-label]'),
            assumptionStatusPill: document.querySelector('[data-assumptions-status-pill]'),
            assumptionStatusHint: document.querySelector('[data-assumptions-status-hint]'),
            assumptionNote: document.querySelector('[data-assumptions-note]'),
            impactPill: document.querySelector('[data-cost-impact-pill]'),
            costKpiCard: document.querySelector('[data-cost-kpi-card]'),
            driverCard: document.querySelector('[data-cost-driver-card]'),
            driverTitle: document.querySelector('[data-cost-driver-title]'),
            driverBody: document.querySelector('[data-cost-driver-body]'),
            signalCi: document.querySelector('[data-driver-signal="ci"]'),
            signalDevelopment: document.querySelector('[data-driver-signal="development"]'),
            breakdownCiItem: document.querySelector('[data-cost-breakdown-item="ci"]'),
            breakdownDevItem: document.querySelector('[data-cost-breakdown-item="development"]'),
            ciShareLabel: document.querySelector('[data-cost-ci-share-label]'),
            devShareLabel: document.querySelector('[data-cost-dev-share-label]'),
            ciShareBar: document.querySelector('[data-cost-ci-share-bar]'),
            devShareBar: document.querySelector('[data-cost-dev-share-bar]'),
        };

        if (
            assumptionInputs.ciMinuteCost instanceof HTMLInputElement
            && assumptionInputs.developerHourlyCost instanceof HTMLInputElement
            && assumptionInputs.analysisMinutesPerIncident instanceof HTMLInputElement
        ) {
            const assumptionPresets = {
                conservative: { ciMinuteCost: 3, developerHourlyCost: 2500, analysisMinutesPerIncident: 15 },
                realistic: { ciMinuteCost: 5, developerHourlyCost: 3000, analysisMinutesPerIncident: 20 },
                enterprise: { ciMinuteCost: 10, developerHourlyCost: 5000, analysisMinutesPerIncident: 30 },
            };
            const defaultAssumptions = {
                ciMinuteCost: normalizeOptionalNumber(businessCostConfig.assumptions && businessCostConfig.assumptions.ciMinuteCostRub),
                developerHourlyCost: normalizeOptionalNumber(businessCostConfig.assumptions && businessCostConfig.assumptions.developerHourlyCostRub),
                analysisMinutesPerIncident: normalizeOptionalNumber(businessCostConfig.assumptions && businessCostConfig.assumptions.analysisMinutesPerUnstable),
            };

            const storedAssumptions = readStoredBusinessAssumptions();
            const initialAssumptions = storedAssumptions || defaultAssumptions;

            setAssumptionInputs(initialAssumptions);
            renderBusinessCostMetrics(initialAssumptions);

            Object.values(assumptionInputs).forEach(function (input) {
                input.addEventListener('input', function () {
                    const assumptions = readAssumptionsFromInputs();
                    saveStoredBusinessAssumptions(assumptions);
                    renderBusinessCostMetrics(assumptions);
                });
            });

            assumptionPresetButtons.forEach(function (button) {
                button.addEventListener('click', function () {
                    const presetName = button.getAttribute('data-assumption-preset');
                    const presetValues = presetName ? assumptionPresets[presetName] : null;

                    if (!presetValues) {
                        return;
                    }

                    setAssumptionInputs(presetValues);
                    saveStoredBusinessAssumptions(presetValues);
                    renderBusinessCostMetrics(presetValues);
                });
            });

            if (assumptionResetButton) {
                assumptionResetButton.addEventListener('click', function () {
                    clearStoredBusinessAssumptions();
                    setAssumptionInputs(defaultAssumptions);
                    renderBusinessCostMetrics(defaultAssumptions);
                });
            }
        }

        function buildLineChartOptions(min, max) {
            return {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: '#c9d1d9' },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: '#8b949e' },
                        grid: { color: '#21262d' },
                    },
                    y: {
                        ...(typeof min === 'number' ? { min: min } : {}),
                        ...(typeof max === 'number' ? { max: max } : {}),
                        ticks: { color: '#8b949e' },
                        grid: { color: '#21262d' },
                    },
                },
            };
        }

        function buildBarChartOptions(horizontal, fullLabels) {
            return {
                responsive: true,
                indexAxis: horizontal ? 'y' : 'x',
                plugins: {
                    legend: {
                        labels: { color: '#c9d1d9' },
                    },
                    tooltip: {
                        callbacks: {
                            title: function (items) {
                                const item = items && items[0];
                                if (!item) {
                                    return '';
                                }

                                const dataIndex = typeof item.dataIndex === 'number' ? item.dataIndex : -1;
                                return Array.isArray(fullLabels) && dataIndex >= 0 && fullLabels[dataIndex]
                                    ? fullLabels[dataIndex]
                                    : item.label;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: '#8b949e' },
                        grid: { color: '#21262d' },
                    },
                    y: {
                        ticks: { color: '#8b949e' },
                        grid: { color: '#21262d' },
                    },
                },
            };
        }

        function buildDoughnutChartOptions(fullLabels) {
            return {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#c9d1d9' },
                    },
                    tooltip: {
                        callbacks: {
                            title: function (items) {
                                const item = items && items[0];
                                if (!item) {
                                    return '';
                                }

                                const dataIndex = typeof item.dataIndex === 'number' ? item.dataIndex : -1;
                                return Array.isArray(fullLabels) && dataIndex >= 0 && fullLabels[dataIndex]
                                    ? fullLabels[dataIndex]
                                    : item.label;
                            },
                        },
                    },
                },
            };
        }

        function localizeStatusLabel(label) {
            return dashboardText.statusLabels[label] || label;
        }

        function normalizeOptionalNumber(value) {
            return typeof value === 'number' && Number.isFinite(value) ? value : null;
        }

        function parseOptionalInputNumber(value) {
            if (typeof value !== 'string') {
                return null;
            }

            const normalized = value.replace(',', '.').trim();
            if (!normalized) {
                return null;
            }

            const parsed = Number(normalized);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        }

        function roundToTwoDigits(value) {
            return Math.round(value * 100) / 100;
        }

        function formatCurrencyValue(value) {
            return value === null ? '—' : value.toFixed(2) + ' ₽';
        }

        function formatAssumptionDisplay(value, unit) {
            return value === null ? dashboardText.states.notSet : value + ' ' + unit;
        }

        function formatAssumptionsSummary(assumptions) {
            if (assumptions.ciMinuteCost === null && assumptions.developerHourlyCost === null) {
                return dashboardText.business.assumptionsEmpty;
            }

            return dashboardText.business.ciMinuteCost + ' ' + (assumptions.ciMinuteCost === null ? 0 : assumptions.ciMinuteCost)
                + ' ₽/мин • ' + dashboardText.business.devHourCost + ' ' + (assumptions.developerHourlyCost === null ? 0 : assumptions.developerHourlyCost)
                + ' ₽/час • ' + dashboardText.business.analysisMinutes + ' ' + (assumptions.analysisMinutesPerIncident === null ? 0 : assumptions.analysisMinutesPerIncident)
                + ' мин/инцидент';
        }

        function getAssumptionsState(assumptions) {
            const isCiConfigured = assumptions.ciMinuteCost !== null;
            const isDeveloperConfigured = assumptions.developerHourlyCost !== null && assumptions.analysisMinutesPerIncident !== null;
            const hasAnyValue = isCiConfigured || assumptions.developerHourlyCost !== null || assumptions.analysisMinutesPerIncident !== null;

            if (isCiConfigured && isDeveloperConfigured) {
                return 'ready';
            }

            if (hasAnyValue) {
                return 'partial';
            }

            return 'empty';
        }

        function getAssumptionsStatusLabel(assumptions) {
            const state = getAssumptionsState(assumptions);

            if (state === 'ready') {
                return dashboardText.business.scenarioStatusReady;
            }

            if (state === 'partial') {
                return dashboardText.business.scenarioStatusPartial;
            }

            return dashboardText.business.scenarioStatusEmpty;
        }

        function getAssumptionsStatusHint(assumptions) {
            const state = getAssumptionsState(assumptions);

            if (state === 'ready') {
                return dashboardText.business.scenarioStatusReadyHint;
            }

            if (state === 'partial') {
                return dashboardText.business.scenarioStatusPartialHint;
            }

            return dashboardText.business.scenarioStatusEmptyHint;
        }

        function getAssumptionsStatusClassName(assumptions) {
            const state = getAssumptionsState(assumptions);
            return 'scenario-status-pill scenario-status-' + state;
        }

        function formatShareValue(value, total) {
            if (value === null || total === null || total <= 0) {
                return '—';
            }

            return roundToTwoDigits((value / total) * 100) + '%';
        }

        function formatShareWidthValue(value, total) {
            if (value === null || total === null || total <= 0) {
                return '0%';
            }

            return Math.max(0, Math.min(100, roundToTwoDigits((value / total) * 100))) + '%';
        }

        function getImpactLevel(totalCost, costPerDay) {
            if (totalCost === null) {
                return 'unknown';
            }

            if (totalCost >= 50000 || (costPerDay !== null && costPerDay >= 10000)) {
                return 'high';
            }

            if (totalCost >= 15000 || (costPerDay !== null && costPerDay >= 3000)) {
                return 'medium';
            }

            return 'low';
        }

        function getImpactLabel(totalCost, costPerDay) {
            const level = getImpactLevel(totalCost, costPerDay);

            if (level === 'high') {
                return dashboardText.business.impactHigh;
            }

            if (level === 'medium') {
                return dashboardText.business.impactMedium;
            }

            if (level === 'low') {
                return dashboardText.business.impactLow;
            }

            return dashboardText.business.impactUnknown;
        }

        function getImpactClassName(totalCost, costPerDay) {
            return 'impact-pill impact-' + getImpactLevel(totalCost, costPerDay);
        }

        function getDriverType(ciCost, developerCost, totalCost) {
            if (totalCost === null || totalCost <= 0) {
                return 'missing';
            }

            const normalizedCiCost = ciCost || 0;
            const normalizedDeveloperCost = developerCost || 0;
            const delta = Math.abs(normalizedCiCost - normalizedDeveloperCost);

            if (delta <= totalCost * 0.15) {
                return 'balanced';
            }

            return normalizedCiCost > normalizedDeveloperCost ? 'ci' : 'development';
        }

        function getDriverInsightTitle(ciCost, developerCost, totalCost) {
            const driverType = getDriverType(ciCost, developerCost, totalCost);

            if (driverType === 'ci') {
                return dashboardText.business.topDriverCiTitle;
            }

            if (driverType === 'development') {
                return dashboardText.business.topDriverDevelopmentTitle;
            }

            if (driverType === 'balanced') {
                return dashboardText.business.topDriverBalancedTitle;
            }

            return dashboardText.business.topDriverMissingTitle;
        }

        function getDriverInsightBody(ciCost, developerCost, totalCost) {
            const driverType = getDriverType(ciCost, developerCost, totalCost);

            if (driverType === 'ci') {
                return dashboardText.business.topDriverCiBody;
            }

            if (driverType === 'development') {
                return dashboardText.business.topDriverDevelopmentBody;
            }

            if (driverType === 'balanced') {
                return dashboardText.business.topDriverBalancedBody;
            }

            return dashboardText.business.topDriverMissingBody;
        }

        function updatePresetButtonsState(assumptions) {
            const presets = {
                conservative: { ciMinuteCost: 3, developerHourlyCost: 2500, analysisMinutesPerIncident: 15 },
                realistic: { ciMinuteCost: 5, developerHourlyCost: 3000, analysisMinutesPerIncident: 20 },
                enterprise: { ciMinuteCost: 10, developerHourlyCost: 5000, analysisMinutesPerIncident: 30 },
            };

            assumptionPresetButtons.forEach(function (button) {
                const presetName = button.getAttribute('data-assumption-preset');
                const presetValues = presetName ? presets[presetName] : null;
                const isActive = Boolean(presetValues)
                    && assumptions.ciMinuteCost === presetValues.ciMinuteCost
                    && assumptions.developerHourlyCost === presetValues.developerHourlyCost
                    && assumptions.analysisMinutesPerIncident === presetValues.analysisMinutesPerIncident;

                button.classList.toggle('is-active', isActive);
            });
        }

        function setAssumptionInputs(assumptions) {
            assumptionInputs.ciMinuteCost.value = assumptions.ciMinuteCost === null ? '' : String(assumptions.ciMinuteCost);
            assumptionInputs.developerHourlyCost.value = assumptions.developerHourlyCost === null ? '' : String(assumptions.developerHourlyCost);
            assumptionInputs.analysisMinutesPerIncident.value = assumptions.analysisMinutesPerIncident === null ? '' : String(assumptions.analysisMinutesPerIncident);
        }

        function readAssumptionsFromInputs() {
            return {
                ciMinuteCost: parseOptionalInputNumber(assumptionInputs.ciMinuteCost.value),
                developerHourlyCost: parseOptionalInputNumber(assumptionInputs.developerHourlyCost.value),
                analysisMinutesPerIncident: parseOptionalInputNumber(assumptionInputs.analysisMinutesPerIncident.value),
            };
        }

        function renderBusinessCostMetrics(assumptions) {
            const extraRetryMinutes = normalizeOptionalNumber(businessCostConfig.baseMetrics && businessCostConfig.baseMetrics.extraRetryMinutes) || 0;
            const unstableRuns = normalizeOptionalNumber(businessCostConfig.baseMetrics && businessCostConfig.baseMetrics.unstableRuns) || 0;
            const activeDays = normalizeOptionalNumber(businessCostConfig.baseMetrics && businessCostConfig.baseMetrics.activeDays) || 0;
            const ciCost = assumptions.ciMinuteCost === null ? null : roundToTwoDigits(extraRetryMinutes * assumptions.ciMinuteCost);
            const developerCost = assumptions.developerHourlyCost === null || assumptions.analysisMinutesPerIncident === null
                ? null
                : roundToTwoDigits(unstableRuns * (assumptions.analysisMinutesPerIncident / 60) * assumptions.developerHourlyCost);
            const totalCost = ciCost === null && developerCost === null
                ? null
                : roundToTwoDigits((ciCost || 0) + (developerCost || 0));
            const costPerDay = totalCost === null || activeDays === 0 ? null : roundToTwoDigits(totalCost / activeDays);
            const impactLevel = getImpactLevel(totalCost, costPerDay);
            const driverType = getDriverType(ciCost, developerCost, totalCost);

            if (businessCostTargets.total) {
                businessCostTargets.total.textContent = formatCurrencyValue(totalCost);
            }
            if (businessCostTargets.breakdown) {
                businessCostTargets.breakdown.textContent = dashboardText.business.ciBreakdown + ': ' + formatCurrencyValue(ciCost) + ' • ' + dashboardText.business.developerBreakdown + ': ' + formatCurrencyValue(developerCost);
            }
            if (businessCostTargets.summary) {
                businessCostTargets.summary.textContent = formatAssumptionsSummary(assumptions);
            }
            if (businessCostTargets.totalBreakdown) {
                businessCostTargets.totalBreakdown.textContent = formatCurrencyValue(totalCost);
            }
            if (businessCostTargets.ci) {
                businessCostTargets.ci.textContent = formatCurrencyValue(ciCost);
            }
            if (businessCostTargets.developer) {
                businessCostTargets.developer.textContent = formatCurrencyValue(developerCost);
            }
            if (businessCostTargets.perDay) {
                businessCostTargets.perDay.textContent = formatCurrencyValue(costPerDay);
            }
            if (businessCostTargets.perDayHero) {
                businessCostTargets.perDayHero.textContent = formatCurrencyValue(costPerDay);
            }
            if (businessCostTargets.assumptionCi) {
                businessCostTargets.assumptionCi.textContent = formatAssumptionDisplay(assumptions.ciMinuteCost, '₽/мин');
            }
            if (businessCostTargets.assumptionDev) {
                businessCostTargets.assumptionDev.textContent = formatAssumptionDisplay(assumptions.developerHourlyCost, '₽/час');
            }
            if (businessCostTargets.assumptionAnalysis) {
                businessCostTargets.assumptionAnalysis.textContent = formatAssumptionDisplay(assumptions.analysisMinutesPerIncident, 'мин/инцидент');
            }
            if (businessCostTargets.assumptionStatusPill) {
                businessCostTargets.assumptionStatusPill.textContent = getAssumptionsStatusLabel(assumptions);
                businessCostTargets.assumptionStatusPill.className = getAssumptionsStatusClassName(assumptions);
            }
            if (businessCostTargets.assumptionStatusHint) {
                businessCostTargets.assumptionStatusHint.textContent = getAssumptionsStatusHint(assumptions);
            }
            if (businessCostTargets.assumptionNote) {
                businessCostTargets.assumptionNote.textContent = formatAssumptionsSummary(assumptions);
            }
            if (businessCostTargets.impactPill) {
                businessCostTargets.impactPill.textContent = getImpactLabel(totalCost, costPerDay);
                businessCostTargets.impactPill.className = getImpactClassName(totalCost, costPerDay);
            }
            if (businessCostTargets.costKpiCard) {
                businessCostTargets.costKpiCard.className = 'kpi-card cost-kpi-card impact-' + impactLevel;
            }
            if (businessCostTargets.driverCard) {
                businessCostTargets.driverCard.className = 'business-insight-card impact-' + impactLevel;
            }
            if (businessCostTargets.driverTitle) {
                businessCostTargets.driverTitle.textContent = getDriverInsightTitle(ciCost, developerCost, totalCost);
            }
            if (businessCostTargets.driverBody) {
                businessCostTargets.driverBody.textContent = getDriverInsightBody(ciCost, developerCost, totalCost);
            }
            if (businessCostTargets.ciShareLabel) {
                businessCostTargets.ciShareLabel.textContent = formatShareValue(ciCost, totalCost);
            }
            if (businessCostTargets.devShareLabel) {
                businessCostTargets.devShareLabel.textContent = formatShareValue(developerCost, totalCost);
            }
            if (businessCostTargets.ciShareBar) {
                businessCostTargets.ciShareBar.style.width = formatShareWidthValue(ciCost, totalCost);
            }
            if (businessCostTargets.devShareBar) {
                businessCostTargets.devShareBar.style.width = formatShareWidthValue(developerCost, totalCost);
            }
            if (businessCostTargets.breakdownCiItem) {
                businessCostTargets.breakdownCiItem.classList.toggle('is-dominant', driverType === 'ci');
            }
            if (businessCostTargets.breakdownDevItem) {
                businessCostTargets.breakdownDevItem.classList.toggle('is-dominant', driverType === 'development');
            }
            if (businessCostTargets.signalCi) {
                businessCostTargets.signalCi.classList.toggle('is-dominant', driverType === 'ci');
            }
            if (businessCostTargets.signalDevelopment) {
                businessCostTargets.signalDevelopment.classList.toggle('is-dominant', driverType === 'development');
            }

            updatePresetButtonsState(assumptions);
        }

        function readStoredBusinessAssumptions() {
            try {
                const rawValue = window.localStorage.getItem(businessCostStorageKey);
                if (!rawValue) {
                    return null;
                }

                const parsed = JSON.parse(rawValue);
                return {
                    ciMinuteCost: normalizeOptionalNumber(parsed && parsed.ciMinuteCost),
                    developerHourlyCost: normalizeOptionalNumber(parsed && parsed.developerHourlyCost),
                    analysisMinutesPerIncident: normalizeOptionalNumber(parsed && parsed.analysisMinutesPerIncident),
                };
            } catch (_error) {
                return null;
            }
        }

        function saveStoredBusinessAssumptions(assumptions) {
            try {
                window.localStorage.setItem(businessCostStorageKey, JSON.stringify(assumptions));
            } catch (_error) {
                // localStorage недоступен, silently ignore
            }
        }

        function clearStoredBusinessAssumptions() {
            try {
                window.localStorage.removeItem(businessCostStorageKey);
            } catch (_error) {
                // localStorage недоступен, silently ignore
            }
        }
    </script>
</body>
</html>`
}

function renderProblematicTestRow(test: DashboardProblematicTest, filters: DashboardSummary['filters'], testDetailsBasePath: string): string {
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

function renderFlakyTestRow(test: DashboardFlakyTestMetric, filters: DashboardSummary['filters'], testDetailsBasePath: string): string {
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

function renderSlowTestRow(test: DashboardSlowTest, filters: DashboardSummary['filters'], testDetailsBasePath: string): string {
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

function renderDurationBreakdownRow(item: DashboardDurationBreakdownItem): string {
    return `
        <tr>
            <td>${renderOverflowText(item.label, { className: 'table-cell-text-wide' })}</td>
            <td>${escapeHtml(formatDuration(item.durationMs))}</td>
            <td>${escapeHtml(formatPercent(item.sharePercent))}</td>
            <td>${item.tests}</td>
        </tr>
    `
}

function renderCurrentRunTestsBrowser(summary: DashboardSummary, testDetailsBasePath: string): string {
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

function renderStatusDrilldown(summary: DashboardSummary): string {
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

function renderCurrentRunTestRow(
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

function renderHistoryRow(run: DashboardSummary['history']['recentRuns'][number]): string {
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

function renderTabButton(id: string, label: string, isActive = false): string {
    return `<button class="tab-button${isActive ? ' is-active' : ''}" type="button" role="tab" aria-selected="${isActive ? 'true' : 'false'}" data-tab-button="${escapeHtml(id)}">${escapeHtml(label)}</button>`
}

function renderPlaceholderPanel(title: string, description: string, metrics: readonly string[]): string {
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

function renderPhaseLegend(items: DashboardPhaseBreakdownItem[]): string {
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

function renderOverflowText(
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

function toPerformanceChartDataset<T extends DashboardPhaseBreakdownItem | DashboardDurationBreakdownItem>(
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

function getLeadingPhase(items: DashboardPhaseBreakdownItem[]): DashboardPhaseBreakdownItem | null {
    if (items.length === 0) {
        return null
    }

    return [...items].sort((left, right) => right.durationMs - left.durationMs)[0] ?? null
}

function formatPerformancePhaseLabel(label: string): string {
    if (label === 'Setup') {
        return 'Подготовка'
    }

    if (label === 'Teardown') {
        return 'Завершение'
    }

    return 'Тесты'
}

function shortenChartLabel(label: string, maxLength: number): string {
    if (label.length <= maxLength) {
        return label
    }

    return `${label.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`
}

function roundChartValue(value: number): number {
    return Math.round(value * 10) / 10
}

function getStatusClass(status: string, flaky: boolean): string {
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

function formatStatusLabel(status: string, flaky: boolean): string {
    if (flaky) {
        return DASHBOARD_TEXT.statusLabels.flaky
    }

    const normalizedStatus = status.toLowerCase()
    return DASHBOARD_TEXT.statusLabels[normalizedStatus as keyof typeof DASHBOARD_TEXT.statusLabels] ?? status
}

function formatPassRateDelta(delta: number | null): string {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRun
    }

    if (delta === 0) {
        return DASHBOARD_TEXT.states.noChanges
    }

    const sign = delta > 0 ? '+' : ''
    return `${sign}${delta.toFixed(1)} п.п. к прошлому прогону`
}

function formatCountDelta(label: string, delta: number | null): string {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRun
    }

    if (delta === 0) {
        return `Без изменений ${label}`
    }

    const sign = delta > 0 ? '+' : ''
    return `${sign}${delta} ${label}`
}

function formatDurationDelta(delta: number | null): string {
    if (delta === null) {
        return DASHBOARD_TEXT.states.noPreviousRun
    }

    if (delta === 0) {
        return DASHBOARD_TEXT.states.noChanges
    }

    const sign = delta > 0 ? '+' : '-'
    return `${sign}${formatDuration(Math.abs(delta))} к прошлому прогону`
}

function formatMetricDelta(delta: number | null, type: 'pp' | 'count' | 'duration', inverted: boolean): string {
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

function getTrendArrow(delta: number | null, inverted: boolean): string {
    if (delta === null || delta === 0) {
        return '→'
    }

    if (inverted) {
        return delta < 0 ? '↑' : '↓'
    }

    return delta > 0 ? '↑' : '↓'
}

function formatCommit(commit: string | null): string {
    if (!commit) {
        return '—'
    }

    return commit.slice(0, 8)
}

function formatRunLabel(run: DashboardSummary['comparison']['currentRun']): string {
    if (!run) {
        return '—'
    }

    const dateLabel = formatDate(run.reportTimestamp ?? run.generatedAt)
    const branchLabel = run.branch ? ` • ${run.branch}` : ''
    const commitLabel = run.commit ? ` • ${formatCommit(run.commit)}` : ''

    return `${dateLabel}${branchLabel}${commitLabel}`
}

function formatCurrency(value: number | null): string {
    if (value === null) {
        return '—'
    }

    return `${value.toFixed(2)} ₽`
}

function formatMinutes(value: number): string {
    return `${value.toFixed(2)} мин`
}

function formatNullableMinutes(value: number | null): string {
    return value === null ? '—' : formatMinutes(value)
}

function formatDailyRatio(value: number): string {
    return `${value.toFixed(2)} / день`
}

function formatScore(value: number): string {
    return `${value.toFixed(1)} / 100`
}

function formatNullableDays(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(2)} дн`
}

function formatNullablePercent(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)}%`
}

function formatCostAssumptions(summary: DashboardSummary): string {
    const assumptions = summary.businessMetrics.costOfFlakiness.assumptions

    if (assumptions.ciMinuteCostRub === null && assumptions.developerHourlyCostRub === null) {
        return DASHBOARD_TEXT.business.assumptionsEmpty
    }

    return `${DASHBOARD_TEXT.business.ciMinuteCost} ${assumptions.ciMinuteCostRub ?? 0} ₽/мин • ${DASHBOARD_TEXT.business.devHourCost} ${assumptions.developerHourlyCostRub ?? 0} ₽/час • ${DASHBOARD_TEXT.business.analysisMinutes} ${assumptions.analysisMinutesPerUnstable ?? 0} мин/инцидент`
}

function formatAssumptionValue(value: number | null, unit: string): string {
    if (value === null) {
        return DASHBOARD_TEXT.states.notSet
    }

    return `${value} ${unit}`
}

function renderManagerOverview(summary: DashboardSummary, dashboardActionPath: string): string {
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

function renderManagerSignalCard(label: string, signal: DashboardSummary['managerSummary']['releaseReadiness'], levelLabel: string, hint: string): string {
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

function renderManagerBlocker(
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

function renderManagerChange(change: DashboardSummary['managerSummary']['changes'][number]): string {
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

function getManagerSignalClass(level: DashboardSummary['managerSummary']['releaseReadiness']['level']): string {
    return `manager-status-${level}`
}

function getManagerBlockerHref(
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

function getManagerReadinessLabel(level: DashboardSummary['managerSummary']['releaseReadiness']['level']): string {
    if (level === 'healthy') {
        return DASHBOARD_TEXT.manager.readinessHealthy
    }

    if (level === 'warning') {
        return DASHBOARD_TEXT.manager.readinessWarning
    }

    return DASHBOARD_TEXT.manager.readinessCritical
}

function getManagerRiskLabel(level: DashboardSummary['managerSummary']['qualityRisk']['level']): string {
    if (level === 'healthy') {
        return DASHBOARD_TEXT.manager.riskHealthy
    }

    if (level === 'warning') {
        return DASHBOARD_TEXT.manager.riskWarning
    }

    return DASHBOARD_TEXT.manager.riskCritical
}

function getManagerChangeClass(direction: DashboardSummary['managerSummary']['changes'][number]['direction']): 'improving' | 'regressing' | 'stable' {
    return direction
}

function getManagerChangeLabel(direction: DashboardSummary['managerSummary']['changes'][number]['direction']): string {
    if (direction === 'improving') {
        return 'Улучшается'
    }

    if (direction === 'regressing') {
        return 'Деградирует'
    }

    return 'Без сдвига'
}

function renderFlakyHistoryInsight(summary: DashboardSummary): string {
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

function getFlakyTopTestsEmptyState(summary: DashboardSummary): string {
    if (summary.kpis.flakyTests > 0) {
        return DASHBOARD_TEXT.states.flakyTestsHistoryMissing
    }

    return DASHBOARD_TEXT.states.flakyTestsEmpty
}

function renderReleaseConfidenceBreakdown(summary: DashboardSummary): string {
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

function renderBusinessMetricReadiness(summary: DashboardSummary): string {
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

function buildReleaseConfidenceBreakdown(summary: DashboardSummary): {
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

function buildBusinessMetricReadiness(summary: DashboardSummary): Array<{
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

function getBusinessReadinessStatusLabel(status: 'ready' | 'partial' | 'pending'): string {
    if (status === 'ready') {
        return DASHBOARD_TEXT.business.readinessReady
    }

    if (status === 'partial') {
        return DASHBOARD_TEXT.business.readinessPartial
    }

    return DASHBOARD_TEXT.business.readinessPending
}

function getDashboardScoreTone(value: number): string {
    if (value >= 80) {
        return ''
    }

    if (value >= 60) {
        return 'warning'
    }

    return 'danger'
}

function clampDashboardScore(value: number): number {
    return Math.min(Math.max(value, 0), 100)
}

function averageDashboardNumber(values: number[]): number {
    if (values.length === 0) {
        return 0
    }

    return values.reduce((total, value) => total + value, 0) / values.length
}

function roundToOneDigit(value: number): number {
    return Math.round(value * 10) / 10
}

function getBusinessAssumptionsState(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): 'ready' | 'partial' | 'empty' {
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

function getBusinessScenarioStatusClass(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    return `scenario-status-${getBusinessAssumptionsState(assumptions)}`
}

function getBusinessScenarioStatusLabel(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    const state = getBusinessAssumptionsState(assumptions)

    if (state === 'ready') {
        return DASHBOARD_TEXT.business.scenarioStatusReady
    }

    if (state === 'partial') {
        return DASHBOARD_TEXT.business.scenarioStatusPartial
    }

    return DASHBOARD_TEXT.business.scenarioStatusEmpty
}

function getBusinessScenarioStatusHint(assumptions: DashboardSummary['businessMetrics']['costOfFlakiness']['assumptions']): string {
    const state = getBusinessAssumptionsState(assumptions)

    if (state === 'ready') {
        return DASHBOARD_TEXT.business.scenarioStatusReadyHint
    }

    if (state === 'partial') {
        return DASHBOARD_TEXT.business.scenarioStatusPartialHint
    }

    return DASHBOARD_TEXT.business.scenarioStatusEmptyHint
}

function getBusinessImpactLevel(totalCost: number | null, costPerDay: number | null): 'high' | 'medium' | 'low' | 'unknown' {
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

function getBusinessImpactClass(totalCost: number | null, costPerDay: number | null): string {
    return `impact-${getBusinessImpactLevel(totalCost, costPerDay)}`
}

function getBusinessImpactLabel(totalCost: number | null, costPerDay: number | null): string {
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

function getBusinessDriverType(ciCost: number | null, developerCost: number | null, totalCost: number | null): 'ci' | 'development' | 'balanced' | 'missing' {
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

function getBusinessBreakdownItemClass(ciCost: number | null, developerCost: number | null, totalCost: number | null, target: 'ci' | 'development'): string {
    return getBusinessDriverType(ciCost, developerCost, totalCost) === target ? 'is-dominant' : ''
}

function getBusinessDriverSignalClass(ciCost: number | null, developerCost: number | null, totalCost: number | null, target: 'ci' | 'development'): string {
    return getBusinessDriverType(ciCost, developerCost, totalCost) === target ? 'is-dominant' : ''
}

function getBusinessDriverInsightTitle(ciCost: number | null, developerCost: number | null, totalCost: number | null): string {
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

function getBusinessDriverInsightBody(ciCost: number | null, developerCost: number | null, totalCost: number | null): string {
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

function formatCostShare(value: number | null, total: number | null): string {
    if (value === null || total === null || total <= 0) {
        return '—'
    }

    return `${((value / total) * 100).toFixed(1)}%`
}

function formatCostShareWidth(value: number | null, total: number | null): string {
    if (value === null || total === null || total <= 0) {
        return '0%'
    }

    return `${Math.max(0, Math.min(100, (value / total) * 100)).toFixed(1)}%`
}

function getTrendClass(delta: number | null, inverted: boolean): string {
    if (delta === null || delta === 0) {
        return 'trend-neutral'
    }

    if (inverted) {
        return delta < 0 ? 'trend-up' : 'trend-down'
    }

    return delta > 0 ? 'trend-up' : 'trend-down'
}

function renderFilterSelect(name: 'branch' | 'project' | 'file', label: string, options: string[], selectedValue: string | null): string {
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

function buildTestHistoryHref(
    title: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    testDetailsBasePath: string,
): string {
    const query = buildQueryString(filters)
    const basePath = `${testDetailsBasePath}/${encodeURIComponent(title)}`
    return query ? `${basePath}?${query}` : basePath
}

function normalizeDashboardBasePath(basePath: string | undefined): string {
    if (typeof basePath !== 'string') {
        return ''
    }

    const trimmedValue = basePath.trim()

    if (!trimmedValue || trimmedValue === '/') {
        return ''
    }

    return trimmedValue.endsWith('/') ? trimmedValue.slice(0, -1) : trimmedValue
}

function buildDashboardTabHref(
    dashboardActionPath: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    tabId: string,
    sectionId?: string,
): string {
    const query = buildQueryString(filters)
    const hash = sectionId ? `#${tabId}:${sectionId}` : `#${tabId}`
    return query ? `${dashboardActionPath}?${query}${hash}` : `${dashboardActionPath}${hash}`
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

function serializeForInlineScript(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}

function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}
