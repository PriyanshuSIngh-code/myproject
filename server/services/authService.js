import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'nayayamitra-production-jwt-secure-session-key-2026'
const JWT_EXPIRES_IN = '7d'

/**
 * Validate password strength against security requirements.
 */
export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' }
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z).' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter (a-z).' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number (0-9).' }
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*...).' }
  }
  return { valid: true }
}

/**
 * Hash a password using bcrypt with 12 salt rounds.
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

/**
 * Compare plaintext password with stored bcrypt hash.
 */
export async function comparePassword(password, hash) {
  if (!password || !hash) return false
  return bcrypt.compare(password, hash)
}

/**
 * Normalize an email address (lowercase, trim).
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

/**
 * Normalize and validate a phone number with country code into E.164 format.
 * e.g. ("+91", "98765 43210") -> "+919876543210"
 */
export function normalizePhone(countryCode, phoneNumber) {
  const code = (countryCode || '+91').trim().replace(/[^0-9+]/g, '')
  const raw = String(phoneNumber || '').trim().replace(/[^0-9]/g, '')

  const full = `${code.startsWith('+') ? code : '+' + code}${raw}`
  // Validate format E.164: + followed by 7 to 15 digits
  const valid = /^\+[1-9]\d{7,14}$/.test(full)
  return { phone: full, valid }
}

/**
 * Generate a signed JWT session token.
 */
export function signSessionToken(payload) {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * Verify a JWT session token.
 */
export function verifySessionToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}
