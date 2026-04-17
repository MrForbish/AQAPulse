import { ru } from './i18n/ru'

export interface MetricIconDefinition {
    svg: string
}

type MetricIconId =
    | 'check-circle'
    | 'x-circle'
    | 'spark'
    | 'orbit'
    | 'clock'
    | 'hourglass'
    | 'cluster'
    | 'monitor'
    | 'compare'
    | 'burst'
    | 'chart-up'
    | 'pie'
    | 'history'
    | 'note'
    | 'list'
    | 'ruler'
    | 'layers'
    | 'globe'
    | 'compass'
    | 'chart-down'
    | 'alert'
    | 'target'
    | 'dice'
    | 'flag'
    | 'bell'
    | 'wrench'
    | 'coins'
    | 'brain'
    | 'shield'
    | 'calculator'
    | 'sliders'
    | 'code'
    | 'users'
    | 'bot'
    | 'calendar'
    | 'hash'
    | 'timeline'
    | 'medical'
    | 'bandage'
    | 'book'
    | 'link'
    | 'check-dot'
    | 'archive-box'
    | 'gauge'

const SVG_ICON_BY_ID: Record<MetricIconId, MetricIconDefinition> = {
    'check-circle': svgIcon('<circle cx="8" cy="8" r="5.25" /><path d="M5.7 8.1 7.25 9.65 10.45 6.45" />'),
    'x-circle': svgIcon('<circle cx="8" cy="8" r="5.25" /><path d="M6 6l4 4M10 6 6 10" />'),
    spark: svgIcon('<path d="M8 2.5c.55 2.05 1.45 2.95 3.5 3.5-2.05.55-2.95 1.45-3.5 3.5-.55-2.05-1.45-2.95-3.5-3.5 2.05-.55 2.95-1.45 3.5-3.5Z" /><path d="M11.4 10.4c.28 1.05.75 1.52 1.8 1.8-1.05.28-1.52.75-1.8 1.8-.28-1.05-.75-1.52-1.8-1.8 1.05-.28 1.52-.75 1.8-1.8Z" />'),
    orbit: svgIcon('<circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" /><path d="M3.3 8c0-2.4 2.1-4.4 4.7-4.4 2.6 0 4.7 2 4.7 4.4s-2.1 4.4-4.7 4.4c-2.6 0-4.7-2-4.7-4.4Z" /><path d="M5 4.5c1.8.6 3.2 1.8 4.3 3.5.8 1.3 1.2 2.6 1.2 4" />'),
    clock: svgIcon('<circle cx="8" cy="8" r="5.25" /><path d="M8 4.9v3.35l2.2 1.35" />'),
    hourglass: svgIcon('<path d="M5 3.4h6M5 12.6h6M5.3 3.8c0 1.7.9 2.5 2 3.4 1.1.9 2.4 1.6 2.4 2.8M10.7 3.8c0 1.7-.9 2.5-2 3.4-1.1.9-2.4 1.6-2.4 2.8" />'),
    cluster: svgIcon('<circle cx="5" cy="5.4" r="1.6" /><circle cx="11.1" cy="5" r="1.6" /><circle cx="8.2" cy="10.8" r="1.6" /><path d="M6.4 6.1 7.3 7.9M9.5 6 8.9 7.5" />'),
    monitor: svgIcon('<rect x="2.6" y="3.2" width="10.8" height="7.2" rx="1.4" /><path d="M6.2 12.5h3.6M8 10.4v2.1" />'),
    compare: svgIcon('<path d="M4 5.2h7.1M8.4 2.8l2.7 2.4-2.7 2.4M12 10.8H4.9M7.6 8.4 4.9 10.8l2.7 2.4" />'),
    burst: svgIcon('<path d="m8 2.8 1.4 2.85 3.15.46-2.28 2.22.54 3.14L8 10.1l-2.81 1.47.54-3.14L3.45 6.1l3.15-.46L8 2.8Z" />'),
    'chart-up': svgIcon('<path d="M3.2 11.7h9.6" /><path d="M4.2 10 6.5 7.7l2 1.9 3.1-3.3" />'),
    pie: svgIcon('<path d="M8 2.75a5.25 5.25 0 1 0 5.25 5.25H8Z" /><path d="M8.55 2.8a5.25 5.25 0 0 1 4.65 4.65H8.55Z" />'),
    history: svgIcon('<path d="M3.4 7.8A4.9 4.9 0 1 1 5 11.5" /><path d="M3.6 4.6v3h3" /><path d="M8 5.4v2.8l1.9 1.2" />'),
    note: svgIcon('<path d="M4.2 2.9h5.1l2.5 2.5v7.7H4.2Z" /><path d="M9.3 2.9v2.6h2.5M5.6 7h4.8M5.6 9.3h4.8" />'),
    list: svgIcon('<path d="M5.5 4.8h6M5.5 8h6M5.5 11.2h6" /><circle cx="3.7" cy="4.8" r=".7" fill="currentColor" stroke="none" /><circle cx="3.7" cy="8" r=".7" fill="currentColor" stroke="none" /><circle cx="3.7" cy="11.2" r=".7" fill="currentColor" stroke="none" />'),
    ruler: svgIcon('<rect x="3" y="4.2" width="10" height="7.6" rx="1.2" /><path d="M5.2 6v1.4M7 6v.8M8.8 6v1.4M10.6 6v.8" />'),
    layers: svgIcon('<path d="m8 3.2 4.5 2.2L8 7.6 3.5 5.4 8 3.2ZM3.9 7.7 8 9.8l4.1-2.1M3.9 9.9 8 12l4.1-2.1" />'),
    globe: svgIcon('<circle cx="8" cy="8" r="5.25" /><path d="M2.8 8h10.4M8 2.75c1.45 1.45 2.2 3.15 2.2 5.25S9.45 11.8 8 13.25M8 2.75C6.55 4.2 5.8 5.9 5.8 8s.75 3.8 2.2 5.25" />'),
    compass: svgIcon('<circle cx="8" cy="8" r="5.25" /><path d="m9.9 6.1-1.2 3-2.8 1.2 1.2-3 2.8-1.2Z" />'),
    'chart-down': svgIcon('<path d="M3.2 11.7h9.6" /><path d="M4.2 6.1 6.5 8.4l2-1.9 3.1 3.3" />'),
    alert: svgIcon('<path d="M8 3.1 12.5 11H3.5L8 3.1Z" /><path d="M8 6v2.3M8 9.9h.01" />'),
    target: svgIcon('<circle cx="8" cy="8" r="4.9" /><circle cx="8" cy="8" r="2.2" /><circle cx="8" cy="8" r=".7" fill="currentColor" stroke="none" />'),
    dice: svgIcon('<rect x="3.1" y="3.1" width="9.8" height="9.8" rx="1.8" /><circle cx="6" cy="6" r=".6" fill="currentColor" stroke="none" /><circle cx="10" cy="6" r=".6" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r=".6" fill="currentColor" stroke="none" /><circle cx="6" cy="10" r=".6" fill="currentColor" stroke="none" /><circle cx="10" cy="10" r=".6" fill="currentColor" stroke="none" />'),
    flag: svgIcon('<path d="M4.3 13V3.2" /><path d="M5 3.6h5l-1.1 1.8L10 7.2H5Z" />'),
    bell: svgIcon('<path d="M5.2 10.6h5.6" /><path d="M6 10.6V7.4a2 2 0 1 1 4 0v3.2" /><path d="M7 11.2a1 1 0 0 0 2 0" />'),
    wrench: svgIcon('<path d="M10.9 3.6a2.2 2.2 0 0 0-2.7 2.8L4.4 10.2a1.1 1.1 0 1 0 1.6 1.6l3.8-3.8a2.2 2.2 0 0 0 2.8-2.7l-1.7 1.1-1.3-1.3 1.3-1.5Z" />'),
    coins: svgIcon('<ellipse cx="8" cy="4.5" rx="3.4" ry="1.6" /><path d="M4.6 4.5v4c0 .9 1.5 1.6 3.4 1.6s3.4-.7 3.4-1.6v-4" /><path d="M4.6 7c0 .9 1.5 1.6 3.4 1.6s3.4-.7 3.4-1.6" />'),
    brain: svgIcon('<path d="M6.1 4.2a1.9 1.9 0 1 0-2.6 2.6 2 2 0 0 0 1.2 3.7h1.7V4.2ZM9.9 4.2a1.9 1.9 0 1 1 2.6 2.6 2 2 0 0 1-1.2 3.7H9.6V4.2Z" /><path d="M6.4 6.1h3.2M6.4 8.2h3.2" />'),
    shield: svgIcon('<path d="M8 2.8 11.6 4v3.2c0 2.3-1.5 4.2-3.6 5-2.1-.8-3.6-2.7-3.6-5V4L8 2.8Z" /><path d="M6.2 8.1 7.5 9.3 9.9 6.9" />'),
    calculator: svgIcon('<rect x="4.1" y="2.8" width="7.8" height="10.4" rx="1.3" /><path d="M5.6 5.1h4.8M5.8 7.8h1.1M8.1 7.8h1.1M10.4 7.8h.1M5.8 10.1h1.1M8.1 10.1h1.1M10.4 10.1h.1" />'),
    sliders: svgIcon('<path d="M4.5 3.6v8.8M8 3.6v8.8M11.5 3.6v8.8" /><circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="9" r="1.1" fill="currentColor" stroke="none" /><circle cx="11.5" cy="5.2" r="1.1" fill="currentColor" stroke="none" />'),
    code: svgIcon('<path d="M6.2 5.3 4 8l2.2 2.7M9.8 5.3 12 8l-2.2 2.7M8.6 4.5 7.4 11.5" />'),
    users: svgIcon('<circle cx="6.1" cy="5.7" r="1.7" /><circle cx="10.5" cy="6.3" r="1.4" /><path d="M3.9 11c.6-1.6 1.8-2.4 3.6-2.4S10.5 9.4 11 11M9.3 10.7c.4-1 1.2-1.6 2.4-1.6 1.1 0 1.8.4 2.3 1.4" />'),
    bot: svgIcon('<rect x="4" y="4.7" width="8" height="6.1" rx="1.5" /><path d="M8 2.9v1.4M6.1 4.7l-.8-1M9.9 4.7l.8-1" /><circle cx="6.8" cy="7.7" r=".55" fill="currentColor" stroke="none" /><circle cx="9.2" cy="7.7" r=".55" fill="currentColor" stroke="none" /><path d="M6.9 9.2h2.2" />'),
    calendar: svgIcon('<rect x="3.2" y="4" width="9.6" height="8.3" rx="1.2" /><path d="M5.4 2.8v2.1M10.6 2.8v2.1M3.2 6.2h9.6" />'),
    hash: svgIcon('<path d="M6.1 3.2 5.2 12.8M10.8 3.2 9.9 12.8M3.5 6.2h8.8M3.1 9.8h8.8" />'),
    timeline: svgIcon('<path d="M3.2 8h9.6" /><circle cx="4.3" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="11.7" cy="8" r="1" fill="currentColor" stroke="none" />'),
    medical: svgIcon('<rect x="3.1" y="4.2" width="9.8" height="7.6" rx="1.8" /><path d="M8 5.8v4.4M5.8 8h4.4" />'),
    bandage: svgIcon('<path d="m5.1 5.2 5.7 5.7M10.8 5.2l-5.7 5.7" /><rect x="3.2" y="6.2" width="9.6" height="3.6" rx="1.8" transform="rotate(-45 8 8)" /><path d="M7 7.1h.01M8 8h.01M9 8.9h.01" />'),
    book: svgIcon('<path d="M4.2 3.6h5.1a1.8 1.8 0 0 1 1.8 1.8v6H6a1.8 1.8 0 0 0-1.8 1.8V5.4a1.8 1.8 0 0 1 1.8-1.8Z" /><path d="M6.2 5.9h3.3M6.2 8.1h3.3" />'),
    link: svgIcon('<path d="M6.1 9.9 4.8 11.2a2 2 0 1 1-2.8-2.8l1.9-1.9a2 2 0 0 1 2.8 0M9.9 6.1l1.3-1.3a2 2 0 1 1 2.8 2.8L12 9.5a2 2 0 0 1-2.8 0M5.8 10.2l4.4-4.4" />'),
    'check-dot': svgIcon('<circle cx="8" cy="8" r="5.25" /><circle cx="8" cy="8" r="1.35" fill="currentColor" stroke="none" />'),
    'archive-box': svgIcon('<path d="M3.2 5.1h9.6v6.6H3.2z" /><path d="M2.6 3.4h10.8v1.7H2.6zM6.2 8h3.6" />'),
    gauge: svgIcon('<path d="M3.6 10.9a4.8 4.8 0 1 1 8.8 0" /><path d="M8 8l2-2.1" /><circle cx="8" cy="8" r=".8" fill="currentColor" stroke="none" />'),
}

