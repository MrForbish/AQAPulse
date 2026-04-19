import { normalizeOptionalText } from '../../shared/text-utils'
import type { WorkspaceUserRole } from '../contracts'

export function requireNonEmptyText(value: string | null | undefined, errorMessage: string): string {
    const normalizedValue = normalizeOptionalText(value)

    if (!normalizedValue) {
        throw new Error(errorMessage)
    }

    return normalizedValue
}

export function normalizeWorkspaceSlug(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    if (!slug) {
        throw new Error('Не удалось сформировать slug workspace. Используй латиницу или цифры.')
    }

    return slug
}

export function normalizeWorkspaceUserRole(value: unknown): WorkspaceUserRole {
    return value === 'owner' ? 'owner' : 'viewer'
}