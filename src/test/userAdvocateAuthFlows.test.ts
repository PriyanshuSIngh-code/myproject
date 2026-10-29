import { describe, it, expect, afterAll } from 'vitest'
import crypto from 'node:crypto'
// @ts-expect-error JS module in server
import { db } from '../../server/db.js'
// @ts-expect-error JS module in server
import { hashOtp } from '../../server/services/otpService.js'

describe('Separate User and Advocate Authentication Flows', () => {
  const BASE_URL = 'http://localhost:3001'
  const runId = Date.now()
  const citizenEmail = `citizen.http.${runId}@example.com`
  const advocateNoSubEmail = `advocate.nosub.http.${runId}@example.com`
  const advocateWithSubEmail = `advocate.withsub.http.${runId}@example.com`
  const password = 'StrongPassword123!'

  let citizenUserId = ''
  let citizenToken = ''
  let advocateNoSubToken = ''
  let advocateWithSubToken = ''

  it('1. HTTP USER SIGNUP: creates unverified user and issues email OTP', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/user/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Citizen Arvind',
        email: citizenEmail,
        password,
        confirmPassword: password
      })
    })

    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.ok).toBe(true)
    expect(data.requiresEmailVerification).toBe(true)
    expect(data.userId).toBeDefined()
    citizenUserId = data.userId

    // Verify unverified status in database
    const userInDb = db.prepare('SELECT email_verified, account_status, role FROM users WHERE id = ?').get(citizenUserId)
    expect(userInDb.email_verified).toBe(0)
    expect(userInDb.account_status).toBe('pending_verification')
    expect(userInDb.role).toBe('user')
  })

  it('2. HTTP UNVERIFIED USER: Cannot login before verifying email', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/user/login-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: citizenEmail })
    })

    const data = await res.json()
    // When unverified, backend detects and flags requiresVerification: true
    expect(res.status).toBe(200)
    expect(data.requiresVerification).toBe(true)
  })

  it('3. HTTP USER EMAIL VERIFICATION: Verifies OTP, activates account and logs user in', async () => {
    // Retrieve the active OTP record from DB
    const otpRecord = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type = 'user_email_verification' AND verified_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(citizenUserId)
    expect(otpRecord).toBeDefined()

    // 1. Test invalid OTP
    const badRes = await fetch(`${BASE_URL}/api/auth/user/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: citizenUserId,
        email: citizenEmail,
        otp: '000000'
      })
    })
    expect(badRes.status).toBe(400)

    // 2. Set known valid OTP using official HMAC hashOtp
    const testValidOtp = '555666'
    const testHash = hashOtp(testValidOtp)
    db.prepare('UPDATE otp_verifications SET otp_hash = ?, attempts = 0 WHERE id = ?').run(testHash, otpRecord.id)

    const goodRes = await fetch(`${BASE_URL}/api/auth/user/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: citizenUserId,
        email: citizenEmail,
        otp: testValidOtp
      })
    })

    const goodData = await goodRes.json()
    expect(goodRes.status).toBe(200)
    expect(goodData.ok).toBe(true)
    expect(goodData.token).toBeDefined()
    citizenToken = goodData.token

    // Verify user is now active and email_verified = 1 in database
    const activatedUser = db.prepare('SELECT email_verified, account_status FROM users WHERE id = ?').get(citizenUserId)
    expect(activatedUser.email_verified).toBe(1)
    expect(activatedUser.account_status).toBe('active')
  })

  it('4. HTTP USER LOGIN: Requires fresh Email OTP every time (no password bypass)', async () => {
    // Request fresh login OTP
    const reqRes = await fetch(`${BASE_URL}/api/auth/user/login-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: citizenEmail })
    })
    const reqData = await reqRes.json()
    expect(reqRes.status).toBe(200)
    expect(reqData.ok).toBe(true)
    expect(reqData.cooldownSeconds).toBeDefined()

    // Check OTP record in DB
    const loginOtpRecord = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type = 'user_login' AND verified_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(citizenUserId)
    expect(loginOtpRecord).toBeDefined()

    // Test with valid login OTP using official hashOtp
    const testLoginOtp = '777888'
    const loginHash = hashOtp(testLoginOtp)
    db.prepare('UPDATE otp_verifications SET otp_hash = ? WHERE id = ?').run(loginHash, loginOtpRecord.id)

    const verifyRes = await fetch(`${BASE_URL}/api/auth/user/login-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: citizenEmail,
        otp: testLoginOtp
      })
    })

    const verifyData = await verifyRes.json()
    expect(verifyRes.status).toBe(200)
    expect(verifyData.ok).toBe(true)
    expect(verifyData.token).toBeDefined()
    expect(verifyData.redirectTo).toBe('/dashboard')

    // Test OTP single-use: Reusing the same OTP must fail immediately
    const reuseRes = await fetch(`${BASE_URL}/api/auth/user/login-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: citizenEmail,
        otp: testLoginOtp
      })
    })
    expect(reuseRes.status).toBe(400)
  })

  it('5. HTTP ADVOCATE SIGNUP: Dedicated flow records Bar credentials and assigns advocate role', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/advocate/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Adv. Manpreet Singh',
        email: advocateNoSubEmail,
        password,
        confirmPassword: password,
        enrolmentNumber: 'D/4821/2016',
        city: 'New Delhi',
        court: 'High Court of Delhi',
        practiceAreas: 'Civil, Commercial Arbitration'
      })
    })

    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.ok).toBe(true)
    expect(data.user.role).toBe('advocate')
    expect(data.token).toBeDefined()
    // No subscription yet -> redirectTo: '/plans'
    expect(data.hasActiveSubscription).toBe(false)
    expect(data.redirectTo).toBe('/plans')

    advocateNoSubToken = data.token
  })

  it('6. HTTP ADVOCATE LOGIN: Citizen account cannot login through advocate login', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/advocate/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: citizenEmail,
        password
      })
    })

    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.isUserAccount).toBe(true)
  })

  it('7. HTTP ADVOCATE LOGIN: Advocate without active subscription is directed to /plans', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/advocate/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: advocateNoSubEmail,
        password
      })
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.hasActiveSubscription).toBe(false)
    expect(data.redirectTo).toBe('/plans')
  })

  it('8. HTTP ADVOCATE LOGIN: Advocate WITH active subscription is directed to /advocate/dashboard', async () => {
    // 1. Create second advocate
    const signupRes = await fetch(`${BASE_URL}/api/auth/advocate/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Adv. Sunita Rao',
        email: advocateWithSubEmail,
        password,
        confirmPassword: password,
        enrolmentNumber: 'KAR/1984/2012',
        city: 'Bengaluru',
        court: 'High Court of Karnataka',
        practiceAreas: 'Intellectual Property, Corporate'
      })
    })
    const signupData = await signupRes.json()
    const advocateId = signupData.user.id

    // 2. Insert active subscription in database
    const now = new Date().toISOString()
    const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(`
      INSERT INTO advocate_subscriptions (id, user_id, payment_id, starts_at, ends_at, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(crypto.randomUUID(), advocateId, `pay-${crypto.randomUUID()}`, now, futureDate)

    // 3. Log in with advocate credentials
    const loginRes = await fetch(`${BASE_URL}/api/auth/advocate/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: advocateWithSubEmail,
        password
      })
    })

    const loginData = await loginRes.json()
    expect(loginRes.status).toBe(200)
    expect(loginData.ok).toBe(true)
    expect(loginData.hasActiveSubscription).toBe(true)
    expect(loginData.redirectTo).toBe('/advocate/dashboard')
    advocateWithSubToken = loginData.token
  })

  it('9. HTTP ACCESS CONTROL: Citizen user is rejected from case drafting endpoint /api/draft', async () => {
    const res = await fetch(`${BASE_URL}/api/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        kind: 'Legal notice',
        language: 'English',
        facts: 'Tenant refused to vacate the premises after lease termination.'
      })
    })

    expect(res.status).toBe(403)
  })

  it('10. HTTP ACCESS CONTROL: Advocate without active plan is rejected from /api/draft', async () => {
    const res = await fetch(`${BASE_URL}/api/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advocateNoSubToken}`
      },
      body: JSON.stringify({
        kind: 'Legal notice',
        language: 'English',
        facts: 'Tenant refused to vacate the premises after lease termination.'
      })
    })

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.subscriptionRequired).toBe(true)
  })

  it('11. HTTP ACCESS CONTROL: Advocate with active subscription can access /api/cases', async () => {
    const res = await fetch(`${BASE_URL}/api/cases`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${advocateWithSubToken}`
      }
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  afterAll(() => {
    try {
      const emails = [citizenEmail, advocateNoSubEmail, advocateWithSubEmail]
      for (const email of emails) {
        const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
        if (u) {
          db.prepare('DELETE FROM otp_verifications WHERE user_id = ?').run(u.id)
          db.prepare('DELETE FROM advocate_subscriptions WHERE user_id = ?').run(u.id)
          db.prepare('DELETE FROM advocate_applications WHERE user_id = ?').run(u.id)
          db.prepare('DELETE FROM profiles WHERE id = ?').run(u.id)
          db.prepare('DELETE FROM users WHERE id = ?').run(u.id)
        }
      }
    } catch {
      // ignore
    }
  })
})
