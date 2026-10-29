import { describe, it, expect } from 'vitest'
import { evaluatePasswordRules } from '../components/PasswordStrengthIndicator'
// @ts-expect-error JS import in TS test
import { maskEmail } from '../../server/services/emailService.js'
// @ts-expect-error JS import in TS test
import { maskPhone } from '../../server/services/smsService.js'
// @ts-expect-error JS import in TS test
import { normalizeEmail, normalizePhone, validatePasswordStrength } from '../../server/services/authService.js'
// @ts-expect-error JS import in TS test
import { generateOtp, hashOtp, verifyOtp } from '../../server/services/otpService.js'

describe('Dual-Verification Authentication System Unit Tests', () => {
  it('enforces password strength requirements', () => {
    // Missing symbol
    const noSymbol = validatePasswordStrength('Priyanshu123')
    expect(noSymbol.valid).toBe(false)

    // Missing uppercase
    const noUpper = validatePasswordStrength('priyanshu@123')
    expect(noUpper.valid).toBe(false)

    // Missing number
    const noNumber = validatePasswordStrength('Priyanshu@Law')
    expect(noNumber.valid).toBe(false)

    // Less than 8 characters
    const short = validatePasswordStrength('P@1a')
    expect(short.valid).toBe(false)

    // Valid strong password
    const valid = validatePasswordStrength('StrongP@ssw0rd!')
    expect(valid.valid).toBe(true)

    // Frontend evaluate rules
    const rules = evaluatePasswordRules('StrongP@ssw0rd!')
    expect(rules.every(r => r.met)).toBe(true)
  })

  it('normalizes email addresses correctly', () => {
    expect(normalizeEmail('  Advocate.User+Tag@GMAIL.COM ')).toBe('advocate.user+tag@gmail.com')
  })

  it('normalizes and validates international phone numbers', () => {
    const indian = normalizePhone('+91', '9876543210')
    expect(indian.valid).toBe(true)
    expect(indian.phone).toBe('+919876543210')

    const us = normalizePhone('+1', '4155552671')
    expect(us.valid).toBe(true)
    expect(us.phone).toBe('+14155552671')

    const invalid = normalizePhone('+91', '123')
    expect(invalid.valid).toBe(false)
  })

  it('masks email addresses and mobile numbers securely', () => {
    expect(maskEmail('priyanshu@domain.com')).toBe('p***u@domain.com')
    expect(maskEmail('ab@domain.com')).toBe('a*@domain.com')

    expect(maskPhone('+919876543210')).toBe('+91 ******3210')
    expect(maskPhone('+14155552671')).toBe('+1 ******2671')
  })

  it('generates cryptographically secure 6-digit numeric OTPs and timing-safe hashes', () => {
    const otp = generateOtp()
    expect(otp).toMatch(/^[0-9]{6}$/)

    const salt = 'test-salt-1234'
    const hash = hashOtp(otp, salt)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBe(64) // SHA-256 hex string

    // Correct verification
    expect(verifyOtp(otp, hash, salt)).toBe(true)

    // Incorrect OTP
    expect(verifyOtp('000000', hash, salt)).toBe(false)
  })
})

