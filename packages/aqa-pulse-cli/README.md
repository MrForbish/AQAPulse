# @aqa-pulse/cli

CLI для подключения Playwright-проектов к AQA Pulse без локальных helper-скриптов в репозитории автотестов.

## Команды

```bash
aqa-pulse upload-report --generate-source-facts --repo-root "$CI_PROJECT_DIR"
aqa-pulse merge-reports --project-kind ui --output test-results/dashboard/ui-merged.json test-results/dashboard/ui-*.json
aqa-pulse generate-source-facts --report test-results/dashboard/data.json --repo-root .
```

## GitLab CI

```yaml
variables:
  AQA_PULSE_BASE_URL: "https://aqa-pulse.example.com"
  AQA_PULSE_WORKSPACE_SLUG: "autotests-main"
  AQA_PULSE_REPORT_PATH: "Playwright/test-results/dashboard/data.json"

script:
  - npm ci
  - npm test
  - npx @aqa-pulse/cli upload-report --generate-source-facts --repo-root "$CI_PROJECT_DIR"
```

`AQA_PULSE_WORKSPACE_API_KEY` лучше хранить в GitLab CI/CD Variables.

## Публикация

Публичный npm:

```bash
npm publish --access public
```

GitLab Package Registry:

```bash
echo "@aqa-pulse:registry=${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/npm/" > .npmrc
echo "//${CI_SERVER_HOST}/api/v4/projects/${CI_PROJECT_ID}/packages/npm/:_authToken=${CI_JOB_TOKEN}" >> .npmrc
npm publish
```
