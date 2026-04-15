import React from 'react'

export function PageFrame(props: { children: React.ReactNode }): React.JSX.Element {
    return <div className="app-shell">{props.children}</div>
}

export function Panel(props: { title?: string; description?: string; children: React.ReactNode; className?: string }): React.JSX.Element {
    return (
        <section className={['panel', props.className].filter(Boolean).join(' ')}>
            {(props.title || props.description) ? (
                <header className="panel-header">
                    {props.title ? <h2>{props.title}</h2> : null}
                    {props.description ? <p>{props.description}</p> : null}
                </header>
            ) : null}
            {props.children}
        </section>
    )
}

export function MetricCard(props: { label: string; value: string; hint?: string; tone?: 'default' | 'good' | 'warn' | 'danger' }): React.JSX.Element {
    return (
        <article className={['metric-card', props.tone && props.tone !== 'default' ? `is-${props.tone}` : ''].filter(Boolean).join(' ')}>
            <div className="metric-label">{props.label}</div>
            <div className="metric-value">{props.value}</div>
            {props.hint ? <div className="metric-hint">{props.hint}</div> : null}
        </article>
    )
}

export function StatusBadge(props: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'accent' }): React.JSX.Element {
    return <span className={`status-badge is-${props.tone ?? 'neutral'}`}>{props.label}</span>
}

export function SegmentedTabs(props: {
    activeTab: string
    items: Array<{ id: string; label: string }>
    onChange: (value: string) => void
}): React.JSX.Element {
    return (
        <div className="segmented-tabs" role="tablist" aria-label="Категории метрик">
            {props.items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    className={item.id === props.activeTab ? 'is-active' : ''}
                    onClick={() => props.onChange(item.id)}
                >
                    {item.label}
                </button>
            ))}
        </div>
    )
}

export function LoadingView(props: { label?: string }): React.JSX.Element {
    return (
        <Panel>
            <div className="state-block">
                <div className="state-spinner" aria-hidden="true" />
                <div>{props.label ?? 'Загружаем данные...'}</div>
            </div>
        </Panel>
    )
}

export function ErrorView(props: { title: string; message: string; action?: React.ReactNode }): React.JSX.Element {
    return (
        <Panel className="panel-error">
            <div className="state-block">
                <h2>{props.title}</h2>
                <p>{props.message}</p>
                {props.action}
            </div>
        </Panel>
    )
}

export function EmptyState(props: { title: string; message: string }): React.JSX.Element {
    return (
        <div className="empty-state">
            <strong>{props.title}</strong>
            <p>{props.message}</p>
        </div>
    )
}