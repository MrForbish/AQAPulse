# AQA Pulse

Изолированный прототип аналитического дашборда для Playwright, вынесенный в отдельную директорию в корне `autotests`.

## Что уже делает AQA Pulse

- читает JSON-репорт Playwright в формате `@clipboard-health/playwright-reporter-llm`;
- считает базовые метрики Week 1:
  - `totalTests`
  - `passedTests`
  - `failedTests`
  - `flakyTests`
  - `passRate`
  - `errorClusters`
  - `totalDuration`
  - `medianDuration`
    - сохраняет историю запусков в `dist/history.json`;
    - показывает тренд `Pass Rate` и дельты к предыдущему прогону;
- генерирует `dist/dashboard-data.json`;
- собирает статический `dist/index.html` в визуальном стиле `dashboard.html`;
- показывает dashboard по табам категорий метрик: `Обзор`, `Производительность`, `Flaky-аналитика`, `Качество кода тестов`, `Бизнес-метрики`, `Командные метрики`, `AI / ML`;
- рендерит server-side drill-down страницу истории конкретного теста;
- показывает info icon / tooltip с описанием ключевых метрик;
- использует общий helper `src/render-metric-info.ts` для tooltip'ов и заголовков метрик в dashboard и на drill-down странице теста;
- поддерживает каскадные фильтры `branch -> project -> file` в UI и query params.

## Минимальная схема теста в upload JSON

Для runtime-метрики AQA Pulse теперь поддерживает явное поле `browser` на уровне теста.
Если `browser` передан, метрика `Runtime-проекты / браузеры` использует его.
Если `browser` отсутствует, AQA Pulse использует `Chrome` по умолчанию.

Пример минимального объекта теста:

```json
{
  "id": "T-1",
  "title": "Checkout > completes order with saved card",
  "status": "passed",
  "flaky": false,
  "durationMs": 11400,
  "location": {
    "file": "tests/UI/checkout/checkout.spec.ts",
    "line": 18,
    "column": 5
  },
  "project": "ui",
  "browser": "chromium",
  "retries": 0,
  "errors": [],
  "attempts": [
    {
      "attempt": 1,
      "status": "passed",
      "durationMs": 11400,
      "startTime": "2026-04-14T12:34:00.000Z"
    }
  ]
}
```

Поле `browser` опционально. Если его не передать, для runtime-метрики будет использован `Chrome`. Если передать, AQA Pulse покажет значение этого поля как есть.

## Что уже реализовано из первых P1-метрик

На текущих данных уже считаются и отображаются:

- `M2.1 P95 / P99 Duration`
- `M2.2 Slowest Tests` (top slowest tests)
- `M2.3 Duration Trend`
- `M2.7 Flaky Score (0-100)`
- `M2.8 MTBF`
- `M2.9 First Flake to Fix`
- `M2.10 Flaky Trend`
- `M2.23 Cost of Flakiness` (proxy)
- `M2.24 Developer Friction` (proxy)
- `M2.25 Release Confidence Score` (proxy)

Пока сознательно не реализованы, потому что не хватает входных данных:

- полноценная non-proxy версия бизнес-метрик с реальными cost inputs и coverage

## Табы dashboard и статус фич

- `Обзор`
  - `Последний vs предыдущий запуск`
  - `Pass Rate trend`
  - `Status distribution`
  - `История запусков`
  - `Замечания по AQA Pulse`
- `Производительность`
  - `Duration Trend`
  - `Топ медленных тестов`
  - таблица `Top slowest tests (P1)` с drill-down ссылками по названию теста
- `Flaky-аналитика`
  - `Flaky Trend`
  - `Кластеры ошибок`
  - `Топ проблемных тестов`
  - `Top flaky tests (P1)`
  - drill-down ссылки на HTML-страницу истории теста сохранены
- `Бизнес-метрики`
  - `Cost of Flakiness` (proxy)
  - `Developer Friction` (proxy)
  - `Release Confidence Score` (proxy)
  - `Cost breakdown (proxy)`
  - `Config assumptions`
- `Качество кода тестов`, `Командные метрики`, `AI / ML`
  - пока показываются как честные placeholder-панели
  - UI явно объясняет, каких данных пока не хватает для расчёта

