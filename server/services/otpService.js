import crypto from 'node:crypto'

const OTP_SECRET = process.env.OTP_SECRET || 'nayaya-mitra-secure-otp-secret-key-2026'
const OTP_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds
const MAX_ATTEMPTS = 5

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 */
export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString()
}

/**
 * Hash an OTP using HMAC-SHA256 for secure database storage.
 */
export function hashOtp(otp) {
  return crypto.createHmac('sha256', OTP_SECRET).update(String(otp).trim()).digest('hex')
}

/**
 * Verify an OTP against its stored hash using timing-safe comparison.
 */
export function verifyOtp(submittedOtp, storedHash) {
  if (!submittedOtp || !storedHash) return false
  const computedHash = hashOtp(submittedOtp)
  try {
    const a = Buffer.from(computedHash, 'hex')
    const b = Buffer.from(storedHash, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Generate a cryptographically secure random token (e.g. for password resets or sessions).
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Hash a secure token (e.g. password reset token).
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex')
}

export { OTP_EXPIRY_MS, RESEND_COOLDOWN_MS, MAX_ATTEMPTS }
