/**
 * Назначение: общий frontend runtime для bootstrap и доступа к текущему route/session состоянию.
 */
import React from 'react'
import {
    createEmptyFrontendBootstrap,
    parseFrontendBootstrap,
    type FrontendBootstrapData,
} from '../frontend-bootstrap'

const RuntimeContext = React.createContext<FrontendBootstrapData>(createEmptyFrontendBootstrap())

/**
 * Читает bootstrap из inline script в документе, чтобы React стартовал из server/static shell без отдельного prefetch запроса.
 */
export function readBootstrapFromDocument(documentRef: Document = document): FrontendBootstrapData {
    const scriptElement = documentRef.getElementById('aqa-pulse-bootstrap')
    return parseFrontendBootstrap(scriptElement?.textContent)
}

/**
 * Держит bootstrap как единый runtime context, чтобы feature-хуки и страницы не тащили напрямую DOM или глобалы браузера.
 */
export function RuntimeProvider(props: { bootstrap: FrontendBootstrapData; children: React.ReactNode }): React.JSX.Element {
    return <RuntimeContext.Provider value={props.bootstrap}>{props.children}</RuntimeContext.Provider>
}

export function useRuntime(): FrontendBootstrapData {
    return React.useContext(RuntimeContext)
}
