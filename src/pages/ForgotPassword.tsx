import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, ArrowRight, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react'
import { authClient } from '../lib/authClient'

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [devResetToken, setDevResetToken] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage('')

    if (!identifier.trim()) {
      setErrorMessage('Please enter your registered email address or mobile number.')
      return
    }

    setBusy(true)
    try {
      const res = await authClient.forgotPassword({ identifier: identifier.trim() })
      setSubmitted(true)
      if (res.resetToken) {
        setDevResetToken(res.resetToken)
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to process password reset request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section container auth-section">
      <Link to="/login" className="back-link">
        <ArrowLeft size={16} /> Back to Sign In
      </Link>

      <div className="auth-card" style={{ maxWidth: '480px', padding: '36px 36px' }}>
        <div className="auth-symbol">
          <KeyRound size={28} />
        </div>
        <div className="eyebrow">RECOVERY ASSISTANCE</div>
        <h1>Reset Your Password</h1>
        <p className="muted centered" style={{ fontSize: '13px', marginTop: '6px' }}>
          Enter your registered email address or mobile phone number to receive a secure recovery code.
        </p>

        {submitted ? (
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <CheckCircle2 size={44} style={{ color: '#16a34a', margin: '0 auto 12px' }} />
            <h3 style={{ color: '#15803d', fontSize: '18px', margin: '0 0 8px' }}>Instructions Dispatched</h3>
            <p style={{ color: '#58637b', fontSize: '13px', lineHeight: 1.6, margin: '0 0 20px' }}>
              If an active account matches the details you entered, we have sent password reset instructions to your verified contact.
            </p>

            {devResetToken && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '16px',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e' }}>
                  DEV MOCK RESET TOKEN:
                </div>
                <div style={{ fontSize: '12px', wordBreak: 'break-all', color: '#b45309', marginTop: '4px' }}>
                  {devResetToken}
                </div>
                <Link
                  to={`/reset-password?token=${encodeURIComponent(devResetToken)}`}
                  style={{
                    display: 'inline-block',
                    marginTop: '8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#92400e',
                    textDecoration: 'underline'
                  }}
                >
                  Click here to proceed directly to Reset Password screen &rarr;
                </Link>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              <Link to="/reset-password" className="button button-full">
                Enter Reset Token or Code <ArrowRight size={15} />
              </Link>
              <Link to="/login" className="button button-ghost button-full">
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: '24px' }}>
            {errorMessage && (
              <div
                className="notice"
                style={{
                  background: '#fef2f2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{errorMessage}</div>
              </div>
            )}

            <label className="field-label" htmlFor="forgot-id">
              <Mail size={14} /> Registered Email or Phone
            </label>
            <div className="input-with-icon">
              <input
                id="forgot-id"
                type="text"
                placeholder="e.g. name@example.com or +919876543210"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                disabled={busy}
              />
            </div>

            <button type="submit" className="button button-full" disabled={busy} style={{ marginTop: '24px' }}>
              {busy ? 'Sending Instructions...' : 'Send Recovery Code'} <ArrowRight size={16} />
            </button>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/login" style={{ fontSize: '12px', color: '#6d7690' }}>
                Remember your password? <strong>Sign in</strong>
              </Link>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
