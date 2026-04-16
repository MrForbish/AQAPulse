/**
 * Назначение: общий auth-shell layout для admin/workspace логина и API-key exchange сценариев.
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { PageFrame, Panel } from '../../shared/ui'

export interface AuthShellProps {
    eyebrow: string
    title: string
    description: string
    children: React.ReactNode
    footerLink?: { href: string; label: string }
}

/**
 * AuthShell выносит общий layout отдельно от конкретных form-action hooks, чтобы login/exchange страницы различались только полями и submit-логикой.
 */
export function AuthShell(props: AuthShellProps): React.JSX.Element {
    return (
        <PageFrame>
            <div className="auth-layout">
                <Panel className="auth-card">
                    <div className="eyebrow">{props.eyebrow}</div>
                    <h1 className="auth-title">{props.title}</h1>
                    <p className="subtle-copy auth-copy">{props.description}</p>
                    {props.children}
                    {props.footerLink ? (
                        <div className="auth-footer-link">
                            <Link to={props.footerLink.href} className="ghost-link">{props.footerLink.label}</Link>
                        </div>
                    ) : null}
                </Panel>
            </div>
        </PageFrame>
    )
}
