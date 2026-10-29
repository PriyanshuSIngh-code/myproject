import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  authClient,
  type AuthUser,
  getStoredUser,
  getStoredToken,
  setAuthSession,
  clearAuthSession
} from '../lib/authClient'

export type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'pending_verification'

export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  authState: AuthState
  isLoading: boolean
  isAuthenticated: boolean
  isPendingVerification: boolean
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<{ ok: boolean; requiresVerification?: boolean; userId?: string; message?: string }>
  register: (params: Parameters<typeof authClient.register>[0]) => Promise<{ ok: boolean; userId: string; emailMasked: string; phoneMasked: string; message: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<AuthUser | null>
  setSession: (token: string, user: AuthUser, remember?: boolean) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser())
  const [token, setToken] = useState<string | null>(getStoredToken())
  const [isLoading, setIsLoading] = useState(true)

  // Determine computed state
  let authState: AuthState = 'unauthenticated'
  if (isLoading) {
    authState = 'loading'
  } else if (user && token) {
    if (user.role === 'admin' || user.role === 'advocate' || user.email_verified) {
      authState = 'authenticated'
    } else {
      authState = 'pending_verification'
    }
  }

  const isAuthenticated = authState === 'authenticated'
  const isPendingVerification = authState === 'pending_verification'

  // Central session refresher validating with backend
  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const currentToken = getStoredToken()
    if (!currentToken) {
      setUser(null)
      setToken(null)
      setIsLoading(false)
      return null
    }

    try {
      const res = await authClient.getMe()
      if (res.user) {
        setUser(res.user)
        setToken(currentToken)
        setAuthSession(currentToken, res.user)
        return res.user
      }
      return null
    } catch {
      // Token expired or invalid
      clearAuthSession()
      setUser(null)
      setToken(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial check on mount
  useEffect(() => {
    refreshUser()

    // Cross-tab synchronization
    function handleStorage(e: StorageEvent) {
      if (e.key === 'nayaya_auth_token' || e.key === 'nayaya_local_user') {
        const storedToken = getStoredToken()
        const storedUser = getStoredUser()
        setToken(storedToken)
        setUser(storedUser)
      }
    }

    function handleAuthChanged(e: any) {
      const updatedUser = e.detail?.user || getStoredUser()
      const updatedToken = getStoredToken()
      setUser(updatedUser)
      setToken(updatedToken)
      setIsLoading(false)
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('nayaya:auth-changed', handleAuthChanged)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('nayaya:auth-changed', handleAuthChanged)
    }
  }, [refreshUser])

  // Explicit session setter
  const setSession = useCallback((newToken: string, newUser: AuthUser, remember = true) => {
    setAuthSession(newToken, newUser, remember)
    setToken(newToken)
    setUser(newUser)
    setIsLoading(false)
  }, [])

  // Login handler
  const login = useCallback(async (identifier: string, password: string, rememberMe = true) => {
    const res = await authClient.login({ identifier, password, rememberMe })
    if (res.ok && res.token && res.user) {
      setSession(res.token, res.user, rememberMe)
      return { ok: true, message: res.message, user: res.user }
    }
    if (res.requiresVerification && res.userId) {
      return {
        ok: false,
        requiresVerification: true,
        userId: res.userId,
        message: res.message || 'Account verification incomplete.'
      }
    }
    return { ok: false, message: res.error || 'Login failed.' }
  }, [setSession])

  // Register handler
  const register = useCallback(async (params: Parameters<typeof authClient.register>[0]) => {
    return authClient.register(params)
  }, [])

  // Real logout handler
  const logout = useCallback(async () => {
    try {
      await authClient.logout()
    } finally {
      clearAuthSession()
      setUser(null)
      setToken(null)
      setIsLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authState,
        isLoading,
        isAuthenticated,
        isPendingVerification,
        login,
        register,
        logout,
        refreshUser,
        setSession
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
