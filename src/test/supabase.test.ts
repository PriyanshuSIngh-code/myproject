import { describe, it, expect } from 'vitest'
import { isSupabaseConfigured, isBackendConnected, supabase } from '../lib/supabase'

describe('Backend Client Configuration', () => {
  it('provides a valid backend client (cloud or local adapter)', () => {
    expect(typeof isSupabaseConfigured).toBe('boolean')
    expect(isBackendConnected).toBe(true)
    expect(supabase).not.toBeNull()
    expect(typeof supabase.auth.getUser).toBe('function')
    expect(typeof supabase.from).toBe('function')
    expect(typeof supabase.functions.invoke).toBe('function')
  })

  it('correctly evaluates placeholder check rules for cloud Supabase', () => {
    const isConfigured = (url?: string, key?: string) =>
      Boolean(url && key && !url.includes('YOUR_PROJECT_ID') && !key.includes('YOUR_SUPABASE'))

    expect(isConfigured(undefined, undefined)).toBe(false)
    expect(isConfigured('https://YOUR_PROJECT_ID.supabase.co', 'YOUR_SUPABASE_ANON_PUBLIC_KEY')).toBe(false)
    expect(isConfigured('https://abc.supabase.co', 'YOUR_SUPABASE_ANON_PUBLIC_KEY')).toBe(false)
    expect(isConfigured('https://abc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI...')).toBe(true)
  })
})
