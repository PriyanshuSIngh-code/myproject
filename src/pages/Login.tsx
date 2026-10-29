import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Briefcase
} from 'lucide-react'
import { authClient } from '../lib/authClient'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshUser } = useAuth()

  const queryParams = new URLSearchParams(location.search)
  const initialEmail =
    (location.state as any)?.email ||
    queryParams.get('email') ||
    ''

  const initialNotice =
    (location.state as any)?.notice ||
    (queryParams.get('verified') === 'true'
      ? 'Your email has been verified successfully. Please enter your email to receive your login code.'
      : '')

  // Flow step: 'email' (Step 1) -> 'otp' (Step 2)
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState<string>(initialEmail)
  const [maskedEmail, setMaskedEmail] = useState<string>('')
  const [otp, setOtp] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successNotice, setSuccessNotice] = useState(initialNotice)
  const [cooldown, setCooldown] = useState(0)

  // Countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Step 1: Request Email OTP for User Login
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage('')
    setSuccessNotice('')

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid registered email address.')
      return
    }

    setBusy(true)

    try {
      const res = await authClient.userLoginRequest({ email: cleanEmail })

      if (res.requiresVerification && res.userId) {
        setSuccessNotice('Account pending verification. Redirecting to email verification...')
        setTimeout(() => {
          navigate(`/verify-email?userId=${encodeURIComponent(res.userId!)}&email=${encodeURIComponent(cleanEmail)}`)
        }, 1200)
        return
      }

      if (res.ok || res.success) {
        setMaskedEmail(res.emailMasked || cleanEmail)
        setSuccessNotice(`Single-use login code sent to ${res.emailMasked || cleanEmail}.`)
        setCooldown(res.cooldownSeconds || 60)
        setStep('otp')
      } else {
        setErrorMessage(res.message || 'Login request failed. Please check your email address.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to request login code. Please verify your email or sign up.')
    } finally {
      setBusy(false)
    }
  }

  // Step 2: Verify Login OTP
  async function handleVerifyOtp(e?: React.FormEvent, codeToVerify?: string) {
    if (e) e.preventDefault()
    setErrorMessage('')

    const code = (codeToVerify || otp).trim()
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setErrorMessage('Please enter the complete 6-digit login code.')
      return
    }

    setBusy(true)

    try {
      const res = await authClient.userLoginVerify({
        email: email.trim().toLowerCase(),
        otp: code
      })

      if (res.ok || (res as any).success) {
        setSuccessNotice('Login verified! Redirecting to User Dashboard...')
        await refreshUser()
        const returnUrl = (location.state as any)?.from || res.redirectTo || '/dashboard'
        setTimeout(() => {
          navigate(returnUrl, { replace: true })
        }, 600)
      } else {
        setErrorMessage(res.message || 'Login verification failed.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired login code. Please request a new code.')
    } finally {
      setBusy(false)
    }
  }

  // Resend Login OTP
  async function handleResendLoginOtp() {
    if (cooldown > 0 || busy) return
    setErrorMessage('')
    setSuccessNotice('')
    setBusy(true)

    try {
      const res = await authClient.userLoginResend({ email: email.trim().toLowerCase() })
      setSuccessNotice(res.message || 'A fresh login code has been sent to your email.')
      setCooldown(res.cooldownSeconds || 60)
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend login code. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleOtpInput(val: string) {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 6)
    setOtp(clean)
    if (clean.length === 6) {
      handleVerifyOtp(undefined, clean)
    }
  }

  return (
    <section className="section container auth-section">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <div className="auth-card" style={{ maxWidth: '480px', padding: '36px 34px' }}>
        <div className="auth-symbol">
          <ShieldCheck size={28} />
        </div>

        <div className="eyebrow">CITIZEN PORTAL · SECURE LOGIN</div>
        <h1>{step === 'email' ? 'User Sign In' : 'Enter Login Code'}</h1>
        <p className="muted centered" style={{ fontSize: '13px', marginTop: '6px' }}>
          {step === 'email'
            ? 'For citizen privacy and data protection, an email OTP is required on every login.'
            : `Enter the 6-digit one-time code sent to ${maskedEmail || email}.`}
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

        {successNotice && (
          <div
            className="notice"
            role="status"
            style={{
              borderColor: '#10b981',
              background: 'rgba(16, 185, 129, 0.08)',
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#10b981' }}>{successNotice}</span>
          </div>
        )}

        {/* STEP 1: Enter Email */}
        {step === 'email' && (
          <form onSubmit={handleRequestOtp} className="auth-form" style={{ marginTop: '22px' }}>
            <div className="form-group">
              <label className="field-label" htmlFor="userEmail">
                Registered Email Address
              </label>
              <div className="input-wrap">
                <span className="input-icon">
                  <Mail size={18} />
                </span>
                <input
                  id="userEmail"
                  type="email"
                  className="text-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={busy}
                  autoComplete="email"
                />
              </div>
              <small className="field-hint" style={{ color: 'var(--muted, #888)' }}>
                Every login requires an instant one-time passcode sent to your inbox.
              </small>
            </div>

            <button
              type="submit"
              className="button button-full"
              disabled={busy || !email.trim()}
              style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {busy ? (
                <>
                  <RefreshCw size={16} className="spin" /> Sending Login Code...
                </>
              ) : (
                <>
                  Send One-Time Login Code <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Enter 6-Digit OTP */}
        {step === 'otp' && (
          <form onSubmit={e => handleVerifyOtp(e)} style={{ marginTop: '22px' }}>
            <div className="form-group">
              <label className="field-label" htmlFor="loginOtp" style={{ textAlign: 'center', display: 'block' }}>
                6-Digit Login Code
              </label>
              <input
                id="loginOtp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="text-input"
                value={otp}
                onChange={e => handleOtpInput(e.target.value)}
                placeholder="••••••"
                autoFocus
                disabled={busy}
                style={{
                  fontSize: '28px',
                  letterSpacing: '10px',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: '#c7a45b',
                  padding: '12px 16px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <button
              type="submit"
              className="button button-full"
              disabled={busy || otp.length !== 6}
              style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {busy ? (
                <>
                  <RefreshCw size={16} className="spin" /> Verifying Code...
                </>
              ) : (
                <>
                  Verify & Enter User Dashboard <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Resend and change email options */}
            <div style={{ marginTop: '18px', textAlign: 'center' }}>
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={handleResendLoginOtp}
                disabled={cooldown > 0 || busy}
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                {cooldown > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} /> Resend login code in {cooldown}s
                  </span>
                ) : (
                  'Resend Login Code'
                )}
              </button>

              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email')
                    setOtp('')
                    setErrorMessage('')
                  }}
                  className="text-link"
                  style={{ fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ← Use a different email address
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Footer & Advocate Portal Redirection */}
        <div className="auth-footer" style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #1e293b', paddingTop: '18px' }}>
          <p className="muted" style={{ fontSize: '13px', margin: 0 }}>
            Don't have a citizen account yet?{' '}
            <Link to="/register" className="text-link" style={{ fontWeight: 600 }}>
              Sign Up
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
              <div>
                <strong style={{ fontSize: '12px', color: '#f1f5f9', display: 'block' }}>Are you an Advocate?</strong>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Access Case Drafting & Bar Dashboard</span>
              </div>
            </div>
            <Link
              to="/advocate/login"
              className="button button-small"
              style={{ fontSize: '11px', padding: '6px 12px', whiteSpace: 'nowrap' }}
            >
              Advocate Login →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
