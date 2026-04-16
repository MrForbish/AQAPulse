"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHistoryRowAnchor = buildHistoryRowAnchor;
exports.formatRunsLabel = formatRunsLabel;
exports.getRunWord = getRunWord;
exports.formatTemplate = formatTemplate;
exports.isStableHistoryItem = isStableHistoryItem;
exports.isUnstableHistoryItem = isUnstableHistoryItem;
exports.getUnstableHistoryItems = getUnstableHistoryItems;
exports.getUnstableEventLabel = getUnstableEventLabel;
exports.findLatestStableRecovery = findLatestStableRecovery;
exports.findCurrentStabilityStreak = findCurrentStabilityStreak;
exports.findUnstableStreakBeforeRecovery = findUnstableStreakBeforeRecovery;
exports.formatCurrentStabilityDescription = formatCurrentStabilityDescription;
exports.normalizeAnchorLookupValue = normalizeAnchorLookupValue;
exports.buildStepAnchor = buildStepAnchor;
exports.buildDiagnosticStepTree = buildDiagnosticStepTree;
exports.findIncidentStepAnchor = findIncidentStepAnchor;
exports.getAttachmentReference = getAttachmentReference;
exports.buildAttachmentHref = buildAttachmentHref;
exports.isImageAttachment = isImageAttachment;
exports.isMarkdownAttachment = isMarkdownAttachment;
exports.canInlineMarkdownPreview = canInlineMarkdownPreview;
const dashboard_helpers_1 = require("./dashboard-helpers");
const ru_1 = require("./i18n/ru");
const HISTORY_TEXT = ru_1.ru.testHistory;
function buildHistoryRowAnchor(runId) {
    const normalizedId = runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalizedId.length > 0 ? `history-row-${normalizedId}` : 'history-row-run';
}
function formatRunsLabel(count) {
    return `${count} ${getRunWord(count)}`;
}
function getRunWord(count) {
    const remainder100 = count % 100;
    const remainder10 = count % 10;
    if (remainder100 >= 11 && remainder100 <= 14) {
        return 'прогонов';
    }
    if (remainder10 === 1) {
        return 'прогон';
    }
    if (remainder10 >= 2 && remainder10 <= 4) {
        return 'прогона';
    }
    return 'прогонов';
}
function formatTemplate(template, values) {
    return Object.entries(values).reduce((result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value), template);
}
function isStableHistoryItem(item) {
    return item.status === 'passed' && !item.flaky && !item.errorMessage;
}
function isUnstableHistoryItem(item) {
    return Boolean(item.errorMessage)
        || item.flaky
        || item.status === 'failed'
        || item.status === 'timedout'
        || item.status === 'interrupted';
}
function getUnstableHistoryItems(history) {
    return history.filter(isUnstableHistoryItem);
}
function getUnstableEventLabel(item) {
    if (item.errorMessage) {
        return HISTORY_TEXT.labels.error;
    }
    if (item.flaky) {
        return HISTORY_TEXT.labels.flaky;
    }
    return (0, dashboard_helpers_1.formatStatusLabel)(item.status, false);
}
function findLatestStableRecovery(history) {
    for (let index = 0; index < history.length - 1; index += 1) {
        const currentItem = history[index];
        const previousOlderItem = history[index + 1];
        if (isStableHistoryItem(currentItem) && isUnstableHistoryItem(previousOlderItem)) {
            return {
                recovery: currentItem,
                previousUnstable: previousOlderItem,
            };
        }
    }
    return null;
}
function findCurrentStabilityStreak(history) {
    if (history.length === 0) {
        return {
            count: 0,
            latestStable: null,
            oldestStable: null,
            previousUnstable: null,
        };
    }
    let count = 0;
    for (const item of history) {
        if (!isStableHistoryItem(item)) {
            break;
        }
        count += 1;
    }
    if (count === 0) {
        return {
            count: 0,
            latestStable: null,
            oldestStable: null,
            previousUnstable: history[0] ?? null,
        };
    }
    return {
        count,
        latestStable: history[0] ?? null,
        oldestStable: history[count - 1] ?? null,
        previousUnstable: history[count] ?? null,
    };
}
function findUnstableStreakBeforeRecovery(history) {
    const recoveryPair = findLatestStableRecovery(history);
    if (!recoveryPair) {
        return null;
    }
    const recoveryIndex = history.findIndex((item) => item.runId === recoveryPair.recovery.runId);
    if (recoveryIndex < 0 || recoveryIndex === history.length - 1) {
        return null;
    }
    const unstableItems = [];
    for (let index = recoveryIndex + 1; index < history.length; index += 1) {
        const currentItem = history[index];
        if (!isUnstableHistoryItem(currentItem)) {
            break;
        }
        unstableItems.push(currentItem);
    }
    if (unstableItems.length === 0) {
        return null;
    }
    return {
        count: unstableItems.length,
        recovery: recoveryPair.recovery,
        latestUnstable: unstableItems[0],
        oldestUnstable: unstableItems[unstableItems.length - 1],
    };
}
function formatCurrentStabilityDescription(streak) {
    if (streak.count === 0) {
        return HISTORY_TEXT.texts.streakNotStarted;
    }
    if (!streak.previousUnstable) {
        return formatTemplate(HISTORY_TEXT.texts.streakWholeHistory, { count: String(streak.count) });
    }
    return formatTemplate(HISTORY_TEXT.texts.streakAfterEvent, {
        count: String(streak.count),
        event: getUnstableEventLabel(streak.previousUnstable),
    });
}
function normalizeAnchorLookupValue(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
    return normalized.length > 0 ? normalized : null;
}
function buildStepAnchor(runId, attemptNumber, stepIndex) {
    const runSlug = runId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'run';
    return `step-${runSlug}-a${attemptNumber}-s${stepIndex + 1}`;
}
function buildDiagnosticStepTree(steps) {
    const roots = [];
    let currentDepthOneTestStep = null;
    steps.forEach((step, stepIndex) => {
        const node = {
            step,
            stepIndex,
            children: [],
        };
        if (step.depth === 2 && currentDepthOneTestStep) {
            currentDepthOneTestStep.children.push(node);
            return;
        }
        roots.push(node);
        currentDepthOneTestStep = step.category === 'test.step' && step.depth === 1 ? node : null;
    });
    return roots;
}
function findIncidentStepAnchor(history, failureStepTitle) {
    const normalizedTarget = normalizeAnchorLookupValue(failureStepTitle);
    if (!normalizedTarget) {
        return null;
    }
    const latestRun = history[0];
    const latestUnstable = getUnstableHistoryItems(history)[0];
    const candidates = [latestRun, latestUnstable].filter((item, index, collection) => Boolean(item) && collection.findIndex((candidate) => candidate?.runId === item?.runId) === index);
    for (const item of candidates) {
        for (const attempt of item.attemptDetails) {
            for (const [stepIndex, step] of attempt.steps.entries()) {
                if (normalizeAnchorLookupValue(step.title) === normalizedTarget) {
                    return buildStepAnchor(item.runId, attempt.attempt, stepIndex);
                }
            }
        }
    }
    return null;
}
function getAttachmentReference(attachment) {
    return attachment.path ?? attachment.url ?? attachment.name;
}
function buildAttachmentHref(runId, attachment, artifactBasePath) {
    if (attachment.url) {
        return attachment.url;
    }
    if (!artifactBasePath || !attachment.path) {
        return null;
    }
    const normalizedRunId = normalizeArtifactRunDirectory(runId);
    const normalizedPath = attachment.path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalizedPath.includes('..') || /^(?:[a-z][a-z0-9+.-]*:|[a-z]:\/)/i.test(normalizedPath)) {
        return null;
    }
    const resolvedArtifactPath = normalizedPath.startsWith(`${normalizedRunId}/`)
        ? normalizedPath
        : `${normalizedRunId}/${normalizedPath}`;
    return `${artifactBasePath}/${encodeURIComponent(runId)}?path=${encodeURIComponent(resolvedArtifactPath)}`;
}
function isImageAttachment(attachment) {
    const contentType = attachment.contentType?.toLowerCase() ?? '';
    if (contentType.startsWith('image/')) {
        return true;
    }
    return /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(getAttachmentReference(attachment));
}
function isMarkdownAttachment(attachment) {
    const contentType = attachment.contentType?.toLowerCase() ?? '';
    if (contentType.includes('markdown')) {
        return true;
    }
    return /\.(md|markdown|mdx)$/i.test(getAttachmentReference(attachment));
}
function canInlineMarkdownPreview(href) {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
        return true;
    }
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        return new URL(href, window.location.href).origin === window.location.origin;
    }
    catch {
        return false;
    }
}
function normalizeArtifactRunDirectory(runId) {
    return runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'run';
}
