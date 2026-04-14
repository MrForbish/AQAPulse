# aqa-pulse-server

Внутренний self-hosted server package для AQA Pulse.

Дополнительные инструкции:
- [`SELF-HOSTED-QUICKSTART.md`](./SELF-HOSTED-QUICKSTART.md) — короткая версия для быстрого старта на своём сервере
- [`CLIENT-QUICKSTART.md`](./CLIENT-QUICKSTART.md) — короткая версия для клиента
- [`SELF-HOSTED-INSTALL.md`](./SELF-HOSTED-INSTALL.md) — как поставить на свой сервер
- [`CLIENT-ONBOARDING.md`](./CLIENT-ONBOARDING.md) — что передавать клиенту и что он должен установить
- [`GITLAB-CI-INTEGRATION.md`](./GITLAB-CI-INTEGRATION.md) — как поднять сервер отдельно и отправлять отчёты из GitLab CI

Что входит:
- `createSaasApp(...)`
- file/sqlite/postgres storage abstraction для workspace/registry/dashboard read-model
- auth middleware и UI flow для admin, workspace API key и workspace user token
- CLI: `aqa-pulse-server start`
- CLI: `aqa-pulse-server init`
- CLI: `aqa-pulse-server bootstrap-workspace`
- CLI: `aqa-pulse-server bootstrap-demo`
- CLI: `aqa-pulse-server sqlite-migrate`
- CLI: `aqa-pulse-server sqlite-backup`

## Быстрый self-hosted запуск

```bash
npm install
npm run build

export AQA_PULSE_DATA_ROOT="/srv/aqa-pulse"
export AQA_PULSE_STORAGE_DRIVER="file"
export AQA_PULSE_SQLITE_PATH="/srv/aqa-pulse/aqa-pulse.sqlite"
export AQA_PULSE_POSTGRES_URL="postgresql://postgres:postgres@127.0.0.1:5432/aqa_pulse"
export AQA_PULSE_ADMIN_TOKEN="local-admin-token"
export AQA_PULSE_JWT_SECRET="change-me-jwt-secret"
export AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS="28800"
export AQA_PULSE_ENABLE_DEV_BOOTSTRAP="false"
export AQA_PULSE_REQUIRE_WORKSPACE_AUTH="true"

node ./bin/aqa-pulse-server.js init
node ./bin/aqa-pulse-server.js start
```

## PowerShell installer

```bash
cd /opt/aqa-pulse-server
pwsh ./scripts/install-self-hosted.ps1 -DataRoot ./data -AdminToken "change-me-admin-token" -StorageDriver sqlite
```

## Docker Compose

```bash
cd /opt/aqa-pulse-server
cp .env.example .env
docker compose up --build
```

`docker-compose.yml` использует:

- локальный build context текущего пакета;
- `Dockerfile` из `aqa-pulse-server` bundle;
- volume `./data:/data`;
- настройки из `.env` (обычно создаётся копированием `.env.example`).

## Что входит в аккуратную self-hosted поставку

`aqa-pulse-server` можно везти как отдельный runtime bundle без соседней папки `aqa-pulse`, если пакет уже собран (`dist/**/*`).

В bundle уже включены:

- runtime `dist/**/*`;
- CLI `bin/**/*`;
- `Dockerfile`, `docker-compose.yml`, `.env.example`;
- install/onboarding docs;
- PowerShell installer;
- GitLab CI template `templates/gitlab/aqa-pulse-upload.gitlab-ci.yml`.

Соседний `aqa-pulse` нужен только на этапе локальной сборки `npm run build`, потому что `aqa-pulse-server` собирает runtime из `../aqa-pulse/dist-ts`.

## Команды CLI

- `aqa-pulse-server start`
- `aqa-pulse-server init`
- `aqa-pulse-server bootstrap-workspace --name "<workspace name>" [--slug <slug>] [--base-url <url>] [--skip-user] [--json]`
- `aqa-pulse-server bootstrap-demo`
- `aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]`
- `aqa-pulse-server sqlite-backup [backupDirectory]`

## Быстрый bootstrap workspace под GitLab CI

Если сервер уже поднят и storage инициализирован, можно не делать provisioning руками через admin UI/API, а сразу создать workspace и получить нужные секреты одной командой:

