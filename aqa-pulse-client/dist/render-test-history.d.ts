import type { TestHistoryConflict, TestHistoryResponse } from './api-store';
interface HistoryPageFilters {
    branch?: string;
    project?: string;
    file?: string;
}
interface HistoryPageOptions {
    basePath?: string;
    apiBasePath?: string;
    artifactBasePath?: string;
}
export declare function renderTestHistoryHtml(payload: TestHistoryResponse | TestHistoryConflict | null, requestedTitle: string, filters?: HistoryPageFilters, options?: HistoryPageOptions): string;
export {};
