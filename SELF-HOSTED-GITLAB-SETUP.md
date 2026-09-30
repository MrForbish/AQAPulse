# AQA Pulse: Self-Hosted и подключение к GitLab CI

Инструкция предполагает наличие Linux-сервера, домена `aqa-pulse.example.com` и GitLab CI.

## 1. Подготовить сервер

Установите:

- Docker;
- Docker Compose;
- Node.js 22 или новее.

Направьте домен `aqa-pulse.example.com` на сервер.

## 2. Запустить AQA Pulse

```bash
git clone https://github.com/MrForbish/AQAPulse.git
cd AQAPulse/aqa-pulse-server

npm run setup:docker -- \
  --workspace-name "Autotests main" \
  --workspace-slug autotests-main \
  --public-host aqa-pulse.example.com
```

Команда автоматически:

- создаст `.env` с секретами;
- соберёт и запустит Docker-контейнер;
- создаст workspace;
- выведет Workspace API key;
- выведет Workspace user token;
- создаст пример Nginx-конфигурации в `.generated/nginx/`.

Сохраните выведенные токены. Не добавляйте `.env` и токены в Git.

## 3. Настроить HTTPS

Подключите созданную Nginx-конфигурацию и выпустите TLS-сертификат, например через Certbot.

Проверьте сервер:

```bash
curl --fail https://aqa-pulse.example.com/api/health
```

Ожидаемый ответ:

```json
{
  "status": "ok",
  "service": "all"
}
```

Dashboard будет доступен по адресу:

```text
https://aqa-pulse.example.com/w/autotests-main
```

Если включена авторизация:

```text
https://aqa-pulse.example.com/w/autotests-main/login
```

Для входа используйте Workspace user token.

## 4. Настроить репозиторий автотестов

Создайте в корне репозитория файл `.aqa-pulse.yml`:

```yaml
projectDir: Playwright
reportPath: test-results/dashboard/data.json
repoRoot: .
```

Playwright должен создавать отчёт:

```text
Playwright/test-results/dashboard/data.json
```

Для формирования отчёта используется reporter:

```text
@clipboard-health/playwright-reporter-llm
```

Если тесты запускаются из каталога `Playwright`, задайте:

```yaml
PW_LLM_REPORT: "test-results/dashboard/data.json"
```

Reporter должен быть подключён в `playwright.config.ts`.

## 5. Добавить GitLab CI/CD Variables

В настройках GitLab-проекта добавьте:

```text
AQA_PULSE_BASE_URL=https://aqa-pulse.example.com
AQA_PULSE_WORKSPACE_SLUG=autotests-main
AQA_PULSE_WORKSPACE_API_KEY=<ключ из setup:docker>
```

Workspace API key рекомендуется отметить как `Masked`.

Не добавляйте в GitLab:

- `AQA_PULSE_ADMIN_TOKEN`;
- Workspace user token;
- JWT secret из `.env`.

## 6. Настроить pipeline

Добавьте в `.gitlab-ci.yml`:

```yaml
playwright tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.58.2-noble
  variables:
    PW_LLM_REPORT: "test-results/dashboard/data.json"
  script:
    - cd Playwright
    - npm ci
    - npm test
  artifacts:
    when: always
    paths:
      - Playwright/test-results/dashboard

aqa pulse upload:
  stage: test
  image: node:22-bookworm-slim
  needs:
    - job: playwright tests
      artifacts: true
  script:
    - npx @aqa-pulse/cli@0.2.0 upload-from-config --config .aqa-pulse.yml
  allow_failure: true
```

Замените:

- `playwright tests` на имя своей test job;
- `npm test` на фактическую команду запуска Playwright;
- Docker-образ Playwright на используемую версию.

GitLab автоматически передаст JSON-отчёт в `aqa pulse upload` через artifacts.

## 7. Проверить интеграцию

Запустите pipeline и откройте лог job `aqa pulse upload`.

После успешной загрузки новый прогон появится здесь:

```text
https://aqa-pulse.example.com/w/autotests-main
```

## Обновление AQA Pulse

После получения изменений:

```bash
cd AQAPulse
git pull

cd aqa-pulse-server
npm run update:docker -- --build-package
```

Проверка после обновления:

```bash
curl --fail https://aqa-pulse.example.com/api/health
```

## Полная документация

- [Self-hosted deployment](aqa-pulse-server/SELF-HOSTED-DEPLOYMENT.md)
- [GitLab CI integration](aqa-pulse-server/GITLAB-CI-INTEGRATION.md)
