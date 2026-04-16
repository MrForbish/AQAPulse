export function mapManagerTone(level: 'healthy' | 'warning' | 'critical'): 'good' | 'warn' | 'danger' {
    if (level === 'healthy') {
        return 'good'
    }

    if (level === 'warning') {
        return 'warn'
    }

    return 'danger'
}

export function mapChangeTone(direction: 'improving' | 'regressing' | 'stable'): 'good' | 'warn' | 'accent' {
    if (direction === 'improving') {
        return 'good'
    }

    if (direction === 'regressing') {
        return 'warn'
    }

    return 'accent'
}