# AQA Pulse — основной self-hosted guide

Это единственный полный guide по развёртке `aqa-pulse-server`.

Что получится в итоге:

- поднятый self-hosted сервер;
- workspace под проект или команду;
- `workspace API key` для GitLab upload;
- `workspace user token` для dashboard, если read-routes закрыты;
- готовые GitLab variables.

## Перед началом

Нужно:

- Node.js 22+, если собираешь проект на самом сервере из исходников;
- Docker;
- Docker Compose;
- каталог `aqa-pulse-server`.

Если у тебя уже есть готовая сборка с `dist/**/*`, соседний `aqa-pulse` не нужен.

Если на сервере стоит Node 18 или Node 20 ниже `20.19`, сборка React frontend через Vite не запустится. Для текущего self-hosted flow ориентируйся на Node 22.

Все команды ниже выполняются из директории `aqa-pulse-server`.

## Рекомендуемый путь

Для первого запуска достаточно одной команды:

```bash
npm run setup:docker -- --workspace-name "Autotests main" --workspace-slug autotests-main --public-host your-domain.example.com
```

Что делает `setup:docker`:

- создаёт `.env` с безопасными токенами;
- поднимает `docker compose up --build -d`;
- ждёт локальный `GET http://127.0.0.1:<PORT>/api/health`;
- создаёт workspace;
- печатает `Workspace API key`, `Workspace user token`, `Dashboard URL` и готовые GitLab variables;
- при `--public-host` дополнительно пишет Nginx snippet в `./.generated/nginx/<host>.conf`.

Если `.env` уже существует и его нужно пересоздать, добавь `--overwrite-env`.

## Если нужен ручной путь

### 0. Проверить Node.js

```bash
node -v
npm -v
```

Если версия Node ниже `22`, сначала обнови её, а уже потом запускай `npm install` и `npm run build`.

### 1. Подготовить `.env`

```bash
cp .env.example .env
```

Минимальный пример:

```env
PORT=3000
AQA_PULSE_DATA_ROOT=/data
AQA_PULSE_STORAGE_DRIVER=sqlite
AQA_PULSE_SQLITE_PATH=/data/aqa-pulse.sqlite
AQA_PULSE_POSTGRES_URL=
AQA_PULSE_ADMIN_TOKEN=change-me-admin-token
AQA_PULSE_JWT_SECRET=change-me-jwt-secret
AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS=28800
AQA_PULSE_ENABLE_DEV_BOOTSTRAP=false
AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true
```

Для первого запуска рекомендован `sqlite`.

### 2. Поднять сервер

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f aqa-pulse-server
```

### 3. Проверить health

```bash
curl --silent --show-error --fail http://127.0.0.1:3000/api/health
```

Если сервер уже опубликован наружу, дополнительно проверь внешний URL.

### 4. Создать workspace

Если есть публичный URL:

```bash
docker compose exec aqa-pulse-server npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url https://your-domain.example.com
```

Если reverse proxy ещё не настроен:

```bash
docker compose exec aqa-pulse-server npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url http://127.0.0.1:3000
```

Команда напечатает:

- `Workspace API key`
- `Workspace user token`
- `Dashboard URL`
- `Login URL`
- готовый блок GitLab variables

## Что сохранить

После `bootstrap-workspace` у тебя есть два важных raw token:

1. `workspace API key`
Используется только для ingestion из CI.

2. `workspace user token`
Используется только для входа в dashboard, если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`.

В GitLab CI/CD нужны только:

```text
AQA_PULSE_BASE_URL=https://your-domain.example.com
AQA_PULSE_WORKSPACE_SLUG=autotests-main
AQA_PULSE_WORKSPACE_API_KEY=<workspace-api-key>
```

`admin token` и `workspace user token` в GitLab хранить не нужно.

## Первый ingestion

Для реального CI flow смотри [`GITLAB-CI-INTEGRATION.md`](./GITLAB-CI-INTEGRATION.md).

Если нужен быстрый smoke check без GitLab:

