# AQA Pulse — быстрый запуск на своём сервере

Полная версия: [`SELF-HOSTED-INSTALL.md`](./SELF-HOSTED-INSTALL.md)

## Что нужно

- Docker
- Docker Compose
- каталог `aqa-pulse-server`

> Для быстрого старта это основной и рекомендуемый путь.

## Минимальная конфигурация

Возьми значения из `.env.example` и обязательно замени admin token.

Рекомендуемый минимум:

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

## Запуск

```powershell
Set-Location "C:\Users\mpecherskiy\WebstormProjects\autotests\aqa-pulse-server"
docker compose up --build
```

После запуска сервер будет доступен на:

```text
http://127.0.0.1:3000
```

## Что сделать сразу после запуска

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

Этот токен нужен для чтения dashboard и workspace API.

```powershell
Invoke-WebRequest -Method Post -UseBasicParsing "http://127.0.0.1:3000/api/workspaces/demo/users" `
  -Headers @{ Authorization = "Bearer $($adminLogin.accessToken)" } `
  -ContentType "application/json" `
  -Body '{"label":"Dashboard viewer","role":"viewer"}' |
  Select-Object -ExpandProperty Content
```

### 4. Создать ingestion API key

Этот токен нужен для загрузки новых прогонов.

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

## Первая загрузка отчёта

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

## Как открыть dashboard

```text
http://127.0.0.1:3000/w/demo
```

Если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`, сначала сделай exchange `workspace user token -> workspace JWT/session` через:

```text
GET /w/<slug>/login
POST /auth/workspaces/<slug>/users/login
```

## Что у тебя будет в итоге

- `admin token` — для управления workspace
- `workspace API key` — raw provisioning token для exchange в ingestion JWT
- `workspace user token` — raw provisioning token для exchange в workspace JWT/session
- `workspace slug` — идентификатор клиента/проекта

## Минимальный checklist

- [ ] сервер поднялся
- [ ] `GET /api/health` отвечает `200`
- [ ] workspace создан
- [ ] workspace user создан
- [ ] ingestion API key создан
- [ ] Playwright report загрузился
- [ ] dashboard открывается

