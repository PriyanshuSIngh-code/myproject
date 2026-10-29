import { describe, it, expect } from 'vitest'
import { getPublicAdvocates, submitLegalQuestion } from '../lib/api'

describe('Legal API helpers connected to backend', () => {
  it('fetches approved advocates from backend database', async () => {
    const advocates = await getPublicAdvocates()
    expect(Array.isArray(advocates)).toBe(true)
    expect(advocates.length).toBeGreaterThan(0)
    expect(advocates[0]).toHaveProperty('display_name')
    expect(advocates[0].verification_status).toBe('approved')
  })

  it('provides legal guidance and official sources when submitting questions', async () => {
    const response = await submitLegalQuestion('What is FIR?', 'English')
    expect(response).toBeDefined()
    expect(typeof response.answer).toBe('string')
    expect(response.answer.length).toBeGreaterThan(20)
    expect(Array.isArray(response.sources)).toBe(true)
    expect(response.sources.length).toBeGreaterThan(0)

    const titles = response.sources.map(s => s.title)
    expect(titles.some(t => t.includes('India Code'))).toBe(true)
    expect(titles.some(t => t.includes('NALSA'))).toBe(true)

    for (const source of response.sources) {
      expect(source.url).toMatch(/^https:\/\//)
    }
  })
})
