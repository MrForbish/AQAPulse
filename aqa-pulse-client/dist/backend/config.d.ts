import type { StorageDriver } from './contracts';
export interface SaasAppConfig {
    port: number;
    dataRoot: string;
    storageDriver: StorageDriver;
    sqlitePath: string | null;
    postgresConnectionString: string | null;
    requestBodyLimit: string;
    distPath: string;
    archiveRootPath: string;
    /**
     * @deprecated Используй archiveRootPath. Alias сохранён для обратной совместимости внешних override/test setup.
     */
    legacyArchiveRootPath?: string;
    allowDevBootstrap: boolean;
    adminToken: string | null;
    requireWorkspaceAuth: boolean;
    jwtSecret: string;
    accessTokenTtlSeconds: number;
    adminSessionCookieName: string;
    workspaceSessionCookiePrefix: string;
}
export declare function resolveSaasAppConfig(overrides?: Partial<SaasAppConfig>): SaasAppConfig;
