import type { TestHistoryResponse } from '../api-store'
import { formatStatusLabel } from './dashboard-helpers'
import { ru } from './i18n/ru'

const HISTORY_TEXT = ru.testHistory
type TestHistoryItem = TestHistoryResponse['history'][number]
type TestHistoryAttachment = TestHistoryItem['attemptDetails'][number]['attachments'][number]
type TestHistoryAttemptStep = TestHistoryItem['attemptDetails'][number]['steps'][number]

export interface DiagnosticStepTreeNode {
    step: TestHistoryAttemptStep
    stepIndex: number
    children: DiagnosticStepTreeNode[]
}

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

export function normalizeAnchorLookupValue(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase()
    return normalized.length > 0 ? normalized : null
}

export function buildStepAnchor(runId: string, attemptNumber: number, stepIndex: number): string {
    const runSlug = runId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'run'
    return `step-${runSlug}-a${attemptNumber}-s${stepIndex + 1}`
}

export function buildDiagnosticStepTree(
    steps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'],
): DiagnosticStepTreeNode[] {
    const roots: DiagnosticStepTreeNode[] = []
    const nodeStack: Array<{ depth: number; node: DiagnosticStepTreeNode }> = []

    steps.forEach((step, stepIndex) => {
        const node: DiagnosticStepTreeNode = {
            step,
            stepIndex,
            children: [],
        }

        while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].depth >= step.depth) {
            nodeStack.pop()
        }

        const parentNode = nodeStack[nodeStack.length - 1]?.node ?? null

        if (parentNode) {
            parentNode.children.push(node)
        } else {
            roots.push(node)
        }

        nodeStack.push({ depth: step.depth, node })
    })

    return roots
}

export function findIncidentStepAnchor(
    history: TestHistoryResponse['history'],
    input: {
        failureStepTitle: string | null
        failureStepCategory?: string | null
        failureStepErrorMessage?: string | null
        failureStepRunId?: string | null
        failureStepAttempt?: number | null
        failureStepOffsetMs?: number | null
    },
): string | null {
    const normalizedTarget = normalizeAnchorLookupValue(input.failureStepTitle)

    if (!normalizedTarget) {
        return null
    }

    const latestRun = history[0]
    const latestUnstable = getUnstableHistoryItems(history)[0]
    const scopedCandidates = typeof input.failureStepRunId === 'string' && input.failureStepRunId.length > 0
        ? history.filter((item) => item.runId === input.failureStepRunId)
        : []
    const candidates = (scopedCandidates.length > 0 ? scopedCandidates : [latestRun, latestUnstable]).filter(
        (item, index, collection): item is NonNullable<typeof item> => Boolean(item) && collection.findIndex((candidate) => candidate?.runId === item?.runId) === index,
    )
    const normalizedCategory = normalizeAnchorLookupValue(input.failureStepCategory ?? null)
    const normalizedErrorMessage = normalizeAnchorLookupValue(input.failureStepErrorMessage ?? null)
    let bestMatch: { anchor: string; score: number } | null = null

    for (const item of candidates) {
        for (const attempt of item.attemptDetails) {
            if (typeof input.failureStepAttempt === 'number' && attempt.attempt !== input.failureStepAttempt) {
                continue
            }

            for (const [stepIndex, step] of attempt.steps.entries()) {
                if (normalizeAnchorLookupValue(step.title) !== normalizedTarget) {
                    continue
                }

                let score = 1

                if (typeof input.failureStepOffsetMs === 'number' && step.offsetMs === input.failureStepOffsetMs) {
                    score += 16
                }

                if (normalizedCategory && normalizeAnchorLookupValue(step.category) === normalizedCategory) {
                    score += 8
                }

                if (normalizedErrorMessage && normalizeAnchorLookupValue(step.errorMessage) === normalizedErrorMessage) {
                    score += 12
                }

                if (typeof input.failureStepAttempt === 'number' && attempt.attempt === input.failureStepAttempt) {
                    score += 10
                }

                if (typeof input.failureStepRunId === 'string' && item.runId === input.failureStepRunId) {
                    score += 10
                }

                const anchor = buildStepAnchor(item.runId, attempt.attempt, stepIndex)

                if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { anchor, score }
                }
            }
        }
    }

    return bestMatch?.anchor ?? null
}

export function getAttachmentReference(attachment: TestHistoryAttachment): string {
    return attachment.path ?? attachment.url ?? attachment.name
}

export function buildAttachmentHref(runId: string, attachment: TestHistoryAttachment, artifactBasePath: string): string | null {
    if (attachment.url) {
        return attachment.url
    }

    if (!artifactBasePath || !attachment.path) {
        return null
    }

    const normalizedRunId = normalizeArtifactRunDirectory(runId)
    const normalizedPath = attachment.path.replace(/\\/g, '/').replace(/^\/+/, '')

    if (normalizedPath.includes('..') || /^(?:[a-z][a-z0-9+.-]*:|[a-z]:\/)/i.test(normalizedPath)) {
        return null
    }

    const resolvedArtifactPath = normalizedPath.startsWith(`${normalizedRunId}/`)
        ? normalizedPath
        : `${normalizedRunId}/${normalizedPath}`

    return `${artifactBasePath}/${encodeURIComponent(runId)}?path=${encodeURIComponent(resolvedArtifactPath)}`
}

export function isImageAttachment(attachment: TestHistoryAttachment): boolean {
    const contentType = attachment.contentType?.toLowerCase() ?? ''

    if (contentType.startsWith('image/')) {
        return true
    }

    return /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(getAttachmentReference(attachment))
}

export function isMarkdownAttachment(attachment: TestHistoryAttachment): boolean {
    const contentType = attachment.contentType?.toLowerCase() ?? ''

    if (contentType.includes('markdown')) {
        return true
    }

    return /\.(md|markdown|mdx)$/i.test(getAttachmentReference(attachment))
}

export function canInlineMarkdownPreview(href: string): boolean {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
        return true
    }

    if (typeof window === 'undefined') {
        return false
    }

    try {
        return new URL(href, window.location.href).origin === window.location.origin
    } catch {
        return false
    }
}

function normalizeArtifactRunDirectory(runId: string): string {
    return runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'run'
}