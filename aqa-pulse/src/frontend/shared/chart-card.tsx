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
    type: FrontendChartType
    data: FrontendChartData
    showLegend?: boolean
    aside?: React.ReactNode
    className?: string
}

interface ChartInstance {
    destroy(): void
}

type ChartConstructor = new (
    canvas: HTMLCanvasElement,
    configuration: {
        type: FrontendChartType
        data: FrontendChartData
        options: {
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
    },
) => ChartInstance

export function ChartCard(props: ChartCardProps): React.JSX.Element {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

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
        let chart: ChartInstance | null = null

        void import('chart.js/auto').then((chartModule) => {
            if (!canvasRef.current || isDisposed) {
                return
            }

            const Chart = chartModule.default as unknown as ChartConstructor

            chart = new Chart(canvasRef.current, {
                type: props.type,
                data: props.data,
                options: {
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: props.showLegend ?? true,
                            labels: {
                                color: '#d7deeb',
                            },
                        },
                    },
                    scales: props.type === 'doughnut' || props.type === 'pie'
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
                },
            })
        })

        return () => {
            isDisposed = true
            chart?.destroy()
        }
    }, [props.data, props.showLegend, props.type])

    return (
        <Panel title={props.title} description={props.description} titleTooltip={props.titleTooltip} titleMetricKey={props.titleMetricKey} className={['chart-panel', props.className].filter(Boolean).join(' ')}>
            <div className={['chart-layout', props.aside ? 'has-aside' : ''].filter(Boolean).join(' ')}>
                <div className="chart-frame">
                    <canvas ref={canvasRef} />
                </div>
                {props.aside ? <div className="chart-aside">{props.aside}</div> : null}
            </div>
        </Panel>
    )
}