# AQA Pulse — быстрый старт для клиента

Полная версия: [`CLIENT-ONBOARDING.md`](./CLIENT-ONBOARDING.md)

## Что вы получаете

Если AQA Pulse для вас хостится как сервис, вы получаете:

- `workspace slug`
- `dashboard URL`
- `ingestion URL`
- `workspace API key`
- `workspace user token`

## Для чего нужны токены

### Workspace API key
Нужен для загрузки новых прогонов.

### Workspace user token
Нужен для просмотра dashboard и workspace API.

## Куда отправлять отчёт

```text
POST /api/workspaces/:slug/ingestions
```

Пример:

```text
https://<your-host>/api/workspaces/<slug>/ingestions
```

## Как авторизоваться при загрузке

```text
1. POST /auth/workspaces/:slug/api-keys/login
2. получить accessToken
3. Authorization: Bearer <ingestion-jwt>
```

Минимальный пример exchange:

```bash
INGESTION_JWT=$(curl --silent --show-error --fail \
  -X POST "https://<your-host>/auth/workspaces/<slug>/api-keys/login" \
  -H "Content-Type: application/json" \
  -d '{"token":"<workspace-api-key>"}' \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { process.stdout.write(JSON.parse(body).accessToken); });")
```

## Какой payload отправлять

```json
{
  "report": { "...": "playwright reporter json" },
  "metadata": {
    "branch": "main",
    "commit": "abcdef123456",
    "author": "John Doe"
  },
  "sourceFile": "ci://playwright/data.json"
}
```

## Как открыть dashboard

```text
https://<your-host>/w/<slug>
```

Если включён защищённый доступ к workspace, для просмотра используется `workspace user token`.

Для защищённого workspace user token тоже сначала меняется на JWT/session через:

```text
GET /w/<slug>/login
или
POST /auth/workspaces/<slug>/users/login
```

## Минимальный пример данных, которые вы должны получить от поставщика

```text
Workspace name: <client-name>
Workspace slug: <slug>
Dashboard URL: https://<your-host>/w/<slug>
Summary API: https://<your-host>/api/workspaces/<slug>/summary
Ingestion URL: https://<your-host>/api/workspaces/<slug>/ingestions
Workspace API key: <ingestion-token>
Workspace user token: <read-token>
```

## Что устанавливать у себя

### Если это hosted SaaS
Ничего ставить не нужно.

Нужно только:
- настроить отправку Playwright report;
- сохранить токены;
- открыть dashboard URL.

### Если это on-prem / self-hosted
Тогда вам передадут уже не только токены, а self-hosted комплект на базе `aqa-pulse-server`.

## Минимальный checklist

- [ ] получили `workspace slug`
- [ ] получили `dashboard URL`
- [ ] получили `ingestion URL`
- [ ] получили `workspace API key`
- [ ] получили `workspace user token`
- [ ] отправили первый Playwright report
- [ ] открыли dashboard


