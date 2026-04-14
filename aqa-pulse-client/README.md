# aqa-pulse-client

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

Важно: если клиенту нужно **поставить AQA Pulse у себя**, ему обычно нужен не `aqa-pulse-client`, а `aqa-pulse-server`.
Практический onboarding см. в `../aqa-pulse-server/CLIENT-ONBOARDING.md`.

