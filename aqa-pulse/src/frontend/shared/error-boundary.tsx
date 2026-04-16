/**
 * Назначение: route-level error boundary для React shell с retry/reload recovery вместо падения всего frontend runtime.
 */
import React from 'react'
import { ErrorView, PageFrame } from './ui'

interface FrontendErrorBoundaryProps {
    children: React.ReactNode
}

interface FrontendErrorBoundaryState {
    error: Error | null
    instanceKey: number
}

/**
 * Boundary сбрасывает subtree через `instanceKey`, чтобы retry пересоздавал весь route-узел, а не пытался продолжить со старым повреждённым state.
 */
export class FrontendErrorBoundary extends React.Component<FrontendErrorBoundaryProps, FrontendErrorBoundaryState> {
    state: FrontendErrorBoundaryState = {
        error: null,
        instanceKey: 0,
    }

    static getDerivedStateFromError(error: Error): FrontendErrorBoundaryState {
        return {
            error,
            instanceKey: 0,
        }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('[AQA Pulse] Frontend route render failed.', error, errorInfo)
    }

    /**
     * Retry идёт через remount subtree: для route-level ошибок это надёжнее, чем пытаться локально восстановить часть уже сломанного дерева.
     */
    private handleRetry = (): void => {
        this.setState((currentState) => ({
            error: null,
            instanceKey: currentState.instanceKey + 1,
        }))
    }

    /**
     * Reload остаётся запасным путём для случаев, когда ошибка вызвана глобальным runtime состоянием, а не только одним React subtree.
     */
    private handleReload = (): void => {
        if (typeof window !== 'undefined') {
            window.location.reload()
            return
        }

        this.handleRetry()
    }

    render(): React.JSX.Element {
        if (this.state.error) {
            return (
                <PageFrame>
                    <ErrorView
                        title="Интерфейс не смог отрисоваться"
                        message={this.state.error.message || 'Во время загрузки страницы произошла ошибка.'}
                        action={(
                            <div className="state-actions">
                                <button type="button" className="secondary-button" onClick={this.handleRetry}>
                                    Попробовать снова
                                </button>
                                <button type="button" className="secondary-button" onClick={this.handleReload}>
                                    Перезагрузить страницу
                                </button>
                            </div>
                        )}
                    />
                </PageFrame>
            )
        }

        return <React.Fragment key={this.state.instanceKey}>{this.props.children}</React.Fragment>
    }
}