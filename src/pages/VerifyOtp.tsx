import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ShieldCheck,
  Mail,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { authClient } from '../lib/authClient'
import { useAuth } from '../context/AuthContext'

export default function VerifyOtp() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { refreshUser } = useAuth()

  const userId = searchParams.get('userId') || ''
  const initialEmail = searchParams.get('email') || (location.state as any)?.email || ''
  const urlOtp = searchParams.get('otp') || ''

  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState(urlOtp)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [cooldown, setCooldown] = useState(60)

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Auto-verify if OTP is provided in URL link
  useEffect(() => {
    if (urlOtp && urlOtp.length === 6 && (userId || initialEmail)) {
      handleVerify(urlOtp)
    }
  }, [urlOtp, userId, initialEmail])

  async function handleVerify(codeToVerify?: string) {
    const code = (codeToVerify || otp).trim()
    setErrorMessage('')
    setSuccessMessage('')

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setErrorMessage('Please enter the complete 6-digit verification code.')
      return
    }

    setBusy(true)

    try {
      const res = await authClient.userVerifyEmail({
        userId: userId || undefined,
        email: email || undefined,
        otp: code
      })

      if (res.ok || (res as any).success) {
        setSuccessMessage('Email verified successfully! Setting up your secure workspace...')
        await refreshUser()
        setTimeout(() => {
          navigate('/dashboard', {
            state: { notice: 'Email verified successfully! Welcome to your User Dashboard.' }
          })
        }, 800)
      } else {
        setErrorMessage(res.message || 'Verification failed. Please check your code.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired verification code. Please request a new one.')
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || busy) return
    setErrorMessage('')
    setSuccessMessage('')
    setBusy(true)

    try {
      const res = await authClient.userResendVerification({
        userId: userId || undefined,
        email: email || undefined
      })

      setSuccessMessage(res.message || 'A fresh verification code has been dispatched to your email.')
      setCooldown(res.cooldownSeconds || 60)
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend verification code. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleInputChange(val: string) {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 6)
    setOtp(clean)
    if (clean.length === 6) {
      handleVerify(clean)
    }
  }

  return (
    <section className="section container auth-section">
      <div className="auth-card" style={{ maxWidth: '480px', padding: '36px 32px' }}>
        <div className="auth-symbol">
          <Mail size={30} style={{ color: '#c7a45b' }} />
        </div>

        <div className="eyebrow">MANDATORY EMAIL VERIFICATION</div>
        <h1>Verify Your Email Address</h1>
        <p className="muted centered" style={{ fontSize: '13px', marginTop: '6px' }}>
          We have sent a single-use 6-digit confirmation code to:
          <br />
          <strong style={{ color: '#f1f5f9', fontSize: '14px', wordBreak: 'break-all' }}>
            {email || 'your registered email inbox'}
          </strong>
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

        {successMessage && (
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
            <span style={{ fontSize: '13px', color: '#10b981' }}>{successMessage}</span>
          </div>
        )}

        <form
          onSubmit={e => {
            e.preventDefault()
            handleVerify()
          }}
          style={{ marginTop: '24px' }}
        >
          <div className="form-group">
            <label className="field-label" htmlFor="otpInput" style={{ textAlign: 'center', display: 'block' }}>
              Enter 6-Digit Email Code
            </label>
            <input
              id="otpInput"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="text-input"
              value={otp}
              onChange={e => handleInputChange(e.target.value)}
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
                Verify Email & Enter Dashboard <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Resend Controls */}
        <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <p className="muted" style={{ fontSize: '12px', marginBottom: '8px' }}>
            Didn't receive the email? Check your spam/junk folder.
          </p>

          <button
            type="button"
            className="button button-ghost button-small"
            onClick={handleResend}
            disabled={cooldown > 0 || busy}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            {cooldown > 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={13} /> Resend code in {cooldown}s
              </span>
            ) : (
              'Resend Verification Code'
            )}
          </button>

          <div style={{ marginTop: '14px' }}>
            <Link to="/register" className="text-link" style={{ fontSize: '12px' }}>
              ← Return to Signup (Change Email)
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
