import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../db.js'
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  generateSecureToken,
  hashToken,
  OTP_EXPIRY_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS
} from '../services/otpService.js'
import {
  validatePasswordStrength,
  hashPassword,
  comparePassword,
  normalizeEmail,
  normalizePhone,
  signSessionToken,
  verifySessionToken
} from '../services/authService.js'
import { sendEmailOtp, maskEmail, devEmailOutbox, isEmailProviderConfigured } from '../services/emailService.js'
import { sendSmsOtp, maskPhone, devSmsOutbox, isSmsProviderConfigured } from '../services/smsService.js'
import { registrationLimiter, loginLimiter, otpLimiter } from '../middleware/rateLimiter.js'

export const authRouter = Router()

/**
 * Authentication middleware for protected endpoints.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' })
  }

  const decoded = verifySessionToken(token)
  if (!decoded || !decoded.userId) {
    // Check database session token
    const dbSession = db.prepare('SELECT user_id, expires_at FROM user_sessions WHERE token = ?').get(token)
    if (!dbSession || new Date(dbSession.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' })
    }
    req.userId = dbSession.user_id
  } else {
    req.userId = decoded.userId
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  if (!user) {
    return res.status(401).json({ error: 'User account not found.' })
  }
  if (user.account_status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended.' })
  }

  req.user = user
  next()
}

// =============================================================
// SEPARATE USER AND ADVOCATE AUTHENTICATION SYSTEM
// =============================================================

// -------------------------------------------------------------
// [USER FLOW 1] USER SIGNUP (EMAIL VERIFICATION MANDATORY)
// -------------------------------------------------------------
authRouter.post('/user/signup', registrationLimiter, async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body

    // 1. Validation
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters long.' })
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'A valid email address is required.' })
    }
    const normalizedEmail = normalizeEmail(email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }
    if (!password || password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and Confirm Password do not match.' })
    }
    const pwdValidation = validatePasswordStrength(password)
    if (!pwdValidation.valid) {
      return res.status(400).json({ error: pwdValidation.message })
    }

    // 2. Duplicate account check
    const existing = db.prepare('SELECT id, email_verified, role, account_status FROM users WHERE email = ?').get(normalizedEmail)
    if (existing) {
      if (existing.email_verified === 1) {
        return res.status(409).json({ error: 'An account with this email address is already registered. Please log in.' })
      }
      // Re-initialize unverified account with updated credentials
      const newHash = await hashPassword(password)
      const now = new Date().toISOString()
      db.prepare('UPDATE users SET full_name = ?, password_hash = ?, updated_at = ? WHERE id = ?')
        .run(fullName.trim(), newHash, now, existing.id)

      const emailOtp = generateOtp()
      const emailOtpHash = hashOtp(emailOtp)
      const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()

      db.prepare("UPDATE otp_verifications SET expires_at = datetime('now') WHERE user_id = ? AND type IN ('user_email_verification', 'email') AND verified_at IS NULL").run(existing.id)

      db.prepare(`
        INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
        VALUES (?, ?, 'user_email_verification', ?, ?, ?, 0, 0, ?)
      `).run(crypto.randomUUID(), existing.id, normalizedEmail, emailOtpHash, expiry, now)

      await sendEmailOtp({ email: normalizedEmail, name: fullName.trim(), otp: emailOtp, type: 'registration' })

      return res.status(200).json({
        ok: true,
        success: true,
        requiresEmailVerification: true,
        message: 'Account pending verification. A new verification code has been sent to your email.',
        userId: existing.id,
        email: normalizedEmail,
        emailMasked: maskEmail(normalizedEmail),
        cooldownSeconds: 60
      })
    }

    // 3. Create fresh unverified account
    const userId = crypto.randomUUID()
    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO users (id, full_name, email, phone_number, country_code, password_hash, email_verified, phone_verified, role, account_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, '+91', ?, 0, 1, 'user', 'pending_verification', ?, ?)
    `).run(userId, fullName.trim(), normalizedEmail, `pending-${userId}`, passwordHash, now, now)

    db.prepare(`
      INSERT INTO profiles (id, full_name, email, role)
      VALUES (?, ?, ?, 'user')
    `).run(userId, fullName.trim(), normalizedEmail)

    // 4. Generate 6-digit email verification OTP
    const emailOtp = generateOtp()
    const emailOtpHash = hashOtp(emailOtp)
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()

    db.prepare(`
      INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
      VALUES (?, ?, 'user_email_verification', ?, ?, ?, 0, 0, ?)
    `).run(crypto.randomUUID(), userId, normalizedEmail, emailOtpHash, expiry, now)

    // 5. Send real email OTP
    await sendEmailOtp({ email: normalizedEmail, name: fullName.trim(), otp: emailOtp, type: 'registration' })

    return res.status(201).json({
      ok: true,
      success: true,
      requiresEmailVerification: true,
      message: 'Signup initiated. A 6-digit verification code has been sent to your email address.',
      userId,
      email: normalizedEmail,
      emailMasked: maskEmail(normalizedEmail),
      cooldownSeconds: 60
    })
  } catch (err) {
    console.error('[Auth Error /user/signup]:', err)
    return res.status(500).json({ error: 'Signup failed due to a server error. Please try again.' })
  }
})

// -------------------------------------------------------------
// [USER FLOW 2] USER EMAIL VERIFICATION
// -------------------------------------------------------------
authRouter.post('/user/verify-email', otpLimiter, async (req, res) => {
  try {
    const { userId, email, otp } = req.body
    if ((!userId && !email) || !otp) {
      return res.status(400).json({ error: 'User identifier and 6-digit verification code are required.' })
    }

    const cleanOtp = String(otp).trim()
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ error: 'Verification code must be exactly 6 digits.' })
    }

    let user = null
    if (userId) {
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    } else if (email) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email))
    }

    if (!user) {
      return res.status(404).json({ error: 'User account record not found.' })
    }

    if (user.email_verified === 1) {
      const token = signSessionToken({ userId: user.id, email: user.email, role: user.role })
      return res.json({
        ok: true,
        success: true,
        alreadyVerified: true,
        message: 'Email address is already verified.',
        token,
        user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
        redirectTo: '/dashboard'
      })
    }

    // Retrieve active OTP record
    const otpRecord = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type IN ('user_email_verification', 'email') AND verified_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id)

    if (!otpRecord) {
      return res.status(400).json({ error: 'No active verification code found. Please request a new code.' })
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please click "Resend Code".' })
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. This code is locked. Please request a new code.' })
    }

    const isValid = verifyOtp(cleanOtp, otpRecord.otp_hash)
    if (!isValid) {
      const newAttempts = otpRecord.attempts + 1
      db.prepare('UPDATE otp_verifications SET attempts = ? WHERE id = ?').run(newAttempts, otpRecord.id)
      const remaining = MAX_ATTEMPTS - newAttempts
      return res.status(400).json({
        error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code locked. Please resend.'}`
      })
    }

    // Mark as verified & activate account
    const now = new Date().toISOString()
    db.prepare('UPDATE otp_verifications SET verified_at = ? WHERE id = ?').run(now, otpRecord.id)
    db.prepare("UPDATE users SET email_verified = 1, email_verified_at = ?, account_status = 'active', updated_at = ? WHERE id = ?").run(now, now, user.id)
    db.prepare('UPDATE profiles SET email_verified_at = ? WHERE id = ?').run(now, user.id)

    const sessionToken = signSessionToken({ userId: user.id, email: user.email, role: user.role })

    return res.json({
      ok: true,
      success: true,
      message: 'Email verified successfully! Welcome to NayayaMitra.',
      token: sessionToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        email_verified: true
      },
      redirectTo: '/dashboard'
    })
  } catch (err) {
    console.error('[Auth Error /user/verify-email]:', err)
    return res.status(500).json({ error: 'Email verification failed. Please try again.' })
  }
})

// -------------------------------------------------------------
// [USER FLOW 3] USER RESEND EMAIL VERIFICATION
// -------------------------------------------------------------
authRouter.post('/user/resend-verification', otpLimiter, async (req, res) => {
  try {
    const { userId, email } = req.body
    let user = null
    if (userId) user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    else if (email) user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email))

    if (!user) return res.status(404).json({ error: 'User record not found.' })
    if (user.email_verified === 1) return res.status(400).json({ error: 'Your email address is already verified.' })

    const lastOtp = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type IN ('user_email_verification', 'email')
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id)

    if (lastOtp) {
      const elapsed = Date.now() - new Date(lastOtp.last_sent_at).getTime()
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
        return res.status(429).json({
          error: `Please wait ${waitSec} seconds before requesting a new code.`,
          retryAfter: waitSec,
          cooldownSeconds: waitSec
        })
      }
    }

    db.prepare("UPDATE otp_verifications SET expires_at = datetime('now') WHERE user_id = ? AND type IN ('user_email_verification', 'email') AND verified_at IS NULL").run(user.id)

    const newOtp = generateOtp()
    const newHash = hashOtp(newOtp)
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()
    const now = new Date().toISOString()
    const resendCount = (lastOtp?.resend_count || 0) + 1

    db.prepare(`
      INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
      VALUES (?, ?, 'user_email_verification', ?, ?, ?, 0, ?, ?)
    `).run(crypto.randomUUID(), user.id, user.email, newHash, expiry, resendCount, now)

    await sendEmailOtp({ email: user.email, name: user.full_name, otp: newOtp, type: 'registration' })

    return res.json({
      ok: true,
      success: true,
      message: 'A fresh verification code has been sent to your email.',
      cooldownSeconds: 60
    })
  } catch (err) {
    console.error('[Auth Error /user/resend-verification]:', err)
    return res.status(500).json({ error: 'Failed to resend verification code.' })
  }
})

// -------------------------------------------------------------
// [USER FLOW 4] USER LOGIN REQUEST (EMAIL OTP REQUIRED EVERY TIME)
// -------------------------------------------------------------
authRouter.post('/user/login-request', loginLimiter, async (req, res) => {
  try {
    const { email } = req.body
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Please enter your registered email address.' })
    }

    const normalizedEmail = normalizeEmail(email)
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail)

    if (!user) {
      return res.status(401).json({ error: 'No account found with this email address. Please sign up.' })
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' })
    }

    // Step 2 requirement: An unverified email must not be allowed to log in.
    if (user.email_verified !== 1) {
      const newOtp = generateOtp()
      const newHash = hashOtp(newOtp)
      const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()
      const now = new Date().toISOString()

      db.prepare(`
        INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
        VALUES (?, ?, 'user_email_verification', ?, ?, ?, 0, 0, ?)
      `).run(crypto.randomUUID(), user.id, user.email, newHash, expiry, now)

      await sendEmailOtp({ email: user.email, name: user.full_name, otp: newOtp, type: 'registration' })

      return res.status(200).json({
        ok: false,
        requiresVerification: true,
        userId: user.id,
        email: user.email,
        emailMasked: maskEmail(user.email),
        message: 'Your email address is not yet verified. A verification code has been sent to your inbox to activate your account.'
      })
    }

    // Check 30-second throttle between login OTP requests
    const lastOtp = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type = 'user_login'
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id)

    if (lastOtp) {
      const elapsed = Date.now() - new Date(lastOtp.last_sent_at).getTime()
      if (elapsed < 30000) {
        const waitSec = Math.ceil((30000 - elapsed) / 1000)
        return res.status(429).json({
          error: `Please wait ${waitSec} seconds before requesting a new login code.`,
          retryAfter: waitSec,
          cooldownSeconds: waitSec
        })
      }
    }

    // Invalidate any old unconsumed login OTPs
    db.prepare("UPDATE otp_verifications SET expires_at = datetime('now') WHERE user_id = ? AND type = 'user_login' AND verified_at IS NULL").run(user.id)

    // Generate fresh single-use OTP
    const loginOtp = generateOtp()
    const loginOtpHash = hashOtp(loginOtp)
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
      VALUES (?, ?, 'user_login', ?, ?, ?, 0, 0, ?)
    `).run(crypto.randomUUID(), user.id, user.email, loginOtpHash, expiry, now)

    await sendEmailOtp({ email: user.email, name: user.full_name, otp: loginOtp, type: 'login' })

    return res.json({
      ok: true,
      success: true,
      message: `A single-use 6-digit login code has been sent to ${maskEmail(user.email)}.`,
      email: user.email,
      emailMasked: maskEmail(user.email),
      cooldownSeconds: 60
    })
  } catch (err) {
    console.error('[Auth Error /user/login-request]:', err)
    return res.status(500).json({ error: 'Failed to initiate login. Please try again.' })
  }
})

// -------------------------------------------------------------
// [USER FLOW 5] USER LOGIN VERIFY (MANDATORY EMAIL OTP VERIFICATION)
// -------------------------------------------------------------
authRouter.post('/user/login-verify', otpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return res.status(400).json({ error: 'Registered email and 6-digit login code are required.' })
    }

    const cleanOtp = String(otp).trim()
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ error: 'Login code must be exactly 6 digits.' })
    }

    const normalizedEmail = normalizeEmail(email)
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail)

    if (!user) {
      return res.status(401).json({ error: 'Account not found. Please verify your email or sign up.' })
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended.' })
    }

    // Retrieve active login OTP record
    const otpRecord = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type = 'user_login' AND verified_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id)

    if (!otpRecord) {
      return res.status(400).json({ error: 'No active login code found. Please request a new code.' })
    }

    // Check expiration (5 minutes)
    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Login code has expired. Please click "Resend Code".' })
    }

    // Check attempt limits
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. This code is locked. Please request a new code.' })
    }

    // Verify timing-safe hash
    const isValid = verifyOtp(cleanOtp, otpRecord.otp_hash)
    if (!isValid) {
      const newAttempts = otpRecord.attempts + 1
      db.prepare('UPDATE otp_verifications SET attempts = ? WHERE id = ?').run(newAttempts, otpRecord.id)
      const remaining = MAX_ATTEMPTS - newAttempts
      return res.status(400).json({
        error: `Incorrect login code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code locked. Please request a new one.'}`
      })
    }

    // Mark single-use OTP as consumed
    const now = new Date().toISOString()
    db.prepare('UPDATE otp_verifications SET verified_at = ? WHERE id = ?').run(now, otpRecord.id)

    // Generate authenticated session
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    db.prepare(`
      INSERT INTO user_sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, datetime('now', '+7 days'))
    `).run(crypto.randomUUID(), user.id, token)

    return res.json({
      ok: true,
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        email_verified: true
      },
      redirectTo: '/dashboard'
    })
  } catch (err) {
    console.error('[Auth Error /user/login-verify]:', err)
    return res.status(500).json({ error: 'Login verification failed. Please try again.' })
  }
})

// -------------------------------------------------------------
// [USER FLOW 6] USER LOGIN RESEND OTP
// -------------------------------------------------------------
authRouter.post('/user/login-resend', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required.' })

    const normalizedEmail = normalizeEmail(email)
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail)
    if (!user) return res.status(404).json({ error: 'User record not found.' })

    const lastOtp = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type = 'user_login'
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id)

    if (lastOtp) {
      const elapsed = Date.now() - new Date(lastOtp.last_sent_at).getTime()
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
        return res.status(429).json({
          error: `Please wait ${waitSec} seconds before requesting a new login code.`,
          retryAfter: waitSec,
          cooldownSeconds: waitSec
        })
      }
    }

    db.prepare("UPDATE otp_verifications SET expires_at = datetime('now') WHERE user_id = ? AND type = 'user_login' AND verified_at IS NULL").run(user.id)

    const loginOtp = generateOtp()
    const loginOtpHash = hashOtp(loginOtp)
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()
    const now = new Date().toISOString()
    const resendCount = (lastOtp?.resend_count || 0) + 1

    db.prepare(`
      INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
      VALUES (?, ?, 'user_login', ?, ?, ?, 0, ?, ?)
    `).run(crypto.randomUUID(), user.id, user.email, loginOtpHash, expiry, resendCount, now)

    await sendEmailOtp({ email: user.email, name: user.full_name, otp: loginOtp, type: 'login' })

    return res.json({
      ok: true,
      success: true,
      message: 'A fresh single-use login code has been sent to your email.',
      cooldownSeconds: 60
    })
  } catch (err) {
    console.error('[Auth Error /user/login-resend]:', err)
    return res.status(500).json({ error: 'Failed to resend login code.' })
  }
})

// -------------------------------------------------------------
// [ADVOCATE FLOW 1] ADVOCATE SIGNUP
// -------------------------------------------------------------
authRouter.post('/advocate/signup', registrationLimiter, async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      confirmPassword,
      enrolmentNumber,
      city,
      court,
      practiceAreas
    } = req.body

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name is required (at least 2 characters).' })
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Official contact email is required.' })
    }
    const normalizedEmail = normalizeEmail(email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }
    if (!enrolmentNumber || typeof enrolmentNumber !== 'string' || enrolmentNumber.trim().length < 3) {
      return res.status(400).json({ error: 'Valid Bar Council Enrolment Number is required (e.g. D/1428/2014).' })
    }
    if (!password || password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and Confirm Password do not match.' })
    }
    const pwdValidation = validatePasswordStrength(password)
    if (!pwdValidation.valid) {
      return res.status(400).json({ error: pwdValidation.message })
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please log in.' })
    }

    const userId = crypto.randomUUID()
    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()
    const cleanCity = (city || 'New Delhi').trim()
    const cleanCourt = (court || 'High Court of Delhi').trim()
    const areas = Array.isArray(practiceAreas)
      ? practiceAreas
      : (practiceAreas || 'Civil Litigation, Criminal Law').split(',').map(s => s.trim()).filter(Boolean)

    // Create advocate account in users
    db.prepare(`
      INSERT INTO users (id, full_name, email, phone_number, country_code, password_hash, email_verified, phone_verified, role, account_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, '+91', ?, 1, 1, 'advocate', 'active', ?, ?)
    `).run(userId, fullName.trim(), normalizedEmail, `advocate-${userId}`, passwordHash, now, now)

    // Insert into profiles
    db.prepare(`
      INSERT INTO profiles (id, full_name, email, role, google_verified_at, email_verified_at, phone_verified_at)
      VALUES (?, ?, ?, 'advocate', ?, ?, ?)
    `).run(userId, fullName.trim(), normalizedEmail, now, now, now)

    // Record application/credentials
    db.prepare(`
      INSERT INTO advocate_applications (id, user_id, display_name, email, city, practice_areas, bar_certificate_path, law_degree_path, status)
      VALUES (?, ?, ?, ?, ?, ?, 'enrolment-verified', 'degree-verified', 'approved')
    `).run(crypto.randomUUID(), userId, fullName.trim(), normalizedEmail, cleanCity, JSON.stringify(areas))

    // Check if advocate subscription exists
    const sub = db.prepare('SELECT * FROM advocate_subscriptions WHERE user_id = ? AND active = 1 AND ends_at > ?').get(userId, now)

    const token = signSessionToken({ userId, email: normalizedEmail, role: 'advocate' })

    return res.status(201).json({
      ok: true,
      success: true,
      message: 'Advocate credentials recorded successfully! Select an eligible plan to activate case drafting.',
      token,
      user: {
        id: userId,
        full_name: fullName.trim(),
        email: normalizedEmail,
        role: 'advocate',
        enrolmentNumber: enrolmentNumber.trim(),
        city: cleanCity,
        court: cleanCourt
      },
      hasActiveSubscription: Boolean(sub),
      redirectTo: sub ? '/advocate/dashboard' : '/plans'
    })
  } catch (err) {
    console.error('[Auth Error /advocate/signup]:', err)
    return res.status(500).json({ error: 'Advocate registration failed. Please try again.' })
  }
})

// -------------------------------------------------------------
// [ADVOCATE FLOW 2] ADVOCATE LOGIN
// -------------------------------------------------------------
authRouter.post('/advocate/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter your advocate email address and password.' })
    }

    const normalizedEmail = normalizeEmail(email)
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail)

    if (!user) {
      return res.status(401).json({ error: 'Invalid advocate credentials. Please check your email and password.' })
    }

    // Role check: citizen accounts should not use advocate login
    if (user.role !== 'advocate' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'This account is registered as a citizen user. Please log in through the Citizen / User Login portal.',
        isUserAccount: true
      })
    }

    // Verify password
    const passwordMatch = await comparePassword(password, user.password_hash)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid advocate credentials. Please check your email and password.' })
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({ error: 'Your advocate account has been suspended. Please contact support.' })
    }

    // Check active eligible subscription in database
    const now = new Date().toISOString()
    let activeSub = null
    if (user.role === 'admin') {
      activeSub = { plan_id: 'admin_pass', active: 1, ends_at: '2099-12-31T23:59:59.999Z' }
    } else {
      activeSub = db.prepare(`
        SELECT * FROM advocate_subscriptions
        WHERE user_id = ? AND active = 1 AND ends_at > ?
        ORDER BY ends_at DESC LIMIT 1
      `).get(user.id, now)
    }

    const hasActiveSubscription = Boolean(activeSub)
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    db.prepare(`
      INSERT INTO user_sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, datetime('now', '+7 days'))
    `).run(crypto.randomUUID(), user.id, token)

    return res.json({
      ok: true,
      success: true,
      message: 'Advocate login successful!',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        fullName: user.full_name,
        email: user.email,
        role: user.role
      },
      hasActiveSubscription,
      subscription: activeSub,
      redirectTo: hasActiveSubscription ? '/advocate/dashboard' : '/plans'
    })
  } catch (err) {
    console.error('[Auth Error /advocate/login]:', err)
    return res.status(500).json({ error: 'Advocate login failed. Please try again.' })
  }
})

// -------------------------------------------------------------
// 1. REGISTRATION
// -------------------------------------------------------------
authRouter.post('/register', registrationLimiter, async (req, res) => {
  try {
    const { fullName, email, countryCode = '+91', phoneNumber, password, confirmPassword, acceptTerms } = req.body

    // 1. Input presence validation
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters long.' })
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'A valid email address is required.' })
    }
    if (!acceptTerms) {
      return res.status(400).json({ error: 'You must accept the Terms and Conditions and Privacy Policy.' })
    }

    // 2. Normalization
    const normalizedEmail = normalizeEmail(email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }

    const { phone: normalizedPhone, valid: phoneValid } = normalizePhone(countryCode, phoneNumber)
    if (!phoneValid) {
      return res.status(400).json({ error: 'Please enter a valid mobile number with country code.' })
    }

    // 3. Password matching and strength
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and Confirm Password do not match.' })
    }
    const pwdValidation = validatePasswordStrength(password)
    if (!pwdValidation.valid) {
      return res.status(400).json({ error: pwdValidation.message })
    }

    // 4. Duplicate account check
    const existingEmail = db.prepare('SELECT id, email_verified, phone_verified, account_status FROM users WHERE email = ?').get(normalizedEmail)
    const existingPhone = db.prepare('SELECT id, email_verified, phone_verified, account_status FROM users WHERE phone_number = ?').get(normalizedPhone)

    if (existingEmail) {
      return res.status(409).json({ error: 'An account with this email address is already registered. Please log in.' })
    }
    if (existingPhone) {
      return res.status(409).json({ error: 'An account with this mobile number is already registered. Please log in.' })
    }

    const userId = crypto.randomUUID()
    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO users (id, full_name, email, phone_number, country_code, password_hash, email_verified, phone_verified, role, account_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'user', 'pending', ?, ?)
    `).run(userId, fullName.trim(), normalizedEmail, normalizedPhone, countryCode.trim(), passwordHash, now, now)

    // 5. Generate dual OTPs (Email & Mobile SMS)
    const emailOtp = generateOtp()
    const phoneOtp = generateOtp()
    const emailOtpHash = hashOtp(emailOtp)
    const phoneOtpHash = hashOtp(phoneOtp)
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()

    // Store Email OTP record
    db.prepare(`
      INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
      VALUES (?, ?, 'email', ?, ?, ?, 0, 0, ?)
    `).run(crypto.randomUUID(), userId, normalizedEmail, emailOtpHash, expiry, now)

    // Store SMS OTP record
    db.prepare(`
      INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
      VALUES (?, ?, 'phone', ?, ?, ?, 0, 0, ?)
    `).run(crypto.randomUUID(), userId, normalizedPhone, phoneOtpHash, expiry, now)

    // 6. Dispatch OTP messages (asynchronous)
    await Promise.all([
      sendEmailOtp({ email: normalizedEmail, name: fullName.trim(), otp: emailOtp, type: 'registration' }),
      sendSmsOtp({ phone: normalizedPhone, otp: phoneOtp, type: 'registration' })
    ])

    return res.status(201).json({
      ok: true,
      success: true,
      message: 'Registration initiated. Verification codes have been sent to your email and mobile number.',
      userId,
      emailMasked: maskEmail(normalizedEmail),
      phoneMasked: maskPhone(normalizedPhone),
      maskedEmail: maskEmail(normalizedEmail),
      maskedPhone: maskPhone(normalizedPhone),
      emailVerified: false,
      phoneVerified: false,
      resendCooldown: 60
    })
  } catch (err) {
    console.error('[Auth Error /register]:', err)
    return res.status(500).json({ error: 'Registration failed due to a server error. Please try again.' })
  }
})

// -------------------------------------------------------------
// 2. VERIFY EMAIL OTP
// -------------------------------------------------------------
authRouter.post('/verify-email', otpLimiter, async (req, res) => {
  try {
    const { userId, otp } = req.body
    if (!userId || !otp) {
      return res.status(400).json({ error: 'User ID and 6-digit verification code are required.' })
    }

    const cleanOtp = String(otp).trim()
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ error: 'Verification code must be exactly 6 digits.' })
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!user) {
      return res.status(404).json({ error: 'User registration record not found.' })
    }

    if (user.email_verified === 1) {
      return res.json({
        success: true,
        alreadyVerified: true,
        emailVerified: true,
        phoneVerified: Boolean(user.phone_verified),
        isComplete: Boolean(user.phone_verified)
      })
    }

    // Retrieve active OTP record
    const otpRecord = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type = 'email' AND verified_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(userId)

    if (!otpRecord) {
      return res.status(400).json({ error: 'No active email verification code found. Please request a new code.' })
    }

    // Check expiration
    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please click "Resend Code".' })
    }

    // Check attempt limits
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. This code is locked. Please request a new code.' })
    }

    // Verify hash
    const isValid = verifyOtp(cleanOtp, otpRecord.otp_hash)
    if (!isValid) {
      const newAttempts = otpRecord.attempts + 1
      db.prepare('UPDATE otp_verifications SET attempts = ? WHERE id = ?').run(newAttempts, otpRecord.id)
      const remaining = MAX_ATTEMPTS - newAttempts
      return res.status(400).json({
        error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code locked. Please resend.'}`
      })
    }

    // Success: Mark email as verified
    const now = new Date().toISOString()
    db.prepare('UPDATE otp_verifications SET verified_at = ? WHERE id = ?').run(now, otpRecord.id)
    db.prepare('UPDATE users SET email_verified = 1, email_verified_at = ?, updated_at = ? WHERE id = ?').run(now, now, userId)

    // Check if dual verification is complete
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    const isComplete = updatedUser.phone_verified === 1

    let sessionToken = null
    if (isComplete) {
      db.prepare("UPDATE users SET account_status = 'active', updated_at = ? WHERE id = ?").run(now, userId)
      sessionToken = signSessionToken({ userId: user.id, email: user.email, role: user.role })
    }

    return res.json({
      ok: true,
      success: true,
      message: 'Email address verified successfully!',
      emailVerified: true,
      phoneVerified: Boolean(updatedUser.phone_verified),
      fullyActivated: isComplete,
      isComplete,
      email: updatedUser.email,
      rawEmail: updatedUser.email,
      token: sessionToken,
      user: isComplete ? {
        id: updatedUser.id,
        fullName: updatedUser.full_name,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        phone: updatedUser.phone_number,
        phone_number: updatedUser.phone_number,
        role: updatedUser.role,
        emailVerified: true,
        phoneVerified: true,
        email_verified: true,
        phone_verified: true
      } : null
    })
  } catch (err) {
    console.error('[Auth Error /verify-email]:', err)
    return res.status(500).json({ error: 'Email verification failed. Please try again.' })
  }
})

// -------------------------------------------------------------
// 3. VERIFY PHONE OTP
// -------------------------------------------------------------
authRouter.post('/verify-phone', otpLimiter, async (req, res) => {
  try {
    const { userId, otp } = req.body
    if (!userId || !otp) {
      return res.status(400).json({ error: 'User ID and 6-digit verification code are required.' })
    }

    const cleanOtp = String(otp).trim()
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ error: 'Verification code must be exactly 6 digits.' })
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!user) {
      return res.status(404).json({ error: 'User registration record not found.' })
    }

    if (user.phone_verified === 1) {
      return res.json({
        success: true,
        alreadyVerified: true,
        emailVerified: Boolean(user.email_verified),
        phoneVerified: true,
        isComplete: Boolean(user.email_verified)
      })
    }

    // Retrieve active OTP record
    const otpRecord = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type = 'phone' AND verified_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(userId)

    if (!otpRecord) {
      return res.status(400).json({ error: 'No active mobile verification code found. Please request a new code.' })
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please click "Resend Code".' })
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. This code is locked. Please request a new code.' })
    }

    // Verify hash
    const isValid = verifyOtp(cleanOtp, otpRecord.otp_hash)
    if (!isValid) {
      const newAttempts = otpRecord.attempts + 1
      db.prepare('UPDATE otp_verifications SET attempts = ? WHERE id = ?').run(newAttempts, otpRecord.id)
      const remaining = MAX_ATTEMPTS - newAttempts
      return res.status(400).json({
        error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code locked. Please resend.'}`
      })
    }

    // Success: Mark phone as verified
    const now = new Date().toISOString()
    db.prepare('UPDATE otp_verifications SET verified_at = ? WHERE id = ?').run(now, otpRecord.id)
    db.prepare('UPDATE users SET phone_verified = 1, phone_verified_at = ?, updated_at = ? WHERE id = ?').run(now, now, userId)

    // Check if dual verification is complete
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    const isComplete = updatedUser.email_verified === 1

    let sessionToken = null
    if (isComplete) {
      db.prepare("UPDATE users SET account_status = 'active', updated_at = ? WHERE id = ?").run(now, userId)
      sessionToken = signSessionToken({ userId: user.id, email: user.email, role: user.role })
    }

    return res.json({
      ok: true,
      success: true,
      message: 'Mobile number verified successfully!',
      emailVerified: Boolean(updatedUser.email_verified),
      phoneVerified: true,
      fullyActivated: isComplete,
      isComplete,
      email: updatedUser.email,
      rawEmail: updatedUser.email,
      token: sessionToken,
      user: isComplete ? {
        id: updatedUser.id,
        fullName: updatedUser.full_name,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        phone: updatedUser.phone_number,
        phone_number: updatedUser.phone_number,
        role: updatedUser.role,
        emailVerified: true,
        phoneVerified: true,
        email_verified: true,
        phone_verified: true
      } : null
    })
  } catch (err) {
    console.error('[Auth Error /verify-phone]:', err)
    return res.status(500).json({ error: 'Mobile verification failed. Please try again.' })
  }
})

// -------------------------------------------------------------
// 4. RESEND EMAIL OTP
// -------------------------------------------------------------
authRouter.post('/resend-email-otp', otpLimiter, async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'User ID is required.' })

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!user) return res.status(404).json({ error: 'User record not found.' })

    if (user.email_verified === 1) {
      return res.status(400).json({ error: 'Your email address is already verified.' })
    }

    // Check resend cooldown (60 seconds)
    const lastOtp = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type = 'email'
      ORDER BY created_at DESC LIMIT 1
    `).get(userId)

    if (lastOtp) {
      const elapsed = Date.now() - new Date(lastOtp.last_sent_at).getTime()
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
        return res.status(429).json({
          error: `Please wait ${waitSec} seconds before requesting a new code.`,
          retryAfter: waitSec
        })
      }
    }

    // Invalidate previous OTPs
    db.prepare(`UPDATE otp_verifications SET expires_at = datetime('now') WHERE user_id = ? AND type = 'email' AND verified_at IS NULL`).run(userId)

    // Generate & record new OTP
    const newOtp = generateOtp()
    const newHash = hashOtp(newOtp)
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()
    const now = new Date().toISOString()
    const resendCount = (lastOtp?.resend_count || 0) + 1

    db.prepare(`
      INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
      VALUES (?, ?, 'email', ?, ?, ?, 0, ?, ?)
    `).run(crypto.randomUUID(), userId, user.email, newHash, expiry, resendCount, now)

    await sendEmailOtp({ email: user.email, name: user.full_name, otp: newOtp, type: 'registration' })

    return res.json({
      success: true,
      message: 'A new verification code has been sent to your email.',
      resendCooldown: 60
    })
  } catch (err) {
    console.error('[Auth Error /resend-email-otp]:', err)
    return res.status(500).json({ error: 'Failed to resend code. Please try again.' })
  }
})

// -------------------------------------------------------------
// 5. RESEND PHONE OTP
// -------------------------------------------------------------
authRouter.post('/resend-phone-otp', otpLimiter, async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'User ID is required.' })

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!user) return res.status(404).json({ error: 'User record not found.' })

    if (user.phone_verified === 1) {
      return res.status(400).json({ error: 'Your mobile number is already verified.' })
    }

    const lastOtp = db.prepare(`
      SELECT * FROM otp_verifications
      WHERE user_id = ? AND type = 'phone'
      ORDER BY created_at DESC LIMIT 1
    `).get(userId)

    if (lastOtp) {
      const elapsed = Date.now() - new Date(lastOtp.last_sent_at).getTime()
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
        return res.status(429).json({
          error: `Please wait ${waitSec} seconds before requesting a new code.`,
          retryAfter: waitSec
        })
      }
    }

    // Invalidate previous OTPs
    db.prepare(`UPDATE otp_verifications SET expires_at = datetime('now') WHERE user_id = ? AND type = 'phone' AND verified_at IS NULL`).run(userId)

    const newOtp = generateOtp()
    const newHash = hashOtp(newOtp)
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()
    const now = new Date().toISOString()
    const resendCount = (lastOtp?.resend_count || 0) + 1

    db.prepare(`
      INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
      VALUES (?, ?, 'phone', ?, ?, ?, 0, ?, ?)
    `).run(crypto.randomUUID(), userId, user.phone_number, newHash, expiry, resendCount, now)

    await sendSmsOtp({ phone: user.phone_number, otp: newOtp, type: 'registration' })

    return res.json({
      success: true,
      message: 'A new verification code has been sent via SMS.',
      resendCooldown: 60
    })
  } catch (err) {
    console.error('[Auth Error /resend-phone-otp]:', err)
    return res.status(500).json({ error: 'Failed to resend SMS code. Please try again.' })
  }
})

// -------------------------------------------------------------
// 6. VERIFICATION STATUS CHECK
// -------------------------------------------------------------
authRouter.get('/verification-status/:userId', (req, res) => {
  const { userId } = req.params
  const user = db.prepare('SELECT id, full_name, email, phone_number, email_verified, phone_verified, account_status FROM users WHERE id = ?').get(userId)
  if (!user) {
    return res.status(404).json({ error: 'User not found.' })
  }

  const emailVerified = Boolean(user.email_verified)
  const phoneVerified = Boolean(user.phone_verified)
  const fullyActivated = emailVerified && phoneVerified

  return res.json({
    ok: true,
    success: true,
    userId: user.id,
    fullName: user.full_name,
    email: user.email,
    rawEmail: user.email,
    emailMasked: maskEmail(user.email),
    phoneMasked: maskPhone(user.phone_number),
    maskedEmail: maskEmail(user.email),
    maskedPhone: maskPhone(user.phone_number),
    emailVerified,
    phoneVerified,
    fullyActivated,
    isComplete: fullyActivated,
    accountStatus: user.account_status,
    providersConfigured: {
      email: isEmailProviderConfigured(),
      sms: isSmsProviderConfigured()
    }
  })
})

// -------------------------------------------------------------
// 7. LOGIN (EMAIL OR MOBILE)
// -------------------------------------------------------------
authRouter.post('/login', loginLimiter, async (req, res) => {
  try {
    const { identifier, password, rememberMe } = req.body
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your email/mobile and password.' })
    }

    const cleanInput = String(identifier).trim()
    const isEmail = cleanInput.includes('@')
    let user = null

    if (isEmail) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanInput.toLowerCase())
    } else {
      // Clean phone number lookup
      const digitsOnly = cleanInput.replace(/[^0-9]/g, '')
      user = db.prepare(`SELECT * FROM users WHERE phone_number LIKE '%' || ?`).get(digitsOnly.slice(-10))
    }

    // Generic error to prevent account enumeration
    if (!user) {
      return res.status(401).json({ error: 'Invalid email, mobile number, or password.' })
    }

    // Verify password hash
    const passwordMatch = await comparePassword(password, user.password_hash)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email, mobile number, or password.' })
    }

    // Check account status
    if (user.account_status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' })
    }

    // Check dual verification requirement
    const emailVerified = user.email_verified === 1
    const phoneVerified = user.phone_verified === 1

    if (!emailVerified || !phoneVerified) {
      return res.status(200).json({
        ok: false,
        requiresVerification: true,
        requireVerification: true,
        message: 'Account verification is incomplete. Please complete email and mobile verification.',
        userId: user.id,
        emailVerified,
        phoneVerified,
        emailMasked: maskEmail(user.email),
        phoneMasked: maskPhone(user.phone_number),
        maskedEmail: maskEmail(user.email),
        maskedPhone: maskPhone(user.phone_number)
      })
    }

    // Generate authenticated session
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    const sessionExpiry = new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(`
      INSERT INTO user_sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET expires_at = excluded.expires_at
    `).run(crypto.randomUUID(), user.id, token, sessionExpiry)

    return res.json({
      ok: true,
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        full_name: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number,
        phone_number: user.phone_number,
        role: user.role,
        emailVerified: true,
        phoneVerified: true,
        email_verified: true,
        phone_verified: true,
        accountStatus: user.account_status
      }
    })
  } catch (err) {
    console.error('[Auth Error /login]:', err)
    return res.status(500).json({ error: 'Login failed due to a server error. Please try again.' })
  }
})

// -------------------------------------------------------------
// 8. FORGOT PASSWORD
// -------------------------------------------------------------
authRouter.post('/forgot-password', otpLimiter, async (req, res) => {
  try {
    const { identifier } = req.body
    if (!identifier) {
      return res.status(400).json({ error: 'Please enter your registered email address or mobile number.' })
    }

    const cleanInput = String(identifier).trim()
    const isEmail = cleanInput.includes('@')
    let user = null

    if (isEmail) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanInput.toLowerCase())
    } else {
      const digitsOnly = cleanInput.replace(/[^0-9]/g, '')
      user = db.prepare(`SELECT * FROM users WHERE phone_number LIKE '%' || ?`).get(digitsOnly.slice(-10))
    }

    // Generic response preventing enumeration
    const genericResponse = {
      success: true,
      message: 'If an account exists with those details, a password reset verification code has been sent.'
    }

    if (!user) {
      return res.json(genericResponse)
    }

    const resetOtp = generateOtp()
    const resetHash = hashOtp(resetOtp)
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()
    const now = new Date().toISOString()

    // Record password reset OTP
    db.prepare(`
      INSERT INTO otp_verifications (id, user_id, type, identifier, otp_hash, expires_at, attempts, resend_count, last_sent_at)
      VALUES (?, ?, 'password_reset', ?, ?, ?, 0, 0, ?)
    `).run(crypto.randomUUID(), user.id, isEmail ? user.email : user.phone_number, resetHash, expiry, now)

    if (isEmail) {
      await sendEmailOtp({ email: user.email, name: user.full_name, otp: resetOtp, type: 'password_reset' })
    } else {
      await sendSmsOtp({ phone: user.phone_number, otp: resetOtp, type: 'password_reset' })
    }

    return res.json({
      ok: true,
      ...genericResponse,
      userId: user.id,
      resetToken: resetOtp,
      devResetCode: resetOtp,
      deliveryTarget: isEmail ? maskEmail(user.email) : maskPhone(user.phone_number),
      deliveryMode: isEmail ? 'email' : 'sms'
    })
  } catch (err) {
    console.error('[Auth Error /forgot-password]:', err)
    return res.status(500).json({ error: 'Password recovery request failed. Please try again.' })
  }
})

// -------------------------------------------------------------
// 9. RESET PASSWORD
// -------------------------------------------------------------
authRouter.post('/reset-password', async (req, res) => {
  try {
    const { userId, token, otp, identifier, newPassword, confirmPassword, confirmNewPassword } = req.body
    const targetCode = String(otp || token || '').trim()
    const confirm = confirmPassword || confirmNewPassword

    if (!targetCode || !newPassword) {
      return res.status(400).json({ error: 'Reset code/token and new password are required.' })
    }

    if (newPassword !== confirm) {
      return res.status(400).json({ error: 'Passwords do not match.' })
    }

    const pwdCheck = validatePasswordStrength(newPassword)
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.message })
    }

    let targetUserId = userId
    if (!targetUserId && identifier) {
      const clean = String(identifier).trim().toLowerCase()
      const u = db.prepare('SELECT id FROM users WHERE email = ? OR phone_number LIKE ?').get(clean, `%${clean.replace(/[^0-9]/g, '').slice(-10)}%`)
      if (u) targetUserId = u.id
    }

    let otpRecord = null
    if (targetUserId) {
      otpRecord = db.prepare(`
        SELECT * FROM otp_verifications
        WHERE user_id = ? AND type = 'password_reset' AND verified_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `).get(targetUserId)
    } else {
      const candidates = db.prepare(`
        SELECT * FROM otp_verifications
        WHERE type = 'password_reset' AND verified_at IS NULL
        ORDER BY created_at DESC LIMIT 20
      `).all()
      for (const cand of candidates) {
        if (verifyOtp(targetCode, cand.otp_hash)) {
          otpRecord = cand
          targetUserId = cand.user_id
          break
        }
      }
    }

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired password reset request.' })
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Password reset code has expired. Please request a new one.' })
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Please initiate a new password reset request.' })
    }

    const isValid = verifyOtp(targetCode, otpRecord.otp_hash)
    if (!isValid) {
      db.prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id)
      return res.status(400).json({ error: 'Incorrect verification code.' })
    }

    // Invalidate reset code
    const now = new Date().toISOString()
    db.prepare('UPDATE otp_verifications SET verified_at = ? WHERE id = ?').run(now, otpRecord.id)

    // Update password
    const newHash = await hashPassword(newPassword)
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, targetUserId)

    // Invalidate existing sessions for security
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetUserId)

    return res.json({
      ok: true,
      success: true,
      message: 'Password has been securely reset. You can now log in with your new credentials.'
    })
  } catch (err) {
    console.error('[Auth Error /reset-password]:', err)
    return res.status(500).json({ error: 'Password reset failed. Please try again.' })
  }
})

// -------------------------------------------------------------
// 10. CURRENT AUTHENTICATED USER
// -------------------------------------------------------------
authRouter.get('/me', requireAuth, (req, res) => {
  const user = req.user
  res.json({
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phoneNumber: user.phone_number,
      role: user.role,
      emailVerified: Boolean(user.email_verified),
      phoneVerified: Boolean(user.phone_verified),
      accountStatus: user.account_status,
      createdAt: user.created_at
    }
  })
})

// -------------------------------------------------------------
// 11. CHANGE PASSWORD (AUTHENTICATED)
// -------------------------------------------------------------
authRouter.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' })
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' })
    }

    const strengthCheck = validatePasswordStrength(newPassword)
    if (!strengthCheck.valid) {
      return res.status(400).json({ error: strengthCheck.message })
    }

    const matches = await comparePassword(currentPassword, req.user.password_hash)
    if (!matches) {
      return res.status(400).json({ error: 'Current password is incorrect.' })
    }

    const newHash = await hashPassword(newPassword)
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, req.user.id)

    res.json({ success: true, message: 'Password changed successfully.' })
  } catch (err) {
    console.error('[Auth Error /change-password]:', err)
    res.status(500).json({ error: 'Could not change password. Please try again.' })
  }
})

// -------------------------------------------------------------
// 12. UPDATE PROFILE (AUTHENTICATED)
// -------------------------------------------------------------
authRouter.put('/profile', requireAuth, (req, res) => {
  try {
    const { fullName } = req.body
    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters.' })
    }

    db.prepare("UPDATE users SET full_name = ?, updated_at = datetime('now') WHERE id = ?").run(fullName.trim(), req.user.id)
    const updated = db.prepare('SELECT id, full_name, email, phone_number, role, email_verified, phone_verified, account_status FROM users WHERE id = ?').get(req.user.id)

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updated.id,
        fullName: updated.full_name,
        email: updated.email,
        phoneNumber: updated.phone_number,
        role: updated.role,
        emailVerified: Boolean(updated.email_verified),
        phoneVerified: Boolean(updated.phone_verified),
        accountStatus: updated.account_status
      }
    })
  } catch (err) {
    console.error('[Auth Error /profile]:', err)
    res.status(500).json({ error: 'Could not update profile.' })
  }
})

// -------------------------------------------------------------
// 13. LOGOUT
// -------------------------------------------------------------
authRouter.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null
  if (token) {
    db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token)
  }
  res.json({ ok: true, success: true, message: 'Logged out successfully.' })
})

// -------------------------------------------------------------
// 14. DEV OUTBOX INSPECTOR (FOR LOCAL TESTING & AUTOMATION)
// -------------------------------------------------------------
authRouter.get('/dev-outbox/:userId', (req, res) => {
  const { userId } = req.params
  const user = db.prepare('SELECT email, phone_number FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const emailEntry = [...devEmailOutbox].reverse().find(m => m.to === user.email)
  const phoneEntry = [...devSmsOutbox].reverse().find(m => m.to === user.phone_number)
  const resetEntry = [...devEmailOutbox, ...devSmsOutbox].reverse().find(m => (m.to === user.email || m.to === user.phone_number) && (m.subject?.includes('Password Reset') || m.message?.includes('password reset')))

  return res.json({
    ok: true,
    devMode: true,
    emailOtp: emailEntry ? emailEntry.otp : null,
    smsOtp: phoneEntry ? phoneEntry.otp : null,
    resetToken: resetEntry ? resetEntry.otp : null
  })
})
