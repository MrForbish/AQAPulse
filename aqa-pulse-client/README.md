# aqa-pulse-client

`aqa-pulse-client` теперь считается legacy compatibility package.

Он остаётся для существующих сценариев, где нужен string-based HTML renderer, но новый UI и дальнейшее развитие продукта идут через React runtime в `aqa-pulse-server`.

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

Пакет содержит только клиентский runtime-код и публичные декларации типов.
Backend-логика, CLI, API-сервер и файловая обработка в пакет не публикуются.

Важно: API этого пакета поддерживается как compatibility layer. Новые React-фичи, auth flow и self-hosted UI в него не портируются автоматически.

Важно: если клиенту нужно **поставить AQA Pulse у себя**, ему обычно нужен не `aqa-pulse-client`, а `aqa-pulse-server`.
Практический migration path см. в `../aqa-pulse-server/MIGRATION.md`, а быстрый self-hosted старт — в `../aqa-pulse-server/SELF-HOSTED-QUICKSTART.md`.

