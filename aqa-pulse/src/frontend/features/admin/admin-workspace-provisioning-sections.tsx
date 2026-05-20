import React from 'react'
import { Panel } from '../../shared/ui'

export function AdminProvisioningIntro(props: {
    isCreatingWorkspace: boolean
    onCreateWorkspace: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
}): React.JSX.Element {
    return (
        <section className="admin-grid">
            <Panel title="Создать workspace" description="Workspace создается вместе с первым ключом загрузки отчетов. После создания админка покажет готовые блоки, которые нужно вставить в GitLab и репозиторий автотестов.">
                <form className="stack admin-form" onSubmit={props.onCreateWorkspace}>
                    <label>
                        <span>Шаблон</span>
                        <select name="template" defaultValue="production">
                            <option value="production">Боевой CI</option>
                            <option value="sandbox">Песочница / тестовые данные</option>
                            <option value="demo">Demo workspace</option>
                        </select>
                    </label>
                    <label><span>Название</span><input type="text" name="name" required /></label>
                    <label><span>Slug</span><input type="text" name="slug" placeholder="autotests-main" /></label>
                    <label><span>Название первого ключа</span><input type="text" name="apiKeyLabel" placeholder="GitLab CI загрузка отчетов" /></label>
                    <button type="submit" className="primary-link auth-submit" disabled={props.isCreatingWorkspace}>
                        {props.isCreatingWorkspace ? 'Создаем...' : 'Создать workspace'}
                    </button>
                </form>
            </Panel>
            <Panel title="Что будет создано" description="Минимальный набор для подключения автотестов к AQA Pulse.">
                <div className="detail-pairs compact-pairs">
                    <div className="detail-row"><span>Workspace</span><code>отдельный дашборд и хранилище прогонов</code></div>
                    <div className="detail-row"><span>Ключ загрузки</span><code>только для отправки отчетов из CI</code></div>
                    <div className="detail-row"><span>GitLab Variables</span><code>Settings / CI/CD / Variables</code></div>
                    <div className="detail-row"><span>.aqa-pulse.yml</span><code>файл в корне репозитория автотестов</code></div>
                    <div className="detail-row"><span>.gitlab-ci.yml</span><code>job, который вызывает npx @aqa-pulse/cli</code></div>
                    <div className="detail-row"><span>Секреты</span><code>полный ключ показывается только один раз</code></div>
                </div>
            </Panel>
            <Panel title="Важно про GitLab template" description="Template из AQA Pulse не применяется автоматически. Для первого подключения проще вставить upload job прямо в .gitlab-ci.yml автотестов. Include нужен только если ты отдельно хранишь AQA Pulse template в GitLab-репозитории.">
                <div className="detail-pairs compact-pairs">
                    <div className="detail-row"><span>Первый запуск</span><code>используй простой job без include</code></div>
                    <div className="detail-row"><span>Много репозиториев</span><code>вынеси template в общий GitLab repo</code></div>
                </div>
            </Panel>
            <GitLabPipelineWizard />
        </section>
    )
}

