import { ru } from './shared/i18n/ru'

export const METRIC_INFO_STYLES = `
.metric-heading { display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.metric-icon { display: inline-flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; transform: translateY(-1px); }
.metric-info { position: relative; display: inline-flex; align-items: center; }
.metric-info-button { width: 16px; height: 16px; border-radius: 50%; border: 1px solid #30363d; background: #21262d; color: #8b949e; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; cursor: help; }
.metric-info-button:focus-visible { outline: 2px solid #2f81f7; outline-offset: 2px; }
.metric-tooltip { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(4px); width: min(280px, 70vw); padding: 10px 12px; border-radius: 8px; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; font-size: 12px; line-height: 1.45; box-shadow: 0 10px 30px rgba(1, 4, 9, 0.45); opacity: 0; pointer-events: none; z-index: 10; white-space: normal; text-align: left; transition: opacity 0.15s ease, transform 0.15s ease; }
.metric-info:hover .metric-tooltip, .metric-info:focus-within .metric-tooltip { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
`

const METRIC_ICON_BY_KEY: Record<string, string> = {
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
}

const METRIC_ICON_BY_LABEL = createMetricIconLabelMap()

export function renderMetricHeading(
    label: string,
    description: string,
    options: { className?: string; tagName?: 'div' | 'span'; metricKey?: string } = {},
): string {
    const className = [options.className, 'metric-heading'].filter(Boolean).join(' ')
    const tagName = options.tagName ?? 'span'
    const iconMarkup = renderMetricIcon(resolveMetricIcon(options.metricKey, label))

    return `<${tagName} class="${escapeHtml(className)}">${iconMarkup}<span>${escapeHtml(label)}</span>${renderMetricInfoIcon(description, label)}</${tagName}>`
}

export function renderMetricInfoIcon(description: string, label: string): string {
    return `<span class="metric-info"><span class="metric-info-button" tabindex="0" role="img" aria-label="Описание метрики ${escapeHtml(label)}">i</span><span class="metric-tooltip">${escapeHtml(description)}</span></span>`
}

function renderMetricIcon(icon: string | null): string {
    if (!icon) {
        return ''
    }

    return `<span class="metric-icon" aria-hidden="true">${escapeHtml(icon)}</span>`
}

function resolveMetricIcon(metricKey: string | undefined, label: string): string | null {
    if (metricKey && METRIC_ICON_BY_KEY[metricKey]) {
        return METRIC_ICON_BY_KEY[metricKey]
    }

    return METRIC_ICON_BY_LABEL.get(normalizeLabel(label)) ?? null
}

function createMetricIconLabelMap(): Map<string, string> {
    const iconMap = new Map<string, string>()

    const register = (label: string, key: keyof typeof METRIC_ICON_BY_KEY) => {
        iconMap.set(normalizeLabel(label), METRIC_ICON_BY_KEY[key])
    }

    register(ru.dashboard.metrics.passRate, 'passRate')
    register(ru.dashboard.metrics.failedTests, 'failedTests')
    register(ru.dashboard.metrics.flakyTests, 'flakyTests')
    register(ru.dashboard.metrics.runDuration, 'runDuration')
    register(ru.dashboard.metrics.errorClusters, 'errorClusters')
    register(ru.dashboard.metrics.environment, 'environment')
    register(ru.dashboard.metrics.latestVsPrevious, 'latestVsPrevious')
    register(ru.dashboard.metrics.failures, 'failures')
    register(ru.dashboard.metrics.flakyShort, 'flakyShort')
    register(ru.dashboard.metrics.duration, 'duration')
    register(ru.dashboard.metrics.passRateTrend, 'passRateTrend')
    register(ru.dashboard.metrics.statusDistribution, 'statusDistribution')
    register(ru.dashboard.metrics.recentRuns, 'recentRuns')
    register(ru.dashboard.metrics.notes, 'notes')
    register(ru.dashboard.metrics.latestRuns, 'latestRuns')
    register(ru.dashboard.metrics.durationTrend, 'durationTrend')
    register(ru.dashboard.metrics.p95Duration, 'p95Duration')
    register(ru.dashboard.metrics.p99Duration, 'p99Duration')
    register(ru.dashboard.metrics.topSlowestTests, 'topSlowestTests')
    register(ru.dashboard.metrics.topSlowestTestsP1, 'topSlowestTestsP1')
    register(ru.dashboard.metrics.phaseBreakdown, 'phaseBreakdown')
    register(ru.dashboard.metrics.suiteDuration, 'suiteDuration')
    register(ru.dashboard.metrics.durationPerBrowser, 'durationPerBrowser')
    register(ru.dashboard.metrics.leadingPhase, 'leadingPhase')
    register(ru.dashboard.metrics.flakyTrend, 'flakyTrend')
    register(ru.dashboard.metrics.clusterDistribution, 'clusterDistribution')
    register(ru.dashboard.metrics.problematicTests, 'problematicTests')
    register(ru.dashboard.metrics.topFlakyTests, 'topFlakyTests')
    register(ru.dashboard.metrics.flakyScore, 'flakyScore')
    register(ru.dashboard.metrics.unstableRuns, 'unstableRuns')
    register(ru.dashboard.metrics.lastStatus, 'lastStatus')
    register(ru.dashboard.metrics.timeToDetect, 'timeToDetect')
    register(ru.dashboard.metrics.timeToFixFlaky, 'timeToFixFlaky')
    register(ru.dashboard.metrics.costSection, 'costSection')
    register(ru.dashboard.metrics.costOfFlakiness, 'costOfFlakiness')
    register(ru.dashboard.metrics.developerFriction, 'developerFriction')
    register(ru.dashboard.metrics.releaseConfidenceScore, 'releaseConfidenceScore')
    register(ru.dashboard.metrics.automationRoi, 'automationRoi')
    register(ru.dashboard.metrics.costStructure, 'costStructure')
    register(ru.dashboard.metrics.configAssumptions, 'configAssumptions')
    register(ru.dashboard.metrics.codeQuality, 'codeQuality')
    register(ru.dashboard.metrics.team, 'team')
    register(ru.dashboard.metrics.ai, 'ai')

    register(ru.testHistory.metrics.archiveGaps, 'archiveGaps')
    register(ru.testHistory.metrics.totalRuns, 'totalRuns')
    register(ru.testHistory.metrics.failedRuns, 'failedRuns')
    register(ru.testHistory.metrics.flakyRuns, 'flakyRuns')
    register(ru.testHistory.metrics.latestStatus, 'latestStatus')
    register(ru.testHistory.metrics.passRate, 'passRate')
    register(ru.testHistory.metrics.failRate, 'failRate')
    register(ru.testHistory.metrics.flakyScore, 'flakyScore')
    register(ru.testHistory.metrics.latestError, 'latestError')
    register(ru.testHistory.metrics.latestFlakyEvent, 'latestFlakyEvent')
    register(ru.testHistory.metrics.previousUnstableEvents, 'previousUnstableEvents')
    register(ru.testHistory.metrics.latestStableRecovery, 'latestRecovery')
    register(ru.testHistory.metrics.currentStabilityStreak, 'currentStabilityStreak')
    register(ru.testHistory.metrics.unstableStreakBeforeRecovery, 'unstableStreakBeforeRecovery')
    register(ru.testHistory.metrics.timeline, 'timeline')

    register('Доля падений', 'failureRate')
    register('MTBF', 'mtbf')

    return iconMap
}

function normalizeLabel(label: string): string {
    return label.trim().toLowerCase()
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

