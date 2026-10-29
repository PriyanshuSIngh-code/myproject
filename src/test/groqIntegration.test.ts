import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @ts-expect-error JS module in TS test
import { getActiveAiProvider, callRealAiModel } from '../../server/services/aiProvider.js'
// @ts-expect-error JS module in TS test
import { processChatMessage } from '../../server/services/chatEngine.js'

describe('Groq API Integration & Model Selection', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    delete process.env.DISABLE_CLOUD_AI_IN_TESTS
    delete process.env.GROQ_API_KEY
    delete process.env.GROQ_MODEL
    delete process.env.OPENAI_API_KEY
    delete process.env.GEMINI_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('selects Groq as the active provider with openai/gpt-oss-120b when GROQ_API_KEY is configured', () => {
    process.env.GROQ_API_KEY = 'gsk_mock_test_key_12345'
    const provider = getActiveAiProvider()

    expect(provider).not.toBeNull()
    expect(provider?.type).toBe('groq')
    expect(provider?.key).toBe('gsk_mock_test_key_12345')
    expect(provider?.baseUrl).toBe('https://api.groq.com/openai/v1')
    expect(provider?.model).toBe('openai/gpt-oss-120b')
  })

  it('supports custom GROQ_MODEL overrides such as llama-3.1-8b-instant', () => {
    process.env.GROQ_API_KEY = 'gsk_mock_test_key_12345'
    process.env.GROQ_MODEL = 'llama-3.1-8b-instant'
    const provider = getActiveAiProvider()

    expect(provider?.model).toBe('llama-3.1-8b-instant')
  })

  it('prioritizes Groq when both GROQ_API_KEY and OPENAI_API_KEY are configured', () => {
    process.env.GROQ_API_KEY = 'gsk_test_groq'
    process.env.OPENAI_API_KEY = 'sk-test-openai'
    const provider = getActiveAiProvider()

    expect(provider?.type).toBe('groq')
  })

  it('calls Groq OpenAI-compatible endpoint and parses the generated response', async () => {
    process.env.GROQ_API_KEY = 'gsk_mock_active_key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Under Indian tenancy law, your landlord cannot evict you without 15 days written notice under Section 106.'
            }
          }
        ]
      })
    })
    globalThis.fetch = mockFetch

    const result = await callRealAiModel({
      message: 'My landlord told me to vacate without notice.',
      language: 'English',
      caseDetails: { languagePreference: 'en', issueType: 'tenancy_eviction_without_notice' }
    })

    expect(result).not.toBeNull()
    expect(result.text).toContain('Section 106')
    expect(result.modelUsed).toBe('groq:openai/gpt-oss-120b')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer gsk_mock_active_key',
          'Content-Type': 'application/json'
        })
      })
    )
  })

  it('throws an honest, descriptive error when Groq returns 401 unauthorized', async () => {
    process.env.GROQ_API_KEY = 'gsk_invalid_key'

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API Key' } })
    })

    await expect(
      processChatMessage({
        message: 'I have a legal question regarding my rent.'
      })
    ).rejects.toThrow(/Groq Authentication Failed \(401\)/i)
  })

  it('throws an honest error when Groq returns 429 rate limit exceeded', async () => {
    process.env.GROQ_API_KEY = 'gsk_valid_key'

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit reached' } })
    })

    await expect(
      processChatMessage({
        message: 'I have a legal question regarding my rent.'
      })
    ).rejects.toThrow(/Groq Rate Limit Exceeded \(429\)/i)
  })

  it('falls back seamlessly to local engine when no cloud keys are configured', async () => {
    const res = await processChatMessage({
      message: 'My landlord is asking me to vacate without notice.'
    })

    expect(res.text).toContain('Transfer of Property Act, 1882')
    expect(res.modelUsed).toBe('nayaya-deep-case-engine-v3')
  })
})
