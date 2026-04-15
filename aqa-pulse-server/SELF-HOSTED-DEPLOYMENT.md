# AQA Pulse — полная инструкция по развёртке self-hosted

Этот документ — основной сценарий развёртки `aqa-pulse-server` как self-hosted решения.

Если нужен один рекомендуемый путь без выбора между несколькими полуинструкциями, используй именно этот guide.

Что ты получишь в итоге:

- поднятый self-hosted сервер AQA Pulse;
- workspace для конкретного проекта или команды;
- `workspace API key` для GitLab CI upload;
- `workspace user token` для входа в dashboard, если включена защита read-routes;
- готовые значения для GitLab CI/CD variables.

## Что именно разворачивается

Для self-hosted нужен пакет `aqa-pulse-server`.

Он включает:

- HTML dashboard и API;
- workspace-модель;
- admin token и workspace-scoped токены;
- ingestion Playwright JSON-репортов;
- storage через `file`, `sqlite` или `postgres`;
- Dockerfile, Docker Compose, bootstrap CLI и GitLab template.

`aqa-pulse-client` для развёртки сервера не нужен.

## Рекомендуемый путь

Для первого рабочего запуска рекомендованный сценарий такой:

1. поднять `aqa-pulse-server` через Docker Compose;
2. проверить `GET /api/health`;
3. создать workspace одной CLI-командой `bootstrap-workspace`;
4. сохранить 3 GitLab CI/CD variables;
5. отправить первый Playwright report;
6. открыть dashboard.

Ниже именно этот путь и описан.

## Что нужно заранее

На сервере должны быть:

- Docker;
- Docker Compose;
- каталог `aqa-pulse-server`.

Есть 2 нормальных варианта, откуда взять `aqa-pulse-server`:

1. Исходники этого workspace, если ты собираешь пакет сам.
2. Уже собранный runtime bundle, если тебе передали готовый self-hosted комплект с заполненной `dist/`.

Если `dist/` уже есть, соседняя папка `aqa-pulse` для запуска не нужна.

## Шаг 1. Подготовить каталог сервера

Пример целевого каталога:

```bash
mkdir -p /opt/aqa-pulse-server
cd /opt/aqa-pulse-server
```

Дальше в этом каталоге должны лежать как минимум:

- `package.json`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `bin/`
- `dist/`

Если у тебя не runtime bundle, а исходники из текущего workspace, сначала собери пакет:

```bash
cd /path/to/AQAPulse/aqa-pulse-server
npm install
npm run build
```

## Шаг 2. Настроить `.env`

Скопируй пример конфига:

```bash
cd /opt/aqa-pulse-server
cp .env.example .env
```

Минимально рабочая конфигурация для первого self-hosted запуска:

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

Что важно поменять обязательно:

- `AQA_PULSE_ADMIN_TOKEN`
- `AQA_PULSE_JWT_SECRET`

Что рекомендую оставить как есть для первого запуска:

- `AQA_PULSE_STORAGE_DRIVER=sqlite`
- `AQA_PULSE_SQLITE_PATH=/data/aqa-pulse.sqlite`
- `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`

Почему `sqlite` по умолчанию:

- проще, чем Postgres;
- стабильнее и удобнее для self-hosted, чем чисто файловый режим;
- весь storage лежит в одном файле плюс workspace data root.

## Шаг 3. Поднять сервер

Запуск:

```bash
cd /opt/aqa-pulse-server
docker compose up --build -d
```

Проверить, что контейнер поднялся:

```bash
docker compose ps
docker compose logs -f aqa-pulse-server
```

Остановка:

```bash
docker compose down
```

Перезапуск после изменения `.env` или обновления bundle:

```bash
docker compose up --build -d
```

## Шаг 4. Проверить health endpoint

После старта сервер должен отвечать так:

```bash
curl --silent --show-error --fail http://127.0.0.1:3000/api/health
```

Если всё хорошо, будет успешный ответ без ошибки от `curl`.

Если сервер опубликован наружу через reverse proxy, сразу проверь и внешний URL тоже:

```bash
curl --silent --show-error --fail https://your-domain.example.com/api/health
```

## Шаг 5. Создать workspace одной командой

Это основной рекомендованный путь. Он удобнее, чем создавать workspace, user и api key по отдельности через admin API.

Если у тебя сервер уже доступен по публичному URL, выполни:

```bash
cd /opt/aqa-pulse-server
docker compose exec aqa-pulse-server npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url https://your-domain.example.com
```

Если reverse proxy ещё не настроен и ты пока работаешь локально на сервере:

```bash
cd /opt/aqa-pulse-server
docker compose exec aqa-pulse-server npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url http://127.0.0.1:3000
```

Команда напечатает:

- `Workspace API key`
- `Workspace user token`
- `Dashboard URL`
- `Login URL`
- готовый блок `GitLab CI/CD variables`

Если нужен JSON для автоматизации:

```bash
cd /opt/aqa-pulse-server
docker compose exec aqa-pulse-server npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url https://your-domain.example.com --json
```

## Шаг 6. Сохранить секреты

После `bootstrap-workspace` у тебя есть 2 важных raw token:

1. `workspace API key`
Нужен только для CI ingestion.

