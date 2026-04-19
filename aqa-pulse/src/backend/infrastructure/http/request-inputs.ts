import type { Request } from 'express'
import type { ApiFilters } from '../../../api-store'

export function getFiltersFromRequest(request: Request): ApiFilters {
    const branch = pickQueryParam(request, 'branch')
    const project = pickQueryParam(request, 'project')
    const file = pickQueryParam(request, 'file')

    return {
        branch: branch ?? undefined,
        project: project ?? undefined,
        file: file ?? undefined,
    }
}

export function normalizePaginationQueryValue(value: unknown, fallback: number, maxValue: number): number {
    const normalizedValue = Array.isArray(value) ? value[0] : value

    if (typeof normalizedValue !== 'string' || normalizedValue.trim().length === 0) {
        return fallback
    }

    const parsedValue = Number(normalizedValue)

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        return fallback
    }

    return Math.min(parsedValue, maxValue)
}

export function getRouteParam(request: Request, key: string): string {
    const value = request.params[key]
    return Array.isArray(value) ? value[0] : value
}

export function pickQueryParam(request: Request, key: string): string | null {
    const value = request.query[key]
    const normalizedValue = Array.isArray(value) ? value[0] : value
    return typeof normalizedValue === 'string' && normalizedValue.trim().length > 0 ? normalizedValue.trim() : null
}

export function pickOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}