## Структура

```text
aqa-pulse/
├── fixtures/               # демо-репорт для локальной проверки
├── src/                    # TypeScript-исходники
├── dist/                   # итоговый JSON + HTML после генерации, плюс history.json
├── history/                # архив запусков: <run>/data.json + metadata.json
├── package.json
├── tsconfig.json
└── README.md
```

## Быстрый старт

Все команды ниже, если не указано иное, выполняются из каталога `aqa-pulse/`.

```bash
npm install
npm run generate:history-demo
npm run typecheck
```

После этого открой `aqa-pulse/dist/index.html` в браузере.

## SaaS foundation (workspace-scoped MVP)

Теперь в `aqa-pulse` есть первый SaaS-oriented слой поверх текущей аналитики:

- registry рабочих пространств в `dev-data/registry.json`;
- изоляция данных по workspace в `dev-data/workspaces/<slug>/`;
- ingestion Playwright JSON-репорта по HTTP;
- отдельные HTML/API routes на workspace:
  - `GET /w/:slug`
  - `GET /w/:slug/test/:name`
  - `GET /api/workspaces/:slug/*`

### Что хранится по workspace

```text
aqa-pulse/dev-data/
├── registry.json
└── workspaces/
    └── <slug>/
        ├── dist/
        │   ├── dashboard-data.json
        │   └── history.json
        ├── history/
        │   └── <run>/data.json + metadata.json
        └── raw-reports/
```

### Быстрый demo-flow для SaaS слоя

```bash
# 1. Подготовить demo workspace и ingest sample report
npm run saas:demo

# 2. Поднять API/UI
npm run api
```

После этого будут доступны:

```text
http://127.0.0.1:3000/w/demo
http://127.0.0.1:3000/api/workspaces/demo/summary
```

### Bootstrap workspace через HTTP

```bash
curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/api/dev/bootstrap" \
  -H "Content-Type: application/json" \
  -d '{"slug":"demo","name":"Demo Workspace"}'
```

Ответ вернёт `workspace` и plaintext `apiKey` — сохрани его, он нужен для ingestion.

### Загрузка Playwright JSON-репорта в workspace

```bash
API_KEY="<workspace-api-key>"

INGESTION_JWT=$(curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/auth/workspaces/demo/api-keys/login" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$API_KEY\"}" \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { process.stdout.write(JSON.parse(body).accessToken); });")

node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('./fixtures/sample-llm-report.json', 'utf8'));
// Если хочешь явно разделять runtime по браузерам,
// передавай report.tests[*].browser, например: chromium.
const payload = {
  report,
  metadata: {
    branch: 'main',
    commit: 'manual-upload',
    author: 'AQA Pulse SaaS MVP'
  },
  sourceFile: 'manual://sample-llm-report.json'
};
fs.writeFileSync('/tmp/aqa-pulse-ingestion.json', JSON.stringify(payload));
"

curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/api/workspaces/demo/ingestions" \
  -H "Authorization: Bearer $INGESTION_JWT" \
  -H "Content-Type: application/json" \
  --data @/tmp/aqa-pulse-ingestion.json
```

### Workspace-scoped API

- `GET /api/workspaces`
- `GET /api/workspaces/:slug`
- `POST /api/workspaces`
- `POST /api/workspaces/:slug/api-keys`
- `POST /api/workspaces/:slug/users`
- `POST /api/workspaces/:slug/ingestions`
- `GET /api/workspaces/:slug/summary`
- `GET /api/workspaces/:slug/runs`
- `GET /api/workspaces/:slug/run/:id`
- `GET /api/workspaces/:slug/flaky`
- `GET /api/workspaces/:slug/errors/clusters`
- `GET /api/workspaces/:slug/metrics/cost`
- `GET /api/workspaces/:slug/test/:name`

Это пока dev-storage MVP, но уже с правильной SaaS-моделью: `workspace -> API key -> isolated history -> isolated dashboard`.

### Конфиг для SaaS-ready локального сервера

Сервер теперь поддерживает явную конфигурацию путей и защиту admin routes:

