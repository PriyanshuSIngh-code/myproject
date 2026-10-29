import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { processChatMessage } from '../services/chatEngine.js'
import { verifySessionToken } from '../services/authService.js'
import { chatLimiter } from '../middleware/rateLimiter.js'

export const chatRouter = Router()

/**
 * Helper to extract authenticated user or guest session token from request.
 */
function resolveChatIdentity(req) {
  const authHeader = req.headers.authorization
  const rawToken = req.headers['x-user-id'] || (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null)
  const guestSession = req.headers['x-guest-session'] || req.body?.sessionToken || null

  let userId = null
  if (rawToken && rawToken !== 'null' && rawToken !== 'undefined') {
    const decoded = verifySessionToken(rawToken)
    const effectiveId = decoded?.userId || rawToken

    // Check user existence
    const user = db.prepare('SELECT id, full_name, email, role FROM users WHERE id = ?').get(effectiveId)
    if (user) {
      userId = user.id
    } else {
      const profile = db.prepare('SELECT id, full_name, email, role FROM profiles WHERE id = ?').get(effectiveId)
      if (profile) userId = profile.id
    }
  }

  return { userId, guestSession: guestSession || (userId ? null : crypto.randomUUID()) }
}

// -------------------------------------------------------------
// 1. SUBMIT MESSAGE & GENERATE INTELLIGENT AI RESPONSE
// -------------------------------------------------------------
chatRouter.post('/', chatLimiter, async (req, res) => {
  try {
    const { question, message, conversationId, language = 'English', jurisdiction = '' } = req.body
    const inputMessage = (message || question || '').trim()

    if (!inputMessage) {
      return res.status(400).json({ error: 'A question or message is required.' })
    }

    if (inputMessage.length > 4000) {
      return res.status(400).json({ error: 'Message exceeds the maximum permitted length (4,000 characters).' })
    }

    const { userId, guestSession } = resolveChatIdentity(req)

    // Ensure conversation exists or create a new one
    let targetConvId = conversationId
    let conversation = null

    if (targetConvId) {
      conversation = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(targetConvId)
      // Check authorization
      if (conversation) {
        if (userId && conversation.user_id && conversation.user_id !== userId) {
          return res.status(403).json({ error: 'Unauthorized: You cannot access this conversation.' })
        }
      }
    }

    if (!conversation) {
      targetConvId = crypto.randomUUID()
      const title = inputMessage.slice(0, 50).trim() + (inputMessage.length > 50 ? '...' : '')
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO chat_conversations (id, user_id, session_token, title, category, language, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'General', ?, ?, ?)
      `).run(targetConvId, userId, guestSession, title, language, now, now)
    }

    // Retrieve recent conversation history (latest 10 messages in chronological order)
    const historyRows = db.prepare(`
      SELECT role, content FROM (
        SELECT id, role, content, created_at FROM chat_messages
        WHERE conversation_id = ?
        ORDER BY created_at DESC LIMIT 10
      ) ORDER BY created_at ASC
    `).all(targetConvId)

    const conversationHistory = historyRows.map(r => ({
      role: r.role,
      content: r.content
    }))

    // Save user message
    const userMsgId = crypto.randomUUID()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, 'user', ?, ?)
    `).run(userMsgId, targetConvId, inputMessage, now)

    // Execute multi-domain chat engine with crisis detection and source grounding
    const engineOutput = await processChatMessage({
      message: inputMessage,
      conversationHistory,
      language,
      jurisdiction
    })

    // Save assistant message
    const assistantMsgId = crypto.randomUUID()
    const nowAssist = new Date().toISOString()
    db.prepare(`
      INSERT INTO chat_messages (
        id, conversation_id, role, content, category, urgency,
        immediate_action, sources, follow_up_suggestions, created_at
      ) VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assistantMsgId,
      targetConvId,
      engineOutput.text,
      engineOutput.category,
      engineOutput.urgency,
      engineOutput.immediateAction ? JSON.stringify(engineOutput.immediateAction) : null,
      JSON.stringify(engineOutput.sources),
      JSON.stringify(engineOutput.followUpSuggestions),
      nowAssist
    )

    // Update conversation metadata
    db.prepare(`
      UPDATE chat_conversations
      SET updated_at = ?, category = ?, language = ?
      WHERE id = ?
    `).run(nowAssist, engineOutput.category, language, targetConvId)

    return res.json({
      success: true,
      conversationId: targetConvId,
      messageId: assistantMsgId,
      answer: engineOutput.text,
      category: engineOutput.category,
      subCategory: engineOutput.subCategory,
      urgency: engineOutput.urgency,
      isEmergency: engineOutput.isEmergency,
      immediateAction: engineOutput.immediateAction,
      sources: engineOutput.sources,
      followUpSuggestions: engineOutput.followUpSuggestions,
      requiresJurisdictionCheck: engineOutput.requiresJurisdictionCheck,
      language: engineOutput.language,
      modelUsed: engineOutput.modelUsed,
      timestamp: nowAssist
    })
  } catch (err) {
    console.error('[Chat Error /api/chat]:', err)
    return res.status(500).json({
      error: err.message || 'An unexpected error occurred while processing your query. Please try again.'
    })
  }
})

// -------------------------------------------------------------
// 2. CREATE A NEW CONVERSATION
// -------------------------------------------------------------
chatRouter.post('/conversations', (req, res) => {
  try {
    const { title = 'New Conversation', language = 'English', category = 'General' } = req.body
    const { userId, guestSession } = resolveChatIdentity(req)

    const convId = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO chat_conversations (id, user_id, session_token, title, category, language, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(convId, userId, guestSession, title.slice(0, 100), category, language, now, now)

    const conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(convId)
    return res.status(201).json({ success: true, conversation: conv })
  } catch (err) {
    console.error('[Chat Error /conversations POST]:', err)
    return res.status(500).json({ error: 'Failed to create conversation.' })
  }
})

// -------------------------------------------------------------
// 3. RETRIEVE PERMITTED CONVERSATIONS
// -------------------------------------------------------------
chatRouter.get('/conversations', (req, res) => {
  try {
    const { userId, guestSession } = resolveChatIdentity(req)

    let rows = []
    if (userId) {
      rows = db.prepare(`
        SELECT * FROM chat_conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC LIMIT 30
      `).all(userId)
    } else if (guestSession) {
      rows = db.prepare(`
        SELECT * FROM chat_conversations
        WHERE session_token = ? AND user_id IS NULL
        ORDER BY updated_at DESC LIMIT 20
      `).all(guestSession)
    }

    return res.json({ success: true, conversations: rows })
  } catch (err) {
    console.error('[Chat Error /conversations GET]:', err)
    return res.status(500).json({ error: 'Failed to retrieve conversations.' })
  }
})

// -------------------------------------------------------------
// 4. RETRIEVE AN AUTHORIZED CONVERSATION WITH MESSAGES
// -------------------------------------------------------------
chatRouter.get('/conversations/:id', (req, res) => {
  try {
    const { id } = req.params
    const { userId, guestSession } = resolveChatIdentity(req)

    const conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(id)
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' })
    }

    // Authorization check
    if (userId && conv.user_id && conv.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this conversation.' })
    }
    if (!userId && conv.session_token && conv.session_token !== guestSession) {
      return res.status(403).json({ error: 'Access denied: Session mismatch.' })
    }

    const messages = db.prepare(`
      SELECT * FROM chat_messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(id)

    const parsedMessages = messages.map(m => ({
      ...m,
      sources: JSON.parse(m.sources || '[]'),
      follow_up_suggestions: JSON.parse(m.follow_up_suggestions || '[]'),
      immediate_action: m.immediate_action ? JSON.parse(m.immediate_action) : null
    }))

    return res.json({
      success: true,
      conversation: conv,
      messages: parsedMessages
    })
  } catch (err) {
    console.error('[Chat Error /conversations/:id GET]:', err)
    return res.status(500).json({ error: 'Failed to load conversation.' })
  }
})

// -------------------------------------------------------------
// 5. DELETE AN AUTHORIZED CONVERSATION
// -------------------------------------------------------------
chatRouter.delete('/conversations/:id', (req, res) => {
  try {
    const { id } = req.params
    const { userId, guestSession } = resolveChatIdentity(req)

    const conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(id)
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' })
    }

    // Authorization check
    if (userId && conv.user_id && conv.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this conversation.' })
    }
    if (!userId && conv.session_token && conv.session_token !== guestSession) {
      return res.status(403).json({ error: 'Access denied: Session mismatch.' })
    }

    db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(id)
    return res.json({ success: true, message: 'Conversation deleted successfully.' })
  } catch (err) {
    console.error('[Chat Error /conversations/:id DELETE]:', err)
    return res.status(500).json({ error: 'Failed to delete conversation.' })
  }
})

