"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.formatMinutes = formatMinutes;
exports.formatNullableMinutes = formatNullableMinutes;
exports.formatDailyRatio = formatDailyRatio;
exports.formatScore = formatScore;
exports.formatNullableDays = formatNullableDays;
exports.formatNullablePercent = formatNullablePercent;
exports.formatAssumptionValue = formatAssumptionValue;
exports.formatCommit = formatCommit;
exports.formatStatusLabel = formatStatusLabel;
exports.getStatusTone = getStatusTone;
exports.getScoreTone = getScoreTone;
exports.formatDelta = formatDelta;
exports.formatPerformancePhaseLabel = formatPerformancePhaseLabel;
exports.getManagerReadinessLabel = getManagerReadinessLabel;
exports.getManagerRiskLabel = getManagerRiskLabel;
exports.getManagerChangeLabel = getManagerChangeLabel;
exports.buildFlakyHistoryInsight = buildFlakyHistoryInsight;
exports.getFlakyTopTestsEmptyState = getFlakyTopTestsEmptyState;
exports.buildReleaseConfidenceBreakdown = buildReleaseConfidenceBreakdown;
exports.buildBusinessMetricReadiness = buildBusinessMetricReadiness;
exports.averageDashboardNumber = averageDashboardNumber;
exports.getBusinessReadinessStatusLabel = getBusinessReadinessStatusLabel;
exports.getBusinessAssumptionsState = getBusinessAssumptionsState;
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
exports.getDashboardScoreTone = getDashboardScoreTone;
exports.clampDashboardScore = clampDashboardScore;
exports.roundToOneDigit = roundToOneDigit;
exports.roundOne = roundOne;
const ru_1 = require("./i18n/ru");
const DASHBOARD_TEXT = ru_1.ru.dashboard;
function formatCurrency(value) {
    if (value === null) {
        return '—';
    }
    return `${value.toFixed(2)} ₽`;
}
function formatMinutes(value) {
    return `${value.toFixed(2)} мин`;
}
function formatNullableMinutes(value) {
    return value === null ? '—' : formatMinutes(value);
}
function formatDailyRatio(value) {
    return `${value.toFixed(2)} / день`;
}
function formatScore(value) {
    return `${roundOne(value)} / 100`;
}
function formatNullableDays(value) {
    return value === null ? '—' : `${value.toFixed(2)} дн`;
}
function formatNullablePercent(value) {
    return value === null ? '—' : `${value.toFixed(1)}%`;
}
function formatAssumptionValue(value, unit) {
    if (value === null) {
        return DASHBOARD_TEXT.states.notSet;
    }
    return `${value} ${unit}`;
}
function formatCommit(commit) {
    return commit ? commit.slice(0, 8) : '—';
}
function formatStatusLabel(status, flaky) {
    if (flaky) {
        return DASHBOARD_TEXT.statusLabels.flaky;
    }
    return DASHBOARD_TEXT.statusLabels[status] ?? status;
}
function getStatusTone(status, flaky) {
    if (flaky) {
        return 'warn';
    }
    const normalized = status.trim().toLowerCase();
    if (normalized === 'passed') {
        return 'good';
    }
    if (normalized === 'failed' || normalized === 'timedout' || normalized === 'timed out' || normalized === 'interrupted') {
        return 'danger';
    }
    return 'neutral';
}
function getScoreTone(value) {
    if (value >= 80) {
        return 'good';
    }
    if (value >= 60) {
        return 'warn';
    }
    return 'danger';
}
function formatDelta(value, label) {
    if (value === null) {
        return DASHBOARD_TEXT.states.noPreviousRun;
    }
    if (value === 0) {
        return DASHBOARD_TEXT.states.noChanges;
    }
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value} ${label}`;
}
function formatPerformancePhaseLabel(label) {
    if (label === 'Setup') {
        return 'Подготовка';
    }
    if (label === 'Teardown') {
        return 'Завершение';
    }
    return 'Тесты';
}
function getManagerReadinessLabel(level) {
    if (level === 'healthy') {
        return DASHBOARD_TEXT.manager.readinessHealthy;
    }
    if (level === 'warning') {
        return DASHBOARD_TEXT.manager.readinessWarning;
    }
    return DASHBOARD_TEXT.manager.readinessCritical;
}
function getManagerRiskLabel(level) {
    if (level === 'healthy') {
        return DASHBOARD_TEXT.manager.riskHealthy;
    }
    if (level === 'warning') {
        return DASHBOARD_TEXT.manager.riskWarning;
    }
    return DASHBOARD_TEXT.manager.riskCritical;
}
function getManagerChangeLabel(direction) {
    if (direction === 'improving') {
        return 'Улучшается';
    }
    if (direction === 'regressing') {
        return 'Деградирует';
    }
    return 'Без сдвига';
}
function buildFlakyHistoryInsight(summary) {
    const hasHistoricalRanking = summary.flakyAnalytics.topFlakyTests.length > 0;
    const currentRunLine = DASHBOARD_TEXT.flakyInsights.currentRunLine.replace('{count}', String(summary.kpis.flakyTests));
    const finalLine = hasHistoricalRanking
        ? DASHBOARD_TEXT.flakyInsights.historyReady
        : summary.kpis.flakyTests > 0
            ? DASHBOARD_TEXT.flakyInsights.historyMissing
            : DASHBOARD_TEXT.flakyInsights.historyLine;
    return {
        tone: hasHistoricalRanking ? 'info' : summary.kpis.flakyTests > 0 ? 'warn' : 'default',
        title: DASHBOARD_TEXT.flakyInsights.title,
        body: `${currentRunLine} ${DASHBOARD_TEXT.flakyInsights.historyLine} ${finalLine}`,
    };
}
function getFlakyTopTestsEmptyState(summary) {
    if (summary.kpis.flakyTests > 0) {
        return DASHBOARD_TEXT.states.flakyTestsHistoryMissing;
    }
    return DASHBOARD_TEXT.states.flakyTestsEmpty;
}
function buildReleaseConfidenceBreakdown(summary) {
    const passRateValue = clampDashboardScore(summary.kpis.passRate);
    const inverseFlakyValue = clampDashboardScore(100 - summary.kpis.flakyRatio);
    const errorHealthValue = summary.kpis.totalTests === 0
        ? 100
        : clampDashboardScore(100 - ((summary.errorClusters.length / summary.kpis.totalTests) * 100));
    const recentRuns = summary.history.recentRuns.slice(-5);
    const historyConsistencyValue = recentRuns.length > 0
        ? clampDashboardScore(averageDashboardNumber(recentRuns.map((run) => run.passRate - run.flakyRatio)))
        : clampDashboardScore(summary.kpis.passRate - summary.kpis.flakyRatio);
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
    ];
    return {
        total: roundOne(componentDefinitions.reduce((total, component) => total + (component.rawValue * component.weight), 0)),
        components: componentDefinitions.map((component) => ({
            label: component.label,
            formula: `${roundOne(component.rawValue)} × ${component.weight} = ${roundOne(component.rawValue * component.weight)}`,
            width: `${roundOne(component.rawValue)}%`,
            tone: getDashboardScoreTone(component.rawValue),
        })),
    };
}
function buildBusinessMetricReadiness(summary) {
    const costAssumptionsState = getBusinessAssumptionsState(summary.businessMetrics.costOfFlakiness.assumptions);
    const costStatus = costAssumptionsState === 'empty' ? 'pending' : costAssumptionsState;
    const timeToFixStatus = summary.businessMetrics.timeToFixFlaky.averageDays === null ? 'pending' : 'ready';
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
    ];
}
function averageDashboardNumber(values) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
}
function getBusinessReadinessStatusLabel(status) {
    if (status === 'ready') {
        return DASHBOARD_TEXT.business.readinessReady;
    }
    if (status === 'partial') {
        return DASHBOARD_TEXT.business.readinessPartial;
    }
    return DASHBOARD_TEXT.business.readinessPending;
}
function getBusinessAssumptionsState(assumptions) {
    const isCiConfigured = assumptions.ciMinuteCostRub !== null;
    const isDeveloperConfigured = assumptions.developerHourlyCostRub !== null && assumptions.analysisMinutesPerUnstable !== null;
    const hasAnyValue = isCiConfigured || assumptions.developerHourlyCostRub !== null || assumptions.analysisMinutesPerUnstable !== null;
    if (isCiConfigured && isDeveloperConfigured) {
        return 'ready';
    }
    if (hasAnyValue) {
        return 'partial';
    }
    return 'empty';
}
function getBusinessScenarioStatusLabel(assumptions) {
    const state = getBusinessAssumptionsState(assumptions);
    if (state === 'ready') {
        return DASHBOARD_TEXT.business.scenarioStatusReady;
    }
    if (state === 'partial') {
        return DASHBOARD_TEXT.business.scenarioStatusPartial;
    }
    return DASHBOARD_TEXT.business.scenarioStatusEmpty;
}
function getBusinessScenarioStatusHint(assumptions) {
    const state = getBusinessAssumptionsState(assumptions);
    if (state === 'ready') {
        return DASHBOARD_TEXT.business.scenarioStatusReadyHint;
    }
    if (state === 'partial') {
        return DASHBOARD_TEXT.business.scenarioStatusPartialHint;
    }
    return DASHBOARD_TEXT.business.scenarioStatusEmptyHint;
}
function getBusinessImpactLevel(totalCost, costPerDay) {
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
function getBusinessImpactClass(totalCost, costPerDay) {
    return `impact-${getBusinessImpactLevel(totalCost, costPerDay)}`;
}
function getBusinessImpactLabel(totalCost, costPerDay) {
    const impactLevel = getBusinessImpactLevel(totalCost, costPerDay);
    if (impactLevel === 'high') {
        return DASHBOARD_TEXT.business.impactHigh;
    }
    if (impactLevel === 'medium') {
        return DASHBOARD_TEXT.business.impactMedium;
    }
    if (impactLevel === 'low') {
        return DASHBOARD_TEXT.business.impactLow;
    }
    return DASHBOARD_TEXT.business.impactUnknown;
}
function getBusinessDriverType(ciCost, developerCost, totalCost) {
    if (totalCost === null || totalCost <= 0) {
        return 'missing';
    }
    const normalizedCiCost = ciCost ?? 0;
    const normalizedDeveloperCost = developerCost ?? 0;
    const delta = Math.abs(normalizedCiCost - normalizedDeveloperCost);
    if (delta <= totalCost * 0.15) {
        return 'balanced';
    }
    return normalizedCiCost > normalizedDeveloperCost ? 'ci' : 'development';
}
function getBusinessBreakdownItemClass(ciCost, developerCost, totalCost, target) {
    return getBusinessDriverType(ciCost, developerCost, totalCost) === target ? 'is-dominant' : '';
}
function getBusinessDriverSignalClass(ciCost, developerCost, totalCost, target) {
    return getBusinessDriverType(ciCost, developerCost, totalCost) === target ? 'is-dominant' : '';
}
function getBusinessDriverInsightTitle(ciCost, developerCost, totalCost) {
    const driverType = getBusinessDriverType(ciCost, developerCost, totalCost);
    if (driverType === 'ci') {
        return DASHBOARD_TEXT.business.topDriverCiTitle;
    }
    if (driverType === 'development') {
        return DASHBOARD_TEXT.business.topDriverDevelopmentTitle;
    }
    if (driverType === 'balanced') {
        return DASHBOARD_TEXT.business.topDriverBalancedTitle;
    }
    return DASHBOARD_TEXT.business.topDriverMissingTitle;
}
function getBusinessDriverInsightBody(ciCost, developerCost, totalCost) {
    const driverType = getBusinessDriverType(ciCost, developerCost, totalCost);
    if (driverType === 'ci') {
        return DASHBOARD_TEXT.business.topDriverCiBody;
    }
    if (driverType === 'development') {
        return DASHBOARD_TEXT.business.topDriverDevelopmentBody;
    }
    if (driverType === 'balanced') {
        return DASHBOARD_TEXT.business.topDriverBalancedBody;
    }
    return DASHBOARD_TEXT.business.topDriverMissingBody;
}
function formatCostShare(value, total) {
    if (value === null || total === null || total <= 0) {
        return '—';
    }
    return `${((value / total) * 100).toFixed(1)}%`;
}
function formatCostShareWidth(value, total) {
    if (value === null || total === null || total <= 0) {
        return '0%';
    }
    return `${Math.max(0, Math.min(100, (value / total) * 100)).toFixed(1)}%`;
}
function getDashboardScoreTone(value) {
    if (value >= 80) {
        return '';
    }
    if (value >= 60) {
        return 'warning';
    }
    return 'danger';
}
function clampDashboardScore(value) {
    return Math.min(Math.max(value, 0), 100);
}
function roundToOneDigit(value) {
    return roundOne(value);
}
function roundOne(value) {
    return Math.round(value * 10) / 10;
}
