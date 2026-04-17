# AQA Pulse — быстрый self-hosted запуск

Полная версия: [`SELF-HOSTED-DEPLOYMENT.md`](./SELF-HOSTED-DEPLOYMENT.md)

Этот файл нужен только как короткий checklist.

## Что нужно

- Docker
- Docker Compose
- каталог `aqa-pulse-server` с готовым `dist/**/*`

## Быстрый путь

Все команды выполняй из `aqa-pulse-server`.

```bash
npm run setup:docker -- --workspace-name "Autotests main" --workspace-slug autotests-main --public-host aqa-pulse.example.com
```

Если `.env` уже существует, команда по умолчанию не переписывает его, а использует существующие значения как есть. Если в файле остались `change-me-*` заглушки, пересоздай конфиг через `--overwrite-env` или обнови нужные поля вручную.

Для блока `Параметры расчёта` в Business dashboard server-side defaults задаются там же, в `.env`:

```text
AQA_PULSE_CI_MINUTE_COST=9
AQA_PULSE_DEV_HOURLY_COST=4500
AQA_PULSE_ANALYSIS_MINUTES_PER_UNSTABLE=20
```

Эти значения попадают в API summary как базовый сценарий. В React dashboard их можно локально переопределить для live-пересчёта, но browser editor не меняет `.env` и не переписывает сохранённые server settings.

Результат:

- создан `.env`;
- поднят Docker Compose;
- проверен локальный health-check;
- создан workspace;
- напечатаны `AQA_PULSE_BASE_URL`, `AQA_PULSE_WORKSPACE_SLUG`, `AQA_PULSE_WORKSPACE_API_KEY`;
- создан Nginx snippet в `./.generated/nginx/<host>.conf`.

## Что сохранить

В GitLab CI/CD variables нужны только:

```text
AQA_PULSE_BASE_URL=https://aqa-pulse.example.com
AQA_PULSE_WORKSPACE_SLUG=autotests-main
AQA_PULSE_WORKSPACE_API_KEY=<workspace-api-key>
```

## Как открыть dashboard

```text
https://aqa-pulse.example.com/w/autotests-main
```

Если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`, сначала используй `workspace user token` на `/w/<slug>/login`.

Admin UI открывается на `/admin`. Из него можно выдать короткую dashboard share link на 5 или 10 минут. Для split deployment заранее проверь, что в server settings выставлен корректный `Runtime base URL`, иначе share link будет указывать не туда.

## Обновление

```bash
npm run update:docker
npm run docker:restart
```

- `update:docker` — rebuild и health-check.
- `docker:restart` — только restart контейнера.

## Дальше

- полный server setup: [`SELF-HOSTED-DEPLOYMENT.md`](./SELF-HOSTED-DEPLOYMENT.md)
- install variants: [`SELF-HOSTED-INSTALL.md`](./SELF-HOSTED-INSTALL.md)
- GitLab upload: [`GITLAB-CI-INTEGRATION.md`](./GITLAB-CI-INTEGRATION.md)

