# AQA Pulse — быстрый запуск на своём сервере

Полная версия: [`SELF-HOSTED-INSTALL.md`](./SELF-HOSTED-INSTALL.md)

## Что нужно

- Docker
- Docker Compose
- собранный каталог `aqa-pulse-server`

> Для быстрого старта это основной и рекомендуемый путь. Если в каталоге уже есть `dist/**/*`, соседний `aqa-pulse` не нужен.

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

```bash
cd /opt/aqa-pulse-server
cp .env.example .env
docker compose up --build
```

После запуска сервер будет доступен на:

```text
http://127.0.0.1:3000
```

## Что сделать сразу после запуска

### 1. Получить admin JWT

```bash
ADMIN_JWT=$(curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"token":"change-me-admin-token"}' \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { process.stdout.write(JSON.parse(body).accessToken); });")
```

### 2. Создать workspace

```bash
curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/api/workspaces" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"slug":"demo","name":"Demo Workspace","apiKeyLabel":"Primary ingestion key"}'
```

### 3. Создать workspace user

Этот токен нужен для чтения dashboard и workspace API.

```bash
curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/api/workspaces/demo/users" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"label":"Dashboard viewer","role":"viewer"}'
```

### 4. Создать ingestion API key

Этот токен нужен для загрузки новых прогонов.

```bash
curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/api/workspaces/demo/api-keys" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"label":"Upload key"}'
```

### 5. Сделать exchange workspace API key → ingestion JWT

```bash
INGESTION_JWT=$(curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/auth/workspaces/demo/api-keys/login" \
  -H "Content-Type: application/json" \
  -d '{"token":"<workspace-api-key>"}' \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { process.stdout.write(JSON.parse(body).accessToken); });")
```

## Первая загрузка отчёта

```bash
node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('./dist/fixtures/sample-llm-report.json', 'utf8'));
const payload = {
  report,
  metadata: {
    branch: 'main',
    commit: 'manual-upload',
    author: 'AQA Pulse'
  },
  sourceFile: 'manual://sample.json'
};
fs.writeFileSync('/tmp/aqa-pulse-ingestion.json', JSON.stringify(payload));
"

curl --silent --show-error --fail \
  -X POST "http://127.0.0.1:3000/api/workspaces/demo/ingestions" \
  -H "Authorization: Bearer $INGESTION_JWT" \
  -H "Content-Type: application/json" \
  --data @/tmp/aqa-pulse-ingestion.json
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