// -------------------------------------------------------------
// 6. RECORD RESPONSE FEEDBACK (THUMBS UP / DOWN)
// -------------------------------------------------------------
chatRouter.post('/feedback', (req, res) => {
  try {
    const { messageId, conversationId, rating, feedbackText } = req.body
    if (!messageId || !rating) {
      return res.status(400).json({ error: 'Message ID and rating (+1 or -1) are required.' })
    }

    const { userId } = resolveChatIdentity(req)
    const feedbackId = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO chat_feedback (id, message_id, conversation_id, user_id, rating, feedback_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(feedbackId, messageId, conversationId || null, userId, rating > 0 ? 1 : -1, feedbackText || null, now)

    return res.json({ success: true, message: 'Thank you for your feedback!' })
  } catch (err) {
    console.error('[Chat Error /feedback]:', err)
    return res.status(500).json({ error: 'Failed to record feedback.' })
  }
})

// -------------------------------------------------------------
// 7. REPORT INCORRECT OR UNSAFE RESPONSE
// -------------------------------------------------------------
chatRouter.post('/report', (req, res) => {
  try {
    const { messageId, conversationId, reason, details, contactEmail } = req.body
    if (!messageId || !reason) {
      return res.status(400).json({ error: 'Message ID and report reason are required.' })
    }

    const { userId } = resolveChatIdentity(req)
    const reportId = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO chat_reports (id, message_id, conversation_id, user_id, reason, details, contact_email, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(reportId, messageId, conversationId || null, userId, reason, details || null, contactEmail || null, now)

    return res.json({
      success: true,
      message: 'Report submitted successfully. Our safety team will review this response.'
    })
  } catch (err) {
    console.error('[Chat Error /report]:', err)
    return res.status(500).json({ error: 'Failed to submit report.' })
  }
})
