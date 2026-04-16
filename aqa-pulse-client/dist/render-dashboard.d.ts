/**
 * Назначение: legacy string-based dashboard renderer. Новые UI-фичи сюда больше не переносятся; файл удерживается только как compatibility implementation за пределами React runtime.
 */
import type { DashboardSummary } from './dashboard-utils';
export declare function renderDashboardHtml(summary: DashboardSummary, options?: {
    basePath?: string;
}): string;
