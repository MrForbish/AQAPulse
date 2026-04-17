import React from 'react'
import { renderMetricIconSvg, resolveMetricIcon } from '../../shared/metric-info'

export interface PageFrameProps {
    children: React.ReactNode
}

export function PageFrame(props: PageFrameProps): React.JSX.Element {
    return (
        <div className="app-shell">
            <div className="app-shell-statusbar" aria-hidden="true">
                <span>LIVE UI</span>
                <span>ENGINEERING CONSOLE</span>
                <span>AQA PULSE</span>
            </div>
            {props.children}
            <footer className="app-shell-footer">© AQA Pulse — developed by Maksim Pecherskiy</footer>
        </div>
    )
}

export interface PanelProps {
    title?: string
    description?: string
    titleTooltip?: string
    titleMetricKey?: string
    children: React.ReactNode
    className?: string
}

export function Panel(props: PanelProps): React.JSX.Element {
    return (
        <section className={['panel', props.className].filter(Boolean).join(' ')}>
            {(props.title || props.description) ? (
                <header className="panel-header">
                    <div className="panel-kicker">Console block</div>
                    {props.title ? (
                        <h2>
                            <MetricHeading
                                label={props.title}
                                description={props.titleTooltip}
                                metricKey={props.titleMetricKey}
                                className="panel-title-react"
                            />
                        </h2>
                    ) : null}
                    {props.description ? <p>{props.description}</p> : null}
                </header>
            ) : null}
            {props.children}
        </section>
    )
}

export interface MetricCardProps {
    label: string
    value: string
    hint?: React.ReactNode
    labelTooltip?: string
    labelMetricKey?: string
    tone?: 'default' | 'good' | 'warn' | 'danger'
    className?: string
}

export function MetricCard(props: MetricCardProps): React.JSX.Element {
    const hintTitle = typeof props.hint === 'string' ? props.hint : undefined

    return (
        <article className={['metric-card', props.className, props.tone && props.tone !== 'default' ? `is-${props.tone}` : ''].filter(Boolean).join(' ')}>
            <div className="metric-label">
                <MetricHeading
                    label={props.label}
                    description={props.labelTooltip}
                    metricKey={props.labelMetricKey}
                    className="metric-label-heading-react"
                />
            </div>
            <div className="metric-value" title={props.value}>{props.value}</div>
            {props.hint ? <div className="metric-hint" title={hintTitle}>{props.hint}</div> : null}
        </article>
    )
}

export interface MetricHeadingProps {
    label: string
    description?: string
    metricKey?: string
    className?: string
}

export function MetricHeading(props: MetricHeadingProps): React.JSX.Element {
    const icon = resolveMetricIcon(props.metricKey, props.label)
    const className = ['metric-heading-react', props.className].filter(Boolean).join(' ')

    return (
        <span className={className}>
            {icon ? <span className="metric-icon-react" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderMetricIconSvg(icon) }} /> : null}
            <OverflowText as="span" text={props.label} className="metric-heading-label-react" />
            {props.description ? (
                <span className="metric-info-react">
                    <span className="metric-info-button-react" tabIndex={0} role="img" aria-label={`Описание метрики ${props.label}`}>i</span>
                    <span className="metric-tooltip-react">{props.description}</span>
                </span>
            ) : null}
        </span>
    )
}

export interface StatusBadgeProps {
    label: string
    tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'accent'
}

export function StatusBadge(props: StatusBadgeProps): React.JSX.Element {
    return <span className={`status-badge is-${props.tone ?? 'neutral'}`}>{props.label}</span>
}

export interface SummaryStripItemProps {
    label: string
    value: React.ReactNode
    muted?: boolean
    meta?: React.ReactNode
}

export interface SummaryStripProps {
    items: SummaryStripItemProps[]
    className?: string
}