function GitLabPipelineWizard(): React.JSX.Element {
    const [mode, setMode] = React.useState<'single' | 'merge'>('single')
    const [projectDir, setProjectDir] = React.useState('Playwright')
    const [singleJob, setSingleJob] = React.useState('run api tests')
    const [singleReport, setSingleReport] = React.useState('test-results/dashboard/data.json')
    const [mergeJobs, setMergeJobs] = React.useState('run ui tests [purchase]\nrun ui tests [cpu]\nrun ui tests [first]\nrun ui tests [second]')
    const [mergeReports, setMergeReports] = React.useState('test-results/dashboard/ui-purchase.json\ntest-results/dashboard/ui-cpu.json\ntest-results/dashboard/ui-first.json\ntest-results/dashboard/ui-second.json')

    const normalizedProjectDir = projectDir.trim() || 'Playwright'
    const testJobs = splitLines(mode === 'single' ? singleJob : mergeJobs)
    const reportPaths = splitLines(mode === 'single' ? singleReport : mergeReports)
    const configSnippet = mode === 'single'
        ? buildSingleReportConfig(normalizedProjectDir, reportPaths[0] ?? 'test-results/dashboard/data.json')
        : buildMergeConfig(normalizedProjectDir, reportPaths)
    const jobSnippet = buildUploadJob(testJobs)

    return (
        <Panel title="Конструктор GitLab YAML" description="Заполни под свой pipeline: какие jobs создают dashboard JSON и где лежат reports. Ниже появятся готовые блоки для копирования.">
            <div className="stack admin-form">
                <label>
                    <span>Сценарий</span>
                    <select value={mode} onChange={(event) => setMode(event.currentTarget.value === 'merge' ? 'merge' : 'single')}>
                        <option value="single">Один report из одной job</option>
                        <option value="merge">Несколько reports, нужен merge</option>
                    </select>
                </label>
                <label><span>Папка Playwright-проекта</span><input type="text" value={projectDir} onChange={(event) => setProjectDir(event.currentTarget.value)} /></label>

                {mode === 'single' ? (
                    <>
                        <label><span>Имя GitLab job, которая создает report</span><input type="text" value={singleJob} onChange={(event) => setSingleJob(event.currentTarget.value)} /></label>
                        <label><span>Путь к report внутри папки проекта</span><input type="text" value={singleReport} onChange={(event) => setSingleReport(event.currentTarget.value)} /></label>
                    </>
                ) : (
                    <>
                        <label>
                            <span>GitLab jobs, которые создают reports</span>
                            <textarea rows={4} value={mergeJobs} onChange={(event) => setMergeJobs(event.currentTarget.value)} />
                        </label>
                        <label>
                            <span>Reports внутри папки проекта, в том же порядке</span>
                            <textarea rows={4} value={mergeReports} onChange={(event) => setMergeReports(event.currentTarget.value)} />
                        </label>
                    </>
                )}

                <div className="detail-pairs compact-pairs">
                    <div className="detail-row"><span>Куда вставить .aqa-pulse.yml</span><code>в корень репозитория автотестов</code></div>
                    <div className="detail-row"><span>Куда вставить upload job</span><code>в .gitlab-ci.yml или .gitlab/playwright.yml</code></div>
                </div>

                <label>
                    <span>.aqa-pulse.yml</span>
                    <textarea rows={mode === 'single' ? 4 : 12} value={configSnippet} readOnly />
                </label>
                <label>
                    <span>Upload job для .gitlab-ci.yml</span>
                    <textarea rows={Math.max(8, testJobs.length * 2 + 8)} value={jobSnippet} readOnly />
                </label>
            </div>
        </Panel>
    )
}

function splitLines(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
}

function buildSingleReportConfig(projectDir: string, reportPath: string): string {
    return [
        `projectDir: ${projectDir}`,
        `reportPath: ${reportPath}`,
        'repoRoot: .',
    ].join('\n')
}

function buildMergeConfig(projectDir: string, reportPaths: string[]): string {
    const inputs = reportPaths.length > 0 ? reportPaths : ['test-results/dashboard/ui-part-1.json']

    return [
        `projectDir: ${projectDir}`,
        'repoRoot: .',
        '',
        'merge:',
        '  projectKind: ui',
        '  output: test-results/dashboard/ui-merged.json',
        '  allowMissing: true',
        '  inputs:',
        ...inputs.map((reportPath) => `    - ${reportPath}`),
    ].join('\n')
}

function buildUploadJob(jobNames: string[]): string {
    const needs = jobNames.length > 0 ? jobNames : ['playwright tests']

    return [
        'aqa pulse upload:',
        '  stage: Tests',
        '  image: node:22-bookworm-slim',
        '  needs:',
        ...needs.flatMap((jobName) => [
            `    - job: ${jobName}`,
            '      artifacts: true',
        ]),
        '  script:',
        '    - npx @aqa-pulse/cli@latest upload-from-config --config .aqa-pulse.yml',
        '  artifacts:',
        '    when: always',
        '    paths:',
        '      - "**/test-results/dashboard"',
        '  allow_failure: true',
    ].join('\n')
}
