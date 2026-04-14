# AQA Pulse — деплой на сервер и интеграция с GitLab CI

Этот документ описывает практический сценарий:

1. поднять `aqa-pulse-server` на отдельном сервере;
2. создать workspace под текущий проект;
3. из текущего GitLab CI отправлять Playwright report в ingestion backend;
4. открывать dashboard по URL `https://<your-host>/w/<slug>`.

## Целевая схема

```text
GitLab CI (Playwright jobs)
    ↓
генерация data.json через playwright.dashboard.config.ts
    ↓
POST /auth/workspaces/:slug/api-keys/login
    ↓
получение ingestion JWT
    ↓
POST /api/workspaces/:slug/ingestions
    ↓
AQA Pulse backend сохраняет run/history/summary
    ↓
Dashboard: GET /w/:slug
```

## Что именно разворачивать на сервере

Для server runtime нужен `aqa-pulse-server`.

Важно:

- если ты собираешь `aqa-pulse-server` **из исходников**, на сервере должны быть рядом и `aqa-pulse`, и `aqa-pulse-server`, потому что build использует `../aqa-pulse`;
- если ты привозишь уже собранный пакет / tarball с `dist/**/*`, достаточно самого `aqa-pulse-server` bundle.

## Рекомендуемый вариант деплоя

### Вариант A. Самый простой старт — Docker Compose

На сервер перенеси минимум:

- `aqa-pulse-server/`
- `aqa-pulse/` (только если будешь собирать на сервере из source)

Дальше на сервере:

```bash
cd /opt/aqa-pulse-server
cp .env.example .env
# отредактируй .env

docker compose up --build -d
```

Рекомендуемый `.env`:

```env
PORT=3000
AQA_PULSE_DATA_ROOT=/data
AQA_PULSE_STORAGE_DRIVER=sqlite
AQA_PULSE_SQLITE_PATH=/data/aqa-pulse.sqlite
AQA_PULSE_ADMIN_TOKEN=change-me-admin-token
AQA_PULSE_JWT_SECRET=change-me-jwt-secret
AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS=28800
AQA_PULSE_ENABLE_DEV_BOOTSTRAP=false
AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true
```

### Вариант B. Без Docker, напрямую через Node.js

На сервере нужен Node.js 22+.

```bash
cd /opt/autotests/aqa-pulse-server
npm install
npm run build

export AQA_PULSE_DATA_ROOT=/srv/aqa-pulse/data
export AQA_PULSE_STORAGE_DRIVER=sqlite
export AQA_PULSE_SQLITE_PATH=/srv/aqa-pulse/data/aqa-pulse.sqlite
export AQA_PULSE_ADMIN_TOKEN=change-me-admin-token
export AQA_PULSE_JWT_SECRET=change-me-jwt-secret
export AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS=28800
export AQA_PULSE_ENABLE_DEV_BOOTSTRAP=false
export AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true

npm run init
npm run start
```

## Что лучше выбрать для старта

Для первого production/self-hosted запуска рекомендую:

- `sqlite` — как самый простой и предсказуемый storage;
- `postgres` — только если у тебя уже есть готовый Postgres и ты готов обеспечить runtime с `psql`.

## Что открыть наружу

Минимум:

- `http://<host>:3000/admin/login`
- `http://<host>:3000/w/<slug>`
- `http://<host>:3000/api/health`

Для production лучше поставить reverse proxy и TLS, например Nginx:

- `https://aqa-pulse.example.com/admin/login`
- `https://aqa-pulse.example.com/w/<slug>`
- `https://aqa-pulse.example.com/api/workspaces/<slug>/ingestions`

## Первый bootstrap после запуска

### Рекомендуемый короткий путь: через CLI на сервере

Если у тебя есть shell-доступ к серверу или контейнеру, самый аккуратный onboarding — не через ручные HTTP-вызовы, а одной CLI-командой:

```bash
cd /opt/aqa-pulse-server
npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url https://aqa-pulse.example.com
```

Команда сразу напечатает:

- `workspace slug`
- `workspace API key`
- `workspace user token` (если `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`)
- готовый блок GitLab variables

Если сервер работает в Docker Compose:

