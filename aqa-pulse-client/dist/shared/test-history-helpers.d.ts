import type { TestHistoryResponse } from '../api-store';
type TestHistoryItem = TestHistoryResponse['history'][number];
type TestHistoryAttachment = TestHistoryItem['attemptDetails'][number]['attachments'][number];
type TestHistoryAttemptStep = TestHistoryItem['attemptDetails'][number]['steps'][number];
export interface DiagnosticStepTreeNode {
    step: TestHistoryAttemptStep;
    stepIndex: number;
    children: DiagnosticStepTreeNode[];
}
export declare function buildHistoryRowAnchor(runId: string): string;
export declare function formatRunsLabel(count: number): string;
export declare function getRunWord(count: number): string;
export declare function formatTemplate(template: string, values: Record<string, string>): string;
export declare function isStableHistoryItem(item: TestHistoryResponse['history'][number]): boolean;
export declare function isUnstableHistoryItem(item: TestHistoryResponse['history'][number]): boolean;
export declare function getUnstableHistoryItems(history: TestHistoryResponse['history']): TestHistoryResponse['history'];
export declare function getUnstableEventLabel(item: TestHistoryResponse['history'][number]): string;
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
export declare function formatCurrentStabilityDescription(streak: ReturnType<typeof findCurrentStabilityStreak>): string;
export declare function normalizeAnchorLookupValue(value: string | null | undefined): string | null;
export declare function buildStepAnchor(runId: string, attemptNumber: number, stepIndex: number): string;
export declare function buildDiagnosticStepTree(steps: TestHistoryResponse['history'][number]['attemptDetails'][number]['steps']): DiagnosticStepTreeNode[];
export declare function findIncidentStepAnchor(history: TestHistoryResponse['history'], failureStepTitle: string | null): string | null;
export declare function getAttachmentReference(attachment: TestHistoryAttachment): string;
export declare function buildAttachmentHref(runId: string, attachment: TestHistoryAttachment, artifactBasePath: string): string | null;
export declare function isImageAttachment(attachment: TestHistoryAttachment): boolean;
export declare function isMarkdownAttachment(attachment: TestHistoryAttachment): boolean;
export declare function canInlineMarkdownPreview(href: string): boolean;
export {};
