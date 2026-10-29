import nodemailer from 'nodemailer'

const APP_NAME = process.env.VITE_APP_NAME || 'NayayaMitra'
const FROM_EMAIL = process.env.SMTP_FROM || `no-reply@nayayamitra.in`

// In-memory outbox for testing / development verification
export const devEmailOutbox = []

let transporter = null

export function isEmailProviderConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function getTransporter() {
  if (transporter) return transporter

  if (isEmailProviderConfigured()) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }
  return transporter
}

/**
 * Send an Email OTP verification message.
 */
export async function sendEmailOtp({ email, name, otp, type = 'registration' }) {
  const isReset = type === 'password_reset'
  const isLogin = type === 'login'
  const subject = isReset
    ? `${APP_NAME}: Password Reset Verification Code`
    : isLogin
    ? `${APP_NAME}: Your Login One-Time Passcode (OTP)`
    : `Verify Your Email Address — ${APP_NAME}`

  const greetingContext = isReset
    ? 'We received a request to reset your password. Use the verification code below to complete your password reset:'
    : isLogin
    ? `We received a request to sign in to your ${APP_NAME} account. Enter the single-use verification code below to complete your login:`
    : `Thank you for registering with ${APP_NAME}. Your email verification code is:`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f1115; color: #f0f0f0; margin: 0; padding: 24px; }
        .card { max-width: 520px; margin: 0 auto; background: #181b22; border: 1px solid #2d3342; border-radius: 12px; padding: 32px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        .brand { font-size: 20px; font-weight: 700; color: #c7a45b; margin-bottom: 24px; display: inline-block; }
        .greeting { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
        .text { color: #a0aec0; line-height: 1.6; margin-bottom: 24px; }
        .otp-box { background: #0e1014; border: 1px solid #c7a45b; border-radius: 8px; padding: 18px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #f6e05e; margin: 24px 0; }
        .warning { font-size: 13px; color: #e53e3e; margin-top: 16px; }
        .footer { font-size: 12px; color: #718096; margin-top: 32px; border-top: 1px solid #2d3342; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">⚖️ ${APP_NAME}</div>
        <div class="greeting">Hello ${name || 'Citizen'},</div>
        <div class="text">${greetingContext}</div>
        <div class="otp-box">${otp}</div>
        <div class="text">
          <strong>This code expires in 5 minutes and is valid for a single use.</strong> Do not share this code with anyone.
        </div>
        <div class="warning">
          If you did not initiate this request, please ignore this email or secure your account if you suspect unauthorized activity.
        </div>
        <div class="footer">
          Regards,<br>
          The ${APP_NAME} Security Team<br>
          <em>Official Indian Legal Information & Authentication Gateway</em>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
Hello ${name || 'Citizen'},

${greetingContext}

[${otp}]

This code expires in 5 minutes and is valid for single use. Do not share it with anyone.

If you did not initiate this request, please ignore this email.

Regards,
The ${APP_NAME} Security Team
  `.trim()

  const activeTransporter = getTransporter()

  if (activeTransporter) {
    try {
      await activeTransporter.sendMail({
        from: `"${APP_NAME}" <${FROM_EMAIL}>`,
        to: email,
        subject,
        text,
        html
      })
      return { success: true, delivered: true, provider: 'smtp', providerConfigured: true }
    } catch (err) {
      console.error('[EmailService] SMTP delivery failed:', err.message)
      return { success: false, delivered: false, provider: 'smtp', providerConfigured: true, error: err.message }
    }
  }

  // Provider is not configured
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd) {
    return {
      success: false,
      delivered: false,
      providerConfigured: false,
      error: 'SMTP provider not configured. Real email cannot be dispatched.'
    }
  }

  // Development / Test mode record for test inspection
  const record = {
    to: email,
    subject,
    otp,
    sentAt: new Date().toISOString(),
    mode: 'development_mock'
  }
  devEmailOutbox.push(record)
  if (devEmailOutbox.length > 50) devEmailOutbox.shift()

  console.log(`[EmailService (Dev Notice)] SMTP unconfigured in .env.local. Code for ${maskEmail(email)}: [${otp}]`)
  return {
    success: true,
    delivered: false,
    mode: 'development_mock',
    providerConfigured: false,
    warning: 'Email provider not configured (SMTP credentials missing in .env.local). Real email was NOT sent.'
  }
}

/**
 * Mask an email address: e.g. "priyanshu@example.com" -> "p***u@example.com"
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return ''
  const parts = email.split('@')
  if (parts.length !== 2) return email
  const [name, domain] = parts
  if (name.length <= 2) return `${name[0]}*@${domain}`
  return `${name[0]}***${name[name.length - 1]}@${domain}`
}