export function SummaryStrip(props: SummaryStripProps): React.JSX.Element {
    const className = ['summary-strip', props.className].filter(Boolean).join(' ')

    return (
        <div className={className}>
            {props.items.map((item, index) => (
                <article key={`${item.label}-${index}`} className="summary-strip-item">
                    <span title={item.label}>{item.label}</span>
                    <strong className={item.muted ? 'summary-strip-text' : ''}>{item.value}</strong>
                    {item.meta ? <div className="summary-strip-item-meta">{item.meta}</div> : null}
                </article>
            ))}
        </div>
    )
}

export interface OverflowTextProps {
    text: string
    className?: string
    as?: 'span' | 'strong' | 'div' | 'p'
    lines?: 1 | 2 | 3
}

export function OverflowText(props: OverflowTextProps): React.JSX.Element {
    const Tag = props.as ?? 'span'
    const className = [
        'overflow-text-react',
        props.lines && props.lines > 1 ? `is-${props.lines}-line` : '',
        props.className,
    ].filter(Boolean).join(' ')

    return React.createElement(Tag, { className, title: props.text }, props.text)
}

export interface EmptyStateProps {
    title: string
    message: string
}

export function EmptyState(props: EmptyStateProps): React.JSX.Element {
    return (
        <div className="empty-state">
            <strong>{props.title}</strong>
            <p>{props.message}</p>
        </div>
    )
}

export interface NarrativeListItem {
    id: string
    title: string
    body: string
    pillLabel?: string
    pillTone?: 'neutral' | 'good' | 'warn' | 'danger' | 'accent'
    pillStyle?: 'status-badge' | 'module-pill'
    value?: string
    meta?: string | null
}

export interface NarrativeListProps {
    items: NarrativeListItem[]
    emptyState?: EmptyStateProps
    className?: string
}

export function NarrativeList(props: NarrativeListProps): React.JSX.Element {
    const className = ['stack-list', props.className].filter(Boolean).join(' ')

    if (props.items.length === 0) {
        return (
            <div className={className}>
                {props.emptyState ? <EmptyState title={props.emptyState.title} message={props.emptyState.message} /> : null}
            </div>
        )
    }

    return (
        <div className={className}>
            {props.items.map((item) => (
                <article key={item.id} className="stack-item">
                    <div className="stack-item-header">
                        <OverflowText as="strong" text={item.title} className="stack-item-title-react" lines={2} />
                        {item.pillLabel
                            ? item.pillStyle === 'module-pill'
                                ? <span className={`module-pill is-${item.pillTone ?? 'accent'}`}>{item.pillLabel}</span>
                                : <StatusBadge label={item.pillLabel} tone={item.pillTone} />
                            : null}
                    </div>
                    {item.value ? (
                        <div className="summary-line compact-top">
                            <OverflowText as="span" text={item.value} lines={2} />
                        </div>
                    ) : null}
                    <p title={item.body}>{item.body}</p>
                    {item.meta ? <div className="subtle-copy" title={item.meta}>{item.meta}</div> : null}
                </article>
            ))}
        </div>
    )
}

export interface SegmentedTabsProps {
    activeTab: string
    items: Array<{ id: string; label: string }>
    onChange: (value: string) => void
}

/**
 * Tab control intentionally остаётся dumb-компонентом: он рендерит только active state и callback, а URL/state синхронизацию держит feature-слой dashboard.
 */
export function SegmentedTabs(props: SegmentedTabsProps): React.JSX.Element {
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

export interface LoadingViewProps {
    label?: string
}

export function LoadingView(props: LoadingViewProps): React.JSX.Element {
    return (
        <Panel>
            <div className="state-block">
                <div className="state-spinner" aria-hidden="true" />
                <div>{props.label ?? 'Загружаем данные...'}</div>
            </div>
        </Panel>
    )
}

export interface ErrorViewProps {
    title: string
    message: string
    action?: React.ReactNode
}

/**
 * Унифицированный error state нужен и route-level boundary, и feature-страницам, чтобы ошибка transport/render выглядела одинаково во всём React shell.
 */
export function ErrorView(props: ErrorViewProps): React.JSX.Element {
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