// Local backend client adapter implementing Supabase client interface for offline/local development.
// Seamlessly delegates to localhost:3001 (or Vite /api proxy) when Supabase cloud is not configured.

export interface UserProfile {
  id: string
  full_name?: string
  email?: string
  phone?: string
  role: 'user' | 'advocate' | 'admin'
  google_verified_at?: string
  email_verified_at?: string
  phone_verified_at?: string
  created_at?: string
}

function getBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return ''
  }
  return 'http://localhost:3001'
}

class LocalClient {
  private getStoredToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('nayaya_auth_token') || sessionStorage.getItem('nayaya_auth_token')
  }

  private getStoredUser(): UserProfile | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem('nayaya_local_user') || sessionStorage.getItem('nayaya_local_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  private saveUser(user: UserProfile) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nayaya_local_user', JSON.stringify(user))
    }
  }

  auth = {
    getUser: async () => {
      const token = this.getStoredToken()
      if (!token) {
        return { data: { user: null }, error: null }
      }

      try {
        const res = await fetch(`${getBaseUrl()}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            return { data: { user: data.user }, error: null }
          }
        }
      } catch {
        // Fallback to locally stored user
      }

      const storedUser = this.getStoredUser()
      return { data: { user: storedUser }, error: null }
    },

    signInWithOtp: async ({ email, phone }: { email?: string; phone?: string; options?: any }) => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/auth/otp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone })
        })
        const data = await res.json()
        if (!res.ok) return { error: new Error(data.error || 'Failed to send OTP') }
        return { error: null }
      } catch (err: any) {
        return { error: err }
      }
    },

    verifyOtp: async ({ email, phone, token }: { email?: string; phone?: string; token: string; type?: string }) => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/auth/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone, token })
        })
        const data = await res.json()
        if (!res.ok) return { data: null, error: new Error(data.error || 'Verification failed') }
        if (data.user) this.saveUser(data.user)
        return { data: { user: data.user, session: data.session }, error: null }
      } catch (err: any) {
        return { data: null, error: err }
      }
    },

    signInWithOAuth: async ({ provider: _provider, options }: { provider: string; options?: { redirectTo?: string } }) => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/auth/oauth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'owner@nayayamitra.in' })
        })
        const data = await res.json()
        if (data.user) this.saveUser(data.user)
        if (options?.redirectTo && typeof window !== 'undefined') {
          window.location.href = options.redirectTo
        }
        return { error: null }
      } catch (err: any) {
        return { error: err }
      }
    },

    signOut: async () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nayaya_local_user')
      }
      return { error: null }
    }
  }

  from(table: string) {
    const whereConditions: Record<string, string> = {}
    let isSingle = false
    let isMaybeSingle = false

    const queryBuilder = {
      select: (_cols?: string) => queryBuilder,
      eq: (col: string, val: any) => {
        whereConditions[col] = String(val)
        return queryBuilder
      },
      gt: (_col: string, _val: any) => queryBuilder,
      order: (_col: string, _opts?: any) => queryBuilder,
      limit: (_n: number) => queryBuilder,
      single: () => {
        isSingle = true
        return queryBuilder.then()
      },
      maybeSingle: () => {
        isMaybeSingle = true
        return queryBuilder.then()
      },
      insert: async (data: Record<string, any>) => {
        try {
          const token = this.getStoredToken()
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (token) headers['Authorization'] = `Bearer ${token}`

          const res = await fetch(`${getBaseUrl()}/api/rest/v1/${table}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
          })
          const result = await res.json()
          if (!res.ok) return { data: null, error: new Error(result.error || 'Insert failed') }
          return { data: result.data, error: null }
        } catch (err: any) {
          return { data: null, error: err }
        }
      },
      then: async (resolve?: (val: any) => any, reject?: (val: any) => any) => {
        try {
          const params = new URLSearchParams()
          for (const [k, v] of Object.entries(whereConditions)) {
            params.append(k, `eq.${v}`)
          }
          const url = `${getBaseUrl()}/api/rest/v1/${table}?${params.toString()}`
          const token = this.getStoredToken()
          const headers: Record<string, string> = {}
          if (token) headers['Authorization'] = `Bearer ${token}`

          const res = await fetch(url, { headers })
          const rows = await res.json()
          if (!res.ok) {
            const err = new Error(rows.error || 'Query failed')
            if (reject) return reject(err)
            return { data: null, error: err }
          }

          let dataResult = rows
          if (isSingle) {
            dataResult = rows.length > 0 ? rows[0] : null
          } else if (isMaybeSingle) {
            dataResult = rows.length > 0 ? rows[0] : null
          }

          const response = { data: dataResult, error: null }
          if (resolve) return resolve(response)
          return response
        } catch (err: any) {
          if (reject) return reject(err)
          return { data: null, error: err }
        }
      }
    }

    return queryBuilder
  }

  rpc = async (functionName: string, params: Record<string, any>) => {
    try {
      const token = this.getStoredToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${getBaseUrl()}/api/rpc/${functionName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
      })
      const data = await res.json()
      if (!res.ok) return { data: null, error: new Error(data.error || 'RPC call failed') }
      return { data, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  }

  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, file: File, _opts?: any) => {
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('path', path)
          const res = await fetch(`${getBaseUrl()}/api/storage/upload/${bucket}`, {
            method: 'POST',
            body: formData
          })
          const data = await res.json()
          if (!res.ok) return { data: null, error: new Error(data.error || 'Upload failed') }
          return { data: { path: data.data?.path || path }, error: null }
        } catch (err: any) {
          return { data: null, error: err }
        }
      }
    })
  }

  functions = {
    invoke: async (functionName: string, { body }: { body: any }) => {
      try {
        const token = this.getStoredToken()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const endpoint = functionName === 'legal-chat' ? '/api/chat' : functionName === 'case-draft' ? '/api/draft' : `/api/functions/${functionName}`
        const res = await fetch(`${getBaseUrl()}${endpoint}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
        const data = await res.json()
        if (!res.ok) return { data: null, error: new Error(data.error || 'Function invocation failed') }
        return { data, error: null }
      } catch (err: any) {
        return { data: null, error: err }
      }
    }
  }
}

export const localClient = new LocalClient()
