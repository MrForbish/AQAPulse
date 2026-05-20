# aqa-pulse-server

Self-hosted server package для AQA Pulse.

В этом пакете есть:

- готовый сервер и React dashboard/runtime bundle;
- storage для `file`, `sqlite`, `postgres`;
- auth для admin, workspace API key и workspace user token;
- Dockerfile и Docker Compose;
- setup/update scripts для короткого server lifecycle;
- GitLab upload template.

## Куда смотреть

- [`SELF-HOSTED-DEPLOYMENT.md`](./SELF-HOSTED-DEPLOYMENT.md) — основной и единственный полный guide по self-hosted развёртке.
- [`SELF-HOSTED-QUICKSTART.md`](./SELF-HOSTED-QUICKSTART.md) — короткий checklist для первого запуска.
- [`SELF-HOSTED-INSTALL.md`](./SELF-HOSTED-INSTALL.md) — reference по вариантам установки.
- [`MIGRATION.md`](./MIGRATION.md) — как переходить со старого pre-React delivery flow на текущий React runtime.
- [`GITLAB-CI-INTEGRATION.md`](./GITLAB-CI-INTEGRATION.md) — только про upload из GitLab CI.

## Рекомендуемый старт

Все команды выполняй из директории `aqa-pulse-server`.

Самый короткий путь:

```bash
npm run setup:docker -- --workspace-name "Autotests main" --workspace-slug autotests-main --public-host aqa-pulse.example.com
```

Эта команда:

- генерирует `.env`;
- поднимает `docker compose up --build -d`;
- ждёт локальный health-check;
- создаёт первый workspace;
- печатает токены и GitLab variables;
- при `--public-host` пишет Nginx snippet в `./.generated/nginx/<host>.conf`.

## Операционные команды

```bash
npm run update:docker
npm run docker:restart
```

- `update:docker` — backup SQLite, rebuild Docker image, restart container, wait for health-check.
- `docker:restart` — restart контейнера без rebuild образа и без backup.

Если ты работаешь прямо из этой папки проекта и обновил код через `git pull`:

```bash
npm run update:docker -- --build-package
```

Двойной `--` здесь нужен специально: npm передаёт `--build-package` во внутренний script `update:docker`.

## Что входит в готовую сборку

Готовую сборку сервера можно передавать без соседней папки `aqa-pulse`, если `dist/**/*` уже собран.

В поставку входят:

- `dist/**/*`;
- `bin/**/*`;
- `Dockerfile`, `docker-compose.yml`, `.env.example`;
- `scripts/setup-self-hosted.js`;
- `scripts/update-self-hosted.js`;
- `scripts/install-self-hosted.ps1`;
- docs включая `MIGRATION.md` и `template/gitlab/aqa-pulse-upload.gitlab-ci.yml`.

## CLI

- `aqa-pulse-server start`
- `aqa-pulse-server init`
- `aqa-pulse-server bootstrap-workspace --name "<workspace name>" [--slug <slug>] [--base-url <url>] [--skip-user] [--json]`
- `aqa-pulse-server bootstrap-demo`
- `aqa-pulse-server sqlite-migrate [sourceDataRoot] [targetSqlitePath]`
- `aqa-pulse-server sqlite-backup [backupDirectory]`
- `aqa-pulse-server generate-source-facts [--report <path>] [--out <path>] [--repo-root <path>] [--json]`
- `aqa-pulse-server merge-reports [--project-kind ui|api] --output <path> [--allow-missing] <input...>`
- `aqa-pulse-server upload-report [--report <path>] [--source-facts <path>] [--generate-source-facts] [--repo-root <path>] [--base-url <url>] [--workspace-slug <slug>] [--workspace-api-key <key>]`

`upload-report` подходит и для обычного JSON upload, и для Playwright artifact-aware upload: если рядом с report доступны `test-results-*` output directories или markdown/screenshots attachments, CLI подготовит их для ingestion перед отправкой. Дополнительно можно передать `--source-facts <path>` или `AQA_PULSE_SOURCE_FACTS_PATH`, чтобы сервер строил code-quality из precomputed source facts без локального checkout автотестов.

`generate-source-facts` нужен для CI-side анализа исходников: команда читает `report.tests[*].location.file`, находит соответствующие `.ts/.tsx/.js/.jsx` файлы в test repo и пишет `source-facts.json`, который потом передаётся в `upload-report`.

