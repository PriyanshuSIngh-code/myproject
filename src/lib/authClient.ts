/**
 * Client authentication service for NayayaMitra Dual-Verification System.
 * Communicates with /api/auth endpoints and manages client tokens/sessions.
 */

export interface AuthUser {
  id: string
  full_name: string
  email: string
  country_code?: string
  phone_number?: string
  role?: string
  email_verified: boolean
  phone_verified: boolean
  account_status?: string
  created_at?: string
}

export interface VerificationStatus {
  userId: string
  fullName: string
  email?: string
  rawEmail?: string
  emailMasked: string
  phoneMasked: string
  emailVerified: boolean
  phoneVerified: boolean
  fullyActivated: boolean
  providersConfigured?: {
    email: boolean
    sms: boolean
  }
}

export interface AuthSessionResponse {
  ok: boolean
  message?: string
  token?: string
  user?: AuthUser
  requiresVerification?: boolean
  userId?: string
  emailVerified?: boolean
  phoneVerified?: boolean
  error?: string
}

const TOKEN_KEY = 'nayaya_auth_token'
const USER_KEY = 'nayaya_local_user'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setAuthSession(token: string, user: AuthUser, remember = true): void {
  if (typeof window === 'undefined') return
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(TOKEN_KEY, token)
  storage.setItem(USER_KEY, JSON.stringify(user))

  // Dispatch events to notify listeners across the app
  window.dispatchEvent(new Event('storage'))
  window.dispatchEvent(new CustomEvent('nayaya:auth-changed', { detail: { user } }))
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)

  window.dispatchEvent(new Event('storage'))
  window.dispatchEvent(new CustomEvent('nayaya:auth-changed', { detail: { user: null } }))
}

async function authFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getStoredToken()
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(path, {
    ...options,
    headers
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errorMsg = json.error || json.message || `Request failed with status ${res.status}`
    const error = new Error(errorMsg) as any
    error.status = res.status
    error.data = json
    throw error
  }

  return json
}

