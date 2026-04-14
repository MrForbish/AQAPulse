# AQA Pulse — установка на свой сервер

Этот документ описывает, как развернуть `aqa-pulse-server` у себя.

## Что ставить

Для self-hosted режима нужен именно пакет `aqa-pulse-server`.

Он включает:
- API и HTML dashboard;
- storage (`file`, `sqlite` или `postgres`);
- workspace-модель;
- admin token;
- ingestion через workspace API key -> ingestion JWT;
- доступ к dashboard через workspace user token -> workspace JWT/session.

`aqa-pulse-client` для установки сервера **не нужен** — это только клиентский runtime/rendering package.

---

## Варианты установки

Поддерживаются 3 варианта:

1. Docker Compose — рекомендуемый старт.
2. Node.js server — если хочешь запускать напрямую без Docker.
3. PowerShell installer — быстрый путь для Windows-сервера.

---

## Требования

### Для Docker-варианта
- Docker
- Docker Compose

### Для Node.js-варианта
- Node.js 22+
- npm

> Для `sqlite` режима нужен Node 22+, потому что используется `node:sqlite`.

---

## Важные переменные окружения

| Переменная | Назначение |
|---|---|
| `PORT` | порт сервера |
| `AQA_PULSE_DATA_ROOT` | корневая папка хранения данных |
| `AQA_PULSE_STORAGE_DRIVER` | `file`, `sqlite` или `postgres` |
| `AQA_PULSE_SQLITE_PATH` | путь к sqlite-файлу |
| `AQA_PULSE_POSTGRES_URL` | connection string для Postgres |
| `AQA_PULSE_ADMIN_TOKEN` | admin token |
| `AQA_PULSE_JWT_SECRET` | секрет подписи JWT |
| `AQA_PULSE_ACCESS_TOKEN_TTL_SECONDS` | срок жизни JWT/cookie |
| `AQA_PULSE_ENABLE_DEV_BOOTSTRAP` | включение/выключение dev bootstrap route |
| `AQA_PULSE_REQUIRE_WORKSPACE_AUTH` | требовать ли workspace user token для read-routes |
| `AQA_PULSE_DIST_PATH` | legacy summary/static path |
| `AQA_PULSE_ARCHIVE_PATH` | legacy archive path |

Рекомендуемая минимальная конфигурация:

```env
PORT=3000
AQA_PULSE_DATA_ROOT=/data
AQA_PULSE_STORAGE_DRIVER=sqlite
AQA_PULSE_SQLITE_PATH=/data/aqa-pulse.sqlite
AQA_PULSE_ADMIN_TOKEN=change-me-admin-token
AQA_PULSE_JWT_SECRET=change-me-jwt-secret
AQA_PULSE_ENABLE_DEV_BOOTSTRAP=false
AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true
```

---

## Вариант 1. Установка через Docker Compose

Перейди в каталог `aqa-pulse-server` и запусти:

```powershell
Set-Location "C:\Users\mpecherskiy\WebstormProjects\autotests\aqa-pulse-server"
docker compose up --build
```

Что использует compose:
- `aqa-pulse-server/Dockerfile`
- build context = корень репозитория
- volume `./data:/data`
- переменные из `.env.example`

### Что сделать перед запуском

1. Скопировать `.env.example` в рабочий env-файл или отредактировать значения напрямую.
2. Обязательно заменить `AQA_PULSE_ADMIN_TOKEN`.
3. Выбрать storage:
   - `file` — если хочешь максимально простой запуск;
   - `sqlite` — если нужен один файл БД и более удобный self-hosted режим.

### Остановка

```powershell
docker compose down
```

---

## Вариант 2. Установка напрямую на Node.js

### Шаг 1. Установка зависимостей и сборка

```powershell
Set-Location "C:\Users\mpecherskiy\WebstormProjects\autotests\aqa-pulse-server"
npm install
npm run build
```

### Шаг 2. Настройка переменных окружения

Пример для Windows PowerShell:

```powershell
$env:AQA_PULSE_DATA_ROOT = "C:\data\aqa-pulse"
$env:AQA_PULSE_STORAGE_DRIVER = "sqlite"
$env:AQA_PULSE_SQLITE_PATH = "C:\data\aqa-pulse\aqa-pulse.sqlite"
$env:AQA_PULSE_ADMIN_TOKEN = "change-me-admin-token"
$env:AQA_PULSE_ENABLE_DEV_BOOTSTRAP = "false"
$env:AQA_PULSE_REQUIRE_WORKSPACE_AUTH = "true"
```

### Шаг 3. Инициализация storage

```powershell
npm run init
```

### Шаг 4. Запуск сервера

```powershell
npm run start
```

---

## Вариант 3. Быстрый PowerShell installer

Для Windows-сервера можно использовать готовый installer:

```powershell
Set-Location "C:\Users\mpecherskiy\WebstormProjects\autotests\aqa-pulse-server"
.\scripts\install-self-hosted.ps1 -DataRoot ".\data" -AdminToken "change-me-admin-token" -StorageDriver sqlite
```

После этого в том же терминале:

```powershell
npm run start
```

---

## Что происходит после запуска

После запуска у тебя есть 3 уровня доступа:

