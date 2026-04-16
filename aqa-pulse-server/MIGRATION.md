# React Migration Guide

Этот документ нужен командам, которые раньше ориентировались на старый string-based HTML renderer flow.

## Что изменилось

- Основной пользовательский интерфейс AQA Pulse теперь развивается через React runtime.
- Self-hosted сценарий идет через `aqa-pulse-server`.
- browser-safe formatting/bootstrap/types и metric heading helpers для новых интеграций теперь публикуются через `aqa-pulse-browser`.
- Исторический string-based HTML renderer package удалён из текущего repo/distribution surface.
- Старые renderer APIs (`renderDashboardHtml`, `renderTestHistoryHtml`) считаются migrated away и больше не являются supported delivery path.
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

### 3. Нужны publishable browser-safe helpers/types

Используй `aqa-pulse-browser`, если интеграции нужны:

- `formatDate(...)`, `formatDuration(...)`, `formatPercent(...)`;
- `renderMetricHeading(...)`, `METRIC_INFO_STYLES`;
- locale, bootstrap parsing и публичные Dashboard/TestHistory types.

Это replacement surface для старых non-product helper imports без зависимости на full UI/runtime bundle.

## Практическая карта перехода

### Было: HTML renderer в приложении клиента

Типичный старый сценарий:

- сервис клиента раньше сам вызывал string-based renderer API и получал готовый HTML;
- HTML отдавался как готовая страница или встраивался во внутренний портал.

Новый рекомендуемый вариант:

- либо поднять `aqa-pulse-server` и использовать готовые маршруты `/w/<slug>`, `/admin`;
- либо собирать React static export и публиковать `dist/index.html` как артефакт.

### Было: отдельный renderer package как основной пакет поставки

Новый рекомендуемый вариант:

- `aqa-pulse-server` для full product/self-hosted;
- `aqa-pulse` для build-time utilities и static build workflow;
- `aqa-pulse-browser` для publishable browser-safe formatting/bootstrap/types и metric heading helpers;
- отдельный deprecated renderer package больше не нужен и больше не публикуется.

## Embedded React path

Если команда уже живёт внутри этого monorepo или использует внутренний пакет `aqa-pulse` напрямую, теперь доступен subpath `aqa-pulse/react`.

Он экспортирует React pages, runtime provider, shared UI building blocks, admin auth shell/components и admin hooks/API helpers для embedding-сценариев.

Но это не меняет основной migration recommendation:

- `aqa-pulse-server` остаётся главным путём для self-hosted продукта;
- React-based static export из `aqa-pulse` остаётся главным путём для офлайн dashboard;
- `aqa-pulse/react` подходит как internal/embedded integration surface, а не как замена self-hosted deployment flow.

## Рекомендуемый порядок миграции для существующих клиентов

1. Для новых внедрений использовать `aqa-pulse-server`.
2. Для офлайн-отчётов перейти со старого HTML renderer API на static export workflow.
3. Для helper/types-only сценариев использовать `aqa-pulse-browser`.
4. Для embedded integration использовать `aqa-pulse/react`, `aqa-pulse/hooks`, `aqa-pulse/types` внутри доверенного/internal runtime.

## Коротко

- `aqa-pulse-server` = основной self-hosted продукт.
- `aqa-pulse` static build = supported путь для офлайн React dashboard.
- `aqa-pulse-browser` = publishable browser-safe helper/type surface.
- old string-based renderer flow больше не является supported package path: новые пользовательские сценарии и новые метрики добавляются только в React runtime.