import React from 'react'
import type { TestHistoryResponse } from '../../../api-store'
import { HistoryDiagnosticsPanels, HistorySnapshotPanels } from './history-insight-sections'

export function TestHistoryInsightsGrid(props: {
    payload: TestHistoryResponse
    artifactBasePath: string
    isStaticMode: boolean
}): React.JSX.Element {
    return (
        <div className="page-grid">
            <HistorySnapshotPanels payload={props.payload} />
            <HistoryDiagnosticsPanels payload={props.payload} artifactBasePath={props.artifactBasePath} isStaticMode={props.isStaticMode} />
        </div>
    )
}