```bash
cd /opt/aqa-pulse-server
npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url https://aqa-pulse.example.com
```

Команда:

- создаёт workspace;
- создаёт ingestion `workspace API key`;
- если `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`, создаёт ещё и `workspace user token` для login в dashboard;
- печатает готовый блок переменных для GitLab CI/CD.

Если сервер запущен в Docker Compose, можно сделать то же самое внутри контейнера:

```bash
cd /opt/aqa-pulse-server
docker compose exec aqa-pulse-server npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url https://aqa-pulse.example.com
```

Для автоматизации можно получить JSON:

```bash
npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url https://aqa-pulse.example.com --json
```

## Важные env

- `PORT`
- `AQA_PULSE_DATA_ROOT`
- `AQA_PULSE_STORAGE_DRIVER`
- `AQA_PULSE_SQLITE_PATH`
- `AQA_PULSE_POSTGRES_URL`
- `AQA_PULSE_DIST_PATH`
- `AQA_PULSE_ARCHIVE_PATH`
- `AQA_PULSE_ADMIN_TOKEN`
- `AQA_PULSE_JWT_SECRET`
- `AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS`
- `AQA_PULSE_ENABLE_DEV_BOOTSTRAP`
- `AQA_PULSE_REQUIRE_WORKSPACE_AUTH`

## Workspace access model

- admin routes (`/admin`, `/api/workspaces*`) — через admin JWT / session cookie, полученные exchange-ом из `AQA_PULSE_ADMIN_TOKEN`;
- ingestion routes — через ingestion JWT, полученный exchange-ом из workspace API key;
- workspace read routes (`/w/:slug`, `/api/workspaces/:slug/*`) — через workspace JWT / session cookie, полученные exchange-ом из workspace user token, если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`.

## Практический flow токенов

1. Открыть `GET /admin/login` или вызвать `POST /auth/admin/login` и получить admin JWT.
2. Создать workspace, workspace user и workspace API key через admin routes.
3. Для CI/ingestion сделать exchange:

```text
POST /auth/workspaces/:slug/api-keys/login
```

4. Для dashboard/UI сделать exchange:

```text
POST /auth/workspaces/:slug/users/login
```

5. Использовать уже не raw provisioning token, а выданный JWT.

## Сколько токенов реально нужно

Практически схема такая:

- **для GitLab CI upload** нужен ровно **один долгоживущий секрет** — `workspace API key`;
- **admin token** в CI хранить не нужно: он нужен только для provisioning/admin-операций;
- **ingestion JWT** в CI хранить не нужно: `Playwright/scripts/upload-aqa-pulse-report.js` получает его сам через exchange `workspace API key -> ingestion JWT` на каждый job run;
- **workspace user token** нужен только если ты хочешь закрыть dashboard/read-routes (`AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`).

То есть:

- минимальный приватный setup для **CI ingestion без закрытого dashboard** = `admin token` для первоначальной настройки + `workspace API key` для GitLab;
- минимальный приватный setup для **CI ingestion + закрытый dashboard** = `admin token` + `workspace API key` + `workspace user token`.

Отдельные raw token'ы для ingestion и read-доступа здесь оправданы scope-разделением:

- `workspace API key` даёт только `workspace:ingest`;
- `workspace user token` даёт только `workspace:read`;
- admin token даёт только `admin`.

Объединить всё в один raw token теоретически можно только ценой отказа от разделения прав. Для production/self-hosted сценария это хуже по безопасности и сейчас в runtime-модели не требуется.

## Интеграция с Playwright CI

В текущем репозитории совместимый отчёт генерируется через `Playwright/playwright.dashboard.config.ts` и reporter `@clipboard-health/playwright-reporter-llm`.

Ожидаемый файл:

```text
Playwright/test-results/dashboard/data.json
```

Рекомендуемый CI flow:

1. тестовая job генерирует `data.json`;
2. отдельный post-step делает exchange `workspace API key -> ingestion JWT`;
3. этот же step отправляет `POST /api/workspaces/:slug/ingestions` с payload `{ report, metadata, sourceFile }`;
4. dashboard открывается по `https://<host>/w/<slug>`.

