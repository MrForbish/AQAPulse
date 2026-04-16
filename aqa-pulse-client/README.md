# aqa-pulse-client

`aqa-pulse-client` теперь считается deprecated compatibility package и удерживается только как временный bridge до полного removal.

Он остаётся для существующих сценариев, где нужен string-based HTML renderer, но новый UI и дальнейшее развитие продукта идут через React runtime в `aqa-pulse-server`.

Если нужны только browser-safe formatting helpers, locale, bootstrap parsing или Dashboard/TestHistory types, используй `aqa-pulse-browser`, а не этот пакет.

Retirement roadmap:

- новые интеграции на этот пакет больше не строятся;
- пакет получает только compatibility fixes для существующих renderer consumers;
- миграция должна идти в `aqa-pulse-server` или React/static runtime из `aqa-pulse`;
- после перевода существующих renderer-based интеграций пакет планируется удалить.

Точный removal scope и финальный checklist вынесены в `./REMOVAL-CHECKLIST.md`.

Если нужен self-hosted AQA Pulse или актуальный пользовательский интерфейс, ориентируйся на `aqa-pulse-server`, а не на этот пакет.

Публичный клиентский пакет AQA Pulse.

Что входит:
- `renderDashboardHtml(summary)`
- `renderTestHistoryHtml(payload, requestedTitle, filters?)`
- `renderMetricHeading(...)`
- `METRIC_INFO_STYLES`
- `formatDate(...)`
- `formatDuration(...)`
- `formatPercent(...)`
- `ru`
- type exports: `DashboardAdvancedMetrics`, `DashboardAvailableFilters`, `DashboardFilters`, `DashboardKpis`, `DashboardRunMetadata`, `DashboardSummary`, `TestHistoryConflict`, `TestHistoryResponse`

Новый код не должен брать browser-safe utilities/types отсюда: для этого есть `aqa-pulse-browser`.

Пакет содержит только клиентский runtime-код и публичные декларации типов.
Backend-логика, CLI, API-сервер и файловая обработка в пакет не публикуются.

Начиная с текущей схемы, compatibility renderer собирается из собственного source tree внутри `aqa-pulse-client/src`, а не копируется из build output пакета `aqa-pulse`.

Важно: API этого пакета поддерживается только как compatibility layer на время migration window. Новые React-фичи, auth flow и self-hosted UI в него не портируются автоматически.

Важно: если клиенту нужно **поставить AQA Pulse у себя**, ему обычно нужен не `aqa-pulse-client`, а `aqa-pulse-server`.
Практический migration path см. в `../aqa-pulse-server/MIGRATION.md`, а быстрый self-hosted старт — в `../aqa-pulse-server/SELF-HOSTED-QUICKSTART.md`.

