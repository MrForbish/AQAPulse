export function buildTestHistoryCandidateHref(
    workspaceSlug: string | null,
    title: string,
    filters: { branch?: string | null; project?: string | null; file?: string | null },
    project: string,
    file: string,
): string {
    const searchParams = new URLSearchParams()

    if (filters.branch) {
        searchParams.set('branch', filters.branch)
    }

    searchParams.set('project', project)
    searchParams.set('file', file)

    const pathname = workspaceSlug
        ? `/w/${encodeURIComponent(workspaceSlug)}/test/${encodeURIComponent(title)}`
        : `/test/${encodeURIComponent(title)}`

    return `${pathname}?${searchParams.toString()}`
}