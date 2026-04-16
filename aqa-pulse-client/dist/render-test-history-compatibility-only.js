"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderCompatibilityAttemptSteps = renderCompatibilityAttemptSteps;
exports.renderCompatibilityAttachmentDetail = renderCompatibilityAttachmentDetail;
const dashboard_helpers_1 = require("./shared/dashboard-helpers");
const formatting_1 = require("./shared/formatting");
const ru_1 = require("./shared/i18n/ru");
const test_history_helpers_1 = require("./shared/test-history-helpers");
const text_utils_1 = require("./shared/text-utils");
const HISTORY_TEXT = ru_1.ru.testHistory;
function renderCompatibilityAttemptSteps(runId, attemptNumber, steps, isOpenByDefault) {
    const tree = (0, test_history_helpers_1.buildDiagnosticStepTree)(steps);
    return `
        <details class="attempt-step-group"${isOpenByDefault ? ' open' : ''}>
            <summary class="attempt-step-summary">
                <span class="attempt-section-title" style="margin: 0;">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.stepsTitle)}</span>
                <span class="meta-badge">${steps.length}</span>
            </summary>
            <div class="attempt-step-body">
                <div class="step-tree">
                    ${tree.map((node) => renderCompatibilityStepNode(runId, attemptNumber, node)).join('')}
                </div>
            </div>
        </details>
    `;
}
function renderCompatibilityAttachmentDetail(runId, attachment, artifactBasePath) {
    const href = (0, test_history_helpers_1.buildAttachmentHref)(runId, attachment, artifactBasePath);
    const location = attachment.url ?? attachment.path ?? HISTORY_TEXT.diagnostics.attachmentLocationMissing;
    const imagePreviewHtml = href && (0, test_history_helpers_1.isImageAttachment)(attachment)
        ? `
            <details class="attachment-preview">
                <summary class="attachment-preview-summary">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.inlineImagePreview)}</summary>
                <div class="attachment-preview-body">
                    <button
                        type="button"
                        class="attachment-image-trigger"
                        data-image-lightbox-trigger
                        data-image-lightbox-src="${(0, text_utils_1.escapeHtml)(href)}"
                        data-image-lightbox-title="${(0, text_utils_1.escapeHtml)(attachment.name)}"
                        aria-label="${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.expandImageHint)}"
                    >
                        <img class="attachment-image-preview" src="${(0, text_utils_1.escapeHtml)(href)}" alt="${(0, text_utils_1.escapeHtml)(attachment.name)}" loading="lazy">
                    </button>
                    <div class="attachment-image-hint">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.expandImageHint)}</div>
                </div>
            </details>
        `
        : '';
    const markdownPreviewHtml = href && (0, test_history_helpers_1.isMarkdownAttachment)(attachment) && (0, test_history_helpers_1.canInlineMarkdownPreview)(href)
        ? `
            <details class="attachment-preview" data-markdown-preview data-preview-href="${(0, text_utils_1.escapeHtml)(href)}">
                <summary class="attachment-preview-summary">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.inlineMarkdownPreview)}</summary>
                <div class="attachment-preview-body">
                    <div class="attachment-preview-loading" data-markdown-loading>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.loadingMarkdownPreview)}</div>
                    <pre class="attachment-markdown-preview" data-markdown-content hidden></pre>
                    <div class="attachment-preview-error" data-markdown-error hidden>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.markdownPreviewUnavailable)}</div>
                </div>
            </details>
        `
        : '';
    return `
        <div class="attachment-item">
            <div class="attachment-item-header">
                <div class="attachment-title">${renderCompatibilityOverflowText(attachment.name, { className: 'attachment-title-text' })}</div>
                ${attachment.contentType ? `<span class="meta-badge">${(0, text_utils_1.escapeHtml)(attachment.contentType)}</span>` : ''}
            </div>
            <div class="mono">${renderCompatibilityOverflowText(location, { className: 'attachment-location-text mono' })}</div>
            ${href ? `<div class="attachment-actions"><a class="attachment-link" href="${(0, text_utils_1.escapeHtml)(href)}" target="_blank" rel="noreferrer">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.openAttachment)}</a></div>` : ''}
            ${imagePreviewHtml}
            ${markdownPreviewHtml}
        </div>
    `;
}
function renderCompatibilityStepNode(runId, attemptNumber, node) {
    const statusBadge = node.step.status
        ? `<span class="status-badge ${getCompatibilityStatusClass(node.step.status, false)}">${(0, text_utils_1.escapeHtml)((0, dashboard_helpers_1.formatStatusLabel)(node.step.status, false))}</span>`
        : '';
    const failureBadge = node.step.isFailurePoint
        ? `<span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.failedStepBadge)}</span>`
        : '';
    const stepAnchor = (0, test_history_helpers_1.buildStepAnchor)(runId, attemptNumber, node.stepIndex);
    const stepMeta = `${node.step.category ?? HISTORY_TEXT.diagnostics.noCategory} • depth ${node.step.depth}`;
    return `
        <div class="step-tree-node">
            <div id="${(0, text_utils_1.escapeHtml)(stepAnchor)}" class="step-item${node.step.isFailurePoint ? ' step-item-failure' : ''}${node.step.depth === 2 ? ' step-item-nested' : ''}">
                <div class="step-item-header">
                    <div class="step-title">${renderCompatibilityOverflowText(node.step.title, { className: 'step-title-text' })}</div>
                    <div class="attempt-meta">
                        ${statusBadge}
                        <span class="meta-badge">${(0, text_utils_1.escapeHtml)((0, formatting_1.formatDuration)(node.step.durationMs))}</span>
                    </div>
                </div>
                <div class="muted step-meta-copy">${(0, text_utils_1.escapeHtml)(stepMeta)}</div>
                ${(failureBadge || node.step.errorMessage) ? `
                    <div class="step-meta-row">
                        ${failureBadge}
                    </div>
                ` : ''}
                ${node.step.errorMessage ? `<div class="step-error mono">${(0, text_utils_1.escapeHtml)(node.step.errorMessage)}</div>` : ''}
            </div>
            ${node.children.length > 0 ? `<div class="step-tree-children">${node.children.map((childNode) => renderCompatibilityStepNode(runId, attemptNumber, childNode)).join('')}</div>` : ''}
        </div>
    `;
}
function renderCompatibilityOverflowText(value, options = {}) {
    const fullValue = typeof value === 'string' && value.length > 0 ? value : '—';
    const displayValue = options.displayValue ?? fullValue;
    const className = ['overflow-text', options.className].filter(Boolean).join(' ');
    return `<span class="${(0, text_utils_1.escapeHtml)(className)}" title="${(0, text_utils_1.escapeHtml)(fullValue)}">${(0, text_utils_1.escapeHtml)(displayValue)}</span>`;
}
function getCompatibilityStatusClass(status, flaky) {
    if (flaky) {
        return 'status-flaky';
    }
    if (status === 'failed' || status === 'timedout' || status === 'interrupted') {
        return 'status-failed';
    }
    if (status === 'passed') {
        return 'status-passed';
    }
    if (status === 'skipped') {
        return 'status-skipped';
    }
    return 'status-unknown';
}
