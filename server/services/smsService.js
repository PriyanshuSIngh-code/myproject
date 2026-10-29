const APP_NAME = process.env.VITE_APP_NAME || 'NayayaMitra'

// In-memory outbox for testing / development verification
export const devSmsOutbox = []

export function isSmsProviderConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
}

/**
 * Send an SMS OTP verification message.
 */
export async function sendSmsOtp({ phone, otp, type = 'registration' }) {
  const isReset = type === 'password_reset'
  const message = `${APP_NAME}: Your ${isReset ? 'password reset' : 'verification'} code is [${otp}]. It expires in five minutes. Do not share this code with anyone.`

  // 1. Try Twilio if credentials configured
  if (isSmsProviderConfigured()) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      const body = new URLSearchParams({
        To: phone,
        From: process.env.TWILIO_PHONE_NUMBER,
        Body: message
      })

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        }
      )

      if (twilioRes.ok) {
        return { success: true, delivered: true, provider: 'twilio', providerConfigured: true }
      }
      const errText = await twilioRes.text()
      console.error('[SmsService] Twilio delivery error:', errText)
      return { success: false, delivered: false, provider: 'twilio', providerConfigured: true, error: errText }
    } catch (err) {
      console.error('[SmsService] Twilio request failed:', err.message)
      return { success: false, delivered: false, provider: 'twilio', providerConfigured: true, error: err.message }
    }
  }

  // Provider is not configured
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd) {
    return {
      success: false,
      delivered: false,
      providerConfigured: false,
      error: 'Twilio SMS provider not configured. Real SMS cannot be dispatched.'
    }
  }

  // Development / Test mode record for test inspection
  const record = {
    to: phone,
    message,
    otp,
    sentAt: new Date().toISOString(),
    mode: 'development_mock'
  }
  devSmsOutbox.push(record)
  if (devSmsOutbox.length > 50) devSmsOutbox.shift()

  console.log(`[SmsService (Dev Notice)] Twilio unconfigured in .env.local. Code for ${maskPhone(phone)}: [${otp}]`)
  return {
    success: true,
    delivered: false,
    mode: 'development_mock',
    providerConfigured: false,
    warning: 'SMS provider not configured (Twilio credentials missing in .env.local). Real SMS was NOT sent.'
  }
}

/**
 * Mask a phone number: e.g. "+919876543210" -> "+91 ******3210"
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return ''
  const clean = phone.trim()
  if (clean.length < 8) return clean
  let prefix = clean.slice(0, 3)
  if (clean.startsWith('+1') && clean.length === 12) {
    prefix = '+1'
  }
  const last4 = clean.slice(-4)
  return `${prefix} ******${last4}`
}
