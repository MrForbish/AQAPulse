import { ru } from './i18n/ru'

export const DASHBOARD_METRIC_DESCRIPTIONS = {
    ...ru.dashboard.tooltips,
    releaseConfidenceBreakdownTitle: ru.dashboard.tooltips.releaseConfidenceScore,
    managerSummary: ru.dashboard.manager.summaryDescription,
    releaseReadiness: 'Позитивный сводный сигнал: показывает, насколько текущий pass rate, flaky ratio и история прогонов дают опору для решения о релизе.',
    qualityRisk: 'Сводная оценка риска дефектов и нестабильности: чем выше показатель, тем больше вероятность, что текущее качество требует дополнительной проверки.',
    deliveryRisk: 'Сводный сигнал показывает, насколько текущая нестабильность и блокеры влияют на скорость поставки изменений.',
    currentRunTests: ru.dashboard.testsBrowser.description,
    signalCoverage: 'Показывает, какая доля сигналов уже доступна для risk ranking, root-cause анализа и heuristic/AI слоя.',
    modelReadiness: 'Секция собирает ключевые входные сигналы, по которым видно, насколько текущий ingestion готов к heuristic/AI сценариям.',
} as const