import type { TestHistoryConflict, TestHistoryResponse } from './api-store';
interface HistoryPageFilters {
    branch?: string;
    project?: string;
    file?: string;
}
export declare function renderTestHistoryHtml(payload: TestHistoryResponse | TestHistoryConflict | null, requestedTitle: string, filters?: HistoryPageFilters): string;
export {};
