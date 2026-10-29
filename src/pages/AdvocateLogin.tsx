import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Briefcase, Award, ShieldAlert } from 'lucide-react'
import { authClient } from '../lib/authClient'

export default function AdvocateLogin() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isCitizenAccount, setIsCitizenAccount] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage('')
    setIsCitizenAccount(false)

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your advocate email and password.')
      return
    }

    setBusy(true)

    try {
      const res = await authClient.advocateLogin({
        email: email.trim().toLowerCase(),
        password
      })

      if (res.ok || (res as any).success) {
        if (res.hasActiveSubscription) {
          // Has active eligible subscription -> direct to Advocate Dashboard
          navigate('/advocate/dashboard', {
            state: { notice: `Welcome back, ${res.user?.full_name || 'Counsel'}!` }
          })
        } else {
          // Inactive or expired subscription -> direct to /plans
          navigate('/plans', {
            state: {
              notice: 'Your advocate account does not have an active subscription. Please select an eligible plan to access Case Drafting and the Advocate Dashboard.',
              fromLogin: true
            }
          })
        }
      } else {
        if ((res as any).isUserAccount) {
          setIsCitizenAccount(true)
        }
        setErrorMessage(res.message || 'Advocate login failed. Please verify credentials.')
      }
    } catch (err: any) {
      if (err.isUserAccount || (err.message && err.message.toLowerCase().includes('citizen'))) {
        setIsCitizenAccount(true)
      }
      setErrorMessage(err.message || 'An unexpected error occurred during advocate login.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: '520px', margin: '40px auto', padding: '0 20px 60px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#64748b',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>

      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
          padding: '36px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #c7a45b, #101a33)'
          }}
        />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '12px',
              borderRadius: '50%',
              background: '#f8fafc',
              color: '#c7a45b',
              marginBottom: '12px',
              border: '1px solid #e2e8f0'
            }}
          >
            <Briefcase size={28} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
            Advocate Portal Login
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
            Sign in with your Advocate credentials to access Case Drafting and case management tools.
          </p>
        </div>

        {/* Citizen Notice / Switch Banner */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '13px', color: '#475569' }}>
            <strong>Citizen / Public User?</strong>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Use the citizen email-OTP login portal</div>
          </div>
          <Link
            to="/login"
            style={{
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Citizen Login <ArrowRight size={12} />
          </Link>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
            {isCitizenAccount && (
              <Link
                to="/login"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  alignSelf: 'flex-start',
                  marginTop: '4px'
                }}
              >
                Go to Citizen Login →
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Advocate Email */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Advocate Email Address <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="advocate@example.com"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Password <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: '12px', color: '#c7a45b', textDecoration: 'none', fontWeight: 500 }}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '12px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: '#101a33',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: busy ? 0.7 : 1,
              marginTop: '4px'
            }}
          >
            {busy ? 'Signing in…' : 'Sign in to Advocate Portal'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Subscription Info Box */}
        <div
          style={{
            marginTop: '24px',
            padding: '12px 14px',
            background: 'rgba(199, 164, 91, 0.08)',
            border: '1px solid rgba(199, 164, 91, 0.3)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#1e293b',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start'
          }}
        >
          <Award size={16} style={{ color: '#c7a45b', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <strong>Active Subscription Routing:</strong> Advocates with an active plan will be taken directly to the Advocate Dashboard. Expired or un-subscribed accounts will be directed to the Plans page to activate legal drafting.
          </div>
        </div>

        {/* Advocate Register Link */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#64748b' }}>
          New Advocate?{' '}
          <Link to="/advocate/signup" style={{ color: '#c7a45b', fontWeight: 600, textDecoration: 'none' }}>
            Register Bar Profile
          </Link>
        </div>
      </div>
    </div>
  )
}
