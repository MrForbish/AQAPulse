import React from 'react'
import { Panel } from '../../shared/ui'

export function AdminProvisioningIntro(props: {
    isCreatingWorkspace: boolean
    onCreateWorkspace: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
}): React.JSX.Element {
    return (
        <section className="admin-grid">
            <Panel title="Создать workspace" description="Workspace создаётся вместе с первичным ingestion key.">
                <form className="stack admin-form" onSubmit={props.onCreateWorkspace}>
                    <label>
                        <span>Template</span>
                        <select name="template" defaultValue="production">
                            <option value="production">Production CI</option>
                            <option value="sandbox">Sandbox / test data</option>
                            <option value="demo">Demo workspace</option>
                        </select>
                    </label>
                    <label><span>Name</span><input type="text" name="name" required /></label>
                    <label><span>Slug</span><input type="text" name="slug" placeholder="demo-client" /></label>
                    <label><span>Initial API key label</span><input type="text" name="apiKeyLabel" placeholder="Primary ingestion key" /></label>
                    <button type="submit" className="primary-link auth-submit" disabled={props.isCreatingWorkspace}>
                        {props.isCreatingWorkspace ? 'Создаём...' : 'Создать workspace'}
                    </button>
                </form>
            </Panel>
            <Panel title="Как это работает" description="Те же backend контракты, что и раньше, но в одном React shell.">
                <div className="detail-pairs compact-pairs">
                    <div className="detail-row"><span>Admin login</span><code>session cookie</code></div>
                    <div className="detail-row"><span>Workspace API key</span><code>ingestion only</code></div>
                    <div className="detail-row"><span>Workspace user token</span><code>dashboard/API read</code></div>
                    <div className="detail-row"><span>Provisioning tokens</span><code>сохраняются сразу после создания</code></div>
                </div>
            </Panel>
        </section>
    )
}
