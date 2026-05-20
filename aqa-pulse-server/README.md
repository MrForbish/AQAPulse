# aqa-pulse-server

Self-hosted server package для AQA Pulse.

В пакете есть:

- backend ingestion API;
- React dashboard/admin runtime;
- storage drivers `file`, `sqlite`, `postgres`;
- Dockerfile и Docker Compose;
- setup/update scripts;
- GitLab template для загрузки отчетов через `@aqa-pulse/cli`.

## Документация

- [SELF-HOSTED-DEPLOYMENT.md](./SELF-HOSTED-DEPLOYMENT.md) — полный self-hosted deployment guide.
- [GITLAB-CI-INTEGRATION.md](./GITLAB-CI-INTEGRATION.md) — подключение GitLab CI и `.aqa-pulse.yml`.
- [MIGRATION.md](./MIGRATION.md) — заметки по переходу со старого renderer flow на текущий React/runtime flow.
- [template/gitlab/README.md](./template/gitlab/README.md) — краткая справка по reusable GitLab template.

## Быстрый старт

Все команды выполняй из директории `aqa-pulse-server`.

```bash
npm run setup:docker -- --workspace-name "Autotests main" --workspace-slug autotests-main --public-host aqa-pulse.example.com
```

Команда:

- создает `.env`, если его еще нет;
- поднимает `docker compose up --build -d`;
- ждет health-check;
- создает первый workspace;
- печатает `AQA_PULSE_BASE_URL`, `AQA_PULSE_WORKSPACE_SLUG`, `AQA_PULSE_WORKSPACE_API_KEY`;
- при `--public-host` пишет Nginx snippet в `.generated/nginx/<host>.conf`.

## Обновление

После `git pull` на сервере:

```bash
npm run update:docker -- --build-package
```

Только restart без rebuild:

```bash
npm run docker:restart
```

## CLI

Для CI-подключения проектов автотестов используй публичный npm-пакет:

```bash
npx @aqa-pulse/cli@latest upload-from-config --config .aqa-pulse.yml
```

Внутренний `aqa-pulse-server` CLI сохранен для self-hosted/admin сценариев:

- `aqa-pulse-server start`
- `aqa-pulse-server init`
- `aqa-pulse-server bootstrap-workspace --name "<workspace name>" [--slug <slug>] [--base-url <url>] [--skip-user] [--json]`
- `aqa-pulse-server bootstrap-demo`
- `aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]`
- `aqa-pulse-server sqlite-backup [backupDirectory]`
- `aqa-pulse-server generate-source-facts [--report <path>] [--out <path>] [--repo-root <path>] [--json]`
- `aqa-pulse-server merge-reports [--project-kind ui|api] --output <path> [--allow-missing] <input...>`
- `aqa-pulse-server upload-report [--report <path>] [--source-facts <path>] [--generate-source-facts] [--repo-root <path>]`
- `aqa-pulse-server upload-from-config [--config .aqa-pulse.yml] [--dry-run] [--json]`
