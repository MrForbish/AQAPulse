"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTestHistoryHtml = renderTestHistoryHtml;
const render_metric_info_1 = require("./render-metric-info");
const formatting_1 = require("./shared/formatting");
const ru_1 = require("./shared/i18n/ru");
const text_utils_1 = require("./shared/text-utils");
const render_test_history_sections_1 = require("./render-test-history-sections");
const METRIC_DESCRIPTIONS = {
    totalRuns: 'Количество сохранённых прогонов, в которых найден именно этот тест с учётом текущих фильтров.',
    failedRuns: 'Количество прогонов, в которых тест завершился неуспешно: failed, timedout или interrupted.',
    flakyRuns: 'Количество прогонов, где тест был отмечен как flaky: падал на одной из попыток, но в итоге завершился успешно.',
    latestStatus: 'Финальный статус теста в самом свежем найденном прогоне.',
    passRate: 'Доля прогонов этого теста со статусом passed среди всех найденных запусков.',
    failRate: 'Доля прогонов этого теста с неуспешным результатом: failed, timedout или interrupted.',
    flakyScore: 'Сводная оценка нестабильности теста на шкале 0–100 с учётом fail rate, паттерна нестабильности и MTBF.',
    mtbf: 'Среднее время между нестабильными прогонами теста. Чем больше значение, тем реже тест становится нестабильным.',
    timeline: 'Хронологическая история прогонов теста с ключевыми метаданными, длительностью, повторами и ошибками.',
    archiveGaps: 'Список run id, для которых запись есть в history.json, но архив исходного data.json уже недоступен.',
    latestEvent: 'Самый свежий нестабильный эпизод для теста: последнее падение с текстом ошибки или последний flaky-прогон, если более свежей ошибки нет.',
    latestRecovery: 'Самый свежий стабильный прогон после нестабильной серии. Показывается только если после падения или flaky был зафиксирован чистый passed-run без flakiness.',
    previousUnstableEvents: 'Несколько предыдущих нестабильных эпизодов до самого свежего нестабильного прогона. Полезно для быстрого просмотра паттерна проблем без прокрутки всей таблицы.',
    currentStabilityStreak: 'Текущая серия подряд идущих стабильных прогонов от самого свежего запуска назад. Стабильным считается только passed-run без flakiness и без текста ошибки.',
    unstableStreakBeforeRecovery: 'Длина нестабильной серии непосредственно перед последним стабильным восстановлением. Помогает понять, какой по глубине был проблемный период до восстановления.',
};
const HISTORY_TEXT = ru_1.ru.testHistory;
function renderTestHistoryHtml(payload, requestedTitle, filters = {}, options = {}) {
    const normalizedFilters = {
        branch: (0, render_test_history_sections_1.normalizeOptionalFilter)(filters.branch),
        project: (0, render_test_history_sections_1.normalizeOptionalFilter)(filters.project),
        file: (0, render_test_history_sections_1.normalizeOptionalFilter)(filters.file),
    };
    const normalizedBasePath = (0, render_test_history_sections_1.normalizeBasePath)(options.basePath);
    const normalizedApiBasePath = (0, render_test_history_sections_1.normalizeBasePath)(options.apiBasePath);
    const normalizedArtifactBasePath = (0, render_test_history_sections_1.normalizeBasePath)(options.artifactBasePath);
    if (!payload) {
        return (0, render_test_history_sections_1.renderStatePage)({
            title: requestedTitle,
            heading: HISTORY_TEXT.statePages.notFound.heading,
            statusCode: '404',
            toneClass: 'status-failed',
            message: HISTORY_TEXT.statePages.notFound.message,
            filters: normalizedFilters,
            basePath: normalizedBasePath,
            apiBasePath: normalizedApiBasePath,
            extraContent: `<div class="muted">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.statePages.notFound.extra)}</div>`,
        });
    }
    if ('candidates' in payload) {
        const candidatesHtml = payload.candidates.length > 0
            ? payload.candidates.map((candidate) => `
                <div class="candidate-item">
                    <div><a class="test-link" href="${(0, text_utils_1.escapeHtml)((0, render_test_history_sections_1.buildTestHistoryHref)(candidate.title, {
                branch: normalizedFilters.branch,
                project: candidate.project,
                file: candidate.file,
            }, normalizedBasePath))}">${(0, render_test_history_sections_1.renderOverflowText)(candidate.title, { className: 'candidate-text' })}</a></div>
                    <div class="muted">${(0, render_test_history_sections_1.renderOverflowText)((0, render_test_history_sections_1.formatTemplate)(HISTORY_TEXT.candidatesMeta, {
                project: candidate.project,
                file: candidate.file,
            }), { className: 'candidate-text' })}</div>
                </div>
            `).join('')
            : `<div class="muted">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.statePages.conflict.candidatesEmpty)}</div>`;
        return (0, render_test_history_sections_1.renderStatePage)({
            title: requestedTitle,
            heading: HISTORY_TEXT.statePages.conflict.heading,
            statusCode: '409',
            toneClass: 'status-flaky',
            message: payload.message,
            filters: normalizedFilters,
            basePath: normalizedBasePath,
            apiBasePath: normalizedApiBasePath,
            extraContent: `<div class="candidate-list">${candidatesHtml}</div>`,
        });
    }
    const dashboardHref = (0, render_test_history_sections_1.buildDashboardHref)(normalizedFilters, normalizedBasePath);
    const apiHref = (0, render_test_history_sections_1.buildApiTestHistoryHref)(payload.test.title, {
        branch: normalizedFilters.branch,
        project: payload.test.project,
        file: payload.test.file,
    }, normalizedApiBasePath);
    const latestStatusClass = payload.latestRun ? (0, render_test_history_sections_1.getStatusClass)(payload.latestRun.status, payload.latestRun.flaky) : 'status-unknown';
    const incidentSummaryHtml = (0, render_test_history_sections_1.renderIncidentSummary)(payload.incidentSummary, payload.history);
    const latestUnstableEventHtml = (0, render_test_history_sections_1.renderLatestUnstableEvent)(payload.history);
    const previousUnstableEventsHtml = (0, render_test_history_sections_1.renderPreviousUnstableEvents)(payload.history);
    const latestStableRecoveryHtml = (0, render_test_history_sections_1.renderLatestStableRecovery)(payload.history);
    const currentStabilityStreakHtml = (0, render_test_history_sections_1.renderCurrentStabilityStreak)(payload.history);
    const unstableStreakBeforeRecoveryHtml = (0, render_test_history_sections_1.renderUnstableStreakBeforeRecovery)(payload.history);
    const attemptDiagnosticsHtml = (0, render_test_history_sections_1.renderAttemptDiagnostics)(payload.history, normalizedArtifactBasePath);
    const missingRunsHtml = payload.missingRuns.length > 0
        ? `<div class="notice-inline">${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.archiveGaps, METRIC_DESCRIPTIONS.archiveGaps, { className: 'inline-heading', tagName: 'div' })}<div class="mono">${(0, text_utils_1.escapeHtml)(payload.missingRuns.join(', '))}</div></div>`
        : '';
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${(0, text_utils_1.escapeHtml)(payload.test.title)} — ${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.titleSuffix)}</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='42' fill='%232f81f7'/%3E%3C/svg%3E">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
        * {
            scrollbar-width: thin;
            scrollbar-color: #3d444d #161b22;
        }
        *::-webkit-scrollbar {
            width: 12px;
            height: 12px;
        }
        *::-webkit-scrollbar-track {
            background: #161b22;
            border-radius: 999px;
        }
        *::-webkit-scrollbar-thumb {
            background: #3d444d;
            border: 2px solid #161b22;
            border-radius: 999px;
        }
        *::-webkit-scrollbar-thumb:hover {
            background: #57606a;
        }
        .page-shell { max-width: 1440px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
        .page-title { font-size: 30px; font-weight: 600; color: #ffffff; margin-bottom: 10px; }
        .page-title-text { max-width: min(100%, 920px); }
        .subtle { color: #8b949e; font-size: 13px; }
        .meta-badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #21262d; color: #c9d1d9; font-size: 12px; margin-right: 8px; margin-top: 8px; }
        .page-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .page-link { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 16px; border-radius: 6px; border: 1px solid #30363d; text-decoration: none; }
        .page-link-primary { background: #2f81f7; color: #ffffff; }
        .page-link-secondary { background: #21262d; color: #c9d1d9; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
        .summary-card, .table-container, .notice-inline { background: #161b22; border: 1px solid #30363d; border-radius: 8px; }
        .summary-card { padding: 16px; }
        .summary-value { font-size: 28px; font-weight: 600; color: #ffffff; margin: 8px 0; }
        .summary-subtitle { color: #8b949e; font-size: 12px; }
        .event-card { padding: 16px; margin-bottom: 24px; }
        .event-card-error { border-color: rgba(248, 81, 73, 0.45); background: linear-gradient(180deg, rgba(248, 81, 73, 0.12) 0%, #161b22 100%); }
        .event-card-flaky { border-color: rgba(210, 153, 34, 0.45); background: linear-gradient(180deg, rgba(210, 153, 34, 0.12) 0%, #161b22 100%); }
        .event-card-recovery { border-color: rgba(63, 185, 80, 0.45); background: linear-gradient(180deg, rgba(63, 185, 80, 0.12) 0%, #161b22 100%); }
        .event-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
        .event-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .event-body { color: #c9d1d9; font-size: 13px; line-height: 1.5; }
        .incident-summary-stack { display: grid; gap: 10px; margin-bottom: 14px; }
        .incident-summary-lead {
            padding: 12px 14px;
            border-radius: 8px;
            border: 1px solid rgba(88, 166, 255, 0.2);
            background: rgba(88, 166, 255, 0.08);
            color: #ffffff;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.5;
        }
        .incident-summary-list {
            display: grid;
            gap: 8px;
            padding: 0;
            margin: 0;
            list-style: none;
        }
        .incident-summary-item {
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid #30363d;
            background: #0d1117;
            color: #c9d1d9;
            font-size: 13px;
            line-height: 1.5;
        }
        .event-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
        .event-link { color: #58a6ff; text-decoration: none; font-size: 12px; }
        .event-link:hover { text-decoration: underline; }
        .event-list { display: grid; gap: 10px; }
        .event-list-item { padding: 12px; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; }
        .event-list-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .event-list-description { color: #c9d1d9; font-size: 12px; line-height: 1.45; }
        .incident-card {
            --incident-accent-rgb: 88, 166, 255;
            --incident-accent-solid: #58a6ff;
            padding: 16px;
            margin-bottom: 24px;
            position: relative;
            overflow: hidden;
            background: linear-gradient(180deg, rgba(var(--incident-accent-rgb), 0.12) 0%, #161b22 100%);
        }
        .incident-card::before {
            content: '';
            position: absolute;
            inset: 0 auto 0 0;
            width: 4px;
            background: var(--incident-accent-solid);
        }
        .incident-card.is-active {
            --incident-accent-rgb: 248, 81, 73;
            --incident-accent-solid: #f85149;
            border-color: rgba(248, 81, 73, 0.42);
        }
        .incident-card.is-monitoring {
            --incident-accent-rgb: 210, 153, 34;
            --incident-accent-solid: #d29922;
            border-color: rgba(210, 153, 34, 0.42);
        }
        .incident-card.is-resolved {
            --incident-accent-rgb: 63, 185, 80;
            --incident-accent-solid: #3fb950;
            border-color: rgba(63, 185, 80, 0.42);
        }
        .incident-status-banner {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 12px;
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid rgba(var(--incident-accent-rgb), 0.26);
            background: rgba(var(--incident-accent-rgb), 0.1);
        }
        .incident-status-copy { display: grid; gap: 4px; }
        .incident-status-label {
            color: var(--incident-accent-solid);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .incident-status-text {
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            line-height: 1.45;
        }
        .incident-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
        .incident-kpi { padding: 12px; border-radius: 8px; border: 1px solid #30363d; background: rgba(13, 17, 23, 0.7); }
        .incident-card .incident-kpi { border-color: rgba(var(--incident-accent-rgb), 0.18); }
        .incident-kpi-label { color: #8b949e; font-size: 11px; margin-bottom: 6px; }
        .incident-kpi-value { color: #ffffff; font-size: 15px; font-weight: 600; line-height: 1.4; }
        .overflow-text { display: block; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .candidate-text { max-width: 100%; }
        .step-title-text, .attachment-title-text { max-width: 420px; }
        .attachment-location-text { max-width: 100%; }
        .incident-section-title {
            color: #c9d1d9;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.03em;
            margin: 0 0 10px;
        }
        .incident-insights-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
        .incident-insight-card {
            padding: 12px;
            border-radius: 10px;
            border: 1px solid rgba(var(--incident-accent-rgb), 0.2);
            background: rgba(13, 17, 23, 0.82);
            display: grid;
            gap: 8px;
        }
        .incident-insight-label {
            color: #8b949e;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }
        .incident-insight-value {
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            line-height: 1.45;
            word-break: break-word;
        }
        .incident-insight-action { margin-top: 4px; }
        .incident-insight-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: var(--incident-accent-solid);
            font-size: 12px;
            font-weight: 600;
            text-decoration: none;
        }
        .incident-insight-link:hover { text-decoration: underline; }
        .incident-insight-card.is-empty .incident-insight-value {
            color: #8b949e;
            font-weight: 500;
        }
        .incident-evidence-list { display: grid; gap: 8px; margin-top: 12px; }
        .incident-evidence-item {
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid rgba(var(--incident-accent-rgb), 0.18);
            background: #0d1117;
            color: #c9d1d9;
            font-size: 12px;
            line-height: 1.5;
        }
        .incident-message { margin-top: 12px; }
        .diagnostics-shell { display: grid; gap: 12px; margin-bottom: 24px; }
        .diagnostics-card { padding: 16px; }
        .diagnostics-card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .diagnostics-card-description { color: #8b949e; font-size: 12px; line-height: 1.5; margin-bottom: 14px; }
        .attempt-list { display: grid; gap: 10px; }
        .attempt-item { border-radius: 8px; border: 1px solid #30363d; background: #0d1117; overflow: hidden; }
        .attempt-item[open] { border-color: rgba(88, 166, 255, 0.32); }
        .attempt-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px; cursor: pointer; list-style: none; }
        .attempt-summary::-webkit-details-marker { display: none; }
        .attempt-summary-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .attempt-chevron { color: #8b949e; font-size: 11px; transition: transform 0.18s ease; }
        .attempt-item[open] .attempt-chevron { transform: rotate(90deg); }
        .attempt-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .attempt-title { font-size: 13px; font-weight: 600; color: #ffffff; }
        .attempt-meta { display: flex; flex-wrap: wrap; gap: 8px; }
        .attempt-body { padding: 0 12px 12px; max-height: min(640px, 70vh); overflow: auto; scrollbar-gutter: stable; border-top: 1px solid #21262d; }
        .attempt-section-title { color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin: 10px 0 6px; }
        .attempt-error { margin-top: 8px; }
        .attempt-explainer { color: #8b949e; font-size: 12px; line-height: 1.5; margin-bottom: 12px; }
        .attempt-step-group { margin-top: 10px; border: 1px solid #21262d; border-radius: 8px; background: #161b22; overflow: hidden; }
        .attempt-step-group[open] { border-color: rgba(88, 166, 255, 0.22); }
        .attempt-step-summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; cursor: pointer; list-style: none; }
        .attempt-step-summary::-webkit-details-marker { display: none; }
        .attempt-step-body { max-height: min(360px, 42vh); overflow: auto; padding: 0 10px 10px; scrollbar-gutter: stable; }
        .step-list, .attachment-list { display: grid; gap: 8px; }
        .step-item, .attachment-item { padding: 10px 12px; border-radius: 8px; background: #161b22; border: 1px solid #21262d; }
        .step-item.step-item-failure { border-color: rgba(248, 81, 73, 0.45); background: linear-gradient(180deg, rgba(248, 81, 73, 0.12) 0%, #161b22 100%); }
        .step-item-header, .attachment-item-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
        .step-title, .attachment-title { color: #ffffff; font-size: 12px; font-weight: 500; }
        .step-meta-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .step-error { margin-top: 8px; }
        .attachment-link { color: #58a6ff; text-decoration: none; font-size: 12px; }
        .attachment-link:hover { text-decoration: underline; }
        .attachment-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
        .attachment-preview { margin-top: 10px; border: 1px solid #30363d; border-radius: 8px; background: #0d1117; overflow: hidden; }
        .attachment-preview[open] { border-color: rgba(88, 166, 255, 0.28); }
        .attachment-preview-summary { padding: 10px 12px; cursor: pointer; list-style: none; color: #c9d1d9; font-size: 12px; font-weight: 500; }
        .attachment-preview-summary::-webkit-details-marker { display: none; }
        .attachment-preview-body { padding: 0 12px 12px; }
        .attachment-image-trigger {
            display: block;
            width: 100%;
            padding: 0;
            border: 0;
            background: transparent;
            cursor: zoom-in;
            text-align: left;
        }
        .attachment-image-trigger:focus-visible {
            outline: 2px solid #58a6ff;
            outline-offset: 4px;
            border-radius: 10px;
        }
        .attachment-image-preview {
            display: block;
            width: 100%;
            max-width: 100%;
            max-height: min(420px, 52vh);
            object-fit: contain;
            border-radius: 8px;
            border: 1px solid #21262d;
            background: #010409;
            transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }
        .attachment-image-trigger:hover .attachment-image-preview {
            border-color: rgba(88, 166, 255, 0.45);
            box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.18);
            transform: translateY(-1px);
        }
        .attachment-image-hint {
            margin-top: 8px;
            color: #8b949e;
            font-size: 11px;
            line-height: 1.4;
        }
        .attachment-markdown-preview { max-height: min(360px, 42vh); overflow: auto; padding: 12px; border-radius: 8px; border: 1px solid #21262d; background: #010409; color: #c9d1d9; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
        .attachment-preview-loading, .attachment-preview-error { padding: 10px 12px; border-radius: 8px; border: 1px solid #21262d; background: #010409; color: #8b949e; font-size: 12px; line-height: 1.5; }
        .image-lightbox[hidden] { display: none; }
        .image-lightbox {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .image-lightbox-backdrop {
            position: absolute;
            inset: 0;
            border: 0;
            background: rgba(1, 4, 9, 0.86);
            cursor: zoom-out;
        }
        .image-lightbox-dialog {
            position: relative;
            z-index: 1;
            width: min(96vw, 1480px);
            max-height: calc(100vh - 48px);
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: 12px;
            padding: 16px;
            border-radius: 16px;
            border: 1px solid #30363d;
            background: #0d1117;
            box-shadow: 0 28px 80px rgba(0, 0, 0, 0.5);
        }
        .image-lightbox-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
        }
        .image-lightbox-title {
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            line-height: 1.45;
            word-break: break-word;
        }
        .image-lightbox-close {
            flex: none;
            min-width: 40px;
            min-height: 40px;
            padding: 0 12px;
            border-radius: 999px;
            border: 1px solid #30363d;
            background: #161b22;
            color: #c9d1d9;
            cursor: pointer;
            font-size: 22px;
            line-height: 1;
        }
        .image-lightbox-close:hover { border-color: #58a6ff; color: #ffffff; }
        .image-lightbox-close:focus-visible {
            outline: 2px solid #58a6ff;
            outline-offset: 2px;
        }
        .image-lightbox-body {
            min-height: 0;
            overflow: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            scrollbar-gutter: stable;
        }
        .image-lightbox-image {
            display: block;
            max-width: 100%;
            max-height: calc(100vh - 170px);
            width: auto;
            height: auto;
            object-fit: contain;
            border-radius: 12px;
            border: 1px solid #21262d;
            background: #010409;
        }
        ${render_metric_info_1.METRIC_INFO_STYLES}
        .inline-heading { font-size: 13px; color: #ffffff; margin-bottom: 10px; }
        .notice-inline { padding: 14px 16px; margin-bottom: 24px; }
        .table-title { font-weight: 500; margin-bottom: 12px; color: #ffffff; font-size: 18px; }
        .table-container { padding: 8px; overflow-x: auto; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 16px; font-weight: 500; color: #8b949e; border-bottom: 1px solid #30363d; font-size: 13px; }
        td { padding: 12px 16px; border-bottom: 1px solid #21262d; font-size: 13px; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        .history-row:target td { background: rgba(47, 129, 247, 0.14); }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .status-failed { background: #da3633; color: #fff; }
        .status-flaky { background: #d29922; color: #000; }
        .status-passed { background: #1a7f37; color: #fff; }
        .status-skipped { background: #6e7681; color: #fff; }
        .status-unknown { background: #21262d; color: #fff; }
        .mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; color: #ff7b72; word-break: break-word; }
        .muted { color: #8b949e; font-size: 12px; }
        .test-link { color: #58a6ff; text-decoration: none; }
        .test-link:hover { text-decoration: underline; }
        .candidate-list { display: grid; gap: 12px; }
        .candidate-item { padding: 12px; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; }
        @media (max-width: 1100px) { .summary-grid, .incident-grid, .incident-insights-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 768px) { .summary-grid, .incident-grid, .incident-insights-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="page-shell">
        <div class="page-header">
            <div>
                <div class="subtle" style="margin-bottom: 12px;">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.headerEyebrow)}</div>
                <div class="page-title">${(0, render_test_history_sections_1.renderOverflowText)(payload.test.title, { className: 'page-title-text' })}</div>
                <div class="subtle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.headerDescription)}</div>
                <div>
                    <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.filters.project)}: ${(0, text_utils_1.escapeHtml)(payload.test.project)}</span>
                    <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.filters.file)}: ${(0, text_utils_1.escapeHtml)(payload.test.file)}</span>
                    <span class="meta-badge">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.filters.branch)}: ${(0, text_utils_1.escapeHtml)(normalizedFilters.branch ?? HISTORY_TEXT.filters.all)}</span>
                </div>
            </div>
            <div class="page-actions">
                <a class="page-link page-link-secondary" href="${(0, text_utils_1.escapeHtml)(dashboardHref)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.backToDashboard)}</a>
                <a class="page-link page-link-primary" href="${(0, text_utils_1.escapeHtml)(apiHref)}">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.openJson)}</a>
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.totalRuns, METRIC_DESCRIPTIONS.totalRuns, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${payload.summary.totalRuns}</div>
                <div class="summary-subtitle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.subtitles.totalRuns)}</div>
            </div>
            <div class="summary-card">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.failedRuns, METRIC_DESCRIPTIONS.failedRuns, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${payload.summary.failedRuns}</div>
                <div class="summary-subtitle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.subtitles.failedRuns)}</div>
            </div>
            <div class="summary-card">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.flakyRuns, METRIC_DESCRIPTIONS.flakyRuns, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${payload.summary.flakyRuns}</div>
                <div class="summary-subtitle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.subtitles.flakyRuns)}</div>
            </div>
            <div class="summary-card">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.latestStatus, METRIC_DESCRIPTIONS.latestStatus, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value"><span class="status-badge ${latestStatusClass}">${(0, text_utils_1.escapeHtml)((0, render_test_history_sections_1.formatStatusLabel)(payload.summary.latestStatus ?? 'unknown', payload.latestRun?.flaky ?? false))}</span></div>
                <div class="summary-subtitle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.subtitles.latestStatus)}</div>
            </div>
            <div class="summary-card">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.passRate, METRIC_DESCRIPTIONS.passRate, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${(0, text_utils_1.escapeHtml)((0, formatting_1.formatPercent)(payload.summary.passRate))}</div>
                <div class="summary-subtitle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.subtitles.passRate)}</div>
            </div>
            <div class="summary-card">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.failRate, METRIC_DESCRIPTIONS.failRate, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${(0, text_utils_1.escapeHtml)((0, formatting_1.formatPercent)(payload.summary.failRate))}</div>
                <div class="summary-subtitle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.subtitles.failRate)}</div>
            </div>
            <div class="summary-card">
                ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.flakyScore, METRIC_DESCRIPTIONS.flakyScore, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${(0, text_utils_1.escapeHtml)((0, render_test_history_sections_1.formatNullableNumber)(payload.summary.flakyScore))}</div>
                <div class="summary-subtitle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.subtitles.flakyScore)}</div>
            </div>
            <div class="summary-card">
                ${(0, render_metric_info_1.renderMetricHeading)('MTBF', METRIC_DESCRIPTIONS.mtbf, { className: 'subtle', tagName: 'div' })}
                <div class="summary-value">${(0, text_utils_1.escapeHtml)((0, render_test_history_sections_1.formatNullableDays)(payload.summary.mtbfDays))}</div>
                <div class="summary-subtitle">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.subtitles.mtbf)}</div>
            </div>
        </div>

        ${incidentSummaryHtml}

        ${attemptDiagnosticsHtml}

        ${latestUnstableEventHtml}

        ${previousUnstableEventsHtml}

        ${latestStableRecoveryHtml}

        ${currentStabilityStreakHtml}

        ${unstableStreakBeforeRecoveryHtml}

        ${missingRunsHtml}

        ${(0, render_metric_info_1.renderMetricHeading)(HISTORY_TEXT.metrics.timeline, METRIC_DESCRIPTIONS.timeline, { className: 'table-title', tagName: 'div' })}
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.time)}</th>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.branch)}</th>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.commit)}</th>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.author)}</th>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.status)}</th>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.flaky)}</th>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.duration)}</th>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.retries)}</th>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.attempts)}</th>
                        <th>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.error)}</th>
                    </tr>
                </thead>
                <tbody>
                    ${payload.history.length > 0
        ? payload.history.map(render_test_history_sections_1.renderTestHistoryRow).join('')
        : `<tr><td colspan="10">${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.tables.empty)}</td></tr>`}
                </tbody>
            </table>
        </div>
    </div>
    <div class="image-lightbox" data-image-lightbox hidden>
        <button type="button" class="image-lightbox-backdrop" data-image-lightbox-close aria-label="${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.closeImageLightbox)}"></button>
        <div class="image-lightbox-dialog" role="dialog" aria-modal="true" aria-label="${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.imageLightboxTitle)}">
            <div class="image-lightbox-header">
                <div class="image-lightbox-title" data-image-lightbox-title>${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.imageLightboxTitle)}</div>
                <button type="button" class="image-lightbox-close" data-image-lightbox-close aria-label="${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.closeImageLightbox)}">×</button>
            </div>
            <div class="image-lightbox-body">
                <img class="image-lightbox-image" data-image-lightbox-image alt="" loading="eager">
            </div>
        </div>
    </div>
    <script>
        (() => {
            const markdownPreviews = document.querySelectorAll('[data-markdown-preview]')
            const imageLightbox = document.querySelector('[data-image-lightbox]')
            const imageLightboxImage = imageLightbox?.querySelector('[data-image-lightbox-image]')
            const imageLightboxTitle = imageLightbox?.querySelector('[data-image-lightbox-title]')
            const imageLightboxCloseButton = imageLightbox?.querySelector('.image-lightbox-close')
            let previousActiveElement = null

            async function loadMarkdownPreview(container) {
                if (!(container instanceof HTMLElement)) {
                    return
                }

                const state = container.dataset.state
                if (state === 'loading' || state === 'loaded') {
                    return
                }

                const href = container.dataset.previewHref
                const content = container.querySelector('[data-markdown-content]')
                const loading = container.querySelector('[data-markdown-loading]')
                const error = container.querySelector('[data-markdown-error]')

                if (!(content instanceof HTMLElement) || !(loading instanceof HTMLElement) || !(error instanceof HTMLElement) || !href) {
                    return
                }

                container.dataset.state = 'loading'
                loading.hidden = false
                error.hidden = true

                try {
                    const response = await fetch(href, { credentials: 'same-origin' })

                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status)
                    }

                    const text = await response.text()
                    content.textContent = text
                    content.hidden = false
                    loading.hidden = true
                    error.hidden = true
                    container.dataset.state = 'loaded'
                } catch {
                    loading.hidden = true
                    error.hidden = false
                    container.dataset.state = 'error'
                }
            }

            markdownPreviews.forEach((preview) => {
                preview.addEventListener('toggle', () => {
                    if (preview instanceof HTMLDetailsElement && preview.open) {
                        void loadMarkdownPreview(preview)
                    }
                })
            })

            function openImageLightbox(src, title) {
                if (!(imageLightbox instanceof HTMLElement) || !(imageLightboxImage instanceof HTMLImageElement) || !(imageLightboxTitle instanceof HTMLElement) || !src) {
                    return
                }

                previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
                imageLightboxImage.src = src
                imageLightboxImage.alt = title || ''
                imageLightboxTitle.textContent = title || '${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.imageLightboxTitle)}'
                imageLightbox.hidden = false
                document.body.style.overflow = 'hidden'

                if (imageLightboxCloseButton instanceof HTMLElement) {
                    imageLightboxCloseButton.focus()
                }
            }

            function closeImageLightbox() {
                if (!(imageLightbox instanceof HTMLElement) || !(imageLightboxImage instanceof HTMLImageElement) || !(imageLightboxTitle instanceof HTMLElement)) {
                    return
                }

                if (imageLightbox.hidden) {
                    return
                }

                imageLightbox.hidden = true
                imageLightboxImage.removeAttribute('src')
                imageLightboxImage.alt = ''
                imageLightboxTitle.textContent = '${(0, text_utils_1.escapeHtml)(HISTORY_TEXT.diagnostics.imageLightboxTitle)}'
                document.body.style.overflow = ''

                if (previousActiveElement instanceof HTMLElement) {
                    previousActiveElement.focus()
                }

                previousActiveElement = null
            }

            document.addEventListener('click', (event) => {
                const eventTarget = event.target

                if (!(eventTarget instanceof Element)) {
                    return
                }

                const trigger = eventTarget.closest('[data-image-lightbox-trigger]')

                if (trigger instanceof HTMLElement) {
                    event.preventDefault()
                    openImageLightbox(trigger.dataset.imageLightboxSrc || '', trigger.dataset.imageLightboxTitle || '')
                    return
                }

                const closeTrigger = eventTarget.closest('[data-image-lightbox-close]')

                if (closeTrigger instanceof HTMLElement) {
                    event.preventDefault()
                    closeImageLightbox()
                }
            })

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    closeImageLightbox()
                }
            })

            function revealHashTarget() {
                const hash = window.location.hash

                if (!hash || hash.length < 2) {
                    return
                }

                const target = document.getElementById(hash.slice(1))

                if (!(target instanceof HTMLElement)) {
                    return
                }

                let parent = target.parentElement

                while (parent) {
                    if (parent instanceof HTMLDetailsElement) {
                        parent.open = true
                    }

                    parent = parent.parentElement
                }
            }

            revealHashTarget()
            window.addEventListener('hashchange', revealHashTarget)
        })()
    </script>
</body>
</html>`;
}
