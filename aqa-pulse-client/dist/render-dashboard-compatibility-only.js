"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderCompatibilityPlaceholderPanel = renderCompatibilityPlaceholderPanel;
/**
 * Назначение: compatibility-only HTML helpers для deprecated dashboard sections, которые уже не являются источником UI-логики для React runtime.
 */
const text_utils_1 = require("./shared/text-utils");
function renderCompatibilityPlaceholderPanel(title, description, metrics) {
    return `
        <div class="placeholder-card">
            <div class="placeholder-title">${(0, text_utils_1.escapeHtml)(title)}</div>
            <div class="muted">${(0, text_utils_1.escapeHtml)(description)}</div>
            <ul class="placeholder-list">
                ${metrics.map((metric) => `<li>${(0, text_utils_1.escapeHtml)(metric)}</li>`).join('')}
            </ul>
        </div>
    `;
}
