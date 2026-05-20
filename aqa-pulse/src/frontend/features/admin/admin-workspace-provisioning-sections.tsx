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
        </section>
    )
}
