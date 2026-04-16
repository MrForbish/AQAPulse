# aqa-pulse-browser

`aqa-pulse-browser` — публичный browser-safe package для интеграций, которым нужны shared utilities, metric heading helpers, locale, bootstrap helpers и публичные типы AQA Pulse без deprecated HTML renderer API.

Этот пакет зеркалит browser-safe surface внутреннего `aqa-pulse/client`, но публикуется отдельно и не тянет product UI/runtime bundle.

Что входит:

- `formatDate(...)`
- `formatDuration(...)`
- `formatPercent(...)`
- `renderMetricHeading(...)`
- `METRIC_INFO_STYLES`
- `ru`
- `createEmptyFrontendBootstrap(...)`
- `parseFrontendBootstrap(...)`
- type exports: `FrontendBootstrapData`, `FrontendRouteDescriptor`, `FrontendSessionStatus`
- type exports: `DashboardAdvancedMetrics`, `DashboardAvailableFilters`, `DashboardFilters`, `DashboardKpis`, `DashboardRunMetadata`, `DashboardSummary`
- type exports: `TestHistoryConflict`, `TestHistoryResponse`
- type export: `WorkspaceDescriptor`

Чего здесь нет:

- `renderDashboardHtml(...)`
- `renderTestHistoryHtml(...)`

Эти старые string-based renderer APIs больше не публикуются. Для актуального UI-потока используй `aqa-pulse-server` или React/static runtime из `aqa-pulse`.

Когда использовать:

- если нужен browser-safe bootstrap contract для embedded/static integrations;
- если нужны shared formatting helpers, metric heading helpers или locale;
- если нужны Dashboard/TestHistory types без зависимости от deprecated renderer package.

Когда не использовать:

- если нужен self-hosted продукт целиком: используй `aqa-pulse-server`;
- если нужен полноценный dashboard/test-history UI: используй `aqa-pulse-server` или embedded/static React runtime, а не browser helper package;
- если ты работаешь внутри monorepo и можешь использовать private `aqa-pulse/react`, `aqa-pulse/hooks`, `aqa-pulse/types` напрямую.