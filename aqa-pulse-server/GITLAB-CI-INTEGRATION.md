# AQA Pulse GitLab CI integration

Этот документ описывает только подключение репозитория автотестов к уже поднятому AQA Pulse server.

Server setup и создание workspace описаны в [SELF-HOSTED-DEPLOYMENT.md](./SELF-HOSTED-DEPLOYMENT.md).

## Что должно быть готово

- AQA Pulse server доступен из GitLab runner.
- Workspace создан.
- Есть `workspace API key`.
- В проекте автотестов job генерирует Playwright dashboard report JSON.

## GitLab CI/CD Variables

В GitLab UI добавь:

```text
AQA_PULSE_BASE_URL=https://aqa-pulse.example.com
AQA_PULSE_WORKSPACE_SLUG=autotests-main
AQA_PULSE_WORKSPACE_API_KEY=<workspace-api-key>
```

Не добавляй в GitLab:

- `AQA_PULSE_ADMIN_TOKEN`;
- `workspace user token`;
- ingestion JWT.

## .aqa-pulse.yml

Минимальный вариант для одного report:

```yaml
projectDir: Playwright
reportPath: test-results/dashboard/data.json
repoRoot: .
```

Вариант для merge нескольких reports:

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

Пути считаются относительно `projectDir`. Если `projectDir` не указан, пути считаются относительно директории, где лежит `.aqa-pulse.yml`.

## GitLab template

Подключи reusable template:

```yaml
include:
  - project: 'your-group/AQAPulse'
    ref: main
    file: '/aqa-pulse-server/template/gitlab/aqa-pulse-upload.gitlab-ci.yml'
```

Добавь upload job:

```yaml
aqa pulse upload:
  extends: .aqa_pulse_upload_from_config
  needs:
    - job: playwright tests
      artifacts: true
```

`playwright tests` замени на имя job, которая генерирует report.

Эта test job должна сохранить dashboard report как artifact:

```yaml
artifacts:
  when: always
  paths:
    - Playwright/test-results/dashboard
```

## Что делает upload job

Template вызывает:

```bash
npx @aqa-pulse/cli@latest upload-from-config --config .aqa-pulse.yml
```

CLI:

1. читает `.aqa-pulse.yml`;
2. если указан `merge`, объединяет reports;
3. генерирует source facts;
4. обменивает `AQA_PULSE_WORKSPACE_API_KEY` на ingestion JWT;
5. отправляет итоговый report в AQA Pulse.

## Проверка локально

Без upload:

```bash
npx @aqa-pulse/cli@latest upload-from-config --config .aqa-pulse.yml --dry-run
```

С upload:

```bash
npx @aqa-pulse/cli@latest upload-from-config --config .aqa-pulse.yml
```
