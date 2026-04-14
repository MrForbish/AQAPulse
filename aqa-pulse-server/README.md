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
- CLI: `aqa-pulse-server bootstrap-demo`
- CLI: `aqa-pulse-server sqlite-migrate`
- CLI: `aqa-pulse-server sqlite-backup`

## Быстрый self-hosted запуск

```powershell
npm install
npm run build

$env:AQA_PULSE_DATA_ROOT = "C:\data\aqa-pulse"
$env:AQA_PULSE_STORAGE_DRIVER = "file"
$env:AQA_PULSE_SQLITE_PATH = "C:\data\aqa-pulse\aqa-pulse.sqlite"
$env:AQA_PULSE_POSTGRES_URL = "postgresql://postgres:postgres@127.0.0.1:5432/aqa_pulse"
$env:AQA_PULSE_ADMIN_TOKEN = "local-admin-token"
$env:AQA_PULSE_JWT_SECRET = "change-me-jwt-secret"
$env:AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS = "28800"
$env:AQA_PULSE_ENABLE_DEV_BOOTSTRAP = "false"
$env:AQA_PULSE_REQUIRE_WORKSPACE_AUTH = "true"

node .\bin\aqa-pulse-server.js init
node .\bin\aqa-pulse-server.js start
```

## PowerShell installer

```powershell
Set-Location "C:\Users\mpecherskiy\WebstormProjects\autotests\aqa-pulse-server"
.\scripts\install-self-hosted.ps1 -DataRoot ".\data" -AdminToken "change-me-admin-token" -StorageDriver sqlite
```

## Docker Compose

```powershell
Set-Location "C:\Users\mpecherskiy\WebstormProjects\autotests\aqa-pulse-server"
docker compose up --build
```

`docker-compose.yml` использует:

- build context = корень репозитория;
- `aqa-pulse-server/Dockerfile`;
- volume `./data:/data`;
- настройки из `.env.example`.

## Команды CLI

- `aqa-pulse-server start`
- `aqa-pulse-server init`
- `aqa-pulse-server bootstrap-demo`
- `aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]`
- `aqa-pulse-server sqlite-backup [backupDirectory]`

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

