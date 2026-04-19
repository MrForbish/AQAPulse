import { normalizePrecomputedSourceFacts, type ReporterRoot } from '../../../dashboard-utils'
import type { IngestionRequestPayload } from '../../contracts'
import { pickOptionalString } from './request-inputs'

/**
 * Ingestion endpoint принимает либо обёрнутый `{ report, metadata }`, либо сырой reporter root, чтобы CLI/self-hosted интеграции могли эволюционировать без жёсткой привязки к одному payload shape.
 */
export function normalizeIngestionPayload(body: unknown): IngestionRequestPayload | null {
    if (!body || typeof body !== 'object') {
        return null
    }

    const bodyRecord = body as Record<string, unknown>
    const explicitReport = bodyRecord.report

    if (explicitReport && isReporterRoot(explicitReport)) {
        return {
            report: attachNormalizedSourceFacts(explicitReport, bodyRecord.precomputedSourceFacts),
            sourceFile: pickOptionalString(bodyRecord.sourceFile) ?? undefined,
            metadata: normalizeMetadata(bodyRecord.metadata),
        }
    }

    if (isReporterRoot(bodyRecord)) {
        return {
            report: attachNormalizedSourceFacts(bodyRecord, undefined),
            metadata: undefined,
        }
    }

    return null
}

function attachNormalizedSourceFacts(report: ReporterRoot, explicitSourceFacts: unknown): ReporterRoot {
    const normalizedSourceFacts = normalizePrecomputedSourceFacts(explicitSourceFacts ?? report.aqaPulseSourceFacts)

    if (!normalizedSourceFacts) {
        const { aqaPulseSourceFacts: _ignoredSourceFacts, ...reportWithoutSourceFacts } = report
        return reportWithoutSourceFacts
    }

    return {
        ...report,
        aqaPulseSourceFacts: normalizedSourceFacts,
    }
}

function isReporterRoot(value: unknown): value is ReporterRoot {
    if (!value || typeof value !== 'object') {
        return false
    }

    const maybeReporter = value as Record<string, unknown>
    return Array.isArray(maybeReporter.tests)
}

function normalizeMetadata(value: unknown): IngestionRequestPayload['metadata'] | undefined {
    if (!value || typeof value !== 'object') {
        return undefined
    }

    const metadata = value as Record<string, unknown>
    return {
        branch: pickOptionalString(metadata.branch) ?? undefined,
        commit: pickOptionalString(metadata.commit) ?? undefined,
        author: pickOptionalString(metadata.author) ?? undefined,
    }
}