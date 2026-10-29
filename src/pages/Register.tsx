import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Briefcase } from 'lucide-react'
import { authClient } from '../lib/authClient'
import PasswordStrengthIndicator, { evaluatePasswordRules } from '../components/PasswordStrengthIndicator'

export default function Register() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage('')

    // Client-side validations
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please provide a valid email address.')
      return
    }

    const rules = evaluatePasswordRules(password)
    const allRulesMet = rules.every(r => r.met)
    if (!allRulesMet) {
      setErrorMessage('Password does not meet all security requirements listed below.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.')
      return
    }

    if (!acceptTerms) {
      setErrorMessage('You must agree to the Terms of Service and Privacy Policy to proceed.')
      return
    }

    setBusy(true)

    try {
      const res = await authClient.userSignup({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword
      })

      if ((res.ok || (res as any).success) && res.userId) {
        // Navigate to the Email Verification page
        navigate(`/verify-email?userId=${encodeURIComponent(res.userId)}&email=${encodeURIComponent(res.email || email.trim())}`, {
          state: {
            email: res.email || email.trim(),
            emailMasked: res.emailMasked
          }
        })
      } else {
        setErrorMessage(res.message || 'Registration failed. Please try again.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during signup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section container auth-section">
      <Link to="/login" className="back-link">
        <ArrowLeft size={16} /> Back to Sign In
      </Link>

      <div className="auth-card" style={{ maxWidth: '520px', padding: '34px 36px' }}>
        <div className="auth-symbol">
          <ShieldCheck size={28} />
        </div>
        <div className="eyebrow">CITIZEN PORTAL SIGNUP</div>
        <h1>Create Your User Account</h1>
        <p className="muted centered" style={{ fontSize: '13px', marginTop: '6px' }}>
          Mandatory email verification ensures security and verified legal guidance.
        </p>

        {errorMessage && (
          <div
            className="notice"
            role="alert"
            style={{
              borderColor: '#ef4444',
              background: 'rgba(239, 68, 68, 0.08)',
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: '13px' }}>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: '20px' }}>
          {/* Full Name */}
          <div className="form-group">
            <label className="field-label" htmlFor="fullName">
              Full Legal Name
            </label>
            <div className="input-wrap">
              <span className="input-icon">
                <User size={18} />
              </span>
              <input
                id="fullName"
                type="text"
                className="text-input"
                placeholder="Enter your full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                disabled={busy}
                autoFocus
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label className="field-label" htmlFor="email">
              Email Address
            </label>
            <div className="input-wrap">
              <span className="input-icon">
                <Mail size={18} />
              </span>
              <input
                id="email"
                type="email"
                className="text-input"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={busy}
                autoComplete="email"
              />
            </div>
            <small className="field-hint" style={{ color: 'var(--muted, #888)' }}>
              A 6-digit verification code will be sent to confirm this email.
            </small>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <div className="input-wrap">
              <span className="input-icon">
                <Lock size={18} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="text-input"
                placeholder="Create a strong password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={busy}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="input-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Password Strength Indicator */}
          {password && (
            <div style={{ marginTop: '8px', marginBottom: '8px' }}>
              <PasswordStrengthIndicator password={password} />
            </div>
          )}

          {/* Confirm Password */}
          <div className="form-group">
            <label className="field-label" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div className="input-wrap">
              <span className="input-icon">
                <Lock size={18} />
              </span>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="text-input"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={busy}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="input-eye-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                Passwords do not match.
              </span>
            )}
          </div>

          {/* Terms Agreement */}
          <div className="form-checkbox" style={{ margin: '14px 0 18px 0' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
                required
                disabled={busy}
                style={{ marginTop: '2px' }}
              />
              <span className="muted" style={{ lineHeight: 1.4 }}>
                I agree to the <Link to="/terms" target="_blank" className="text-link">Terms of Service</Link>,{' '}
                <Link to="/privacy" target="_blank" className="text-link">Privacy Policy</Link>, and{' '}
                <Link to="/disclaimer" target="_blank" className="text-link">Legal Disclaimer</Link>.
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="button button-full"
            disabled={busy || !acceptTerms}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          >
            {busy ? (
              'Creating Account...'
            ) : (
              <>
                Continue to Email Verification <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #1e293b', paddingTop: '18px' }}>
          <p className="muted" style={{ fontSize: '13px', margin: 0 }}>
            Already have an account?{' '}
            <Link to="/login" className="text-link" style={{ fontWeight: 600 }}>
              Sign In with Email OTP
            </Link>
          </p>

          <div
            style={{
              marginTop: '16px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(199, 164, 91, 0.06)',
              border: '1px solid rgba(199, 164, 91, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
              <Briefcase size={16} style={{ color: '#c7a45b', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Are you a legal advocate?</span>
            </div>
            <Link
              to="/advocate/signup"
              className="text-link"
              style={{ fontSize: '12px', fontWeight: 700, color: '#c7a45b', whiteSpace: 'nowrap' }}
            >
              Advocate Signup →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
