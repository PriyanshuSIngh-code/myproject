import { getStoredToken } from './authClient'

export interface ChatSource {
  title: string
  url: string
  description?: string
  domain: string
}

export interface ImmediateActionCallout {
  title: string
  severity: 'critical' | 'high'
  badge: string
  directives: string[]
  contacts: { label: string; number: string; description: string; url?: string }[]
  disclaimer: string
}

export interface ChatMessageItem {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  category?: string
  subCategory?: string
  urgency?: 'critical' | 'urgent' | 'standard' | 'low'
  isEmergency?: boolean
  immediateAction?: ImmediateActionCallout | null
  sources?: ChatSource[]
  followUpSuggestions?: string[]
  requiresJurisdictionCheck?: boolean
  createdAt: string
  modelUsed?: string
  feedback?: 1 | -1 | null
}

export interface ConversationItem {
  id: string
  title: string
  category: string
  language: string
  createdAt: string
  updatedAt: string
}

const GUEST_SESSION_KEY = 'nayaya_guest_chat_session'

export function getOrCreateGuestSession(): string {
  if (typeof window === 'undefined') return 'server-session'
  let session = localStorage.getItem(GUEST_SESSION_KEY)
  if (!session) {
    session = 'guest-' + Math.random().toString(36).substring(2, 12) + '-' + Date.now().toString(36)
    localStorage.setItem(GUEST_SESSION_KEY, session)
  }
  return session
}

async function chatFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getStoredToken()
  const guestSession = getOrCreateGuestSession()

  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  headers.set('x-guest-session', guestSession)
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

export const chatClient = {
  /**
   * Submit user message and retrieve intelligent response
   */
  async sendMessage(params: {
    message: string
    conversationId?: string | null
    language?: string
    jurisdiction?: string
  }): Promise<{
    success: boolean
    conversationId: string
    messageId: string
    answer: string
    category: string
    subCategory: string
    urgency: 'critical' | 'urgent' | 'standard' | 'low'
    isEmergency: boolean
    immediateAction: ImmediateActionCallout | null
    sources: ChatSource[]
    followUpSuggestions: string[]
    requiresJurisdictionCheck: boolean
    language: string
    modelUsed: string
    timestamp: string
  }> {
    return chatFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: params.message,
        conversationId: params.conversationId,
        language: params.language || 'English',
        jurisdiction: params.jurisdiction || ''
      })
    })
  },

  /**
   * List recent conversations
   */
  async getConversations(): Promise<ConversationItem[]> {
    const res = await chatFetch('/api/chat/conversations', { method: 'GET' })
    if (res.conversations && Array.isArray(res.conversations)) {
      return res.conversations.map((c: any) => ({
        id: c.id,
        title: c.title,
        category: c.category || 'General',
        language: c.language || 'English',
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }))
    }
    return []
  },

  /**
   * Retrieve conversation details and message history
   */
  async getConversation(id: string): Promise<{ conversation: ConversationItem; messages: ChatMessageItem[] }> {
    const res = await chatFetch(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'GET' })
    const messages = (res.messages || []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      category: m.category,
      urgency: m.urgency,
      isEmergency: m.urgency === 'critical' || Boolean(m.immediate_action),
      immediateAction: m.immediate_action,
      sources: m.sources,
      followUpSuggestions: m.follow_up_suggestions,
      createdAt: m.created_at
    }))

    const conversation: ConversationItem = {
      id: res.conversation.id,
      title: res.conversation.title,
      category: res.conversation.category,
      language: res.conversation.language,
      createdAt: res.conversation.created_at,
      updatedAt: res.conversation.updated_at
    }

    return { conversation, messages }
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<{ success: boolean }> {
    return chatFetch(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  /**
   * Submit thumbs up / down feedback
   */
  async submitFeedback(params: {
    messageId: string
    conversationId?: string | null
    rating: 1 | -1
    feedbackText?: string
  }): Promise<{ success: boolean; message: string }> {
    return chatFetch('/api/chat/feedback', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  /**
   * Report an unsafe or inaccurate message
   */
  async reportMessage(params: {
    messageId: string
    conversationId?: string | null
    reason: string
    details?: string
    contactEmail?: string
  }): Promise<{ success: boolean; message: string }> {
    return chatFetch('/api/chat/report', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  }
}