### 1. Admin token
Используется для:
- `GET /api/workspaces`
- `GET /api/workspaces/:slug`
- `POST /api/workspaces`
- `POST /api/workspaces/:slug/api-keys`
- `POST /api/workspaces/:slug/users`
- `POST /api/dev/bootstrap` (если разрешён)

На runtime admin token сначала меняется на admin JWT через:

```text
POST /auth/admin/login
```

### 2. Workspace API key
Используется как raw provisioning token для получения ingestion JWT:

```text
POST /auth/workspaces/:slug/api-keys/login
```

После exchange ingestion JWT используется для:
- `POST /api/workspaces/:slug/ingestions`

### 3. Workspace user token
Используется как raw provisioning token для получения workspace JWT/session:

```text
POST /auth/workspaces/:slug/users/login
```

После exchange workspace JWT/session используется для чтения dashboard и workspace API, если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`:
- `GET /w/:slug`
- `GET /w/:slug/test/:name`
- `GET /api/workspaces/:slug/*`

---

## Первый запуск: минимальный рабочий сценарий

### 1. Получить admin JWT

```powershell
$adminLogin = Invoke-WebRequest -Method Post -UseBasicParsing "http://127.0.0.1:3000/auth/admin/login" `
  -ContentType "application/json" `
  -Body '{"token":"change-me-admin-token"}' |
  Select-Object -ExpandProperty Content |
  ConvertFrom-Json
```

### 2. Создать workspace

```powershell
Invoke-WebRequest -Method Post -UseBasicParsing "http://127.0.0.1:3000/api/workspaces" `
  -Headers @{ Authorization = "Bearer $($adminLogin.accessToken)" } `
  -ContentType "application/json" `
  -Body '{"slug":"demo","name":"Demo Workspace","apiKeyLabel":"Primary ingestion key"}' |
  Select-Object -ExpandProperty Content
```

### 3. Создать workspace user

```powershell
Invoke-WebRequest -Method Post -UseBasicParsing "http://127.0.0.1:3000/api/workspaces/demo/users" `
  -Headers @{ Authorization = "Bearer $($adminLogin.accessToken)" } `
  -ContentType "application/json" `
  -Body '{"label":"Dashboard viewer","role":"viewer"}' |
  Select-Object -ExpandProperty Content
```

### 4. Создать ingestion API key

```powershell
Invoke-WebRequest -Method Post -UseBasicParsing "http://127.0.0.1:3000/api/workspaces/demo/api-keys" `
  -Headers @{ Authorization = "Bearer $($adminLogin.accessToken)" } `
  -ContentType "application/json" `
  -Body '{"label":"Upload key"}' |
  Select-Object -ExpandProperty Content
```

### 5. Сделать exchange workspace API key → ingestion JWT

```powershell
$apiKeyLogin = Invoke-WebRequest -Method Post -UseBasicParsing "http://127.0.0.1:3000/auth/workspaces/demo/api-keys/login" `
  -ContentType "application/json" `
  -Body '{"token":"<workspace-api-key>"}' |
  Select-Object -ExpandProperty Content |
  ConvertFrom-Json
```

### 6. Загрузить Playwright report

```powershell
$report = Get-Content ".\sample-llm-report.json" -Raw

Invoke-WebRequest -Method Post -UseBasicParsing "http://127.0.0.1:3000/api/workspaces/demo/ingestions" `
  -Headers @{ Authorization = "Bearer $($apiKeyLogin.accessToken)" } `
  -ContentType "application/json" `
  -Body (@{
    report = ($report | ConvertFrom-Json)
    metadata = @{
      branch = 'main'
      commit = 'manual-upload'
      author = 'AQA Pulse'
    }
    sourceFile = 'manual://sample.json'
  } | ConvertTo-Json -Depth 100)
```

### 5. Открыть dashboard

```text
http://127.0.0.1:3000/w/demo
```

Если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`, сначала сделай exchange `workspace user token -> workspace JWT/session` через `POST /auth/workspaces/:slug/users/login` или HTML форму `GET /w/:slug/login`.

---

## Что выбрать: file, sqlite или postgres

### `file`
Подходит, если:
- нужен самый простой старт;
- важна прозрачная структура файлов;
- хочешь легко смотреть данные руками в каталогах.

### `sqlite`
Подходит, если:
- нужен более собранный self-hosted режим;
- хочешь один файл БД;
- удобнее бэкапить/переносить данные одним артефактом.

Для production self-hosted я бы начинал с `sqlite`.

### `postgres`
Подходит, если:
- нужен централизованный storage backend;
- уже есть управляемый Postgres;
- ок наличие `psql` в runtime, если используешь текущий postgres adapter.

Важно: текущий Postgres path уже покрыт отдельным smoke-скриптом, но он требует рабочего Docker daemon для локального smoke и доступного `psql` для runtime-команд schema bootstrap.

---

## Что бэкапить

### Если storage = `file`
Бэкапить `AQA_PULSE_DATA_ROOT`.

### Если storage = `sqlite`
Бэкапить:
- `AQA_PULSE_SQLITE_PATH`
- при необходимости дополнительно `AQA_PULSE_DATA_ROOT`

---

## Что проверить после установки

- `GET /api/health` отвечает `200`
- admin token работает
- workspace создаётся
- workspace user создаётся
- ingestion работает
- dashboard открывается
- без workspace user token read-routes закрыты, если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`


