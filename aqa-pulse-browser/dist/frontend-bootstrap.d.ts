/**
 * Назначение: описывает bootstrap-контракт между HTML shell и React runtime для route, session и initial data.
 */
import type { TestHistoryConflict, TestHistoryResponse } from './api-store';
import type { WorkspaceDescriptor } from './backend/contracts';
import type { DashboardSummary } from './dashboard-utils';
export declare const FRONTEND_BOOTSTRAP_PLACEHOLDER = "__AQA_PULSE_BOOTSTRAP__";
export interface FrontendSessionStatus {
    scope: 'admin' | 'workspace' | 'public';
    authenticated: boolean;
    authRequired: boolean;
    workspaceSlug: string | null;
}
export type FrontendRouteDescriptor = {
    kind: 'dashboard';
    workspaceSlug: string | null;
} | {
    kind: 'test-history';
    workspaceSlug: string | null;
    testName: string;
} | {
    kind: 'admin-dashboard';
} | {
    kind: 'admin-login';
} | {
    kind: 'workspace-login';
    workspaceSlug: string;
} | {
    kind: 'workspace-api-key-exchange';
    workspaceSlug: string;
} | {
    kind: 'static-dashboard';
    workspaceSlug: null;
};
export interface FrontendBootstrapData {
    route: FrontendRouteDescriptor;
    initialRequestUrl: string;
    initialDashboardSummary: DashboardSummary | null;
    initialTestHistoryPayload: TestHistoryResponse | TestHistoryConflict | null;
    initialAdminWorkspaces: WorkspaceDescriptor[] | null;
    initialSessionStatus: FrontendSessionStatus | null;
}
/**
 * Возвращает безопасный bootstrap по умолчанию для случаев, когда shell ещё не встроил данные или bootstrap оказался повреждён.
 */
export declare function createEmptyFrontendBootstrap(): FrontendBootstrapData;
/**
 * Парсит bootstrap максимально терпимо: сломанный inline JSON не должен валить клиент, а должен откатывать runtime к пустому состоянию.
 */
export declare function parseFrontendBootstrap(rawValue: string | null | undefined): FrontendBootstrapData;
/**
 * Вставляет bootstrap как inline JSON в HTML template с экранированием опасных символов, чтобы shell оставался безопасным для `<script>`-контекста.
 */
export declare function injectFrontendBootstrap(templateHtml: string, bootstrap: FrontendBootstrapData): string;
