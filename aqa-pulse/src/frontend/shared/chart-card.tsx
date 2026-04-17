import React from 'react'
import { Panel } from './ui'

export type FrontendChartType = 'bar' | 'doughnut' | 'line' | 'pie'

export interface FrontendChartDataset {
    label?: string
    data: number[]
    borderColor?: string
    backgroundColor?: string | string[]
    borderRadius?: number
    fill?: boolean
    tension?: number
    borderWidth?: number
}

export interface FrontendChartData<TChartType extends FrontendChartType = FrontendChartType> {
    labels: string[]
    datasets: FrontendChartDataset[]
    chartType?: TChartType
}

export interface ChartCardProps {
    title: string
    description?: string
    titleTooltip?: string
    titleMetricKey?: string
    valueHint?: string
    type: FrontendChartType
    data: FrontendChartData
    showLegend?: boolean
    aside?: React.ReactNode
    className?: string
}

interface ChartInstance {
    data: FrontendChartData
    options: ChartOptions
    destroy(): void
    update(mode?: string): void
}

interface ChartOptions {
    maintainAspectRatio: boolean
    plugins: {
        legend: {
            display: boolean
            labels: {
                color: string
            }
        }
    }
    scales?: {
        x: {
            ticks: { color: string }
            grid: { color: string }
        }
        y: {
            ticks: { color: string }
            grid: { color: string }
        }
    }
}

type ChartConstructor = new (
    canvas: HTMLCanvasElement,
    configuration: {
        type: FrontendChartType
        data: FrontendChartData
        options: ChartOptions
    },
) => ChartInstance

let chartConstructorPromise: Promise<ChartConstructor> | null = null

function loadChartConstructor(): Promise<ChartConstructor> {
    if (!chartConstructorPromise) {
        chartConstructorPromise = import('chart.js/auto').then((chartModule) => chartModule.default as unknown as ChartConstructor)
    }

    return chartConstructorPromise
}

function cloneChartData(data: FrontendChartData): FrontendChartData {
    return {
        ...data,
        labels: [...data.labels],
        datasets: data.datasets.map((dataset) => ({
            ...dataset,
            data: [...dataset.data],
            backgroundColor: Array.isArray(dataset.backgroundColor)
                ? [...dataset.backgroundColor]
                : dataset.backgroundColor,
        })),
    }
}

function buildChartOptions(type: FrontendChartType, shouldShowLegend: boolean): ChartOptions {
    return {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: shouldShowLegend,
                labels: {
                    color: '#d7deeb',
                },
            },
        },
        scales: type === 'doughnut' || type === 'pie'
            ? undefined
            : {
                x: {
                    ticks: { color: '#91a0b8' },
                    grid: { color: 'rgba(145, 160, 184, 0.12)' },
                },
                y: {
                    ticks: { color: '#91a0b8' },
                    grid: { color: 'rgba(145, 160, 184, 0.12)' },
                },
            },
    }
}

export function ChartCard(props: ChartCardProps): React.JSX.Element {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
    const chartRef = React.useRef<ChartInstance | null>(null)
    const shouldShowLegend = props.showLegend ?? props.data.datasets.length > 1
    const latestPropsRef = React.useRef({
        data: props.data,
        type: props.type,
        shouldShowLegend,
    })

    latestPropsRef.current = {
        data: props.data,
        type: props.type,
        shouldShowLegend,
    }

    React.useEffect(() => {
        if (!canvasRef.current) {
            return undefined
        }

        if (typeof ResizeObserver !== 'function') {
            return undefined
        }

        try {
            if (!canvasRef.current.getContext('2d')) {
                return undefined
            }
        } catch {
            return undefined
        }

        let isDisposed = false

        void loadChartConstructor().then((Chart) => {
            if (!canvasRef.current || isDisposed) {
                return
            }

            const latestProps = latestPropsRef.current

            const chart = new Chart(canvasRef.current, {
                type: latestProps.type,
                data: cloneChartData(latestProps.data),
                options: buildChartOptions(latestProps.type, latestProps.shouldShowLegend),
            })

            chartRef.current = chart
        })

        return () => {
            isDisposed = true
            chartRef.current?.destroy()
            chartRef.current = null
        }
    }, [props.type])

    React.useEffect(() => {
        const chart = chartRef.current

        if (!chart) {
            return
        }

        chart.data = cloneChartData(props.data)
        chart.options = buildChartOptions(props.type, shouldShowLegend)
        chart.update('none')
    }, [props.data, props.type, shouldShowLegend])

    return (
        <Panel title={props.title} description={props.description} titleTooltip={props.titleTooltip} titleMetricKey={props.titleMetricKey} className={['chart-panel', props.className].filter(Boolean).join(' ')}>
            {props.valueHint ? <div className="chart-value-hint">Значения: {props.valueHint}</div> : null}
            <div className={['chart-layout', props.aside ? 'has-aside' : ''].filter(Boolean).join(' ')}>
                <div className="chart-frame">
                    <canvas ref={canvasRef} />
                </div>
                {props.aside ? <div className="chart-aside">{props.aside}</div> : null}
            </div>
        </Panel>
    )
}