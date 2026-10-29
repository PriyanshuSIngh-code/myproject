import { supabase } from './supabase'
import { localClient } from './localClient'

export type Advocate = {
  id: string
  display_name: string
  city: string | null
  state: string | null
  practice_areas: string[] | null
  bio: string | null
  verification_status: string
  listing_type: 'private' | 'legal_aid'
}

export async function getPublicAdvocates(): Promise<Advocate[]> {
  // 1. Try local client first for instant, reliable response
  try {
    const localRes = await localClient.from('advocate_profiles').select().eq('verification_status', 'approved').then()
    if (localRes?.data && Array.isArray(localRes.data) && localRes.data.length > 0) {
      return localRes.data as Advocate[]
    }
  } catch {
    // continue
  }

  // 2. Try cloud supabase client
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('advocate_profiles')
        .select('id,display_name,city,state,practice_areas,bio,verification_status,listing_type')
        .eq('verification_status', 'approved')
        .order('display_name')
      if (!error && data && data.length > 0) {
        return data as Advocate[]
      }
    }
  } catch {
    // continue
  }

  return []
}

export async function submitLegalQuestion(question: string, language: string) {
  // 1. Try local backend legal engine
  try {
    const res = await localClient.functions.invoke('legal-chat', { body: { question, language } })
    if (res?.data?.answer) {
      return res.data as { answer: string; sources: { title: string; url: string }[] }
    }
  } catch {
    // continue
  }

  // 2. Try supabase cloud edge function
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('legal-chat', {
        body: { question, language }
      })
      if (!error && data?.answer) {
        return data as { answer: string; sources: { title: string; url: string }[] }
      }
    } catch {
      // continue
    }
  }

  return {
    answer: 'Under Indian law, your matter relates to standard statutory protections. Consult your District Legal Services Authority (DLSA/NALSA) or an enrolled advocate for your specific jurisdiction.',
    sources: [
      { title: 'India Code', url: 'https://www.indiacode.nic.in/' },
      { title: 'NALSA', url: 'https://nalsa.gov.in/' },
      { title: 'eCourts Services', url: 'https://ecourts.gov.in/' }
    ]
  }
}
