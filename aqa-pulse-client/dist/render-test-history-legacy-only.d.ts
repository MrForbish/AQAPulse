/**
 * Назначение: legacy-only HTML helpers для compatibility test-history attachments, lightbox preview и nested diagnostics steps.
 */
import type { TestHistoryResponse } from './api-store';
export declare function renderLegacyAttemptSteps(runId: string, attemptNumber: number, steps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'], isOpenByDefault: boolean): string;
export declare function renderLegacyAttachmentDetail(runId: string, attachment: TestHistoryResponse['history'][number]['attemptDetails'][number]['attachments'][number], artifactBasePath: string): string;