```bash
export AQA_PULSE_DATA_ROOT="/srv/aqa-pulse"
export AQA_PULSE_DIST_PATH="/opt/autotests/aqa-pulse/dist"
export AQA_PULSE_ARCHIVE_PATH="/opt/autotests/aqa-pulse/history"
export AQA_PULSE_ADMIN_TOKEN="local-admin-token"
export AQA_PULSE_ENABLE_DEV_BOOTSTRAP="false"
npm run api
```

Назначение переменных:

- `AQA_PULSE_DATA_ROOT` — storage для `registry.json` и `workspaces/<slug>`;
- `AQA_PULSE_STORAGE_DRIVER` — storage backend: `file`, `sqlite` или `postgres`;
- `AQA_PULSE_SQLITE_PATH` — путь к sqlite-файлу для self-hosted SQLite режима;
- `AQA_PULSE_POSTGRES_URL` — connection string для Postgres режима;
- `AQA_PULSE_DIST_PATH` — legacy summary/static HTML для root dashboard;
- `AQA_PULSE_ARCHIVE_PATH` — legacy archive runs для root API/drill-down;
- `AQA_PULSE_ADMIN_TOKEN` — защита admin routes (`/api/workspaces*`, `/api/dev/bootstrap`);
- `AQA_PULSE_JWT_SECRET` — секрет подписи admin/workspace JWT, если нужен отдельный secret;
- `AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS` — TTL JWT/cookie в секундах;
- `AQA_PULSE_ENABLE_DEV_BOOTSTRAP=false` — отключение `POST /api/dev/bootstrap`;
- `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true` — обязательный workspace user token для чтения `/w/:slug` и `/api/workspaces/:slug/*`.

Если `AQA_PULSE_ADMIN_TOKEN` не задан, admin routes остаются открытыми — это удобно локально, но не подходит для прод-окружения.

Важно: plaintext provisioning token'ы больше не используются как прямой Bearer для защищённых routes.

Актуальная схема такая:

- `admin token` → `POST /auth/admin/login` → admin JWT / session cookie;
- `workspace API key` → `POST /auth/workspaces/:slug/api-keys/login` → ingestion JWT;
- `workspace user token` → `POST /auth/workspaces/:slug/users/login` → workspace read JWT / session cookie.

Пример admin-запроса через JWT exchange:

```bash
ADMIN_JWT=$(curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"token":"local-admin-token"}' \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { process.stdout.write(JSON.parse(body).accessToken); });")

curl --silent --show-error --fail \
  -H "Authorization: Bearer $ADMIN_JWT" \
  "http://127.0.0.1:3000/api/workspaces"
```

### Короткие команды запуска

```bash
# демо-данные + HTML
npm run generate:history-demo

# локальный API
npm run api:demo

# инициализировать self-hosted data root
npm run self-hosted:init

# реальный Playwright JSON-репорт
npm run parse -- "../Playwright/test-results/dashboard/data.json" "./dist/dashboard-data.json" "./dist/history.json" --branch main --commit 12345678abcdef --author "M. Pecherskiy"
npm run build -- "./dist/dashboard-data.json" "./dist/index.html"
```

## npm / CLI packaging

`aqa-pulse` теперь можно собирать как npm-пакет с CLI entrypoint `aqa-pulse`.

Отдельно появился server-free entrypoint `aqa-pulse/core` — это core analytics/rendering слой без self-hosted runtime.

Проверка упаковки:

```bash
npm run compile
npm run pack:check
npm run publish:check
npm run server:pack:check
```

## Self-hosted server package

Теперь backend можно собирать как отдельный **internal** package `aqa-pulse-server`.

Отдельные практичные инструкции:

- [`../aqa-pulse-server/SELF-HOSTED-QUICKSTART.md`](../aqa-pulse-server/SELF-HOSTED-QUICKSTART.md) — короткая версия: как быстро поставить на свой сервер
- [`../aqa-pulse-server/CLIENT-QUICKSTART.md`](../aqa-pulse-server/CLIENT-QUICKSTART.md) — короткая версия: что передавать клиенту
- [`../aqa-pulse-server/SELF-HOSTED-INSTALL.md`](../aqa-pulse-server/SELF-HOSTED-INSTALL.md) — как поставить на свой сервер
- [`../aqa-pulse-server/CLIENT-ONBOARDING.md`](../aqa-pulse-server/CLIENT-ONBOARDING.md) — что передавать клиенту и как его онбордить

