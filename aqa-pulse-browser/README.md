# aqa-pulse-browser

`aqa-pulse-browser` — публичный browser-safe package для интеграций, которым нужны shared utilities, metric heading helpers, locale, bootstrap helpers и публичные типы AQA Pulse без deprecated HTML renderer API.

Этот пакет зеркалит browser-safe surface внутреннего `aqa-pulse/client`, но публикуется отдельно и не тянет compatibility renderer.

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

Эти compatibility renderer APIs остаются только в `aqa-pulse-client` и считаются deprecated removal path.

Когда использовать:

- если нужен browser-safe bootstrap contract для embedded/static integrations;
- если нужны shared formatting helpers, metric heading helpers или locale;
- если нужны Dashboard/TestHistory types без зависимости от deprecated renderer package.

Когда не использовать:

- если нужен self-hosted продукт целиком: используй `aqa-pulse-server`;
- если нужен deprecated HTML renderer flow: это всё ещё `aqa-pulse-client`;
- если ты работаешь внутри monorepo и можешь использовать private `aqa-pulse/react`, `aqa-pulse/hooks`, `aqa-pulse/types` напрямую.