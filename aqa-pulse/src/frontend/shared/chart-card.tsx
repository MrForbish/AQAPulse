import React from 'react'
import Chart from 'chart.js/auto'
import type { ChartData, ChartType } from 'chart.js'
import { Panel } from './ui'

export function ChartCard(props: {
    title: string
    description?: string
    type: ChartType
    data: ChartData
}): React.JSX.Element {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

    React.useEffect(() => {
        if (!canvasRef.current) {
            return undefined
        }

        const chart = new Chart(canvasRef.current, {
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

        return () => {
            chart.destroy()
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