2. `workspace user token`
Нужен только для входа в dashboard и чтения workspace API, если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`.

Важно:

- `workspace API key` не используй для входа в dashboard;
- `workspace user token` не используй для CI upload;
- `admin token` не храни в GitLab CI/CD variables для обычной загрузки прогонов.

## Шаг 7. Заполнить GitLab CI/CD Variables

Для upload из GitLab нужны ровно 3 переменные:

```text
AQA_PULSE_BASE_URL=https://your-domain.example.com
AQA_PULSE_WORKSPACE_SLUG=autotests-main
AQA_PULSE_WORKSPACE_API_KEY=<workspace-api-key>
```

Если dashboard закрыт, `workspaceUserToken` в CI не нужен.

Он нужен только для пользователя, который открывает `/w/<slug>`.

## Шаг 8. Подключить upload из GitLab

В комплекте уже есть шаблон:

```text
aqa-pulse-server/template/gitlab/aqa-pulse-upload.gitlab-ci.yml
```

Базовая идея такая:

1. Playwright job генерирует `data.json` через `PW_LLM_REPORT`.
2. Upload job получает ingestion JWT из `workspace API key`.
3. Upload job отправляет `POST /api/workspaces/:slug/ingestions`.

Если у тебя уже есть проектный upload script, достаточно передать в него 3 переменные из предыдущего шага.

## Шаг 9. Загрузить первый отчёт вручную

Если хочешь сделать smoke check без GitLab, можно загрузить отчёт руками.

Сначала получи ingestion JWT:

```bash
INGESTION_JWT=$(curl --silent --show-error --fail \
  -X POST "https://your-domain.example.com/auth/workspaces/autotests-main/api-keys/login" \
  -H "Content-Type: application/json" \
  -d '{"token":"<workspace-api-key>"}' \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { process.stdout.write(JSON.parse(body).accessToken); });")
```

Подготовь payload:

```bash
node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('./test-results/dashboard/data.json', 'utf8'));
const payload = {
  report,
  metadata: {
    branch: 'main',
    commit: 'manual-upload',
    author: 'Self-hosted smoke check'
  },
  sourceFile: 'manual://test-results/dashboard/data.json'
};
fs.writeFileSync('/tmp/aqa-pulse-ingestion.json', JSON.stringify(payload));
"
```

Отправь ingestion:

```bash
curl --silent --show-error --fail \
  -X POST "https://your-domain.example.com/api/workspaces/autotests-main/ingestions" \
  -H "Authorization: Bearer $INGESTION_JWT" \
  -H "Content-Type: application/json" \
  --data @/tmp/aqa-pulse-ingestion.json
```

## Шаг 10. Открыть dashboard

URL workspace dashboard:

```text
https://your-domain.example.com/w/autotests-main
```

Если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`, сначала открой:

```text
https://your-domain.example.com/w/autotests-main/login
```

И войди через `workspace user token`.

## Что хранить где

На сервере:

- `.env`
- `AQA_PULSE_ADMIN_TOKEN`
- `AQA_PULSE_JWT_SECRET`
- volume `./data:/data`

В GitLab CI/CD Variables:

- `AQA_PULSE_BASE_URL`
- `AQA_PULSE_WORKSPACE_SLUG`
- `AQA_PULSE_WORKSPACE_API_KEY`

У пользователя dashboard:

- `workspace user token`, если read-routes закрыты.

## Операционные команды

Логи:

```bash
cd /opt/aqa-pulse-server
docker compose logs -f aqa-pulse-server
```

Остановка:

```bash
cd /opt/aqa-pulse-server
docker compose down
```

Обновление после нового bundle:

```bash
cd /opt/aqa-pulse-server
docker compose up --build -d
```

Резервный вариант без Docker:

```bash
cd /opt/aqa-pulse-server
npm install
npm run build
npm run init
npm run start
```

## Что чаще всего ломается

### 1. Сервер стартует, но `dashboard` не открывается

Проверь:

- внешний URL и reverse proxy;
- что открываешь именно `/w/<slug>`;
- что workspace реально создан;
- что при включённом `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true` ты сначала сделал login через `workspace user token`.

### 2. CI не может загрузить report

Проверь:

- `AQA_PULSE_BASE_URL`
- `AQA_PULSE_WORKSPACE_SLUG`
- `AQA_PULSE_WORKSPACE_API_KEY`
- что job реально сгенерировала `PW_LLM_REPORT`
- что upload идёт на `/api/workspaces/:slug/ingestions`

### 3. Дашборд пустой

Обычно это значит одно из двух:

- ingestion ещё не был выполнен;
- report загрузился не в тот workspace slug.

### 4. Время на dashboard сдвинуто

Сейчас время форматируется по timezone среды, где выполняется сервер. Если сервер крутится в контейнере с UTC, UI тоже будет показывать UTC-подобное время.

## Быстрый финальный checklist

- [ ] `docker compose up --build -d` выполнился без ошибки
- [ ] `GET /api/health` отвечает успешно
- [ ] `bootstrap-workspace` вернул `workspace API key`
- [ ] `bootstrap-workspace` вернул `workspace user token` или ты осознанно работаешь без него
- [ ] в GitLab сохранены `AQA_PULSE_BASE_URL`, `AQA_PULSE_WORKSPACE_SLUG`, `AQA_PULSE_WORKSPACE_API_KEY`
- [ ] первый ingestion прошёл успешно
- [ ] dashboard открывается по `/w/<slug>`

Если нужен один короткий вывод: для первого production-like self-hosted запуска подними `aqa-pulse-server` через Docker Compose, создай workspace командой `bootstrap-workspace`, сохрани 3 GitLab variables и проверь первый upload вручную до интеграции в pipeline.