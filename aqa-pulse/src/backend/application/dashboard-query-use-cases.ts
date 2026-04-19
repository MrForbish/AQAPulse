/**
 * Назначение файла: содержит сценарии чтения данных для дашборда,
 * списка прогонов и истории отдельных тестов.
 */
import type { ApiFilters, ApiStore, DashboardRunResponse, TestHistoryConflict, TestHistoryResponse } from '../../api-store'

type DashboardQueryStore = Pick<ApiStore,
    | 'getFilteredSummary'
    | 'getRuns'
    | 'getRunById'
    | 'getFlakyPayload'
    | 'getErrorClustersPayload'
    | 'getCostMetricsPayload'
    | 'getTestHistory'
>

export function queryDashboardSummary(store: DashboardQueryStore, filters: ApiFilters) {
    return store.getFilteredSummary(filters)
}

export function queryDashboardRuns(store: DashboardQueryStore, filters: ApiFilters) {
    return { runs: store.getRuns(filters) }
}

export function queryDashboardRunById(
    store: DashboardQueryStore,
    runId: string,
): { statusCode: 200; body: DashboardRunResponse } | { statusCode: 404; body: { error: string } } {
    const run = store.getRunById(runId)

    if (!run) {
        return {
            statusCode: 404,
            body: { error: `Прогон с id "${runId}" не найден.` },
        }
    }

    return {
        statusCode: 200,
        body: run,
    }
}

export function queryDashboardFlakyPayload(store: DashboardQueryStore, filters: ApiFilters) {
    return store.getFlakyPayload(filters)
}

export function queryDashboardErrorClustersPayload(store: DashboardQueryStore, filters: ApiFilters) {
    return store.getErrorClustersPayload(filters)
}

export function queryDashboardCostMetricsPayload(store: DashboardQueryStore, filters: ApiFilters) {
    return store.getCostMetricsPayload(filters)
}

/**
 * Возвращает ответ для HTML-страницы истории теста,
 * сохраняя различие между отсутствием данных и неоднозначным совпадением.
 */
export function queryTestHistoryForShell(
    store: DashboardQueryStore,
    testName: string,
    filters: ApiFilters,
): { payload: TestHistoryResponse | TestHistoryConflict | null; statusCode: number } {
    const payload = store.getTestHistory(testName, filters)

    return {
        payload,
        statusCode: getTestHistoryStatusCode(payload),
    }
}

/**
 * Возвращает ответ API для истории теста с явным кодом статуса,
 * если данные не найдены или найдено несколько возможных совпадений.
 */
export function queryTestHistoryForApi(
    store: DashboardQueryStore,
    testName: string,
    filters: ApiFilters,
): { statusCode: 200 | 404 | 409; body: TestHistoryResponse | TestHistoryConflict | { error: string } } {
    const payload = store.getTestHistory(testName, filters)

    if (!payload) {
        return {
            statusCode: 404,
            body: { error: `Тест с именем "${testName}" не найден в архивной истории.` },
        }
    }

    if ('candidates' in payload) {
        return {
            statusCode: 409,
            body: payload,
        }
    }

    return {
        statusCode: 200,
        body: payload,
    }
}

function getTestHistoryStatusCode(payload: TestHistoryResponse | TestHistoryConflict | null): number {
    if (!payload) {
        return 404
    }

    if ('candidates' in payload) {
        return 409
    }

    return 200
}