```bash
cd /opt/aqa-pulse-server
docker compose exec aqa-pulse-server npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url https://aqa-pulse.example.com
```

### Альтернатива: через admin API/UI

### 1. Получить admin JWT

```bash
ADMIN_JWT=$(curl --silent --show-error --fail \
  -X POST "https://aqa-pulse.example.com/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"token":"change-me-admin-token"}' \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { process.stdout.write(JSON.parse(body).accessToken); });")
```

### 2. Создать workspace под текущий проект

```bash
curl --silent --show-error --fail \
  -X POST "https://aqa-pulse.example.com/api/workspaces" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"slug":"autotests-main","name":"Autotests main","apiKeyLabel":"GitLab CI upload key"}'
```

### 3. Создать workspace user

```bash
curl --silent --show-error --fail \
  -X POST "https://aqa-pulse.example.com/api/workspaces/autotests-main/users" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"label":"Dashboard viewer","role":"viewer"}'
```

### 4. Создать ingestion API key

```bash
curl --silent --show-error --fail \
  -X POST "https://aqa-pulse.example.com/api/workspaces/autotests-main/api-keys" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"label":"GitLab CI upload key"}'
```

Сохрани отдельно:

- `workspace slug`
- `workspace API key`
- `workspace user token`
- `dashboard URL`

## Какие секреты реально нужны в GitLab CI

В GitLab CI/CD variables для upload нужны только:

- `AQA_PULSE_BASE_URL`
- `AQA_PULSE_WORKSPACE_SLUG`
- `AQA_PULSE_WORKSPACE_API_KEY`

Не нужно класть в GitLab:

- `AQA_PULSE_ADMIN_TOKEN`
- ingestion JWT
- workspace read JWT
- workspace user token

Почему так:

- admin token нужен только для provisioning;
- `Playwright/scripts/upload-aqa-pulse-report.js` сам делает exchange `workspace API key -> ingestion JWT` на каждый pipeline/job run;
- workspace user token нужен только для интерактивного входа в dashboard, если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`.

## Что нужно в текущем GitLab CI

### 1. Добавить CI/CD variables

В GitLab project/group variables добавь:

- `AQA_PULSE_BASE_URL` = `https://aqa-pulse.example.com`
- `AQA_PULSE_WORKSPACE_SLUG` = `autotests-main`
- `AQA_PULSE_WORKSPACE_API_KEY` = `<raw workspace api key>`

Опционально:

- `AQA_PULSE_SOURCE_LABEL` = `gitlab://$CI_PROJECT_PATH/$CI_JOB_NAME`

## Как генерировать report в текущем проекте

В репозитории уже есть:

- `Playwright/playwright.dashboard.config.ts`
- reporter `@clipboard-health/playwright-reporter-llm`

Ожидаемый выходной файл:

```text
Playwright/test-results/dashboard/data.json
```

## Практический CI-подход

### Рекомендуемый вариант

Не ломать текущие test jobs, а сделать для тех job, которые хочешь грузить в AQA Pulse, отдельный запуск Playwright с dashboard config.

Если хочешь начать с малого, подключи сначала только один сценарий:

- например `run api tests`
- или только агрегированную UI job в отдельном pipeline

Причина: сейчас UI у тебя разбиты на несколько jobs (`purchase`, `cpu`, `first`, `second`), и каждая такая job будет отдельным ingestion run.

Это нормально, если ты хочешь видеть историю по сегментам.

Если хочешь один run на проектный поток, лучший путь — отдельная aggregation/upload job после всех test jobs этого проекта.

Практически это выглядит так:

1. каждая test job генерирует свой `data.json` в уникальный artifact path;
2. отдельная post-test job скачивает artifacts всех нужных сегментов внутри одного проекта (`purchase`, `cpu`, `first`, `second` для `ui`, либо API-модули для `api`);
3. merge-скрипт собирает один итоговый `data.json` только внутри этого проекта;
4. только эта job делает один `npm run aqa-pulse:upload`.

Так ты избежишь ситуации `одна job = один ingestion run` и получишь на стороне AQA Pulse один запуск на проектный поток (`ui` отдельно, `api` отдельно).

## Минимальный shell snippet для GitLab job

Ниже пример для Linux runner/job container.

