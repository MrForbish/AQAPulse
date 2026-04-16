"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.METRIC_INFO_STYLES = void 0;
exports.renderMetricHeading = renderMetricHeading;
exports.renderMetricInfoIcon = renderMetricInfoIcon;
const text_utils_1 = require("./shared/text-utils");
const ru_1 = require("./shared/i18n/ru");
exports.METRIC_INFO_STYLES = `
.metric-heading { display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.metric-icon { display: inline-flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; transform: translateY(-1px); }
.metric-info { position: relative; display: inline-flex; align-items: center; }
.metric-info-button { width: 16px; height: 16px; border-radius: 50%; border: 1px solid #30363d; background: #21262d; color: #8b949e; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; cursor: help; }
.metric-info-button:focus-visible { outline: 2px solid #2f81f7; outline-offset: 2px; }
.metric-tooltip { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(4px); width: min(280px, 70vw); padding: 10px 12px; border-radius: 8px; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; font-size: 12px; line-height: 1.45; box-shadow: 0 10px 30px rgba(1, 4, 9, 0.45); opacity: 0; pointer-events: none; z-index: 10; white-space: normal; text-align: left; transition: opacity 0.15s ease, transform 0.15s ease; }
.metric-info:hover .metric-tooltip, .metric-info:focus-within .metric-tooltip { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
`;
const METRIC_ICON_BY_KEY = {
    passRate: '✅',
    failedTests: '❌',
    flakyTests: '🌀',
    runDuration: '⏱️',
    errorClusters: '🧩',
    environment: '🖥️',
    latestVsPrevious: '🆚',
    failures: '💥',
    flakyShort: '🌀',
    duration: '⏱️',
    passRateTrend: '📈',
    statusDistribution: '🥧',
    recentRuns: '🕘',
    notes: '📝',
    latestRuns: '🗂️',
    durationTrend: '📊',
    p95Duration: '📏',
    p99Duration: '📐',
    topSlowestTests: '🐢',
    topSlowestTestsP1: '🐢',
    phaseBreakdown: '🧱',
    suiteDuration: '🗃️',
    durationPerBrowser: '🌐',
    leadingPhase: '🧭',
    flakyTrend: '📉',
    clusterDistribution: '🧩',
    problematicTests: '🚨',
    topFlakyTests: '🎯',
    flakyScore: '🌪️',
    unstableRuns: '🎲',
    lastStatus: '🏁',
    timeToDetect: '🔔',
    timeToFixFlaky: '🛠️',
    costSection: '💸',
    costOfFlakiness: '💸',
    developerFriction: '🧠',
    releaseConfidenceScore: '🛡️',
    automationRoi: '📈',
    costStructure: '🧮',
    configAssumptions: '⚙️',
    codeQuality: '🧼',
    team: '👥',
    ai: '🤖',
    failureRate: '📉',
    mtbf: '📆',
    archiveGaps: '🗃️',
    totalRuns: '🔢',
    failedRuns: '❌',
    flakyRuns: '🌀',
    latestStatus: '🏁',
    failRate: '📉',
    timeline: '🕰️',
    latestError: '💥',
    latestFlakyEvent: '🌀',
    latestEvent: '🚨',
    latestRecovery: '🩹',
    previousUnstableEvents: '📚',
    currentStabilityStreak: '🟢',
    unstableStreakBeforeRecovery: '📎',
};
const METRIC_ICON_BY_LABEL = createMetricIconLabelMap();
function renderMetricHeading(label, description, options = {}) {
    const className = [options.className, 'metric-heading'].filter(Boolean).join(' ');
    const tagName = options.tagName ?? 'span';
    const iconMarkup = renderMetricIcon(resolveMetricIcon(options.metricKey, label));
    return `<${tagName} class="${(0, text_utils_1.escapeHtml)(className)}">${iconMarkup}<span>${(0, text_utils_1.escapeHtml)(label)}</span>${renderMetricInfoIcon(description, label)}</${tagName}>`;
}
function renderMetricInfoIcon(description, label) {
    return `<span class="metric-info"><span class="metric-info-button" tabindex="0" role="img" aria-label="Описание метрики ${(0, text_utils_1.escapeHtml)(label)}">i</span><span class="metric-tooltip">${(0, text_utils_1.escapeHtml)(description)}</span></span>`;
}
function renderMetricIcon(icon) {
    if (!icon) {
        return '';
    }
    return `<span class="metric-icon" aria-hidden="true">${(0, text_utils_1.escapeHtml)(icon)}</span>`;
}
function resolveMetricIcon(metricKey, label) {
    if (metricKey && METRIC_ICON_BY_KEY[metricKey]) {
        return METRIC_ICON_BY_KEY[metricKey];
    }
    return METRIC_ICON_BY_LABEL.get(normalizeLabel(label)) ?? null;
}
function createMetricIconLabelMap() {
    const iconMap = new Map();
    const register = (label, key) => {
        iconMap.set(normalizeLabel(label), METRIC_ICON_BY_KEY[key]);
    };
    register(ru_1.ru.dashboard.metrics.passRate, 'passRate');
    register(ru_1.ru.dashboard.metrics.failedTests, 'failedTests');
    register(ru_1.ru.dashboard.metrics.flakyTests, 'flakyTests');
    register(ru_1.ru.dashboard.metrics.runDuration, 'runDuration');
    register(ru_1.ru.dashboard.metrics.errorClusters, 'errorClusters');
    register(ru_1.ru.dashboard.metrics.environment, 'environment');
    register(ru_1.ru.dashboard.metrics.latestVsPrevious, 'latestVsPrevious');
    register(ru_1.ru.dashboard.metrics.failures, 'failures');
    register(ru_1.ru.dashboard.metrics.flakyShort, 'flakyShort');
    register(ru_1.ru.dashboard.metrics.duration, 'duration');
    register(ru_1.ru.dashboard.metrics.passRateTrend, 'passRateTrend');
    register(ru_1.ru.dashboard.metrics.statusDistribution, 'statusDistribution');
    register(ru_1.ru.dashboard.metrics.recentRuns, 'recentRuns');
    register(ru_1.ru.dashboard.metrics.notes, 'notes');
    register(ru_1.ru.dashboard.metrics.latestRuns, 'latestRuns');
    register(ru_1.ru.dashboard.metrics.durationTrend, 'durationTrend');
    register(ru_1.ru.dashboard.metrics.p95Duration, 'p95Duration');
    register(ru_1.ru.dashboard.metrics.p99Duration, 'p99Duration');
    register(ru_1.ru.dashboard.metrics.topSlowestTests, 'topSlowestTests');
    register(ru_1.ru.dashboard.metrics.topSlowestTestsP1, 'topSlowestTestsP1');
    register(ru_1.ru.dashboard.metrics.phaseBreakdown, 'phaseBreakdown');
    register(ru_1.ru.dashboard.metrics.suiteDuration, 'suiteDuration');
    register(ru_1.ru.dashboard.metrics.durationPerBrowser, 'durationPerBrowser');
    register(ru_1.ru.dashboard.metrics.leadingPhase, 'leadingPhase');
    register(ru_1.ru.dashboard.metrics.flakyTrend, 'flakyTrend');
    register(ru_1.ru.dashboard.metrics.clusterDistribution, 'clusterDistribution');
    register(ru_1.ru.dashboard.metrics.problematicTests, 'problematicTests');
    register(ru_1.ru.dashboard.metrics.topFlakyTests, 'topFlakyTests');
    register(ru_1.ru.dashboard.metrics.flakyScore, 'flakyScore');
    register(ru_1.ru.dashboard.metrics.unstableRuns, 'unstableRuns');
    register(ru_1.ru.dashboard.metrics.lastStatus, 'lastStatus');
    register(ru_1.ru.dashboard.metrics.timeToDetect, 'timeToDetect');
    register(ru_1.ru.dashboard.metrics.timeToFixFlaky, 'timeToFixFlaky');
    register(ru_1.ru.dashboard.metrics.costSection, 'costSection');
    register(ru_1.ru.dashboard.metrics.costOfFlakiness, 'costOfFlakiness');
    register(ru_1.ru.dashboard.metrics.developerFriction, 'developerFriction');
    register(ru_1.ru.dashboard.metrics.releaseConfidenceScore, 'releaseConfidenceScore');
    register(ru_1.ru.dashboard.metrics.automationRoi, 'automationRoi');
    register(ru_1.ru.dashboard.metrics.costStructure, 'costStructure');
    register(ru_1.ru.dashboard.metrics.configAssumptions, 'configAssumptions');
    register(ru_1.ru.dashboard.metrics.codeQuality, 'codeQuality');
    register(ru_1.ru.dashboard.metrics.team, 'team');
    register(ru_1.ru.dashboard.metrics.ai, 'ai');
    register(ru_1.ru.testHistory.metrics.archiveGaps, 'archiveGaps');
    register(ru_1.ru.testHistory.metrics.totalRuns, 'totalRuns');
    register(ru_1.ru.testHistory.metrics.failedRuns, 'failedRuns');
    register(ru_1.ru.testHistory.metrics.flakyRuns, 'flakyRuns');
    register(ru_1.ru.testHistory.metrics.latestStatus, 'latestStatus');
    register(ru_1.ru.testHistory.metrics.passRate, 'passRate');
    register(ru_1.ru.testHistory.metrics.failRate, 'failRate');
    register(ru_1.ru.testHistory.metrics.flakyScore, 'flakyScore');
    register(ru_1.ru.testHistory.metrics.latestError, 'latestError');
    register(ru_1.ru.testHistory.metrics.latestFlakyEvent, 'latestFlakyEvent');
    register(ru_1.ru.testHistory.metrics.previousUnstableEvents, 'previousUnstableEvents');
    register(ru_1.ru.testHistory.metrics.latestStableRecovery, 'latestRecovery');
    register(ru_1.ru.testHistory.metrics.currentStabilityStreak, 'currentStabilityStreak');
    register(ru_1.ru.testHistory.metrics.unstableStreakBeforeRecovery, 'unstableStreakBeforeRecovery');
    register(ru_1.ru.testHistory.metrics.timeline, 'timeline');
    register('Доля падений', 'failureRate');
    register('MTBF', 'mtbf');
    return iconMap;
}
function normalizeLabel(label) {
    return label.trim().toLowerCase();
}
