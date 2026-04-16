/**
 * Назначение: legacy-only HTML helpers для compatibility dashboard sections, которые уже не являются источником UI-логики для React runtime.
 */
import { escapeHtml } from './shared/text-utils'

export function renderLegacyPlaceholderPanel(title: string, description: string, metrics: readonly string[]): string {
    return `
        <div class="placeholder-card">
            <div class="placeholder-title">${escapeHtml(title)}</div>
            <div class="muted">${escapeHtml(description)}</div>
            <ul class="placeholder-list">
                ${metrics.map((metric) => `<li>${escapeHtml(metric)}</li>`).join('')}
            </ul>
        </div>
    `
}