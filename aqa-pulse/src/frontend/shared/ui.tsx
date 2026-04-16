/**
 * Назначение: набор базовых frontend UI primitives для layout, state views и повторно используемых control-элементов.
 */
import React from 'react'
import { renderMetricIconSvg, resolveMetricIcon } from '../../shared/metric-info'

export interface PageFrameProps {
    children: React.ReactNode
}

export function PageFrame(props: PageFrameProps): React.JSX.Element {
    return <div className="app-shell">{props.children}</div>
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
    hint?: string
    labelTooltip?: string
    labelMetricKey?: string
    tone?: 'default' | 'good' | 'warn' | 'danger'
}

export function MetricCard(props: MetricCardProps): React.JSX.Element {
    return (
        <article className={['metric-card', props.tone && props.tone !== 'default' ? `is-${props.tone}` : ''].filter(Boolean).join(' ')}>
            <div className="metric-label">
                <MetricHeading
                    label={props.label}
                    description={props.labelTooltip}
                    metricKey={props.labelMetricKey}
                    className="metric-label-heading-react"
                />
            </div>
            <div className="metric-value">{props.value}</div>
            {props.hint ? <div className="metric-hint">{props.hint}</div> : null}
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
            <span>{props.label}</span>
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
    value: string
    muted?: boolean
}

export interface SummaryStripProps {
    items: SummaryStripItemProps[]
    className?: string
}

export function SummaryStrip(props: SummaryStripProps): React.JSX.Element {
    const className = ['summary-strip', props.className].filter(Boolean).join(' ')

    return (
        <div className={className}>
            {props.items.map((item) => (
                <article key={`${item.label}-${item.value}`} className="summary-strip-item">
                    <span>{item.label}</span>
                    <strong className={item.muted ? 'summary-strip-text' : ''}>{item.value}</strong>
                </article>
            ))}
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
                        <strong>{item.title}</strong>
                        {item.pillLabel
                            ? item.pillStyle === 'module-pill'
                                ? <span className={`module-pill is-${item.pillTone ?? 'accent'}`}>{item.pillLabel}</span>
                                : <StatusBadge label={item.pillLabel} tone={item.pillTone} />
                            : null}
                    </div>
                    {item.value ? (
                        <div className="summary-line compact-top">
                            <span>{item.value}</span>
                        </div>
                    ) : null}
                    <p>{item.body}</p>
                    {item.meta ? <div className="subtle-copy">{item.meta}</div> : null}
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