const METRIC_ICON_BY_KEY: Record<string, MetricIconId> = {
    passRate: 'check-circle',
    failedTests: 'x-circle',
    flakyTests: 'orbit',
    runDuration: 'clock',
    errorClusters: 'cluster',
    environment: 'monitor',
    latestVsPrevious: 'compare',
    failures: 'burst',
    flakyShort: 'orbit',
    duration: 'clock',
    passRateTrend: 'chart-up',
    statusDistribution: 'pie',
    recentRuns: 'history',
    notes: 'note',
    latestRuns: 'list',
    durationTrend: 'chart-up',
    p95Duration: 'ruler',
    p99Duration: 'ruler',
    topSlowestTests: 'hourglass',
    topSlowestTestsP1: 'hourglass',
    phaseBreakdown: 'layers',
    suiteDuration: 'archive-box',
    durationPerBrowser: 'globe',
    leadingPhase: 'compass',
    flakyTrend: 'chart-down',
    clusterDistribution: 'cluster',
    problematicTests: 'alert',
    topFlakyTests: 'target',
    flakyScore: 'orbit',
    unstableRuns: 'dice',
    lastStatus: 'flag',
    timeToDetect: 'bell',
    timeToFixFlaky: 'wrench',
    ciWasteTime: 'hourglass',
    costSection: 'coins',
    costOfFlakiness: 'coins',
    investigationCost: 'coins',
    developerFriction: 'brain',
    releaseConfidenceScore: 'shield',
    releaseReadiness: 'shield',
    qualityRisk: 'alert',
    deliveryRisk: 'gauge',
    managerSummary: 'shield',
    automationRoi: 'chart-up',
    costStructure: 'calculator',
    configAssumptions: 'sliders',
    codeQuality: 'code',
    team: 'users',
    ai: 'bot',
    failureRate: 'chart-down',
    mtbf: 'calendar',
    archiveGaps: 'archive-box',
    currentRunTests: 'list',
    totalRuns: 'hash',
    failedRuns: 'x-circle',
    flakyRuns: 'orbit',
    latestStatus: 'flag',
    failRate: 'chart-down',
    timeline: 'timeline',
    latestError: 'burst',
    latestFlakyEvent: 'orbit',
    latestEvent: 'alert',
    latestRecovery: 'bandage',
    previousUnstableEvents: 'book',
    currentStabilityStreak: 'check-dot',
    unstableStreakBeforeRecovery: 'link',
}

