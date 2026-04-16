/**
 * Назначение: compatibility-only HTML helpers для deprecated test-history attachments, lightbox preview и nested diagnostics steps.
 */
import type { TestHistoryResponse } from './api-store';
export declare function renderCompatibilityAttemptSteps(runId: string, attemptNumber: number, steps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps'], isOpenByDefault: boolean): string;
export declare function renderCompatibilityAttachmentDetail(runId: string, attachment: TestHistoryResponse['history'][number]['attemptDetails'][number]['attachments'][number], artifactBasePath: string): string;
