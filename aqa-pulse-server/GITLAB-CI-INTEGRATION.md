# AQA Pulse — GitLab CI integration

Этот документ описывает только upload из GitLab CI.

Server setup, workspace bootstrap и dashboard access вынесены в [`SELF-HOSTED-DEPLOYMENT.md`](./SELF-HOSTED-DEPLOYMENT.md).

## Что должно уже быть готово

Перед интеграцией GitLab CI у тебя уже должны быть:

- поднятый `aqa-pulse-server`;
- созданный workspace;
- `workspace API key`;
- внешний base URL сервера.

## Что хранить в GitLab CI/CD Variables

Нужно только это:

- `AQA_PULSE_BASE_URL`
- `AQA_PULSE_WORKSPACE_SLUG`
- `AQA_PULSE_WORKSPACE_API_KEY`

Не нужно хранить в GitLab:

- `AQA_PULSE_ADMIN_TOKEN`
- ingestion JWT
- `workspace user token`

## Ожидаемый report

Ожидаемый файл:

```text
Playwright/test-results/dashboard/data.json
```

В текущем репозитории он генерируется reporter'ом `@clipboard-health/playwright-reporter-llm`, если задан `PW_LLM_REPORT`.

## Минимальный upload flow

```text
Playwright job
  -> генерирует data.json
  -> делает exchange workspace API key -> ingestion JWT
  -> отправляет POST /api/workspaces/:slug/ingestions
```

Важно: это backend ingestion flow. Его не нужно и не следует переносить в React: React dashboard/test-history только читает уже сохранённые summary/history payload через bootstrap и JSON API.

## Минимальный shell snippet

Ниже пример для Linux runner/job container.

```bash
cd "$CI_PROJECT_DIR/Playwright"

export PW_LLM_REPORT="test-results/dashboard/data.json"
npx playwright test --project=api

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

## Upload через CLI, если у тебя есть `aqa-pulse-server`

Если CI job работает внутри этого monorepo или у тебя есть доступ к собранному `aqa-pulse-server`, можно использовать готовый backend CLI вместо inline shell glue:

```bash
aqa-pulse-server upload-report --report test-results/dashboard/data.json
```

CLI читает из env:

- `AQA_PULSE_BASE_URL`
- `AQA_PULSE_WORKSPACE_SLUG`
- `AQA_PULSE_WORKSPACE_API_KEY`
- `PW_LLM_REPORT` как fallback для пути к report

А metadata по умолчанию берёт из CI env (`CI_COMMIT_REF_NAME`, `CI_COMMIT_SHA`, `GITLAB_USER_NAME` и т.д.).

## Reusable template

В пакете уже есть reusable snippet:

```text
template/gitlab/aqa-pulse-upload.gitlab-ci.yml
```

Теперь template self-contained: ему не нужен внешний `npm run aqa-pulse:upload` script в репозитории клиента.

## Как лучше встраивать upload

Есть два нормальных варианта.

### Upload в конце каждой test job

Плюсы:

- проще внедрить;
- не нужен отдельный merge step.

Минус:

- каждая job станет отдельным ingestion run.

### Отдельная upload job после тестов

Плюсы:

- проще отделить тесты от ingestion;
- можно собирать `data.json` как artifact;
- это правильный путь, если позже понадобится aggregation внутри одного project flow.

Минус:

- понадобится artifact choreography.

Важно: `ui` и `api` merge-ить между собой не нужно. Aggregation должна происходить только внутри одного Playwright project.

## Что рекомендовано для текущего репозитория

Стартовый безопасный путь:

1. подключить upload сначала только для одного потока;
2. убедиться, что ingestion стабилен;
3. потом подключать остальные jobs;
4. если понадобится единый run внутри `ui` или внутри `api`, добавить отдельную aggregation/upload job.

## Что помнить

- raw `workspace API key` не отправляется напрямую в ingestion route;
- сначала нужен exchange `workspace API key -> ingestion JWT`;
- dashboard access и `workspace user token` к GitLab upload отношения не имеют.