`merge-reports` заменяет локальные project-specific helper-скрипты в репозитории автотестов. Команда объединяет несколько reports одного типа (`ui` или `api`) в один JSON и сохраняет `aqaPulseSourceReportPath`, чтобы `upload-report` потом смог найти локальные Playwright artifacts рядом с исходными reports.

### Формат precomputed source facts

`source-facts.json` должен содержать агрегированные сигналы по test source, а не итоговые score. Минимальный shape такой:

```json
{
	"schemaVersion": 1,
	"analyzerVersion": "my-ci-analyzer@1.0.0",
	"files": [
		{
			"file": "tests/UI/checkout/payment.spec.ts",
			"hasPomImports": false,
			"beforeAllCount": 1,
			"beforeEachCount": 0,
			"serialModeCount": 0,
			"topLevelMutableStateCount": 1,
			"tests": [
				{
					"startLine": 44,
					"endLine": 71,
					"title": "Checkout > retries after payment gateway timeout",
					"assertionCount": 1,
					"smartWaitCount": 1,
					"hardWaitCount": 1,
					"stepCount": 1,
					"directLocatorCount": 3,
					"directPageActionCount": 2,
					"stableSelectorCount": 1,
					"textSelectorCount": 1,
					"fragileSelectorCount": 1,
					"pomReferenceCount": 0,
					"pomFixtureReferenceCount": 0,
					"sharedStateMutationCount": 1,
					"usesPom": false
				}
			]
		}
	]
}
```

Пример полного файла есть в [../aqa-pulse/fixtures/sample-source-facts.json](../aqa-pulse/fixtures/sample-source-facts.json).

Правила сопоставления:

- `files[*].file` должен совпадать с `report.tests[*].location.file`.
- `startLine` / `endLine` нужны, чтобы AQA Pulse матчила конкретный test из report к нужному набору source facts.
- Все `*Count` поля должны быть неотрицательными целыми числами.
- `usesPom` должен отражать итоговый вывод analyzer по тесту.
- Если в report нет `location.line`, AQA Pulse падает обратно на сопоставление по порядку тестов внутри файла.

Как использовать в CI:

1. Сгенерируй обычный Playwright report JSON.
2. Запусти `aqa-pulse-server generate-source-facts` в корне test repo.
3. Передай оба файла в `aqa-pulse-server upload-report`.

Пример полного flow:

```bash
export PW_LLM_REPORT="test-results/dashboard/data.json"
aqa-pulse-server generate-source-facts \
	--report "$PW_LLM_REPORT" \
	--repo-root . \
	--out test-results/dashboard/source-facts.json

aqa-pulse-server upload-report \
	--report "$PW_LLM_REPORT" \
	--source-facts test-results/dashboard/source-facts.json
```

Можно ещё короче: `upload-report` сам сгенерирует `source-facts.json`, если передать флаг:

```bash
aqa-pulse-server upload-report \
	--report "$PW_LLM_REPORT" \
	--generate-source-facts \
	--repo-root .
```

Пример merge нескольких reports перед upload:

```bash
aqa-pulse-server merge-reports \
	--project-kind ui \
	--allow-missing \
	--output test-results/dashboard/ui-merged.json \
	test-results/dashboard/ui-purchase.json \
	test-results/dashboard/ui-cpu.json \
	test-results/dashboard/ui-first.json \
	test-results/dashboard/ui-second.json

aqa-pulse-server upload-report \
	--report test-results/dashboard/ui-merged.json \
	--generate-source-facts \
	--repo-root .
```

Если путь к report уже лежит в `PW_LLM_REPORT`, можно короче:

```bash
aqa-pulse-server generate-source-facts --out test-results/dashboard/source-facts.json

aqa-pulse-server upload-report \
	--report test-results/dashboard/data.json \
	--source-facts test-results/dashboard/source-facts.json
```

То же самое через env:

```bash
export PW_LLM_REPORT="test-results/dashboard/data.json"
export AQA_PULSE_SOURCE_FACTS_PATH="test-results/dashboard/source-facts.json"
aqa-pulse-server generate-source-facts --repo-root .
aqa-pulse-server upload-report
```

Если test repo у тебя на JavaScript или TypeScript, но в нём ещё нет пакета `typescript`, добавь его как `devDependency`: analyzer использует TypeScript parser API, чтобы одинаково разбирать `.ts`, `.tsx`, `.js`, `.jsx`.

