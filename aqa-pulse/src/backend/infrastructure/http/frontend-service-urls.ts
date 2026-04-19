import type { FrontendBootstrapData } from '../../../frontend-bootstrap'
import type { SaasAppConfig } from '../../config'

export function buildFrontendServiceUrls(config: Pick<SaasAppConfig, 'adminBaseUrl' | 'runtimeBaseUrl'>): FrontendBootstrapData['serviceUrls'] {
    return {
        adminBaseUrl: config.adminBaseUrl,
        runtimeBaseUrl: config.runtimeBaseUrl,
    }
}