Он нужен для self-hosted / on-prem сценария и содержит:

- `createSaasApp(...)`
- file/sqlite storage abstraction
- auth middleware для `admin token`, `workspace API key` и `workspace user token`
- CLI runner `aqa-pulse-server`

Быстрый сценарий:

```bash
cd /opt/autotests/aqa-pulse-server
npm install
npm run build

export AQA_PULSE_DATA_ROOT="/srv/aqa-pulse"
export AQA_PULSE_STORAGE_DRIVER="sqlite"
export AQA_PULSE_SQLITE_PATH="/srv/aqa-pulse/aqa-pulse.sqlite"
export AQA_PULSE_ADMIN_TOKEN="local-admin-token"
export AQA_PULSE_ENABLE_DEV_BOOTSTRAP="false"
export AQA_PULSE_REQUIRE_WORKSPACE_AUTH="true"

npm run init
npm run start
```

PowerShell installer:

```bash
cd /opt/autotests/aqa-pulse-server
pwsh ./scripts/install-self-hosted.ps1 -DataRoot ./data -AdminToken "change-me-admin-token" -StorageDriver sqlite
```

Docker Compose:

```bash
cd /opt/autotests/aqa-pulse-server
docker compose up --build
```

Проверка упаковки server-пакета:

```bash
cd /opt/autotests/aqa-pulse-server
npm run pack:check
```

CLI-команды server-пакета:

- `aqa-pulse-server start`
- `aqa-pulse-server init`
- `aqa-pulse-server bootstrap-demo`
- `aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]`
- `aqa-pulse-server sqlite-backup [backupDirectory]`

Workspace access model в self-hosted режиме:

- admin routes — через admin JWT / admin session cookie, полученные из `AQA_PULSE_ADMIN_TOKEN`;
- ingestion — через ingestion JWT, полученный exchange-ом из workspace API key;
- read-access к workspace routes — через workspace read JWT / session cookie, полученные из workspace user token, если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`.

### Smoke-команды для актуального auth/storage flow

```bash
# полный self-hosted auth/UI/JWT smoke на file storage
npm run self-hosted:smoke:auth

