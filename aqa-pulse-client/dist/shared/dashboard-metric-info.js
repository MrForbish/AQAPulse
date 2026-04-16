"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DASHBOARD_METRIC_DESCRIPTIONS = void 0;
const ru_1 = require("./i18n/ru");
exports.DASHBOARD_METRIC_DESCRIPTIONS = {
    ...ru_1.ru.dashboard.tooltips,
    releaseConfidenceBreakdownTitle: ru_1.ru.dashboard.tooltips.releaseConfidenceScore,
    managerSummary: ru_1.ru.dashboard.manager.summaryDescription,
    releaseReadiness: 'Позитивный сводный сигнал: показывает, насколько текущий pass rate, flaky ratio и история прогонов позволяют опираться на автотесты перед релизом.',
    qualityRisk: 'Сводная оценка риска дефектов и нестабильности: чем выше показатель, тем больше вероятность, что текущее качество требует дополнительной проверки.',
    deliveryRisk: 'Сводный сигнал показывает, насколько текущая нестабильность и блокеры влияют на скорость поставки изменений.',
    currentRunTests: ru_1.ru.dashboard.testsBrowser.description,
    signalCoverage: 'Показывает, какая доля сигналов уже доступна для risk ranking, root-cause анализа и heuristic/AI слоя.',
    modelReadiness: 'Секция собирает ключевые входные сигналы, по которым видно, насколько текущий ingestion готов к heuristic/AI сценариям.',
};
