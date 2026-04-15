# AQA Pulse — быстрый запуск на своём сервере

Полная версия: [`SELF-HOSTED-DEPLOYMENT.md`](./SELF-HOSTED-DEPLOYMENT.md)

Этот файл теперь intentionally короткий: он нужен как быстрый checklist для первого запуска.

Если нужен полный production-like сценарий с bootstrap workspace, GitLab variables, первым ingestion и troubleshooting, используй [SELF-HOSTED-DEPLOYMENT.md](./SELF-HOSTED-DEPLOYMENT.md).

## Что нужно

- Docker
- Docker Compose
- собранный каталог `aqa-pulse-server`

> Для быстрого старта это основной и рекомендуемый путь. Если в каталоге уже есть `dist/**/*`, соседний `aqa-pulse` не нужен.

## Быстрый запуск

1. Подготовь `.env`:

```bash
cd /opt/aqa-pulse-server
cp .env.example .env
```

2. Проверь минимум переменных:

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

Обязательно замени:

- `AQA_PULSE_ADMIN_TOKEN`
- `AQA_PULSE_JWT_SECRET`

3. Подними сервер:

```bash
docker compose up --build -d
```

4. Проверь health:

```bash
curl --silent --show-error --fail http://127.0.0.1:3000/api/health
```

5. Создай workspace одной командой:

```bash
docker compose exec aqa-pulse-server npm run bootstrap:workspace -- --name "Autotests main" --slug autotests-main --base-url http://127.0.0.1:3000
```

Команда напечатает:

- `Workspace API key`
- `Workspace user token`
- `Dashboard URL`
- готовые `GitLab CI/CD variables`

## Что дальше

1. Сохрани в GitLab:

```text
AQA_PULSE_BASE_URL=http://127.0.0.1:3000
AQA_PULSE_WORKSPACE_SLUG=autotests-main
AQA_PULSE_WORKSPACE_API_KEY=<workspace-api-key>
```

2. Открой dashboard:

```text
http://127.0.0.1:3000/w/autotests-main
```

Если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`, сначала зайди через `workspace user token` на `/w/<slug>/login`.

3. Для первого smoke check загрузи один report вручную или подключи GitLab upload flow из [GITLAB-CI-INTEGRATION.md](./GITLAB-CI-INTEGRATION.md).

## Минимальный checklist

- [ ] сервер поднялся
- [ ] `GET /api/health` отвечает `200`
- [ ] `bootstrap-workspace` отработал успешно
- [ ] сохранены 3 GitLab CI/CD variables
- [ ] dashboard открывается

Всё остальное, включая ручной ingestion, Node.js install path, Windows installer и troubleshooting, вынесено в [SELF-HOSTED-DEPLOYMENT.md](./SELF-HOSTED-DEPLOYMENT.md).

