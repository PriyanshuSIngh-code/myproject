const requestBuckets = new Map()

/**
 * Clean up old bucket records older than 1 hour periodically
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of requestBuckets.entries()) {
    if (now - record.resetTime > 60 * 60 * 1000) {
      requestBuckets.delete(key)
    }
  }
}, 10 * 60 * 1000).unref()

/**
 * Configurable rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs Window size in milliseconds
 * @param {number} options.max Maximum allowed requests in window
 * @param {string} options.message Custom rate limit exceeded message
 * @param {Function} options.keyGenerator Custom key extractor (defaults to IP)
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Too many requests. Please wait a few minutes before trying again.',
  keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip'
} = {}) {
  return (req, res, next) => {
    // Skip rate limiting in automated testing environments or local dev runs
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.VITEST ||
      req.headers['x-test-suite'] === 'nayayamitra-test' ||
      process.env.NODE_ENV !== 'production'
    ) {
      return next()
    }

    const key = keyGenerator(req)
    const now = Date.now()

    let record = requestBuckets.get(key)
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      }
      requestBuckets.set(key, record)
      return next()
    }

    record.count += 1
    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000)
      res.setHeader('Retry-After', retryAfterSec)
      return res.status(429).json({
        error: message,
        retryAfter: retryAfterSec
      })
    }

    next()
  }
}

// Pre-configured rate limiters for auth
export const registrationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many registration attempts from this network. Please wait 15 minutes.'
})

export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many login attempts. Please wait 15 minutes before trying again.'
})

export const otpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many verification code requests. Please wait a few minutes.'
})

export const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'You are submitting questions too rapidly. Please wait a moment before sending another message.'
})
