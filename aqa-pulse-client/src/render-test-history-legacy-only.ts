/**
 * Назначение: legacy-only HTML helpers для compatibility test-history attachments, lightbox preview и nested diagnostics steps.
 */
import type { TestHistoryResponse } from './api-store'
import { formatStatusLabel } from './shared/dashboard-helpers'
import { formatDuration } from './shared/formatting'
import { ru } from './shared/i18n/ru'
import {
    buildDiagnosticStepTree,
    buildAttachmentHref as buildSharedAttachmentHref,
    buildStepAnchor as buildSharedStepAnchor,
    canInlineMarkdownPreview as canInlineSharedMarkdownPreview,
    isImageAttachment as isSharedImageAttachment,
    isMarkdownAttachment as isSharedMarkdownAttachment,
} from './shared/test-history-helpers'
import { escapeHtml } from './shared/text-utils'

const HISTORY_TEXT = ru.testHistory

export function renderLegacyAttemptSteps(
    runId: string,
    attemptNumber: number,
    steps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'],
    isOpenByDefault: boolean,
): string {
    const tree = buildDiagnosticStepTree(steps)

    return `
        <details class="attempt-step-group"${isOpenByDefault ? ' open' : ''}>
            <summary class="attempt-step-summary">
                <span class="attempt-section-title" style="margin: 0;">${escapeHtml(HISTORY_TEXT.diagnostics.stepsTitle)}</span>
                <span class="meta-badge">${steps.length}</span>
            </summary>
            <div class="attempt-step-body">
                <div class="step-tree">
                    ${tree.map((node) => renderLegacyStepNode(runId, attemptNumber, node)).join('')}
                </div>
            </div>
        </details>
    `
}

export function renderLegacyAttachmentDetail(
    runId: string,
    attachment: TestHistoryResponse['history'][number]['attemptDetails'][number]['attachments'][number],
    artifactBasePath: string,
): string {
    const href = buildSharedAttachmentHref(runId, attachment, artifactBasePath)
    const location = attachment.url ?? attachment.path ?? HISTORY_TEXT.diagnostics.attachmentLocationMissing
    const imagePreviewHtml = href && isSharedImageAttachment(attachment)
        ? `
            <details class="attachment-preview">
                <summary class="attachment-preview-summary">${escapeHtml(HISTORY_TEXT.diagnostics.inlineImagePreview)}</summary>
                <div class="attachment-preview-body">
                    <button
                        type="button"
                        class="attachment-image-trigger"
                        data-image-lightbox-trigger
                        data-image-lightbox-src="${escapeHtml(href)}"
                        data-image-lightbox-title="${escapeHtml(attachment.name)}"
                        aria-label="${escapeHtml(HISTORY_TEXT.diagnostics.expandImageHint)}"
                    >
                        <img class="attachment-image-preview" src="${escapeHtml(href)}" alt="${escapeHtml(attachment.name)}" loading="lazy">
                    </button>
                    <div class="attachment-image-hint">${escapeHtml(HISTORY_TEXT.diagnostics.expandImageHint)}</div>
                </div>
            </details>
        `
        : ''
    const markdownPreviewHtml = href && isSharedMarkdownAttachment(attachment) && canInlineSharedMarkdownPreview(href)
        ? `
            <details class="attachment-preview" data-markdown-preview data-preview-href="${escapeHtml(href)}">
                <summary class="attachment-preview-summary">${escapeHtml(HISTORY_TEXT.diagnostics.inlineMarkdownPreview)}</summary>
                <div class="attachment-preview-body">
                    <div class="attachment-preview-loading" data-markdown-loading>${escapeHtml(HISTORY_TEXT.diagnostics.loadingMarkdownPreview)}</div>
                    <pre class="attachment-markdown-preview" data-markdown-content hidden></pre>
                    <div class="attachment-preview-error" data-markdown-error hidden>${escapeHtml(HISTORY_TEXT.diagnostics.markdownPreviewUnavailable)}</div>
                </div>
            </details>
        `
        : ''

    return `
        <div class="attachment-item">
            <div class="attachment-item-header">
                <div class="attachment-title">${renderLegacyOverflowText(attachment.name, { className: 'attachment-title-text' })}</div>
                ${attachment.contentType ? `<span class="meta-badge">${escapeHtml(attachment.contentType)}</span>` : ''}
            </div>
            <div class="mono">${renderLegacyOverflowText(location, { className: 'attachment-location-text mono' })}</div>
            ${href ? `<div class="attachment-actions"><a class="attachment-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(HISTORY_TEXT.diagnostics.openAttachment)}</a></div>` : ''}
            ${imagePreviewHtml}
            ${markdownPreviewHtml}
        </div>
    `
}

function renderLegacyStepNode(
    runId: string,
    attemptNumber: number,
    node: ReturnType<typeof buildDiagnosticStepTree>[number],
): string {
    const statusBadge = node.step.status
        ? `<span class="status-badge ${getLegacyStatusClass(node.step.status, false)}">${escapeHtml(formatStatusLabel(node.step.status, false))}</span>`
        : ''
    const failureBadge = node.step.isFailurePoint
        ? `<span class="meta-badge">${escapeHtml(HISTORY_TEXT.diagnostics.failedStepBadge)}</span>`
        : ''
    const stepAnchor = buildSharedStepAnchor(runId, attemptNumber, node.stepIndex)
    const stepMeta = `${node.step.category ?? HISTORY_TEXT.diagnostics.noCategory} • depth ${node.step.depth}`

    return `
        <div class="step-tree-node">
            <div id="${escapeHtml(stepAnchor)}" class="step-item${node.step.isFailurePoint ? ' step-item-failure' : ''}${node.step.depth === 2 ? ' step-item-nested' : ''}">
                <div class="step-item-header">
                    <div class="step-title">${renderLegacyOverflowText(node.step.title, { className: 'step-title-text' })}</div>
                    <div class="attempt-meta">
                        ${statusBadge}
                        <span class="meta-badge">${escapeHtml(formatDuration(node.step.durationMs))}</span>
                    </div>
                </div>
                <div class="muted step-meta-copy">${escapeHtml(stepMeta)}</div>
                ${(failureBadge || node.step.errorMessage) ? `
                    <div class="step-meta-row">
                        ${failureBadge}
                    </div>
                ` : ''}
                ${node.step.errorMessage ? `<div class="step-error mono">${escapeHtml(node.step.errorMessage)}</div>` : ''}
            </div>
            ${node.children.length > 0 ? `<div class="step-tree-children">${node.children.map((childNode) => renderLegacyStepNode(runId, attemptNumber, childNode)).join('')}</div>` : ''}
        </div>
    `
}

function renderLegacyOverflowText(
    value: string | null | undefined,
    options: {
        className?: string
        displayValue?: string
    } = {},
): string {
    const fullValue = typeof value === 'string' && value.length > 0 ? value : '—'
    const displayValue = options.displayValue ?? fullValue
    const className = ['overflow-text', options.className].filter(Boolean).join(' ')

    return `<span class="${escapeHtml(className)}" title="${escapeHtml(fullValue)}">${escapeHtml(displayValue)}</span>`
}

function getLegacyStatusClass(status: string, flaky: boolean): string {
    if (flaky) {
        return 'status-flaky'
    }

    if (status === 'failed' || status === 'timedout' || status === 'interrupted') {
        return 'status-failed'
    }

    if (status === 'passed') {
        return 'status-passed'
    }

    if (status === 'skipped') {
        return 'status-skipped'
    }

    return 'status-unknown'
}