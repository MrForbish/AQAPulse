# aqa-pulse-server

Self-hosted server package для AQA Pulse.

В этом пакете есть:

- готовый сервер и React dashboard/runtime bundle;
- storage для `file`, `sqlite`, `postgres`;
- auth для admin, workspace API key и workspace user token;
- Dockerfile и Docker Compose;
- setup/update scripts для короткого server lifecycle;
- GitLab upload template.

## Куда смотреть

- [`SELF-HOSTED-DEPLOYMENT.md`](./SELF-HOSTED-DEPLOYMENT.md) — основной и единственный полный guide по self-hosted развёртке.
- [`SELF-HOSTED-QUICKSTART.md`](./SELF-HOSTED-QUICKSTART.md) — короткий checklist для первого запуска.
- [`SELF-HOSTED-INSTALL.md`](./SELF-HOSTED-INSTALL.md) — reference по вариантам установки.
- [`MIGRATION.md`](./MIGRATION.md) — как переходить со старого pre-React delivery flow на текущий React runtime.
- [`GITLAB-CI-INTEGRATION.md`](./GITLAB-CI-INTEGRATION.md) — только про upload из GitLab CI.

## Рекомендуемый старт

Все команды выполняй из директории `aqa-pulse-server`.

Самый короткий путь:

```bash
npm run setup:docker -- --workspace-name "Autotests main" --workspace-slug autotests-main --public-host aqa-pulse.example.com
```

Эта команда:

- генерирует `.env`;
- поднимает `docker compose up --build -d`;
- ждёт локальный health-check;
- создаёт первый workspace;
- печатает токены и GitLab variables;
- при `--public-host` пишет Nginx snippet в `./.generated/nginx/<host>.conf`.

## Операционные команды

```bash
npm run update:docker
npm run docker:restart
```

- `update:docker` — backup SQLite, rebuild Docker image, restart container, wait for health-check.
- `docker:restart` — restart контейнера без rebuild образа и без backup.

Если ты работаешь прямо из этой папки проекта и обновил код через `git pull`:

```bash
npm run update:docker -- --build-package
```

Двойной `--` здесь нужен специально: npm передаёт `--build-package` во внутренний script `update:docker`.

## Что входит в готовую сборку

Готовую сборку сервера можно передавать без соседней папки `aqa-pulse`, если `dist/**/*` уже собран.

В поставку входят:

- `dist/**/*`;
- `bin/**/*`;
- `Dockerfile`, `docker-compose.yml`, `.env.example`;
- `scripts/setup-self-hosted.js`;
- `scripts/update-self-hosted.js`;
- `scripts/install-self-hosted.ps1`;
- docs включая `MIGRATION.md` и `template/gitlab/aqa-pulse-upload.gitlab-ci.yml`.

## CLI

- `aqa-pulse-server start`
- `aqa-pulse-server init`
- `aqa-pulse-server bootstrap-workspace --name "<workspace name>" [--slug <slug>] [--base-url <url>] [--skip-user] [--json]`
- `aqa-pulse-server bootstrap-demo`
- `aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]`
- `aqa-pulse-server sqlite-backup [backupDirectory]`
- `aqa-pulse-server upload-report [--report <path>] [--base-url <url>] [--workspace-slug <slug>] [--workspace-api-key <key>]`

`upload-report` подходит и для обычного JSON upload, и для Playwright artifact-aware upload: если рядом с report доступны `test-results-*` output directories или markdown/screenshots attachments, CLI подготовит их для ingestion перед отправкой.

