# AQA Pulse — варианты установки self-hosted

Основной guide: [`SELF-HOSTED-DEPLOYMENT.md`](./SELF-HOSTED-DEPLOYMENT.md)

Этот файл нужен только как короткий reference по supported вариантам запуска.

## Что ставить

Для self-hosted нужен пакет `aqa-pulse-server`.

Если у тебя уже есть готовая сборка с `dist/**/*`, соседняя папка `aqa-pulse` не нужна.

Если ты собираешь из исходников прямо на сервере, используй Node.js 22+. Node 18 уже недостаточен для текущей React/Vite сборки.

## Варианты запуска

### 1. Docker Compose

Рекомендуемый путь по умолчанию.

```bash
cd /opt/aqa-pulse-server
npm run setup:docker -- --workspace-name "Autotests main" --workspace-slug autotests-main --public-host aqa-pulse.example.com
```

Если `.env` уже лежит рядом, `setup:docker` использует его без перезаписи. Для замены старых placeholder-значений добавь `--overwrite-env`.

Используй этот вариант для первого запуска и для обычного production/self-hosted сценария.

### 2. Node.js напрямую

Используй только если Docker недоступен или нужен запуск под своим supervisor.

Важно: `.env` не загружается автоматически командами `npm run init` и `npm run start`. Перед запуском нужно либо экспортировать переменные из `.env` в текущий shell, либо передать их через supervisor/systemd.

```bash
cd /opt/aqa-pulse-server
npm install
npm run build

set -a
. ./.env
set +a

npm run init
npm run start
```

### 3. PowerShell installer

Используй на Windows-сервере, если нужен быстрый локальный bootstrap.

```bash
cd /opt/aqa-pulse-server
pwsh ./scripts/install-self-hosted.ps1 -DataRoot ./data -AdminToken "change-me-admin-token" -StorageDriver sqlite
npm run start
```

## Storage

- `sqlite` — рекомендуемый старт.
- `file` — только для совсем простого локального режима.
- `postgres` — если уже есть готовый managed Postgres.

## После установки

Дальше переходи в [`SELF-HOSTED-DEPLOYMENT.md`](./SELF-HOSTED-DEPLOYMENT.md):

1. проверить health;
2. создать workspace;
3. сохранить GitLab variables;
4. сделать первый ingestion;
5. открыть dashboard.

## Обновление

```bash
npm run update:docker
npm run docker:restart
```

- `update:docker` — rebuild и health-check.
- `docker:restart` — только restart контейнера.


