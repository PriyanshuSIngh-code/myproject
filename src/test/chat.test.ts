import { describe, it, expect } from 'vitest'
// @ts-expect-error JS import in TS test
import { detectCrisis } from '../../server/services/crisisDetector.js'
// @ts-expect-error JS import in TS test
import { classifyQuery } from '../../server/services/categoryClassifier.js'
// @ts-expect-error JS import in TS test
import { getVerifiedSources } from '../../server/services/sourceRegistry.js'

describe('AI Chatbot Crisis Detection & Safety Layer', () => {
  it('detects suicidal distress and returns verified Tele-MANAS helpline', () => {
    const result = detectCrisis('I feel hopeless and want to end my life, please help')
    expect(result.isEmergency).toBe(true)
    expect(result.urgency).toBe('critical')
    expect(result.emergencyType).toBe('self_harm')
    expect(result.immediateAction).toBeDefined()
    expect(result.immediateAction?.contacts.some((c: any) => c.number.includes('14416'))).toBe(true)
  })

  it('detects acute medical emergencies (chest pain / stroke)', () => {
    const result = detectCrisis('My father is having severe chest pain and cannot breathe')
    expect(result.isEmergency).toBe(true)
    expect(result.urgency).toBe('critical')
    expect(result.emergencyType).toBe('medical_critical')
    expect(result.immediateAction?.contacts.some((c: any) => c.number.includes('108'))).toBe(true)
  })

  it('detects chemical or poison ingestion and supplies AIIMS Poison Helpline', () => {
    const result = detectCrisis('Child swallowed rat poison by mistake what should I do')
    expect(result.isEmergency).toBe(true)
    expect(result.urgency).toBe('critical')
    expect(result.emergencyType).toBe('poisoning')
    expect(result.immediateAction?.contacts.some((c: any) => c.label.includes('AIIMS'))).toBe(true)
  })

  it('detects active financial cyber fraud and returns 1930 Golden Hour protocol', () => {
    const result = detectCrisis('50,000 was debited from my bank account just now after I gave OTP')
    expect(result.isEmergency).toBe(true)
    expect(result.urgency).toBe('urgent')
    expect(result.emergencyType).toBe('active_cyber_fraud')
    expect(result.immediateAction?.contacts.some((c: any) => c.number === '1930')).toBe(true)
  })
})

describe('AI Chatbot Category Classification & Source Grounding', () => {
  it('classifies legal inquiries and flags jurisdiction requirements', () => {
    const result = classifyQuery('What is the procedure under Section 138 for bounced cheque?')
    expect(result.category).toBe('Legal Assistance')
    expect(result.requiresJurisdictionCheck).toBe(true)

    const sources = getVerifiedSources(result.category)
    expect(sources.some((s: any) => s.url.includes('indiacode.nic.in'))).toBe(true)
    expect(sources.some((s: any) => s.url.includes('ecourts.gov.in'))).toBe(true)
  })

  it('classifies cybercrime inquiries and supplies official cyber portals', () => {
    const result = classifyQuery('Someone sent a phishing link and hacked my account')
    expect(result.category).toBe('Cybercrime & Fraud')

    const sources = getVerifiedSources(result.category)
    expect(sources.some((s: any) => s.url.includes('cybercrime.gov.in'))).toBe(true)
  })

  it('classifies mental health inquiries and supplies Tele-MANAS portal', () => {
    const result = classifyQuery('I am struggling with deep depression and panic attacks')
    expect(result.category).toBe('Mental Health Support')

    const sources = getVerifiedSources(result.category)
    expect(sources.some((s: any) => s.url.includes('telemanas.mohfw.gov.in'))).toBe(true)
  })
})

describe('AI Chatbot Backend Endpoints Integration', () => {
  const testSession = `test-chat-session-${Date.now()}`
  let createdConversationId = ''
  let createdMessageId = ''

  it('submits a message and receives structured multi-domain response', async () => {
    const res = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-session': testSession
      },
      body: JSON.stringify({
        question: 'My cheque of 1 lakh bounced due to insufficient funds, what are my legal rights?',
        language: 'English'
      })
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.conversationId).toBeDefined()
    expect(data.answer).toBeDefined()
    expect(data.category).toBe('Legal Assistance')
    expect(data.sources.length).toBeGreaterThan(0)
    expect(data.followUpSuggestions.length).toBeGreaterThan(0)

    createdConversationId = data.conversationId
    createdMessageId = data.messageId
  })

  it('retrieves conversations associated with the session', async () => {
    const res = await fetch('http://localhost:3001/api/chat/conversations', {
      headers: { 'x-guest-session': testSession }
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.conversations)).toBe(true)
    expect(data.conversations.some((c: any) => c.id === createdConversationId)).toBe(true)
  })

  it('retrieves a single conversation with its message history', async () => {
    const res = await fetch(`http://localhost:3001/api/chat/conversations/${encodeURIComponent(createdConversationId)}`, {
      headers: { 'x-guest-session': testSession }
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.conversation.id).toBe(createdConversationId)
    expect(data.messages.length).toBeGreaterThanOrEqual(2) // 1 user + 1 assistant
  })

  it('records user feedback on an assistant message', async () => {
    const res = await fetch('http://localhost:3001/api/chat/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-session': testSession
      },
      body: JSON.stringify({
        messageId: createdMessageId,
        conversationId: createdConversationId,
        rating: 1,
        feedbackText: 'Clear and structured explanation of Section 138 NI Act'
      })
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('submits a report for an assistant message', async () => {
    const res = await fetch('http://localhost:3001/api/chat/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-session': testSession
      },
      body: JSON.stringify({
        messageId: createdMessageId,
        conversationId: createdConversationId,
        reason: 'Inaccurate legal or factual information',
        details: 'Testing reporting mechanism',
        contactEmail: 'tester@example.com'
      })
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('deletes the conversation', async () => {
    const res = await fetch(`http://localhost:3001/api/chat/conversations/${encodeURIComponent(createdConversationId)}`, {
      method: 'DELETE',
      headers: { 'x-guest-session': testSession }
    })

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
