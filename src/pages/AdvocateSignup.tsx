import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Briefcase, Award, Building, Compass } from 'lucide-react'
import { authClient } from '../lib/authClient'
import PasswordStrengthIndicator, { evaluatePasswordRules } from '../components/PasswordStrengthIndicator'

export default function AdvocateSignup() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [enrolmentNumber, setEnrolmentNumber] = useState('')
  const [city, setCity] = useState('')
  const [court, setCourt] = useState('')
  const [practiceAreas, setPracticeAreas] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptBarTerms, setAcceptBarTerms] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage('')

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Please enter your full legal name as per Bar Council records.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid official email address.')
      return
    }

    if (!enrolmentNumber.trim() || enrolmentNumber.trim().length < 3) {
      setErrorMessage('Please provide your Bar Council Enrolment Number (e.g. D/1428/2014).')
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

    if (!acceptBarTerms) {
      setErrorMessage('You must confirm that you are an enrolled advocate and agree to the Terms of Service.')
      return
    }

    setBusy(true)

    try {
      const res = await authClient.advocateSignup({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        enrolmentNumber: enrolmentNumber.trim(),
        city: city.trim() || 'New Delhi',
        court: court.trim() || 'District & Sessions Courts',
        practiceAreas: practiceAreas.trim() || 'Civil, Criminal Law',
        password,
        confirmPassword
      })

      if (res.ok || (res as any).success) {
        // Direct advocate to /plans with clear subscription message
        navigate('/plans', {
          state: {
            notice: 'Advocate account created! An active subscription plan is required to unlock Case Drafting tools and the Advocate Dashboard.',
            fromSignup: true
          }
        })
      } else {
        setErrorMessage(res.message || 'Advocate registration failed. Please try again.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during advocate registration.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 20px 60px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          to="/advocate/login"
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
          <ArrowLeft size={16} /> Back to Advocate Login
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
            Advocate Registration
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
            Join NayayaMitra's verified legal professional network. Case drafting tools & dashboard require an eligible subscription.
          </p>
        </div>

        {/* Subscription Notice Banner */}
        <div
          style={{
            background: 'rgba(199, 164, 91, 0.08)',
            border: '1px solid rgba(199, 164, 91, 0.35)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}
        >
          <Award size={18} style={{ color: '#c7a45b', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.45 }}>
            <strong>Advocate Dashboard & Case Drafting</strong>: After registration, you will be directed to select an eligible plan (Monthly ₹500 or 6-Month ₹2,499) to activate full legal drafting features.
          </div>
        </div>

        {/* Citizen notice */}
        <div
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#475569'
          }}
        >
          <span>Not an advocate? Looking for legal information?</span>
          <Link
            to="/register"
            style={{
              color: '#0f172a',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Citizen Signup <ArrowRight size={13} />
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
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Full Name (as per Bar Council records) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Adv. Rajesh Kumar Sharma"
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

          {/* Official Email */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Official Contact Email <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="advocate.rajesh@lawchambers.in"
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

          {/* Bar Council Enrolment Number */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Bar Council Enrolment Number <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Award size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type="text"
                required
                value={enrolmentNumber}
                onChange={e => setEnrolmentNumber(e.target.value)}
                placeholder="e.g. D/1428/2014 or MAH/4582/2019"
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

          {/* City & Court row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                City / State
              </label>
              <div style={{ position: 'relative' }}>
                <Building size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g. New Delhi, Delhi"
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

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Primary Courts
              </label>
              <div style={{ position: 'relative' }}>
                <Compass size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={court}
                  onChange={e => setCourt(e.target.value)}
                  placeholder="e.g. High Court / Tis Hazari"
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
          </div>

          {/* Practice Areas */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Practice Areas (comma separated)
            </label>
            <input
              type="text"
              value={practiceAreas}
              onChange={e => setPracticeAreas(e.target.value)}
              placeholder="Civil Litigation, Criminal Law, Family, Consumer, Corporate"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Password <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create a strong password"
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
            <PasswordStrengthIndicator password={password} />
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Confirm Password <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
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
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Declaration Checkbox */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <input
              type="checkbox"
              id="acceptBarTerms"
              checked={acceptBarTerms}
              onChange={e => setAcceptBarTerms(e.target.checked)}
              style={{ marginTop: '3px', cursor: 'pointer' }}
            />
            <label htmlFor="acceptBarTerms" style={{ fontSize: '13px', color: '#475569', lineHeight: 1.4, cursor: 'pointer' }}>
              I declare that I am an enrolled advocate with a State Bar Council in India, and I agree to the{' '}
              <Link to="/terms" target="_blank" style={{ color: '#c7a45b', textDecoration: 'none', fontWeight: 600 }}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" style={{ color: '#c7a45b', textDecoration: 'none', fontWeight: 600 }}>
                Privacy Policy
              </Link>.
            </label>
          </div>

          {/* Submit Button */}
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
              marginTop: '6px'
            }}
          >
            {busy ? 'Registering Advocate Account…' : 'Complete Advocate Registration'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Footer Link to Advocate Login */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#64748b' }}>
          Already have an advocate account?{' '}
          <Link to="/advocate/login" style={{ color: '#c7a45b', fontWeight: 600, textDecoration: 'none' }}>
            Advocate Login
          </Link>
        </div>
      </div>
    </div>
  )
}