```bash
INGESTION_JWT=$(curl --silent --show-error --fail \
  -X POST "https://your-domain.example.com/auth/workspaces/autotests-main/api-keys/login" \
  -H "Content-Type: application/json" \
  -d '{"token":"<workspace-api-key>"}' \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { process.stdout.write(JSON.parse(body).accessToken); });")
```

```bash
node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('./test-results/dashboard/data.json', 'utf8'));
const payload = {
  report,
  metadata: { branch: 'main', commit: 'manual-upload', author: 'Self-hosted smoke check' },
  sourceFile: 'manual://test-results/dashboard/data.json'
};
fs.writeFileSync('/tmp/aqa-pulse-ingestion.json', JSON.stringify(payload));
"
```

```bash
curl --silent --show-error --fail \
  -X POST "https://your-domain.example.com/api/workspaces/autotests-main/ingestions" \
  -H "Authorization: Bearer $INGESTION_JWT" \
  -H "Content-Type: application/json" \
  --data @/tmp/aqa-pulse-ingestion.json
```

## Dashboard

```text
https://your-domain.example.com/w/autotests-main
```

Начиная с React frontend migration, сервер дополнительно раздаёт web bundle по пути:

```text
https://your-domain.example.com/ui-assets/
```

Если перед AQA Pulse стоит reverse proxy, убедись, что он пропускает не только `/w/<slug>` и `/api/*`, но и `/ui-assets/*`.

Это относится и к admin/auth экранам: `/admin`, `/admin/login`, `/w/<slug>/login`, `/auth/workspaces/<slug>/api-keys/login` теперь тоже используют тот же frontend bundle.

Legacy HTML renderer packages вроде `aqa-pulse-client` больше не являются основным deployment path для этих экранов. Для migration path см. `./MIGRATION.md`.

Если read-routes закрыты:

```text
https://your-domain.example.com/w/autotests-main/login
```

## Операции

Логи:

```bash
docker compose logs -f aqa-pulse-server
```

Остановка:

```bash
docker compose down
```

Обновление после новой сборки:

```bash
npm run update:docker
```

Если нужен только restart без rebuild:

```bash
npm run docker:restart
```

Если ты работаешь прямо из этой папки проекта и обновил код через `git pull`:

```bash
npm run update:docker -- --build-package
```

Это не опечатка: первый `--` нужен npm, чтобы передать следующий флаг во внутренний script `update:docker`, а уже `--build-package` читает `scripts/update-self-hosted.js`.

## Частые проблемы

### Dashboard не открывается

Проверь:

- внешний URL и reverse proxy;
- что открываешь `/w/<slug>`;
- что workspace действительно создан;
- что при включённом `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true` выполнен login через `workspace user token`.

### CI не может загрузить report

Проверь:

- `AQA_PULSE_BASE_URL`
- `AQA_PULSE_WORKSPACE_SLUG`
- `AQA_PULSE_WORKSPACE_API_KEY`
- что job реально сгенерировала `PW_LLM_REPORT`
- что upload идёт на `/api/workspaces/:slug/ingestions`

### Dashboard пустой

Обычно это значит:

- ingestion ещё не выполнялся;
- report ушёл не в тот workspace slug.

### Время на dashboard сдвинуто

Время форматируется по timezone среды, где запущен сервер.

## Быстрый финальный checklist

- [ ] `docker compose up --build -d` выполнился без ошибки
- [ ] `GET /api/health` отвечает успешно
- [ ] `bootstrap-workspace` вернул `workspace API key`
- [ ] `bootstrap-workspace` вернул `workspace user token` или ты осознанно работаешь без него
- [ ] в GitLab сохранены `AQA_PULSE_BASE_URL`, `AQA_PULSE_WORKSPACE_SLUG`, `AQA_PULSE_WORKSPACE_API_KEY`
- [ ] первый ingestion прошёл успешно
- [ ] dashboard открывается по `/w/<slug>`

Если нужен один короткий вывод: для первого production-like self-hosted запуска подними `aqa-pulse-server` через Docker Compose, создай workspace командой `bootstrap-workspace`, сохрани 3 GitLab variables и проверь первый upload вручную до интеграции в pipeline.