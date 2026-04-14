# AQA Pulse — что устанавливать клиенту и что ему передавать

Этот документ нужен, чтобы быстро понять, что именно отдавать клиенту в зависимости от модели работы.

## Короткий ответ

Есть 3 модели:

1. **Hosted SaaS** — клиенту ничего не ставить, ты хостишь всё сам.
2. **Self-hosted / on-prem** — клиент поднимает `aqa-pulse-server` у себя.
3. **Rendering SDK** — клиент получает только `aqa-pulse-client`, если ему нужен не продукт целиком, а только renderer.

Если твоя цель — не отдавать продукт как есть, то основной вариант для продажи:
- Hosted SaaS
- или self-hosted Docker bundle

А не голый `aqa-pulse-client`.

---

## Модель 1. Hosted SaaS

### Что происходит
Ты сам разворачиваешь `aqa-pulse-server`, создаёшь клиенту отдельный workspace и выдаёшь ему только доступы.

### Что ставит клиент
Ничего.

### Что ты передаёшь клиенту
- URL дашборда
- URL ingestion endpoint
- `workspace API key` как raw provisioning token для exchange в ingestion JWT
- `workspace user token` как raw provisioning token для exchange в workspace JWT/session
- `workspace slug`
- короткую инструкцию по отправке Playwright report

### Что НЕ передаёшь
- исходники `aqa-pulse`
- исходники `aqa-pulse-server`
- внутренние admin token'ы
- доступ к другим workspace

### Когда выбирать
- если хочешь сохранить контроль над продуктом;
- если клиенту не нужен on-prem;
- если хочешь продавать как сервис.

---

## Модель 2. Self-hosted / on-prem

### Что происходит
Клиент поднимает `aqa-pulse-server` у себя.

### Что ставит клиент
- Docker Compose bundle
- или Node.js + `aqa-pulse-server`

### Что ты передаёшь клиенту
Минимальный набор:
- `aqa-pulse-server`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `SELF-HOSTED-INSTALL.md`
- инструкции по созданию workspace и токенов

Если поставка через Docker image / tarball — ещё лучше, чем через исходники.

### Что желательно не передавать без необходимости
- весь репозиторий `autotests`
- `aqa-pulse-client` отдельно, если клиенту не нужен SDK
- dev/demo runtime данные

### Когда выбирать
- если у клиента строгие требования по безопасности;
- если данные нельзя выносить наружу;
- если клиент требует on-prem.

---

## Модель 3. Только `aqa-pulse-client`

### Что это такое
`aqa-pulse-client` — это не сервер и не SaaS-платформа.
Это только client runtime package для rendering HTML/dashboard страниц.

### Что в нём есть
- `renderDashboardHtml(summary)`
- `renderTestHistoryHtml(...)`
- metric info helpers
- formatting/i18n

### Чего в нём нет
- backend API
- storage
- ingestion
- auth
- workspace-модели
- tenant isolation

### Когда это нужно клиенту
Только если клиент:
- уже имеет свой backend;
- сам будет хранить и агрегировать данные;
- хочет только рендер/UI runtime.

Если продаётся именно продукт AQA Pulse, это обычно **не основной** формат поставки.

---

## Что именно выдавать клиенту в hosted SaaS сценарии

### Шаг 1. Создать workspace
Ты создаёшь клиенту отдельный workspace.

### Шаг 2. Создать workspace user
Это токен для просмотра dashboard и workspace API.

### Шаг 3. Создать workspace API key
Это токен для загрузки новых прогонов.

### Шаг 4. Передать клиенту
Готовый пакет данных:

```text
Workspace name: <client-name>
Workspace slug: <slug>
Dashboard URL: https://<your-host>/w/<slug>
Summary API: https://<your-host>/api/workspaces/<slug>/summary
Ingestion URL: https://<your-host>/api/workspaces/<slug>/ingestions
Workspace API key: <ingestion-token>
Workspace user token: <read-token>
```

---

## Что именно выдавать клиенту в self-hosted сценарии

### Базовая поставка
- `aqa-pulse-server`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `SELF-HOSTED-INSTALL.md`
- краткий onboarding по токенам

### После установки клиент должен:
1. задать `AQA_PULSE_ADMIN_TOKEN`
2. поднять сервер
3. создать workspace
4. создать workspace user
5. создать workspace API key
6. настроить отправку Playwright report

---

## Что отправлять клиенту для ingestion

Клиенту нужно объяснить только 3 вещи:

### 1. Куда отправлять отчёт

```text
POST /api/workspaces/:slug/ingestions
```

### 2. Чем авторизоваться

```text
1. POST /auth/workspaces/:slug/api-keys/login
2. получить ingestion JWT
3. Authorization: Bearer <ingestion-jwt>
```

### 3. Какой payload отправлять

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

---

## Что объяснить клиенту про доступ к dashboard

Если включён `AQA_PULSE_REQUIRE_WORKSPACE_AUTH=true`, то:

- без exchange из `workspace user token` клиент не увидит `GET /w/:slug`
- без exchange из `workspace user token` клиент не увидит `GET /api/workspaces/:slug/*`

То есть для просмотра нужны отдельные read-access токены.

---

## Рекомендуемая схема продажи

### Если продаёшь сервис
Используй **Hosted SaaS**.

Клиенту выдаёшь:
- URL
- ingestion token
- workspace user token
- slug
- инструкцию по загрузке отчётов

### Если продаёшь on-prem
Используй **self-hosted server package**.

Клиенту выдаёшь:
- docker bundle или server package
- env template
- install guide
- onboarding guide

### Если продаёшь SDK
Выдавай `aqa-pulse-client`.

Но это уже не вся платформа, а только renderer.

---

## Что НЕ надо путать

### `aqa-pulse`
Это внутренний core/source package.

### `aqa-pulse-server`
Это self-hosted backend продукт.

### `aqa-pulse-client`
Это клиентский renderer/runtime package.

Если клиент хочет "поставить AQA Pulse у себя", то почти всегда ему нужен именно `aqa-pulse-server`.

---

## Быстрый чеклист: что передавать клиенту

### Hosted SaaS
- [ ] dashboard URL
- [ ] workspace slug
- [ ] workspace API key
- [ ] workspace user token
- [ ] краткая инструкция по ingestion

### Self-hosted
- [ ] `aqa-pulse-server`
- [ ] `Dockerfile`
- [ ] `docker-compose.yml`
- [ ] `.env.example`
- [ ] `SELF-HOSTED-INSTALL.md`
- [ ] этот onboarding guide

### SDK only
- [ ] `aqa-pulse-client`
- [ ] описание, что это только renderer, а не сервер



