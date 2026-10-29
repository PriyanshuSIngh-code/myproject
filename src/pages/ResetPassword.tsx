import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { authClient } from '../lib/authClient'
import PasswordStrengthIndicator, { evaluatePasswordRules } from '../components/PasswordStrengthIndicator'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [token, setToken] = useState(searchParams.get('token') || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage('')

    if (!token.trim()) {
      setErrorMessage('Please provide your password reset token or recovery code.')
      return
    }

    const rules = evaluatePasswordRules(newPassword)
    if (!rules.every(r => r.met)) {
      setErrorMessage('New password does not meet all security requirements.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await authClient.resetPassword({
        token: token.trim(),
        newPassword,
        confirmPassword
      })

      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to reset password. The token may be expired or invalid.')
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
          <ShieldCheck size={28} />
        </div>
        <div className="eyebrow">CREDENTIAL UPDATE</div>
        <h1>Create New Password</h1>
        <p className="muted centered" style={{ fontSize: '13px', marginTop: '6px' }}>
          Choose a secure, strong password to protect your legal account.
        </p>

        {success ? (
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <CheckCircle2 size={46} style={{ color: '#16a34a', margin: '0 auto 12px' }} />
            <h3 style={{ color: '#15803d', fontSize: '18px', margin: '0 0 8px' }}>
              Password Reset Successfully!
            </h3>
            <p style={{ color: '#58637b', fontSize: '13px', margin: '0 0 20px' }}>
              Your password has been securely updated. Redirecting you to the sign-in screen...
            </p>
            <Link to="/login" className="button button-full">
              Sign In Now <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
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

            {/* Reset Token */}
            <label className="field-label" htmlFor="reset-token">
              <ShieldCheck size={14} /> Reset Token / Recovery Code
            </label>
            <div className="input-with-icon">
              <input
                id="reset-token"
                type="text"
                placeholder="Paste the reset token received"
                value={token}
                onChange={e => setToken(e.target.value)}
                required
                disabled={busy}
              />
            </div>

            {/* New Password */}
            <label className="field-label" htmlFor="new-pass" style={{ marginTop: '16px' }}>
              <Lock size={14} /> New Password
            </label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <input
                id="new-pass"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: '#8b93a5',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <PasswordStrengthIndicator password={newPassword} />

            {/* Confirm Password */}
            <label className="field-label" htmlFor="new-conf-pass" style={{ marginTop: '16px' }}>
              <Lock size={14} /> Confirm New Password
            </label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <input
                id="new-conf-pass"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: '#8b93a5',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {confirmPassword && newPassword !== confirmPassword && (
              <div style={{ color: '#e53e3e', fontSize: '11px', marginTop: '5px' }}>
                Passwords do not match.
              </div>
            )}

            <button type="submit" className="button button-full" disabled={busy} style={{ marginTop: '24px' }}>
              {busy ? 'Updating Password...' : 'Save New Password'} <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