describe('Dual-Verification End-to-End API Integration', () => {
  const testEmail = `test.user.${Date.now()}@example.com`
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`
  const testPassword = 'SecureP@ssw0rd!2026'
  let createdUserId = ''

  it('registers a new user and sends initial dual OTPs', async () => {
    const res = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Aarav Sharma',
        email: testEmail,
        countryCode: '+91',
        phoneNumber: testPhone,
        password: testPassword,
        confirmPassword: testPassword,
        acceptTerms: true
      })
    })

    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.ok).toBe(true)
    expect(data.userId).toBeDefined()
    expect(data.emailMasked).toBeDefined()
    expect(data.phoneMasked).toBeDefined()

    createdUserId = data.userId
  })

  it('rejects duplicate registration with identical email', async () => {
    const res = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Another User',
        email: testEmail,
        countryCode: '+91',
        phoneNumber: '9988776655',
        password: testPassword,
        confirmPassword: testPassword,
        acceptTerms: true
      })
    })

    const data = await res.json()
    expect(res.status).toBe(409)
    expect(data.error).toMatch(/already registered/i)
  })

  it('retrieves dual verification status showing both pending', async () => {
    const res = await fetch(`http://localhost:3001/api/auth/verification-status/${encodeURIComponent(createdUserId)}`)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.emailVerified).toBe(false)
    expect(data.phoneVerified).toBe(false)
    expect(data.fullyActivated).toBe(false)
  })

  it('prevents direct dashboard login until dual verification completes', async () => {
    const res = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: testPassword
      })
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.requiresVerification).toBe(true)
    expect(data.userId).toBe(createdUserId)
  })

  it('verifies email OTP from dev outbox', async () => {
    // Get the generated OTP from dev outbox
    const outboxRes = await fetch(`http://localhost:3001/api/auth/dev-outbox/${encodeURIComponent(createdUserId)}`)
    const outbox = await outboxRes.json()
    expect(outbox.emailOtp).toBeDefined()

    // Submit invalid OTP first
    const badRes = await fetch('http://localhost:3001/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: createdUserId, otp: '000000' })
    })
    expect(badRes.status).toBe(400)

    // Submit correct OTP
    const goodRes = await fetch('http://localhost:3001/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: createdUserId, otp: outbox.emailOtp })
    })
    const goodData = await goodRes.json()
    expect(goodRes.status).toBe(200)
    expect(goodData.emailVerified).toBe(true)
    expect(goodData.fullyActivated).toBe(false) // Phone still pending!
  })

  it('verifies mobile SMS OTP and activates account', async () => {
    const outboxRes = await fetch(`http://localhost:3001/api/auth/dev-outbox/${encodeURIComponent(createdUserId)}`)
    const outbox = await outboxRes.json()
    expect(outbox.smsOtp).toBeDefined()

    // Submit correct SMS OTP
    const goodRes = await fetch('http://localhost:3001/api/auth/verify-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: createdUserId, otp: outbox.smsOtp })
    })
    const goodData = await goodRes.json()
    expect(goodRes.status).toBe(200)
    expect(goodData.phoneVerified).toBe(true)
    expect(goodData.fullyActivated).toBe(true)
    expect(goodData.token).toBeDefined()
  })

  it('logs in successfully using Email identifier after dual verification', async () => {
    const res = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: testPassword
      })
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.token).toBeDefined()
    expect(data.user.email_verified).toBe(true)
    expect(data.user.phone_verified).toBe(true)
  })

  it('logs in successfully using Mobile Phone identifier', async () => {
    const res = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testPhone,
        password: testPassword
      })
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.token).toBeDefined()
    expect(data.user.id).toBe(createdUserId)
  })

  it('processes forgot password and resets password with new credentials', async () => {
    const forgotRes = await fetch('http://localhost:3001/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail })
    })
    const forgotData = await forgotRes.json()
    expect(forgotRes.status).toBe(200)
    expect(forgotData.resetToken).toBeDefined()

    const newPassword = 'BrandNewP@ssw0rd!2026'
    const resetRes = await fetch('http://localhost:3001/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: forgotData.resetToken,
        newPassword,
        confirmPassword: newPassword
      })
    })
    const resetData = await resetRes.json()
    expect(resetRes.status).toBe(200)
    expect(resetData.ok).toBe(true)

    // Old password should now fail
    const oldLoginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail, password: testPassword })
    })
    expect(oldLoginRes.status).toBe(401)

    // New password should succeed
    const newLoginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail, password: newPassword })
    })
    const newLoginData = await newLoginRes.json()
    expect(newLoginRes.status).toBe(200)
    expect(newLoginData.token).toBeDefined()
  })

  describe('Post-Verification Navigation and Login Flow Requirements', () => {
    it('verifies that verification status supplies raw email for login pre-fill', async () => {
      const statusRes = await fetch(`http://localhost:3001/api/auth/verification-status/${encodeURIComponent(createdUserId)}`)
      const statusData = await statusRes.json()
      expect(statusRes.status).toBe(200)
      expect(statusData.fullyActivated).toBe(true)
      expect(statusData.email).toBe(testEmail)
      expect(statusData.rawEmail).toBe(testEmail)
    })

    it('denies protected access before user explicitly logs in', async () => {
      const meRes = await fetch('http://localhost:3001/api/auth/me', {
        headers: { 'Authorization': 'Bearer unauthenticated-invalid-token' }
      })
      expect(meRes.status).toBe(401)
    })

    it('rejects incorrect login credentials with a clear error message', async () => {
      const badLoginRes = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: testEmail,
          password: 'IncorrectPassword123!'
        })
      })
      const badData = await badLoginRes.json()
      expect(badLoginRes.status).toBe(401)
      expect(badData.error).toMatch(/Invalid email, mobile number, or password|Invalid credentials/i)
    })

    it('authenticates user upon submitting correct password with pre-filled email', async () => {
      const loginRes = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: testEmail,
          password: 'BrandNewP@ssw0rd!2026'
        })
      })
      const loginData = await loginRes.json()
      expect(loginRes.status).toBe(200)
      expect(loginData.ok).toBe(true)
      expect(loginData.token).toBeDefined()
      expect(loginData.user.email).toBe(testEmail)

      // Verified token grants access to protected /me endpoint
      const meRes = await fetch('http://localhost:3001/api/auth/me', {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
      })
      const meData = await meRes.json()
      expect(meRes.status).toBe(200)
      expect(meData.user.id).toBe(createdUserId)
    })
  })
})