const METRIC_ICON_BY_LABEL = createMetricIconLabelMap()

export function resolveMetricIcon(metricKey: string | undefined, label: string): MetricIconDefinition | null {
    if (metricKey && METRIC_ICON_BY_KEY[metricKey]) {
        return SVG_ICON_BY_ID[METRIC_ICON_BY_KEY[metricKey]]
    }

    return METRIC_ICON_BY_LABEL.get(normalizeMetricLabel(label)) ?? null
}

export function renderMetricIconSvg(icon: MetricIconDefinition): string {
    return icon.svg
}

function createMetricIconLabelMap(): Map<string, MetricIconDefinition> {
    const iconMap = new Map<string, MetricIconDefinition>()

    const register = (label: string, key: keyof typeof METRIC_ICON_BY_KEY) => {
        iconMap.set(normalizeMetricLabel(label), SVG_ICON_BY_ID[METRIC_ICON_BY_KEY[key]])
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
    register(ru.dashboard.metrics.ciWasteTime, 'ciWasteTime')
    register(ru.dashboard.metrics.costSection, 'costSection')
    register(ru.dashboard.metrics.costOfFlakiness, 'costOfFlakiness')
    register(ru.dashboard.metrics.investigationCost, 'investigationCost')
    register(ru.dashboard.metrics.developerFriction, 'developerFriction')
    register(ru.dashboard.metrics.releaseConfidenceScore, 'releaseConfidenceScore')
    register(ru.dashboard.metrics.automationRoi, 'automationRoi')
    register(ru.dashboard.metrics.costStructure, 'costStructure')
    register(ru.dashboard.metrics.configAssumptions, 'configAssumptions')
    register(ru.dashboard.metrics.codeQuality, 'codeQuality')
    register(ru.dashboard.metrics.team, 'team')
    register(ru.dashboard.metrics.ai, 'ai')
    register(ru.dashboard.manager.releaseReadiness, 'releaseReadiness')
    register(ru.dashboard.manager.qualityRisk, 'qualityRisk')
    register(ru.dashboard.manager.deliveryRisk, 'deliveryRisk')
    register(ru.dashboard.testsBrowser.title, 'currentRunTests')

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

function svgIcon(body: string): MetricIconDefinition {
    return {
        svg: `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
    }
}
