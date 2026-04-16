import * as fs from 'node:fs'
import * as path from 'node:path'

async function main(): Promise<void> {
    const rootModule = await import('aqa-pulse')
    const coreModule = await import('aqa-pulse/core')
    const clientModule = await import('aqa-pulse/client')
    const hooksModule = await import('aqa-pulse/hooks')
    const reactModule = await import('aqa-pulse/react')
    const typesModule = await import('aqa-pulse/types')
    const frontendBootstrapModule = await import('aqa-pulse/frontend-bootstrap')

    assertMissingLegacyRenderers(rootModule, 'aqa-pulse')
    assertMissingLegacyRenderers(coreModule, 'aqa-pulse/core')
    assertMissingLegacyRenderers(clientModule, 'aqa-pulse/client')

    assertExport(rootModule, 'createEmptyFrontendBootstrap', 'aqa-pulse')
    assertExport(rootModule, 'parseFrontendBootstrap', 'aqa-pulse')
    assertExport(coreModule, 'createEmptyFrontendBootstrap', 'aqa-pulse/core')
    assertExport(clientModule, 'createEmptyFrontendBootstrap', 'aqa-pulse/client')
    assertExport(hooksModule, 'useDashboardSummaryData', 'aqa-pulse/hooks')
    assertExport(hooksModule, 'useTestHistoryData', 'aqa-pulse/hooks')
    assertExport(reactModule, 'DashboardPage', 'aqa-pulse/react')
    assertExport(reactModule, 'TestHistoryPage', 'aqa-pulse/react')
    assertExport(reactModule, 'RuntimeProvider', 'aqa-pulse/react')
    assertExport(reactModule, 'PageFrame', 'aqa-pulse/react')
    assertExport(reactModule, 'ChartCard', 'aqa-pulse/react')
    assertExport(reactModule, 'AuthShell', 'aqa-pulse/react')
    assertExport(reactModule, 'useAdminDashboardState', 'aqa-pulse/react')
    assertExport(reactModule, 'loginAsAdmin', 'aqa-pulse/react')
    assertExport(frontendBootstrapModule, 'createEmptyFrontendBootstrap', 'aqa-pulse/frontend-bootstrap')
    assertExport(frontendBootstrapModule, 'parseFrontendBootstrap', 'aqa-pulse/frontend-bootstrap')

    assert(typesModule && typeof typesModule === 'object', 'aqa-pulse/types should resolve to a module object')
    assertNoCompatibilityBuildDependency()

    console.log('Export surface smoke passed.')
}

function assertMissingLegacyRenderers(moduleValue: Record<string, unknown>, moduleName: string): void {
    assert(!(moduleValue.renderDashboardHtml), `${moduleName} must not export renderDashboardHtml`)
    assert(!(moduleValue.renderTestHistoryHtml), `${moduleName} must not export renderTestHistoryHtml`)
}

function assertExport(moduleValue: Record<string, unknown>, exportName: string, moduleName: string): void {
    assert(exportName in moduleValue, `${moduleName} must export ${exportName}`)
}

function assertNoCompatibilityBuildDependency(): void {
    const packageRoot = path.resolve(__dirname, '..')
    const repoRoot = path.resolve(packageRoot, '..')
    const removedClientPackagePath = path.resolve(repoRoot, 'aqa-pulse-client')
    const aqaPulsePackageJson = readJsonFile(path.resolve(packageRoot, 'package.json'))
    const serverPackageJson = readJsonFile(path.resolve(repoRoot, 'aqa-pulse-server', 'package.json'))
    const serverBuildPackagePath = path.resolve(repoRoot, 'aqa-pulse-server', 'scripts', 'build-package.js')
    const serverBuildPackage = fs.readFileSync(serverBuildPackagePath, 'utf8')
    const aqaPulseScripts = readScripts(aqaPulsePackageJson)
    const serverScripts = readScripts(serverPackageJson)

    assert(!('smoke:compatibility-html' in aqaPulseScripts), 'aqa-pulse must not keep smoke:compatibility-html in package scripts')
    assert(!fs.existsSync(removedClientPackagePath), 'repo must not keep the removed aqa-pulse-client package')
    assert(!String(serverScripts.build ?? '').includes('aqa-pulse-client'), 'aqa-pulse-server build must not depend on aqa-pulse-client')
    assert(!serverBuildPackage.includes('aqa-pulse-client'), 'aqa-pulse-server/scripts/build-package.js must not copy files from aqa-pulse-client')
    assert(!serverBuildPackage.includes('render-dashboard.js'), 'aqa-pulse-server/scripts/build-package.js must not package deprecated renderer files')
    assert(!serverBuildPackage.includes('render-test-history.js'), 'aqa-pulse-server/scripts/build-package.js must not package deprecated test-history renderer files')
}

function readJsonFile(filePath: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>
}

function readScripts(packageJson: Record<string, unknown>): Record<string, unknown> {
    const scripts = packageJson.scripts
    return scripts && typeof scripts === 'object' ? scripts as Record<string, unknown> : {}
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}

void main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})