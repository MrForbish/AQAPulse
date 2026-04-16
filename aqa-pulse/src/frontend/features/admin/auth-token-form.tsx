import React from 'react'
import { LoadingView, PageFrame } from '../../shared/ui'

export function AuthCheckingSessionState(props: { label: string }): React.JSX.Element {
    return (
        <PageFrame>
            <LoadingView label={props.label} />
        </PageFrame>
    )
}

export function AuthTokenForm(props: {
    fieldLabel: string
    submitLabel: string
    submittingLabel: string
    onSubmitToken: (token: string) => Promise<void>
    isSubmitting: boolean
}): React.JSX.Element {
    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const token = String(formData.get('token') ?? '').trim()

        if (!token) {
            return
        }

        await props.onSubmitToken(token)
    }

    return (
        <form className="stack auth-form" onSubmit={handleSubmit}>
            <label>
                <span>{props.fieldLabel}</span>
                <input type="password" name="token" autoComplete="current-password" required />
            </label>
            <button type="submit" className="primary-link auth-submit" disabled={props.isSubmitting}>
                {props.isSubmitting ? props.submittingLabel : props.submitLabel}
            </button>
        </form>
    )
}