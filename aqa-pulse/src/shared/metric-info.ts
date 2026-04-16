import { ru } from './i18n/ru'

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

export function resolveMetricIcon(metricKey: string | undefined, label: string): string | null {
    if (metricKey && METRIC_ICON_BY_KEY[metricKey]) {
        return METRIC_ICON_BY_KEY[metricKey]
    }

    return METRIC_ICON_BY_LABEL.get(normalizeMetricLabel(label)) ?? null
}

function createMetricIconLabelMap(): Map<string, string> {
    const iconMap = new Map<string, string>()

    const register = (label: string, key: keyof typeof METRIC_ICON_BY_KEY) => {
        iconMap.set(normalizeMetricLabel(label), METRIC_ICON_BY_KEY[key])
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

function normalizeMetricLabel(label: string): string {
    return label.trim().toLowerCase()
}
