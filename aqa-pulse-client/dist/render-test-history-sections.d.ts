/**
 * Назначение: общие HTML-секции deprecated test-history renderer, кроме compatibility-only attachment/lightbox и nested-step helpers.
 */
import type { TestHistoryResponse } from './api-store';
/**
 * Сворачивает последний инцидент в одну обзорную карточку, чтобы оператору не приходилось вручную собирать картину из timeline и diagnostics.
 */
export declare function renderIncidentSummary(incidentSummary: TestHistoryResponse['incidentSummary'], history: TestHistoryResponse['history']): string;
export declare function renderIncidentNarrative(summary: string): string;
export declare function renderIncidentInsights(incidentSummary: NonNullable<TestHistoryResponse['incidentSummary']>, failureStepAnchor: string | null): string;
export declare function renderTestHistoryRow(item: TestHistoryResponse['history'][number]): string;
export declare function renderLatestUnstableEvent(history: TestHistoryResponse['history']): string;
export declare function renderPreviousUnstableEvents(history: TestHistoryResponse['history']): string;
export declare function renderPreviousUnstableEventItem(item: TestHistoryResponse['history'][number]): string;
export declare function renderLatestStableRecovery(history: TestHistoryResponse['history']): string;
export declare function renderCurrentStabilityStreak(history: TestHistoryResponse['history']): string;
export declare function renderUnstableStreakBeforeRecovery(history: TestHistoryResponse['history']): string;
export declare function renderAttemptDiagnostics(history: TestHistoryResponse['history'], artifactBasePath: string): string;
/**
 * Карточка diagnostics намеренно рендерит и последний запуск, и последний нестабильный эпизод, чтобы можно было сравнить текущее состояние с последним плохим run без просмотра всей истории.
 */
export declare function renderAttemptDiagnosticsCard(item: TestHistoryResponse['history'][number], title: string, description: string, artifactBasePath: string): string;
export declare function renderAttemptDetail(runId: string, attempt: TestHistoryResponse['history'][number]['attemptDetails'][number], isOpenByDefault: boolean, artifactBasePath: string): string;
export declare function renderOverflowText(value: string | null | undefined, options?: {
    className?: string;
    displayValue?: string;
}): string;
/**
 * Incident summary ссылается на шаг падения по title, поэтому поиск нормализует и payload, и шаги в рендере, чтобы anchor не ломался из-за регистра или пробелов.
 */
export declare function findIncidentStepAnchor(history: TestHistoryResponse['history'], failureStepTitle: string | null): string | null;
export declare function normalizeAnchorLookupValue(value: string | null | undefined): string | null;
export declare function findLatestStableRecovery(history: TestHistoryResponse['history']): {
    recovery: TestHistoryResponse['history'][number];
    previousUnstable: TestHistoryResponse['history'][number];
} | null;
export declare function findCurrentStabilityStreak(history: TestHistoryResponse['history']): {
    count: number;
    latestStable: TestHistoryResponse['history'][number] | null;
    oldestStable: TestHistoryResponse['history'][number] | null;
    previousUnstable: TestHistoryResponse['history'][number] | null;
};
export declare function findUnstableStreakBeforeRecovery(history: TestHistoryResponse['history']): {
    count: number;
    recovery: TestHistoryResponse['history'][number];
    latestUnstable: TestHistoryResponse['history'][number];
    oldestUnstable: TestHistoryResponse['history'][number];
} | null;
export declare function isStableHistoryItem(item: TestHistoryResponse['history'][number]): boolean;
export declare function getUnstableHistoryItems(history: TestHistoryResponse['history']): TestHistoryResponse['history'];
export declare function getUnstableEventLabel(item: TestHistoryResponse['history'][number]): string;
export declare function formatCurrentStabilityDescription(streak: ReturnType<typeof findCurrentStabilityStreak>): string;
export declare function isUnstableHistoryItem(item: TestHistoryResponse['history'][number]): boolean;
export declare function renderStatePage(options: {
    title: string;
    heading: string;
    statusCode: string;
    toneClass: string;
    message: string;
    filters: {
        branch: string | null;
        project: string | null;
        file: string | null;
    };
    basePath: string;
    apiBasePath: string;
    extraContent?: string;
}): string;
export declare function buildDashboardHref(filters: {
    branch?: string | null;
    project?: string | null;
    file?: string | null;
}, basePath: string): string;
export declare function buildTestHistoryHref(title: string, filters: {
    branch?: string | null;
    project?: string | null;
    file?: string | null;
}, basePath: string): string;
export declare function buildApiTestHistoryHref(title: string, filters: {
    branch?: string | null;
    project?: string | null;
    file?: string | null;
}, basePath: string): string;
export declare function buildQueryString(filters: {
    branch?: string | null;
    project?: string | null;
    file?: string | null;
}): string;
export declare function normalizeOptionalFilter(value: string | undefined): string | null;
export declare function normalizeBasePath(value: string | undefined): string;
export declare function getStatusClass(status: string, flaky: boolean): string;
export declare function getIncidentStatusClass(severity: 'active' | 'monitoring' | 'resolved'): string;
export declare function formatStatusLabel(status: string, flaky: boolean): string;
export declare function formatNullableNumber(value: number | null): string;
export declare function formatNullableDays(value: number | null): string;
export declare function formatCommit(commit: string | null): string;
export declare function buildHistoryRowAnchor(runId: string): string;
export declare function formatRunsLabel(count: number): string;
export declare function getRunWord(count: number): string;
export declare function formatTemplate(template: string, values: Record<string, string>): string;
