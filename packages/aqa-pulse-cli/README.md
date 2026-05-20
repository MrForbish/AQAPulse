# @aqa-pulse/cli

CLI для подключения Playwright-проектов к AQA Pulse без локальных helper-скриптов в репозитории автотестов.

## Команды

```bash
aqa-pulse upload-from-config --config .aqa-pulse.yml
aqa-pulse upload-report --generate-source-facts --repo-root "$CI_PROJECT_DIR"
aqa-pulse merge-reports --project-kind ui --output test-results/dashboard/ui-merged.json test-results/dashboard/ui-*.json
aqa-pulse generate-source-facts --report test-results/dashboard/data.json --repo-root .
```

## .aqa-pulse.yml

Минимальный конфиг для одного готового отчета:

```yaml
projectDir: Playwright
reportPath: test-results/dashboard/data.json
repoRoot: .
```

Конфиг для merge нескольких отчетов и последующего upload:

```yaml
projectDir: Playwright
repoRoot: .

merge:
  projectKind: ui
  output: test-results/dashboard/ui-merged.json
  allowMissing: true
  inputs:
    - test-results/dashboard/ui-part-1.json
    - test-results/dashboard/ui-part-2.json
    - test-results/dashboard/ui-part-3.json
    - test-results/dashboard/ui-part-4.json
```

Пути считаются относительно `projectDir`. Если `projectDir` не указан, пути считаются относительно папки, где лежит `.aqa-pulse.yml`.

## GitLab CI

В GitLab CI/CD Variables храни:

```text
AQA_PULSE_BASE_URL
AQA_PULSE_WORKSPACE_SLUG
AQA_PULSE_WORKSPACE_API_KEY
```

В `.gitlab-ci.yml` можно подключить общий template из репозитория AQA Pulse:

```yaml
include:
  - project: 'your-group/AQAPulse'
    ref: main
    file: '/aqa-pulse-server/template/gitlab/aqa-pulse-upload.gitlab-ci.yml'

aqa pulse upload:
  extends: .aqa_pulse_upload_from_config
  needs:
    - job: playwright tests
      artifacts: true
```

Test job должна сохранить report/artifacts, например:

```yaml
artifacts:
  when: always
  paths:
    - Playwright/test-results/dashboard
```

## Публикация

Публичный npm:

```bash
npm publish --access public
```
