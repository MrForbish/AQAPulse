import type { TestHistoryResponse } from '../../../api-store'
import { formatDate } from '../../../shared/formatting'

export function formatOptionalDate(value: string | null): string {
    return value ? formatDate(value) : '—'
}

export function getEventToneClass(run: TestHistoryResponse['history'][number]): 'is-danger' | 'is-warn' | 'is-good' {
    if (run.errorMessage || run.status === 'failed' || run.status === 'timedout' || run.status === 'interrupted') {
        return 'is-danger'
    }

    if (run.flaky) {
        return 'is-warn'
    }

    return 'is-good'
}