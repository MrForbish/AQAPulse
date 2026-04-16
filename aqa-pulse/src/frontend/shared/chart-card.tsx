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
    type: FrontendChartType
    data: FrontendChartData
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
    }, [props.data, props.type])

    return (
        <Panel title={props.title} description={props.description} className="chart-panel">
            <div className="chart-frame">
                <canvas ref={canvasRef} />
            </div>
        </Panel>
    )
}