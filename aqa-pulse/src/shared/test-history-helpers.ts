import type { TestHistoryResponse } from '../api-store'
import { formatStatusLabel } from './dashboard-helpers'
import { ru } from './i18n/ru'

const HISTORY_TEXT = ru.testHistory

export function buildHistoryRowAnchor(runId: string): string {
    const normalizedId = runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    return normalizedId.length > 0 ? `history-row-${normalizedId}` : 'history-row-run'
}

export function formatRunsLabel(count: number): string {
    return `${count} ${getRunWord(count)}`
}

export function getRunWord(count: number): string {
    const remainder100 = count % 100
    const remainder10 = count % 10

    if (remainder100 >= 11 && remainder100 <= 14) {
        return 'прогонов'
    }

    if (remainder10 === 1) {
        return 'прогон'
    }

    if (remainder10 >= 2 && remainder10 <= 4) {
        return 'прогона'
    }

    return 'прогонов'
}

export function formatTemplate(template: string, values: Record<string, string>): string {
    return Object.entries(values).reduce(
        (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
        template,
    )
}

export function isStableHistoryItem(item: TestHistoryResponse['history'][number]): boolean {
    return item.status === 'passed' && !item.flaky && !item.errorMessage
}

export function isUnstableHistoryItem(item: TestHistoryResponse['history'][number]): boolean {
    return Boolean(item.errorMessage)
        || item.flaky
        || item.status === 'failed'
        || item.status === 'timedout'
        || item.status === 'interrupted'
}

export function getUnstableHistoryItems(history: TestHistoryResponse['history']): TestHistoryResponse['history'] {
    return history.filter(isUnstableHistoryItem)
}

export function getUnstableEventLabel(item: TestHistoryResponse['history'][number]): string {
    if (item.errorMessage) {
        return HISTORY_TEXT.labels.error
    }

    if (item.flaky) {
        return HISTORY_TEXT.labels.flaky
    }

    return formatStatusLabel(item.status, false)
}

export function findLatestStableRecovery(history: TestHistoryResponse['history']): {
    recovery: TestHistoryResponse['history'][number]
    previousUnstable: TestHistoryResponse['history'][number]
} | null {
    for (let index = 0; index < history.length - 1; index += 1) {
        const currentItem = history[index]
        const previousOlderItem = history[index + 1]

        if (isStableHistoryItem(currentItem) && isUnstableHistoryItem(previousOlderItem)) {
            return {
                recovery: currentItem,
                previousUnstable: previousOlderItem,
            }
        }
    }

    return null
}

export function findCurrentStabilityStreak(history: TestHistoryResponse['history']): {
    count: number
    latestStable: TestHistoryResponse['history'][number] | null
    oldestStable: TestHistoryResponse['history'][number] | null
    previousUnstable: TestHistoryResponse['history'][number] | null
} {
    if (history.length === 0) {
        return {
            count: 0,
            latestStable: null,
            oldestStable: null,
            previousUnstable: null,
        }
    }

    let count = 0

    for (const item of history) {
        if (!isStableHistoryItem(item)) {
            break
        }

        count += 1
    }

    if (count === 0) {
        return {
            count: 0,
            latestStable: null,
            oldestStable: null,
            previousUnstable: history[0] ?? null,
        }
    }

    return {
        count,
        latestStable: history[0] ?? null,
        oldestStable: history[count - 1] ?? null,
        previousUnstable: history[count] ?? null,
    }
}

export function findUnstableStreakBeforeRecovery(history: TestHistoryResponse['history']): {
    count: number
    recovery: TestHistoryResponse['history'][number]
    latestUnstable: TestHistoryResponse['history'][number]
    oldestUnstable: TestHistoryResponse['history'][number]
} | null {
    const recoveryPair = findLatestStableRecovery(history)

    if (!recoveryPair) {
        return null
    }

    const recoveryIndex = history.findIndex((item) => item.runId === recoveryPair.recovery.runId)

    if (recoveryIndex < 0 || recoveryIndex === history.length - 1) {
        return null
    }

    const unstableItems: TestHistoryResponse['history'] = []

    for (let index = recoveryIndex + 1; index < history.length; index += 1) {
        const currentItem = history[index]

        if (!isUnstableHistoryItem(currentItem)) {
            break
        }

        unstableItems.push(currentItem)
    }

    if (unstableItems.length === 0) {
        return null
    }

    return {
        count: unstableItems.length,
        recovery: recoveryPair.recovery,
        latestUnstable: unstableItems[0],
        oldestUnstable: unstableItems[unstableItems.length - 1],
    }
}

export function formatCurrentStabilityDescription(streak: ReturnType<typeof findCurrentStabilityStreak>): string {
    if (streak.count === 0) {
        return HISTORY_TEXT.texts.streakNotStarted
    }

    if (!streak.previousUnstable) {
        return formatTemplate(HISTORY_TEXT.texts.streakWholeHistory, { count: String(streak.count) })
    }

    return formatTemplate(HISTORY_TEXT.texts.streakAfterEvent, {
        count: String(streak.count),
        event: getUnstableEventLabel(streak.previousUnstable),
    })
}