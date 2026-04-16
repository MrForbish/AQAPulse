# React Migration Guide

Этот документ нужен командам, которые раньше ориентировались на `aqa-pulse-client` и compatibility HTML renderer flow.

## Что изменилось

- Основной пользовательский интерфейс AQA Pulse теперь развивается через React runtime.
- Self-hosted сценарий идет через `aqa-pulse-server`.
- `aqa-pulse-client` остается только как compatibility layer для существующих интеграций со string-based HTML renderer API.
- browser-safe formatting/bootstrap/types и metric heading helpers для новых интеграций теперь публикуются через `aqa-pulse-browser`.
- Исходники deprecated compatibility renderer теперь живут в самом `aqa-pulse-client`; пакет `aqa-pulse` больше не держит этот renderer как часть собственного source/build surface.
- Compatibility renderer API уже помечен как deprecated и будет постепенно выводиться из активного продукта.
- Backend/domain/infra модули вроде `contracts.ts`, `jwt.ts`, `sqlite-migrate.ts` не мигрируют в React: они остаются серверным и операционным слоем, который новый UI использует через API, bootstrap и shared contracts.

## Какой путь выбрать теперь

### 1. Нужен полный self-hosted продукт

Используй `aqa-pulse-server`.

Это правильный путь, если нужны:

- dashboard и test history через актуальный React UI;
- admin/workspace auth flow;
- workspace management;
- ingestion API;
- Docker/self-hosted setup.

Стартовые документы:

- `./SELF-HOSTED-QUICKSTART.md`
- `./SELF-HOSTED-DEPLOYMENT.md`

### 2. Нужен офлайн dashboard без сервера

Используй static build из `aqa-pulse`.

Текущий supported flow:

1. Сгенерировать данные и static shell через `aqa-pulse`.
2. Забрать итоговый `dist/index.html` и `dist/web/**/*`.
3. Публиковать это как статический артефакт.

Важно: это React-based static shell, а не старый server-rendered HTML renderer API.

### 3. Уже есть интеграция на `aqa-pulse-client`

Можно временно остаться на `aqa-pulse-client`, если у тебя уже есть код вокруг:

- `renderDashboardHtml(...)`
- `renderTestHistoryHtml(...)`
- `renderMetricHeading(...)`

Но если твоя интеграция использует только formatting helpers, metric heading helpers, locale, bootstrap parsing или Dashboard/TestHistory types, переходи сразу на `aqa-pulse-browser` и не держись за deprecated renderer package.

Но нужно учитывать ограничения:

- пакет больше не является основным продуктовым surface;
- ownership этого compatibility flow теперь сосредоточен внутри `aqa-pulse-client`, а не в `aqa-pulse`;
- новые auth flow и UI-фичи туда не переносятся;
- runtime уже предупреждает о deprecated-статусе этих API;
- дальнейшая миграция должна идти в сторону `aqa-pulse-server` или React/static runtime.

## Практическая карта перехода

### Было: HTML renderer в приложении клиента

Типичный старый сценарий:

- сервис клиента сам вызывает `renderDashboardHtml(summary)`;
- HTML отдаётся как готовая страница или встраивается во внутренний портал.

Новый рекомендуемый вариант:

- либо поднять `aqa-pulse-server` и использовать готовые маршруты `/w/<slug>`, `/admin`;
- либо собирать React static export и публиковать `dist/index.html` как артефакт.

### Было: `aqa-pulse-client` как основной пакет поставки

Новый рекомендуемый вариант:

- `aqa-pulse-server` для full product/self-hosted;
- `aqa-pulse` для build-time utilities и static build workflow;
- `aqa-pulse-browser` для publishable browser-safe formatting/bootstrap/types и metric heading helpers;
- `aqa-pulse-client` только как compatibility package для deprecated HTML renderer API.

## Embedded React path

Если команда уже живёт внутри этого monorepo или использует внутренний пакет `aqa-pulse` напрямую, теперь доступен subpath `aqa-pulse/react`.

Он экспортирует React pages, runtime provider, shared UI building blocks, admin auth shell/components и admin hooks/API helpers для embedding-сценариев.

Но это не меняет основной migration recommendation:

- `aqa-pulse-server` остаётся главным путём для self-hosted продукта;
- React-based static export из `aqa-pulse` остаётся главным путём для офлайн dashboard;
- `aqa-pulse/react` подходит как internal/embedded integration surface, а не как замена self-hosted deployment flow.

## Рекомендуемый порядок миграции для существующих клиентов

1. Перестать строить новые интеграции на `aqa-pulse-client`.
2. Для новых внедрений использовать `aqa-pulse-server`.
3. Для офлайн-отчётов перейти с HTML renderer API на static export workflow.
4. Для существующих renderer-based интеграций запланировать постепенную замену до полного removal deprecated compatibility API.

## Retirement plan для `aqa-pulse-client`

1. Пакет остаётся только для поддержки существующих renderer consumers.
2. Main monorepo больше не строит и не пакует compatibility renderer path; negative checks следят, чтобы dependency на него не вернулась в `aqa-pulse` и `aqa-pulse-server`.
3. Новые UI-фичи, auth-потоки и self-hosted сценарии продолжают развиваться только в React runtime.
4. Browser-safe utilities/types уже вынесены в `aqa-pulse-browser`, поэтому после завершения миграции существующих renderer integrations пакет и deprecated HTML API планируются к удалению.

Точный текущий public API inventory и removal gates зафиксированы в `../aqa-pulse-client/REMOVAL-CHECKLIST.md`.

## Коротко

- `aqa-pulse-client` = deprecated compatibility package only.
- `aqa-pulse-server` = основной self-hosted продукт.
- `aqa-pulse` static build = supported путь для офлайн React dashboard.
- compatibility renderer исходники не развиваются как альтернативный UI-путь: новые пользовательские сценарии и новые метрики добавляются только в React runtime.