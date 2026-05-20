# AQA Pulse GitLab templates

## Минимальное подключение

В проекте автотестов добавь `.aqa-pulse.yml`:

```yaml
projectDir: Playwright
reportPath: test-results/dashboard/data.json
repoRoot: .
```

В GitLab CI/CD Variables добавь:

```text
AQA_PULSE_BASE_URL
AQA_PULSE_WORKSPACE_SLUG
AQA_PULSE_WORKSPACE_API_KEY
```

В `.gitlab-ci.yml` подключи template:

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

Test job должна сохранить dashboard report как artifact:

```yaml
artifacts:
  when: always
  paths:
    - Playwright/test-results/dashboard
```

## Merge нескольких reports

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

Template не знает, как называются test jobs и npm scripts. Его задача только прочитать `.aqa-pulse.yml` и вызвать:

```bash
npx @aqa-pulse/cli@latest upload-from-config --config .aqa-pulse.yml
```
