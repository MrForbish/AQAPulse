export function formatPercent(value: number): string {
    return `${value.toFixed(1)}%`
}

export function formatDuration(durationMs: number): string {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return '0s'
    }

    const totalSeconds = Math.round(durationMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const parts: string[] = []

    if (hours > 0) {
        parts.push(`${hours}h`)
    }

    if (minutes > 0 || hours > 0) {
        parts.push(`${minutes}m`)
    }

    parts.push(`${seconds}s`)

    return parts.join(' ')
}

export function formatDate(timestamp: string | null): string {
    if (!timestamp) {
        return '—'
    }

    const date = new Date(timestamp)

    if (Number.isNaN(date.getTime())) {
        return timestamp
    }

    return new Intl.DateTimeFormat('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

