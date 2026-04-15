# AQA Pulse — установка на свой сервер

Основной актуальный guide: [`SELF-HOSTED-DEPLOYMENT.md`](./SELF-HOSTED-DEPLOYMENT.md)

Этот файл теперь оставлен как короткий reference по вариантам установки.

Если тебе нужен один полный пошаговый сценарий, используй только [SELF-HOSTED-DEPLOYMENT.md](./SELF-HOSTED-DEPLOYMENT.md).

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

## Варианты установки

Поддерживаются 3 варианта:

1. Docker Compose — рекомендуемый старт.
2. Node.js server — если хочешь запускать напрямую без Docker.
3. PowerShell installer — быстрый путь для Windows-сервера.

## Требования

- Docker
- Docker Compose
- Node.js 22+
- npm

> Для `sqlite` режима нужен Node 22+, потому что используется `node:sqlite`.

## Когда какой вариант использовать

### Docker Compose

Используй по умолчанию.

Это основной и рекомендуемый путь для первого self-hosted запуска.

### Node.js напрямую

Используй, если:

- Docker недоступен;
- нужен запуск под systemd/pm2/своим supervisor;
- удобнее управлять процессом напрямую.

### PowerShell installer

Используй на Windows-сервере, когда нужен самый быстрый bootstrap без ручной подготовки env.

## Минимальные env-переменные

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

Смысл ключевых переменных:

- `AQA_PULSE_DATA_ROOT` — где хранить данные сервера;
- `AQA_PULSE_STORAGE_DRIVER` — backend storage: `file`, `sqlite`, `postgres`;
- `AQA_PULSE_SQLITE_PATH` — путь к SQLite БД, если выбран `sqlite`;
- `AQA_PULSE_POSTGRES_URL` — строка подключения, если выбран `postgres`;
- `AQA_PULSE_ADMIN_TOKEN` — raw admin token для initial admin login;
- `AQA_PULSE_JWT_SECRET` — секрет подписи JWT;
- `AQA_PULSE_REQUIRE_WORKSPACE_AUTH` — нужен ли workspace user token для просмотра dashboard.

Подробные комментарии к переменным есть в [.env.example](./.env.example).

## Команды по вариантам установки

### Docker Compose

```bash
cd /opt/aqa-pulse-server
cp .env.example .env
docker compose up --build -d
```

### Node.js напрямую

```bash
cd /opt/aqa-pulse-server
npm install
npm run build
npm run init
npm run start
```

### PowerShell installer

```bash
cd /opt/aqa-pulse-server
pwsh ./scripts/install-self-hosted.ps1 -DataRoot ./data -AdminToken "change-me-admin-token" -StorageDriver sqlite
npm run start
```

## Storage choice

### `file`

Для самого простого старта и ручной инспекции файлов.

### `sqlite`

Для production self-hosted я бы начинал с `sqlite`.

### `postgres`

Если уже есть managed Postgres и нужен централизованный backend.

Важно: текущий Postgres path уже покрыт отдельным smoke-скриптом, но он требует рабочего Docker daemon для локального smoke и доступного `psql` для runtime-команд schema bootstrap.

## Что делать дальше

После любого способа установки не продолжай по этому файлу вручную.

Дальше переходи в [SELF-HOSTED-DEPLOYMENT.md](./SELF-HOSTED-DEPLOYMENT.md):

1. проверить `GET /api/health`;
2. создать workspace через `bootstrap-workspace`;
3. сохранить GitLab CI/CD variables;
4. сделать первый ingestion;
5. открыть dashboard.

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


