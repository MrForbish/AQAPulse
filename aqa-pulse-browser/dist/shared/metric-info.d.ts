export interface MetricIconDefinition {
    svg: string;
}
export declare function resolveMetricIcon(metricKey: string | undefined, label: string): MetricIconDefinition | null;
export declare function renderMetricIconSvg(icon: MetricIconDefinition): string;
