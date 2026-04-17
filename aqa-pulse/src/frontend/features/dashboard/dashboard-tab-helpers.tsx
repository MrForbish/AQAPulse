import React from 'react'
import type { DashboardDurationBreakdownItem } from '../../../dashboard-utils'
import { formatDuration, formatPercent } from '../../../shared/formatting'
import { ru } from '../../../shared/i18n/ru'
import { type FrontendChartData } from '../../shared/chart-card'
import { DashboardEmptyTableRow, DashboardTable } from './dashboard-test-table-parts'

const DASHBOARD_TEXT = ru.dashboard
export const DASHBOARD_STATUS_CHART_COLORS = ['#0f766e', '#ea580c', '#ca8a04', '#1d4ed8', '#64748b', '#b91c1c']

export function DashboardBreakdownTable(props: { labelColumn: string; items: DashboardDurationBreakdownItem[]; emptyMessage: string }): React.JSX.Element {
    return (
        <DashboardTable headers={[props.labelColumn, DASHBOARD_TEXT.tables.duration, DASHBOARD_TEXT.tables.share, DASHBOARD_TEXT.tables.tests]}>
            {props.items.length > 0 ? props.items.map((item) => (
                <tr key={`${item.label}-${item.durationMs}`}>
                    <td>{item.label}</td>
                    <td>{formatDuration(item.durationMs)}</td>
                    <td>{formatPercent(item.sharePercent)}</td>
                    <td>{item.tests}</td>
                </tr>
            )) : <DashboardEmptyTableRow colSpan={4} message={props.emptyMessage} />}
        </DashboardTable>
    )
}

export function buildDashboardLineChart(labels: string[], values: number[], color: string): FrontendChartData<'line'> {
    return {
        labels,
        datasets: [
            {
                label: 'dataset',
                data: values,
                borderColor: color,
                backgroundColor: `${color}33`,
                tension: 0.25,
                fill: true,
            },
        ],
    }
}

export function buildDashboardBarChart(labels: string[], values: number[], color: string): FrontendChartData<'bar'> {
    return {
        labels,
        datasets: [
            {
                label: 'dataset',
                data: values,
                backgroundColor: color,
                borderRadius: 12,
            },
        ],
    }
}

export function buildDashboardDoughnutChart(labels: string[], values: number[]): FrontendChartData<'doughnut'> {
    return {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: DASHBOARD_STATUS_CHART_COLORS,
                borderWidth: 0,
            },
        ],
    }
}

export function formatDashboardDurationDelta(value: number | null, comparisonMode: 'adjacent' | 'comparable' = 'adjacent'): string {
    if (value === null) {
        return comparisonMode === 'comparable' ? 'Нет сопоставимого прогона для сравнения' : DASHBOARD_TEXT.states.noPreviousRun
    }

    if (value === 0) {
        return comparisonMode === 'comparable' ? 'Без изменений к сопоставимому прогону' : DASHBOARD_TEXT.states.noChanges
    }

    const prefix = value > 0 ? '+' : ''
    return `${prefix}${value.toFixed(1)}% ${comparisonMode === 'comparable' ? 'к сопоставимому прогону' : 'к прошлому прогону'}`
}
