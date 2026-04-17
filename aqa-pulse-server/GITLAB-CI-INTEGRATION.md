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

Если у тебя есть отдельный analyzer step, который считает code-quality facts рядом с тестами, можно добавить ещё:

- `AQA_PULSE_SOURCE_FACTS_PATH` — путь к JSON с precomputed source facts

Встроенный вариант теперь тоже есть: `aqa-pulse-server generate-source-facts`.

Минимальные требования к `source-facts.json`:

- `files[*].file` должен совпадать с `report.tests[*].location.file`
- `tests[*].startLine` / `endLine` должны попадать в диапазон теста из исходника
- payload должен содержать counts и сигналы, а не готовые score

Референсный пример смотри в [../aqa-pulse/fixtures/sample-source-facts.json](../aqa-pulse/fixtures/sample-source-facts.json).

А metadata по умолчанию берёт из CI env (`CI_COMMIT_REF_NAME`, `CI_COMMIT_SHA`, `GITLAB_USER_NAME` и т.д.).

Если рядом с report лежат Playwright artifacts/output directories, CLI сам попробует подтянуть screenshot и markdown attachments в payload перед ingestion. Это как раз путь для project-level aggregation job, где нужен не только summary JSON, но и контекст падения.

Дополнительные env:

- `AQA_PULSE_PREPARED_REPORT_PATH` — сохранить подготовленный report после attachment enrichment
- `AQA_PULSE_DEBUG_ATTACHMENTS_SUMMARY=true` — напечатать debug summary по attachment discovery
- `AQA_PULSE_INLINE_ATTACHMENTS_TOTAL_MAX_SIZE_BYTES` — общий inline budget для attachment content

### Для текущего multi-job GitLab flow

Твой сценарий с `ui-purchase`, `ui-cpu`, `ui-first`, `ui-second` остаётся валидным, но разделение ответственности теперь такое:

- merge и orchestration между несколькими GitLab jobs остаются в project-specific script/CI logic;
- финальный upload merged report лучше делать через `aqa-pulse-server upload-report`.

То есть для aggregation job нормальный path такой:

```bash
node ./merge-aqa-pulse-reports.js --project-kind ui --allow-missing --output test-results/dashboard/ui-merged.json test-results/dashboard/ui-purchase.json test-results/dashboard/ui-cpu.json test-results/dashboard/ui-first.json test-results/dashboard/ui-second.json
export PW_LLM_REPORT="test-results/dashboard/ui-merged.json"
export AQA_PULSE_DEBUG_ATTACHMENTS_SUMMARY="true"
export AQA_PULSE_PREPARED_REPORT_PATH="test-results/dashboard/ui-merged.prepared.json"
aqa-pulse-server generate-source-facts --report "$PW_LLM_REPORT" --repo-root "$CI_PROJECT_DIR/Playwright" --out "test-results/dashboard/ui-merged.source-facts.json"
aqa-pulse-server upload-report --report "$PW_LLM_REPORT" --source-facts "test-results/dashboard/ui-merged.source-facts.json"
```

Практически это выглядит так:

1. test job или aggregation job строит `ui-merged.json`
2. соседний analyzer step или `aqa-pulse-server generate-source-facts` строит `ui-merged.source-facts.json`
3. upload job отправляет оба файла одним вызовом `aqa-pulse-server upload-report`

На сервере repo автотестов уже не нужен: code-quality считается из присланных facts.

Минимальный пример отдельного analyzer шага:

```bash
cd "$CI_PROJECT_DIR/Playwright"
export PW_LLM_REPORT="test-results/dashboard/data.json"
export AQA_PULSE_SOURCE_FACTS_PATH="test-results/dashboard/source-facts.json"
aqa-pulse-server generate-source-facts --repo-root "$CI_PROJECT_DIR/Playwright"
```

После этого в upload job достаточно вызвать:

```bash
aqa-pulse-server upload-report --report "$PW_LLM_REPORT" --source-facts "$AQA_PULSE_SOURCE_FACTS_PATH"
```

Для API aggregation аналогично, только без UI-specific merge списка.

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
