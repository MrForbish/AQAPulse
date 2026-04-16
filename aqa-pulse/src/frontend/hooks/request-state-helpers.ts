export function resolveInitialLoadedRequestUrl(initialData: unknown, currentRequestUrl: string): string | null {
    return initialData ? currentRequestUrl : null
}

export function hasResolvedRequestUrl(loadedRequestUrl: string | null, currentRequestUrl: string): boolean {
    return loadedRequestUrl === currentRequestUrl
}