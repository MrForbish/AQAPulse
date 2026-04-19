/**
 * Назначение файла: содержит правила нормализации данных workspace
 * и ролей пользователей.
 */
import { normalizeOptionalText } from '../../shared/text-utils'
import type { WorkspaceUserRole } from '../contracts'

/**
 * Гарантирует непустое текстовое значение для domain/application команд.
 */
export function requireNonEmptyText(value: string | null | undefined, errorMessage: string): string {
    const normalizedValue = normalizeOptionalText(value)

    if (!normalizedValue) {
        throw new Error(errorMessage)
    }

    return normalizedValue
}

/**
 * Нормализует произвольное workspace имя в slug, совместимый с URL и storage layout.
 */
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