export const authClient = {
  getStoredUser,
  getStoredToken,
  setAuthSession,
  clearAuthSession,

  /** Register new user */
  async register(params: {
    fullName: string
    email: string
    countryCode?: string
    phoneNumber: string
    password: string
    confirmPassword: string
    acceptTerms: boolean
  }): Promise<{ ok: boolean; userId: string; emailMasked: string; phoneMasked: string; message: string }> {
    return authFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  /** Verify email 6-digit OTP */
  async verifyEmail(params: { userId: string; otp: string }): Promise<{
    ok: boolean
    message: string
    emailVerified: boolean
    fullyActivated: boolean
    email?: string
    rawEmail?: string
    token?: string
    user?: AuthUser
  }> {
    const res = await authFetch('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(params)
    })
    return res
  },

  /** Verify mobile 6-digit OTP */
  async verifyPhone(params: { userId: string; otp: string }): Promise<{
    ok: boolean
    message: string
    phoneVerified: boolean
    fullyActivated: boolean
    email?: string
    rawEmail?: string
    token?: string
    user?: AuthUser
  }> {
    const res = await authFetch('/api/auth/verify-phone', {
      method: 'POST',
      body: JSON.stringify(params)
    })
    return res
  },

  /** Resend email OTP with 60s cooldown enforcement */
  async resendEmailOtp(userId: string): Promise<{ ok: boolean; message: string }> {
    return authFetch('/api/auth/resend-email-otp', {
      method: 'POST',
      body: JSON.stringify({ userId })
    })
  },

  /** Resend mobile SMS OTP with 60s cooldown enforcement */
  async resendPhoneOtp(userId: string): Promise<{ ok: boolean; message: string }> {
    return authFetch('/api/auth/resend-phone-otp', {
      method: 'POST',
      body: JSON.stringify({ userId })
    })
  },

  /** Get current dual verification status */
  async getVerificationStatus(userId: string): Promise<VerificationStatus> {
    return authFetch(`/api/auth/verification-status/${encodeURIComponent(userId)}`, {
      method: 'GET'
    })
  },

  /** Login via Email OR Mobile number */
  async login(params: { identifier: string; password: string; rememberMe?: boolean }): Promise<AuthSessionResponse> {
    const res = await authFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(params)
    })
    if (res.ok && res.token && res.user) {
      setAuthSession(res.token, res.user, Boolean(params.rememberMe))
    }
    return res
  },

  /** Forgot password - requests reset token / OTP */
  async forgotPassword(params: { identifier: string }): Promise<{ ok: boolean; message: string; method?: string; resetToken?: string }> {
    return authFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  /** Reset password with token or OTP */
  async resetPassword(params: {
    token?: string
    otp?: string
    identifier?: string
    newPassword: string
    confirmPassword: string
  }): Promise<{ ok: boolean; message: string }> {
    return authFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  /** Get authenticated user profile */
  async getMe(): Promise<{ ok: boolean; user: AuthUser }> {
    const res = await authFetch('/api/auth/me', { method: 'GET' })
    if (res.user) {
      const token = getStoredToken()
      if (token) setAuthSession(token, res.user)
    }
    return res
  },

  /** Change password for logged in user */
  async changePassword(params: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ ok: boolean; message: string }> {
    return authFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  /** Update profile name */
  async updateProfile(params: { fullName: string }): Promise<{ ok: boolean; user: AuthUser; message: string }> {
    const res = await authFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(params)
    })
    if (res.user) {
      const token = getStoredToken()
      if (token) setAuthSession(token, res.user)
    }
    return res
  },

  /** Logout from server and clear local session */
  async logout(): Promise<void> {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    } finally {
      clearAuthSession()
    }
  },

  /** Dev mock outbox inspector */
  async getDevOutbox(userId: string): Promise<{ ok: boolean; devMode: boolean; emailOtp: string | null; smsOtp: string | null; resetToken: string | null }> {
    return authFetch(`/api/auth/dev-outbox/${encodeURIComponent(userId)}`, { method: 'GET' })
  },

  // -----------------------------------------------------------
  // Dedicated Separate User Authentication Client Methods
  // -----------------------------------------------------------
  async userSignup(params: {
    fullName: string
    email: string
    password: string
    confirmPassword: string
  }): Promise<{ ok: boolean; userId: string; email: string; emailMasked: string; message: string; cooldownSeconds?: number }> {
    return authFetch('/api/auth/user/signup', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  async userVerifyEmail(params: {
    userId?: string
    email?: string
    otp: string
  }): Promise<{ ok: boolean; token?: string; user?: AuthUser; message: string; redirectTo?: string }> {
    const res = await authFetch('/api/auth/user/verify-email', {
      method: 'POST',
      body: JSON.stringify(params)
    })
    if (res.ok && res.token && res.user) {
      setAuthSession(res.token, res.user, true)
    }
    return res
  },

  async userResendVerification(params: {
    userId?: string
    email?: string
  }): Promise<{ ok: boolean; message: string; cooldownSeconds?: number }> {
    return authFetch('/api/auth/user/resend-verification', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  async userLoginRequest(params: {
    email: string
  }): Promise<{ ok: boolean; success: boolean; email?: string; emailMasked?: string; cooldownSeconds?: number; message?: string; requiresVerification?: boolean; userId?: string }> {
    return authFetch('/api/auth/user/login-request', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  async userLoginVerify(params: {
    email: string
    otp: string
  }): Promise<{ ok: boolean; token?: string; user?: AuthUser; message: string; redirectTo?: string }> {
    const res = await authFetch('/api/auth/user/login-verify', {
      method: 'POST',
      body: JSON.stringify(params)
    })
    if (res.ok && res.token && res.user) {
      setAuthSession(res.token, res.user, true)
    }
    return res
  },

  async userLoginResend(params: {
    email: string
  }): Promise<{ ok: boolean; message: string; cooldownSeconds?: number }> {
    return authFetch('/api/auth/user/login-resend', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  // -----------------------------------------------------------
  // Dedicated Separate Advocate Authentication Client Methods
  // -----------------------------------------------------------
  async advocateSignup(params: {
    fullName: string
    email: string
    password: string
    confirmPassword: string
    enrolmentNumber: string
    city?: string
    court?: string
    practiceAreas?: string[] | string
  }): Promise<{ ok: boolean; token?: string; user?: AuthUser; message: string; hasActiveSubscription?: boolean; redirectTo?: string }> {
    const res = await authFetch('/api/auth/advocate/signup', {
      method: 'POST',
      body: JSON.stringify(params)
    })
    if (res.ok && res.token && res.user) {
      setAuthSession(res.token, res.user, true)
    }
    return res
  },

  async advocateLogin(params: {
    email: string
    password: string
  }): Promise<{ ok: boolean; token?: string; user?: AuthUser; message: string; hasActiveSubscription?: boolean; subscription?: any; redirectTo?: string }> {
    const res = await authFetch('/api/auth/advocate/login', {
      method: 'POST',
      body: JSON.stringify(params)
    })
    if (res.ok && res.token && res.user) {
      setAuthSession(res.token, res.user, true)
    }
    return res
  }
}