# полный Postgres smoke (нужен рабочий Docker daemon)
npm run self-hosted:smoke:postgres
```

`self-hosted:smoke:auth` проверяет:

- admin login form + admin JWT/cookie;
- создание workspace / user / API key;
- exchange `raw token -> JWT`;
- ingestion через JWT;
- открытие `/w/:slug` и `/api/workspaces/:slug/*` через workspace JWT/cookie.

Важно: `aqa-pulse-server` остаётся внутренним пакетом и не предназначен для публикации наружу.

Локальная установка tarball и запуск CLI:

```bash
npm pack
npm install -g ./aqa-pulse-0.1.0.tgz

aqa-pulse parse ./fixtures/sample-llm-report.json ./dist/dashboard-data.json ./dist/history.json --branch main --commit 12345678 --author "QA Bot"
aqa-pulse build ./dist/dashboard-data.json ./dist/index.html
aqa-pulse api
```

CLI subcommands:

- `aqa-pulse parse`
- `aqa-pulse build`
- `aqa-pulse api`

CLI help:

```bash
aqa-pulse --help
aqa-pulse parse --help
aqa-pulse build --help
aqa-pulse api --help
```

Пакет сейчас подготовлен к `npm publish --dry-run`, но остаётся с минимально безопасными metadata:

- `license: UNLICENSED`
- без выдуманных `repository`, `homepage`, `bugs`, `author`

В `dist/` будут созданы:

- `dashboard-data.json` — агрегированная сводка для текущего запуска;
- `history.json` — история последних прогонов;
- `assets/chart.umd.js` — локальная копия Chart.js для статического HTML;
- `index.html` — статическая страница дашборда.

Дополнительно будет создан архив запусков:

```text
aqa-pulse/history/
└── YYYY-MM-DD--HH-MM-SS/
    ├── data.json
    └── metadata.json
```

## Прототип API

Поверх `dist/dashboard-data.json` и `dist/history.json` поднят минимальный read-only API.

Теперь UI можно смотреть в двух режимах:

- API-driven UI: `http://127.0.0.1:3000/`
- static fallback: `http://127.0.0.1:3000/static/index.html`

Важно:

- переходы в drill-down историю теста работают в API-driven режиме через серверный route;
- `static/index.html` остаётся полезным fallback для обзора summary, но HTML drill-down страница не генерируется как набор статических файлов на каждый тест.

Доступные endpoint'ы:

- `GET /api/health`
- `GET /api/summary`
- `GET /api/runs`
- `GET /api/run/:id`
- `GET /api/flaky`
- `GET /api/errors/clusters`
- `GET /api/metrics/cost`
- `GET /test/:name`
- `GET /api/test/:name`

Новые P1-метрики попадают в `GET /api/summary`, flaky-аналитика также доступна через `GET /api/flaky` и `GET /api/test/:name`, а cost breakdown отдельно доступен через `GET /api/metrics/cost`.

Для `GET /`, `GET /api/summary`, `GET /api/runs`, `GET /api/flaky`, `GET /api/errors/clusters`, `GET /test/:name` и `GET /api/test/:name` поддерживаются query filters:

- `branch`
- `project`
- `file`

В UI эти фильтры работают каскадно:

- выбор `branch` ограничивает список `project`;
- выбор `branch + project` ограничивает список `file`;
- выбранные фильтры сохраняются в query params и переиспользуются в drill-down ссылках.

Быстрый локальный запуск API на демо-данных:

```bash
npm run api:demo
```

После запуска API будет доступен на:

```text
http://127.0.0.1:3000
```

Главная страница `/` рендерится сервером из текущего `GET /api/summary`, то есть UI теперь живёт поверх того же источника данных, что и API.

Дополнительно из таблиц:

- `Топ проблемных тестов`
- `Top flaky tests (P1)`
- `Top slowest tests (P1)`

название теста является ссылкой на отдельную HTML-страницу истории этого теста.

Примеры UI с фильтрами:

```text
http://127.0.0.1:3000/?project=api
http://127.0.0.1:3000/?branch=main&file=tests/UI/checkout/payment.spec.ts
http://127.0.0.1:3000/test/Checkout%20%3E%20retries%20after%20payment%20gateway%20timeout?project=ui&file=tests%2FUI%2Fcheckout%2Fpayment.spec.ts&branch=main
```

На странице истории теста показываются:

- `Total Runs`
- `Failed Runs`
- `Flaky Runs`
- `Latest Status`
- `Pass Rate`
- `Fail Rate`
- `Flaky Score`
- `MTBF`
- `Latest error` / `Latest flaky event`
- `Previous unstable events`
- `Latest stable recovery`
- `Current stability streak`
- `Unstable streak before recovery`
- история прогонов теста в виде таблицы по времени

Дополнительно для drill-down страницы:

- последний нестабильный эпизод подсвечивается разным акцентом для `error` и `flaky`;
- ниже показывается компактный список нескольких предыдущих нестабильных эпизодов;
- строка recovery подсвечивается отдельным зелёным акцентом;
- отдельно показывается текущая серия стабильных прогонов подряд;
- отдельно показывается длина нестабильного streak перед последним recovery;
- из mini-block'ов есть ссылка `Jump to matching row in history`, которая ведёт к соответствующей строке таблицы истории.

Если `title` не уникален, HTML route вернёт страницу-конфликт `409` со списком кандидатов и готовыми ссылками с `project/file`.

## Использование с реальным JSON-репортом

Если у тебя уже есть файл отчёта, самый простой способ для bash — передавать метаданные через переменные окружения:

```bash
export AQA_PULSE_BRANCH="main"
export AQA_PULSE_COMMIT="12345678abcdef"
export AQA_PULSE_AUTHOR="M. Pecherskiy"
npm run parse -- "../Playwright/test-results/dashboard/data.json" "./dist/dashboard-data.json" "./dist/history.json"
npm run build -- "./dist/dashboard-data.json" "./dist/index.html"
```

Альтернативно можно передать всё вручную аргументами:

```bash
npm run parse -- "../Playwright/test-results/dashboard/data.json" "./dist/dashboard-data.json" "./dist/history.json" --branch main --commit 12345678abcdef --author "M. Pecherskiy"
npm run build -- "./dist/dashboard-data.json" "./dist/index.html"
```

## Быстрая smoke-проверка

```bash
npm run smoke
```

Примеры ручной проверки API:

```bash
curl --silent --show-error --fail "http://127.0.0.1:3000/api/health"
curl --silent --show-error --fail "http://127.0.0.1:3000/api/summary"
curl --silent --show-error --fail "http://127.0.0.1:3000/api/runs"
curl --silent --show-error --fail "http://127.0.0.1:3000/api/flaky"
curl --silent --show-error --fail "http://127.0.0.1:3000/api/errors/clusters"
curl --silent --show-error --fail "http://127.0.0.1:3000/api/metrics/cost"
curl --silent --show-error --fail "http://127.0.0.1:3000/api/test/Checkout%20%3E%20retries%20after%20payment%20gateway%20timeout"
curl --silent --show-error --fail "http://127.0.0.1:3000/api/summary?project=api"
curl --silent --show-error --fail "http://127.0.0.1:3000/api/runs?branch=main&file=tests%2FUI%2Fcheckout%2Fpayment.spec.ts"
```

Примеры ручной проверки HTML drill-down страницы:

```bash
curl --silent --show-error --fail "http://127.0.0.1:3000/"
curl --silent --show-error --fail "http://127.0.0.1:3000/test/Checkout%20%3E%20retries%20after%20payment%20gateway%20timeout?project=ui&file=tests%2FUI%2Fcheckout%2Fpayment.spec.ts&branch=main"
```

Если `title` не уникален между разными файлами/проектами, можно уточнить поиск:

```bash
curl --silent --show-error --fail "http://127.0.0.1:3000/api/test/Catalog%20%3E%20filters%20by%20category%20and%20size?project=ui&file=tests%2FUI%2Fcatalog%2Ffilters.spec.ts"
```

## Proxy business metrics

Для P1 бизнес-метрик сейчас используется proxy-версия на уже доступных данных history и attempts.

- `Cost of Flakiness` = extra retry time + unstable runs + optional денежные assumptions;
- `Developer Friction` = proxy reruns per active day;
- `Release Confidence Score` = композит из `Pass Rate`, обратного `Flaky Ratio`, `Error Health` и `History Consistency`.

Чтобы включить денежную оценку, можно задать env-переменные:

```bash
export AQA_PULSE_CI_MINUTE_COST="2.5"
export AQA_PULSE_DEV_HOURLY_COST="2500"
export AQA_PULSE_ANALYSIS_MINUTES_PER_UNSTABLE="10"
```

Если assumptions не заданы, dashboard и API всё равно показывают retry time / unstable runs / friction, а денежные поля остаются `null` / `—`.

В UI это видно в:

- `Business metrics (proxy)`
- `Cost breakdown (proxy)`
- `Config assumptions`

## Как работает история

- каждый запуск `parse` дописывает текущий прогон в `dist/history.json`;
- параллельно создаётся архив `history/<run>/data.json` и `history/<run>/metadata.json`;
- история автоматически дедуплицируется по `timestamp + sourceFile`;
- хранится не больше 20 последних прогонов;
- для каждого прогона сохраняются `branch`, `commit`, `author`, если они переданы через CLI или env;
- в HTML показываются последние запуски и тренд `Pass Rate`.

`metadata.json` содержит идентификацию запуска и KPI-сводку, а `data.json` хранит полный исходный JSON-репорт этого прогона.

## Что нужно для локального запуска на реальных данных

Сейчас в репозитории **нет готового** `Playwright/test-results/data.json`, поэтому для реального прогона нужен совместимый JSON-репорт Playwright.

Минимально нужно одно из двух:

1. Либо сгенерировать `data.json` репортёром формата `@clipboard-health/playwright-reporter-llm`.
2. Либо подготовить совместимый JSON вручную/конвертером и передать его в `npm run parse`.

### Безопасный способ получить `data.json` из Playwright

Отдельный Playwright dashboard config больше не обязателен.

Теперь `data.json` можно генерировать через основной `Playwright/playwright.config.ts`: reporter `@clipboard-health/playwright-reporter-llm` подключается автоматически, если задан `PW_LLM_REPORT`.

Для drill-down diagnostics поддерживаются и расширенные optional-поля шагов внутри `attempts[].steps[]`:

- `status` — статус конкретного шага;
- `error.message` — текст ошибки именно на шаге;
- `failed` — явный marker, что тест упал на этом шаге.

Также на уровне `attempt` можно передавать `failedStepIndex` или `failedStepTitle`, если reporter знает точную точку падения, но не вкладывает ошибку прямо в объект шага.

Если этих полей нет, `aqa-pulse` теперь сам пытается восстановить точку падения при `parse` и server-side ingestion: сначала ищет явный `step.failed` / `step.error` / неуспешный `step.status`, а если их нет, для неуспешной попытки помечает последний записанный шаг как вероятную точку падения. Явные поля из reporter всё равно приоритетнее и дают более точную root cause аналитику.

Что нужно, чтобы этот запуск реально сработал:

- установленные зависимости в `Playwright`;
- установленные браузеры Playwright, если они ещё не стоят локально;
- корректный `.env` в корне репозитория или в `Playwright/.env`;
- доступный стенд / валидные креды для тех тестов, которые ты запускаешь.

Пример для UI-тестов:

```bash
cd /opt/autotests/Playwright
npm install
npm run pw:test:ui:dashboard
```

После этого ожидаемый JSON-репорт появится здесь:

```text
Playwright/test-results/dashboard/data.json
```

Практически это выглядит так:

```bash
# 1. Сгенерировать совместимый data.json из Playwright
cd /opt/autotests/Playwright
npm run pw:test:ui:dashboard

# 2. Сгенерировать dashboard-data.json + history.json
cd /opt/autotests/aqa-pulse
npm run parse -- "../Playwright/test-results/dashboard/data.json" "./dist/dashboard-data.json" "./dist/history.json" --branch main --commit 12345678abcdef --author "M. Pecherskiy"

# 3. Собрать HTML
npm run build -- "./dist/dashboard-data.json" "./dist/index.html"
```

Если нужен API-репорт вместо UI, используй:

```bash
cd /opt/autotests/Playwright
npm run pw:test:api:dashboard
```

> Reporter `@clipboard-health/playwright-reporter-llm` теперь включается прямо в `Playwright/playwright.config.ts`, если задан `PW_LLM_REPORT`. Источник `data.json` по-прежнему используется как внешний входной файл для `aqa-pulse`.

## Следующий шаг по плану

- перейти от локального файлового API к серверу с устойчивым history-хранилищем по папкам запусков;
- расширять страницу истории конкретного теста новыми drill-down блоками и cross-run аналитикой;
- затем переходить к продвинутым P1-метрикам из плана.

## Локальная проверка end-to-end

Минимальный сценарий локальной проверки после изменений:

```bash
npm install
npm run generate:history-demo
npm run typecheck
npm run api
```

Дальше вручную проверь в браузере:

1. открыть `http://127.0.0.1:3000/`;
2. переключить табы `Обзор` / `Производительность` / `Flaky-аналитика` / `Бизнес-метрики` и убедиться, что контент меняется без перезагрузки страницы;
3. убедиться, что `Качество кода тестов`, `Командные метрики` и `AI / ML` показывают placeholder-панели с объяснением, а не пустые секции;
4. убедиться, что в таблицах `Топ проблемных тестов`, `Top flaky tests (P1)` и `Top slowest tests (P1)` названия тестов кликабельны;
5. перейти по ссылке в историю теста;
6. убедиться, что summary cards и таблица истории рендерятся server-side;
7. навести курсор на info icon рядом с метриками и проверить tooltip-описания как на главной странице, так и на drill-down странице;
8. проверить каскад фильтров `branch -> project -> file`: после выбора `branch` список `project` должен сузиться, а после выбора `project` — список `file`.