```bash
cd "$CI_PROJECT_DIR/Playwright"

export PW_LLM_REPORT="test-results/dashboard/data.json"
npx playwright test --config=playwright.dashboard.config.ts --project=api

INGESTION_JWT=$(curl --silent --show-error --fail \
  -X POST "$AQA_PULSE_BASE_URL/auth/workspaces/$AQA_PULSE_WORKSPACE_SLUG/api-keys/login" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$AQA_PULSE_WORKSPACE_API_KEY\"}" \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { const parsed = JSON.parse(body); process.stdout.write(parsed.accessToken); });")

node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('test-results/dashboard/data.json', 'utf8'));
const payload = {
  report,
  metadata: {
    branch: process.env.CI_COMMIT_REF_NAME || null,
    commit: process.env.CI_COMMIT_SHA || null,
    author: process.env.GITLAB_USER_NAME || process.env.CI_COMMIT_AUTHOR || 'GitLab CI'
  },
  sourceFile: `gitlab://${process.env.CI_PROJECT_PATH}/${process.env.CI_PIPELINE_ID}/${process.env.CI_JOB_NAME}`
};
fs.writeFileSync('test-results/dashboard/ingestion-payload.json', JSON.stringify(payload));
"

curl --silent --show-error --fail \
  -X POST "$AQA_PULSE_BASE_URL/api/workspaces/$AQA_PULSE_WORKSPACE_SLUG/ingestions" \
  -H "Authorization: Bearer $INGESTION_JWT" \
  -H "Content-Type: application/json" \
  --data @test-results/dashboard/ingestion-payload.json
```

## Как встроить это в текущий `.gitlab`

В `aqa-pulse-server` уже добавлен готовый reusable snippet:

```text
aqa-pulse-server/templates/gitlab/aqa-pulse-upload.gitlab-ci.yml
```

Его можно подключать через `include:local`, если хочешь вынести upload в отдельный job и не копировать shell-фрагмент по репозиториям вручную.

Есть 2 нормальных варианта.

### Вариант 1. Upload в конце каждой test job

Плюсы:

- проще всего внедрить;
- не нужен дополнительный artifact choreography;
- каждая job сама отвечает за свой upload.

Минусы:

- каждая job = отдельный run в AQA Pulse.

### Вариант 2. Отдельная upload job после тестов

Плюсы:

- можно аккуратно отделить test execution от ingestion;
- можно хранить `data.json` как artifact.
- это правильная база для будущего merge нескольких UI/API сегментов в один run.

Важно: `ui` и `api` merge-ить между собой не нужно. Aggregation должна происходить только внутри одного Playwright project.

Минусы:

- надо либо собирать один общий `data.json`, либо выбирать, из какой job грузить;
- для твоей текущей разбивки UI на несколько jobs понадобится дополнительная агрегация.

## Что я рекомендую именно для текущего репозитория

Стартовый безопасный путь:

1. поднять `aqa-pulse-server` на сервере в `sqlite` режиме;
2. создать один workspace, например `autotests-main`;
3. начать с upload только одного потока:
   - либо `API Tests`,
   - либо одного UI job;
4. убедиться, что ingestion стабильно работает;
5. потом подключить остальные jobs;
6. если понадобится единый run внутри `ui` или внутри `api` — отдельно добавить шаг агрегации для этого проекта.

Если ты **заранее знаешь**, что целевая модель именно `один project flow = один JSON = один run`, то лучше сразу проектировать схему вокруг отдельной aggregation/upload job, а не вокруг upload внутри test jobs.

## Как открыть dashboard

После первого успешного ingestion:

```text
https://aqa-pulse.example.com/w/autotests-main
```

Если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`, открой:

```text
https://aqa-pulse.example.com/w/autotests-main/login
```

и используй `workspace user token`.

## Что важно помнить

- raw `workspace API key` больше не отправляется напрямую в ingestion route;
- сначала нужен exchange `raw API key -> ingestion JWT`;
- raw `workspace user token` больше не используется как прямой Bearer для dashboard routes;
- сначала нужен exchange `workspace user token -> workspace JWT/session`;
- для build из source на сервере нужен не только `aqa-pulse-server`, но и соседний `aqa-pulse`.
