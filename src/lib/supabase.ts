import { createClient } from '@supabase/supabase-js'
import { localClient } from './localClient'

const url = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined
const anonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) as string | undefined

// Supabase cloud is configured if real keys are provided in .env.local
export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('YOUR_PROJECT_ID') && !anonKey.includes('YOUR_SUPABASE')
)

// When Supabase cloud credentials are provided, use official Supabase JS client.
// Otherwise, seamlessly connect to the local backend server via localClient!
export const isBackendConnected = true
export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : (localClient as any)
