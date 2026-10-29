import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowUp,
  Bot,
  ExternalLink,
  Globe2,
  LoaderCircle,
  MessageCircle,
  Mic,
  MicOff,
  ShieldAlert,
  UserRound,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Square,
  AlertTriangle,
  PhoneCall,
  Trash2,
  Plus,
  Sparkles,
  Info,
  Flag,
  X
} from 'lucide-react'
import {
  chatClient,
  type ChatMessageItem,
  type ConversationItem
} from '../lib/chatClient'
import MarkdownView from '../components/MarkdownView'

const LANGUAGES = [
  'English',
  'Hinglish',
  'हिन्दी',
  'ਪੰਜਾਬੀ',
  'বাংলা',
  'తెలుగు',
  'मराठी',
  'தமிழ்',
  'اردو',
  'ગુજરાતી',
  'ಕನ್ನಡ',
  'മലയാളം'
]

const QUICK_CATEGORIES = [
  {
    icon: '⚖️',
    name: 'Legal Help',
    prompt: 'My cheque of 2 lakhs was dishonoured by the bank. What is the statutory timeline under Section 138 of the NI Act?'
  },
  {
    icon: '🛡️',
    name: 'Cybercrime',
    prompt: 'An unauthorized amount of Rs 45,000 was debited from my bank account just now. How does the 1930 Golden Hour freeze work?'
  },
  {
    icon: '🚨',
    name: 'Emergency Guidance',
    prompt: 'What are the verified national emergency numbers in India for immediate police, ambulance, poison, and fire rescue?'
  },
  {
    icon: '🧠',
    name: 'Mental Wellbeing',
    prompt: 'I am experiencing extreme workplace burnout and anxiety. How can I reach free 24/7 counseling through Tele-MANAS?'
  },
  {
    icon: '🏥',
    name: 'Health Info',
    prompt: 'What critical red flags in acute chest pain or headache require immediate emergency medical room evaluation?'
  },
  {
    icon: '🏛️',
    name: 'Govt Services',
    prompt: 'How do I legally obtain my documents via DigiLocker and file an RTI application online?'
  }
]

export default function Chat() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])

  const [question, setQuestion] = useState('')
  const [language, setLanguage] = useState('English')
  const [busy, setBusy] = useState(false)
  const [voiceReply, setVoiceReply] = useState(false)
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechErrorNotice, setSpeechErrorNotice] = useState('')
  const recognitionRef = useRef<any>(null)

  // Report Modal state
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportTargetMsgId, setReportTargetMsgId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('Inaccurate legal or factual information')
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)

  // Copied state tracker
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Abort controller ref for stop generating
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // 1. Initial Load of Conversations & Browser Speech Support
  useEffect(() => {
    loadConversations()
    if (typeof window !== 'undefined') {
      const w = window as any
      setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore cleanup error
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  async function loadConversations() {
    try {
      const list = await chatClient.getConversations()
      setConversations(list)
    } catch {
      // Ignore initial load failure in offline mode
    }
  }

  async function selectConversation(id: string) {
    if (busy) return
    setCurrentConversationId(id)
    try {
      const { messages: loadedMessages } = await chatClient.getConversation(id)
      setMessages(loadedMessages)
    } catch {
      setMessages([])
    }
  }

  function startNewChat() {
    if (busy) return
    setCurrentConversationId(null)
    setMessages([])
    setQuestion('')
    textareaRef.current?.focus()
  }

  async function handleDeleteConversation(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    try {
      await chatClient.deleteConversation(id)
      setConversations(c => c.filter(item => item.id !== id))
      if (currentConversationId === id) {
        startNewChat()
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  // 2. Submit Question
  async function handleSend(customText?: string) {
    const textToSend = (customText !== undefined ? customText : question).trim()
    if (!textToSend || busy) return

    setQuestion('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Append optimistic user message
    const tempUserMsgId = 'temp-' + Date.now()
    const userMsgItem: ChatMessageItem = {
      id: tempUserMsgId,
      conversationId: currentConversationId || '',
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMsgItem])
    setBusy(true)

    abortControllerRef.current = new AbortController()

    try {
      const result = await chatClient.sendMessage({
        message: textToSend,
        conversationId: currentConversationId,
        language
      })

      if (result.conversationId && !currentConversationId) {
        setCurrentConversationId(result.conversationId)
        loadConversations()
      }

      const assistantMsgItem: ChatMessageItem = {
        id: result.messageId,
        conversationId: result.conversationId,
        role: 'assistant',
        content: result.answer,
        category: result.category,
        subCategory: result.subCategory,
        urgency: result.urgency,
        isEmergency: result.isEmergency,
        immediateAction: result.immediateAction,
        sources: result.sources,
        followUpSuggestions: result.followUpSuggestions,
        requiresJurisdictionCheck: result.requiresJurisdictionCheck,
        modelUsed: result.modelUsed,
        createdAt: result.timestamp
      }

      setMessages(prev => [...prev, assistantMsgItem])

      // Optional voice read-aloud
      if (voiceReply && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        // Strip markdown characters for voice synthesis
        const cleanSpeech = result.answer.replace(/[*#_`[\]]/g, '').slice(0, 300)
        const utterance = new SpeechSynthesisUtterance(cleanSpeech)
        utterance.lang = language === 'हिन्दी' ? 'hi-IN' : language === 'ਪੰਜਾਬੀ' ? 'pa-IN' : 'en-IN'
        window.speechSynthesis.speak(utterance)
      }
    } catch (err: any) {
      const displayError =
        err?.data?.error ||
        err?.message ||
        'We encountered a temporary delay while connecting to the intelligence server. Please check your network or re-send your message.'
      const errorMsgItem: ChatMessageItem = {
        id: 'error-' + Date.now(),
        conversationId: currentConversationId || '',
        role: 'assistant',
        content: `**System Notice**: ${displayError}`,
        urgency: 'standard',
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMsgItem])
    } finally {
      setBusy(false)
      abortControllerRef.current = null
    }
  }

  // 3. Stop Generating
  function handleStopGenerating() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setBusy(false)
  }

  // 4. Regenerate Latest Response
  async function handleRegenerate() {
    if (busy || messages.length === 0) return
    // Find last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMsg) {
      // Remove last assistant message
      setMessages(prev => {
        const lastIdx = prev.length - 1
        if (lastIdx >= 0 && prev[lastIdx].role === 'assistant') {
          return prev.slice(0, lastIdx)
        }
        return prev
      })
      await handleSend(lastUserMsg.content)
    }
  }

  // 5. Copy Response
  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  // 6. Feedback (Thumbs up / down)
  async function handleFeedback(messageId: string, rating: 1 | -1) {
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, feedback: m.feedback === rating ? null : rating } : m))
    )
    try {
      await chatClient.submitFeedback({
        messageId,
        conversationId: currentConversationId,
        rating
      })
    } catch {
      // ignore
    }
  }

  // 7. Report Modal Submission
  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reportTargetMsgId) return
    try {
      await chatClient.reportMessage({
        messageId: reportTargetMsgId,
        conversationId: currentConversationId,
        reason: reportReason,
        details: reportDetails
      })
      setReportSubmitted(true)
      setTimeout(() => {
        setReportModalOpen(false)
        setReportSubmitted(false)
        setReportTargetMsgId(null)
        setReportDetails('')
      }, 1500)
    } catch {
      setReportModalOpen(false)
    }
  }

  // 8. Speech Recognition (Voice Input)
  async function handleVoiceInput() {
    setSpeechErrorNotice('')
    const w = window as any
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Recognition) {
      setSpeechErrorNotice('Voice speech recognition is not supported in this browser. Please type your message.')
      return
    }

    if (listening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore recognition stop error
        }
      }
      setListening(false)
      return
    }

    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(track => track.stop())
        } catch (permErr: any) {
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setSpeechErrorNotice('Microphone access was denied. Please allow microphone permissions in your browser.')
            return
          }
        }
      }

      const recognition = new Recognition()
      recognitionRef.current = recognition
      recognition.lang = language === 'हिन्दी' ? 'hi-IN' : language === 'ਪੰਜਾਬੀ' ? 'pa-IN' : 'en-IN'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setListening(true)
        setSpeechErrorNotice('')
      }
      recognition.onend = () => {
        setListening(false)
        recognitionRef.current = null
      }
      recognition.onerror = (e: any) => {
        setListening(false)
        recognitionRef.current = null
        if (e.error === 'not-allowed') {
          setSpeechErrorNotice('Microphone permission blocked. Please enable it in browser settings.')
        } else if (e.error === 'no-speech') {
          // user didn't speak
        } else {
          setSpeechErrorNotice(`Speech recognition error: ${e.error || 'unable to capture audio'}`)
        }
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setQuestion(q => (q ? `${q} ${transcript}` : transcript))
      }

      recognition.start()
    } catch {
      setListening(false)
      recognitionRef.current = null
      setSpeechErrorNotice('Unable to start speech recognition. Please check your microphone.')
    }
  }

  // Handle textarea keypress
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQuestion(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
  }

  return (
    <section className="section container" style={{ paddingTop: '28px', paddingBottom: '40px' }}>
      {/* Report Modal */}
      {reportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(16, 26, 51, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '18px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px 28px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
                <Flag size={18} />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#101a33' }}>Report Response</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {reportSubmitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#15803d' }}>
                <Check size={36} style={{ margin: '0 auto 8px' }} />
                <strong>Report Received</strong>
                <p style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  Our safety and compliance team will review this output. Thank you.
                </p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} style={{ marginTop: '16px' }}>
                <label className="field-label" htmlFor="report-reason">
                  Reason for Reporting
                </label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  className="text-input"
                  style={{ fontSize: '12px', padding: '8px 10px' }}
                >
                  <option value="Inaccurate legal or factual information">
                    Inaccurate legal or factual information
                  </option>
                  <option value="Unsafe medical or emergency instructions">
                    Unsafe medical or emergency instructions
                  </option>
                  <option value="Hallucinated law, section, or non-existent statute">
                    Hallucinated statute or non-existent law
                  </option>
                  <option value="Harmful or inappropriate content">Harmful or inappropriate content</option>
                  <option value="Other">Other</option>
                </select>

                <label className="field-label" htmlFor="report-details" style={{ marginTop: '12px' }}>
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="report-details"
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  className="text-input"
                  rows={3}
                  placeholder="Explain what was inaccurate or unsafe..."
                  style={{ fontSize: '12px', padding: '8px 10px' }}
                />

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="button button-ghost button-small"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button button-small" style={{ flex: 1 }}>
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: '20px',
          minHeight: '750px',
          alignItems: 'stretch'
        }}
        className="chat-main-grid"
      >
        {/* Left Sidebar: Conversations & Settings */}
        <aside
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 6px 20px rgba(16, 26, 51, 0.03)'
          }}
        >
          {/* New Chat Button */}
          <button
            type="button"
            onClick={startNewChat}
            disabled={busy}
            className="button"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 14px',
              fontSize: '13px'
            }}
          >
            <Plus size={16} /> New Conversation
          </button>

          {/* Past Conversations List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '1px',
                color: '#94a3b8',
                marginBottom: '4px'
              }}
            >
              RECENT CONVERSATIONS
            </div>

            {conversations.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>
                No saved conversations yet. Start asking below!
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: currentConversationId === conv.id ? 700 : 500,
                    background: currentConversationId === conv.id ? '#f5f0e4' : '#f8fafc',
                    color: currentConversationId === conv.id ? '#876a2c' : '#334155',
                    border: currentConversationId === conv.id ? '1px solid #d5b56b' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <MessageCircle size={14} style={{ flexShrink: 0, color: '#c5a65e' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={e => handleDeleteConversation(e, conv.id)}
                    title="Delete conversation"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Settings & Language */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
            <label className="field-label" htmlFor="chat-lang" style={{ margin: '0 0 6px 0', fontSize: '11px' }}>
              <Globe2 size={14} /> Response Language
            </label>
            <select
              id="chat-lang"
              value={language}
              onChange={e => setLanguage(e.target.value)}
              disabled={busy}
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                padding: '8px 10px',
                fontSize: '12px',
                background: '#fff'
              }}
            >
              {LANGUAGES.map(l => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            {/* Read aloud toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <input
                type="checkbox"
                id="voice-reply-toggle"
                checked={voiceReply}
                onChange={e => setVoiceReply(e.target.checked)}
                style={{ accentColor: '#c5a65e', cursor: 'pointer' }}
              />
              <label htmlFor="voice-reply-toggle" style={{ fontSize: '11px', color: '#64748b', cursor: 'pointer' }}>
                Speak replies aloud
              </label>
            </div>

            {/* Privacy notice */}
            <div
              style={{
                marginTop: '14px',
                padding: '10px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                fontSize: '10px',
                color: '#64748b',
                lineHeight: 1.5
              }}
            >
              <ShieldAlert size={15} style={{ color: '#c5a65e', flexShrink: 0, marginTop: '2px' }} />
              <div>Never enter OTPs, bank passwords, or private biometric numbers in chat.</div>
            </div>
          </div>
        </aside>

        {/* Right Main Chat Panel */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 6px 20px rgba(16, 26, 51, 0.03)',
            overflow: 'hidden'
          }}
        >
          {/* Top Chat Header */}
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #101a33, #26385d)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#f1dca1'
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '14px', color: '#101a33' }}>NayayaMitra AI Intelligence</strong>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      background: '#dcfce7',
                      color: '#15803d',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                    Active Online
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Law • Cybercrime • Healthcare • Crisis • Public Services • Technology
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  background: '#f1f5f9',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Globe2 size={12} /> {language}
              </span>
            </div>
          </div>

          {/* Message Stream Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              background: '#fafbfe'
            }}
          >
            {/* Empty State / Welcome Screen */}
            {messages.length === 0 && (
              <div style={{ margin: 'auto', maxWidth: '640px', textAlign: 'center', padding: '30px 10px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '18px',
                    background: 'linear-gradient(135deg, #101a33, #2b3d63)',
                    color: '#f1dca1',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 16px'
                  }}
                >
                  <Sparkles size={28} />
                </div>
                <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#101a33', margin: '0 0 8px' }}>
                  How can I help you today?
                </h2>
                <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6, margin: '0 auto 28px', maxWidth: '520px' }}>
                  I analyze situations, identify rights, explain court and police procedures, provide medical orientation, and offer instant safety guidance for emergencies.
                </p>

                {/* Suggested Starter Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {QUICK_CATEGORIES.map((cat, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(cat.prompt)}
                      disabled={busy}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#c5a65e'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}>{cat.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: '12px', color: '#101a33' }}>{cat.name}</div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          marginTop: '3px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {cat.prompt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rendered Messages */}
            {messages.map((m, idx) => {
              const isAssistant = m.role === 'assistant'
              const isCritical = m.urgency === 'critical'
              const isUrgent = m.urgency === 'urgent'

              return (
                <div
                  key={m.id || idx}
                  style={{
                    display: 'flex',
                    flexDirection: isAssistant ? 'row' : 'row-reverse',
                    gap: '14px',
                    alignItems: 'flex-start'
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      background: isAssistant ? 'linear-gradient(135deg, #101a33, #273b64)' : '#fef3c7',
                      color: isAssistant ? '#f1dca1' : '#92400e'
                    }}
                  >
                    {isAssistant ? <Bot size={18} /> : <UserRound size={18} />}
                  </div>

                  {/* Bubble Content */}
                  <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column' }}>
                    {/* Header bar on assistant messages */}
                    {isAssistant && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px',
                          flexWrap: 'wrap'
                        }}
                      >
                        {m.category && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              color: '#334155',
                              padding: '2px 8px',
                              borderRadius: '6px'
                            }}
                          >
                            {m.category}
                          </span>
                        )}

                        {isCritical && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              background: '#fee2e2',
                              color: '#b91c1c',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <AlertTriangle size={11} /> IMMEDIATE ACTION REQUIRED
                          </span>
                        )}

                        {isUrgent && !isCritical && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              background: '#fef3c7',
                              color: '#b45309',
                              padding: '2px 8px',
                              borderRadius: '6px'
                            }}
                          >
                            ⚡ URGENT ACTION
                          </span>
                        )}

                        {m.modelUsed && (
                          <span style={{ fontSize: '9px', color: '#94a3b8' }}>
                            via {m.modelUsed}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Immediate Action Banner if Emergency Detected */}
                    {isAssistant && m.immediateAction && (
                      <div
                        style={{
                          background: m.immediateAction.severity === 'critical' ? '#fff1f2' : '#fffbeb',
                          border:
                            m.immediateAction.severity === 'critical'
                              ? '1.5px solid #fda4af'
                              : '1.5px solid #fde68a',
                          borderRadius: '12px',
                          padding: '16px 18px',
                          marginBottom: '14px',
                          color: '#101a33'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 800,
                            fontSize: '13px',
                            color: m.immediateAction.severity === 'critical' ? '#be123c' : '#b45309'
                          }}
                        >
                          <PhoneCall size={16} />
                          <span>{m.immediateAction.title}</span>
                        </div>

                        {/* Directives */}
                        <ul
                          style={{
                            margin: '8px 0 12px 18px',
                            padding: 0,
                            fontSize: '12px',
                            lineHeight: 1.6,
                            color: '#334155'
                          }}
                        >
                          {m.immediateAction.directives.map((dir, i) => (
                            <li key={i} style={{ marginBottom: '4px' }}>
                              {dir}
                            </li>
                          ))}
                        </ul>

                        {/* Verified Emergency Contacts Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '8px',
                            marginTop: '8px'
                          }}
                        >
                          {m.immediateAction.contacts.map((contact, i) => (
                            <div
                              key={i}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '8px 10px'
                              }}
                            >
                              <div style={{ fontSize: '10px', color: '#64748b' }}>{contact.label}</div>
                              <div
                                style={{
                                  fontSize: '15px',
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  marginTop: '2px'
                                }}
                              >
                                {contact.number}
                              </div>
                              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                {contact.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bubble Body */}
                    <div
                      style={{
                        background: isAssistant ? '#ffffff' : '#172747',
                        color: isAssistant ? '#1e293b' : '#ffffff',
                        border: isAssistant ? '1px solid #e2e8f0' : 'none',
                        borderRadius: isAssistant ? '3px 18px 18px 18px' : '18px 3px 18px 18px',
                        padding: '16px 20px',
                        boxShadow: isAssistant ? '0 4px 15px rgba(0,0,0,0.03)' : 'none'
                      }}
                    >
                      {isAssistant ? (
                        <MarkdownView content={m.content} />
                      ) : (
                        <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {m.content}
                        </div>
                      )}
                    </div>

                    {/* Verified Sources list */}
                    {isAssistant && m.sources && m.sources.length > 0 && (
                      <div
                        style={{
                          marginTop: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '10px 14px'
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#475569',
                            marginBottom: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Info size={13} style={{ color: '#b38b39' }} /> Verified Authoritative Sources:
                        </div>
                        <div style={{ display: 'grid', gap: '5px' }}>
                          {m.sources.map((src, i) => (
                            <a
                              key={i}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '11px',
                                color: '#a07b32',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                textDecoration: 'none'
                              }}
                            >
                              <span>{src.title}</span>
                              <ExternalLink size={11} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Follow-up Interactive Suggestion Chips */}
                    {isAssistant && m.followUpSuggestions && m.followUpSuggestions.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          marginTop: '10px'
                        }}
                      >
                        {m.followUpSuggestions.map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSend(sug)}
                            disabled={busy}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '20px',
                              padding: '5px 12px',
                              fontSize: '11px',
                              color: '#334155',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#c5a65e'
                              e.currentTarget.style.color = '#876a2c'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = '#cbd5e1'
                              e.currentTarget.style.color = '#334155'
                            }}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Action Bar (Copy, Thumbs, Report) */}
                    {isAssistant && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginTop: '8px',
                          fontSize: '11px',
                          color: '#94a3b8'
                        }}
                      >
                        {/* Copy button */}
                        <button
                          type="button"
                          onClick={() => handleCopy(m.content, m.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedId === m.id ? '#15803d' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: 0
                          }}
                          title="Copy response"
                        >
                          {copiedId === m.id ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        {/* Thumbs up */}
                        <button
                          type="button"
                          onClick={() => handleFeedback(m.id, 1)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: m.feedback === 1 ? '#15803d' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: 0
                          }}
                          title="Helpful response"
                        >
                          <ThumbsUp size={13} />
                        </button>

                        {/* Thumbs down */}
                        <button
                          type="button"
                          onClick={() => handleFeedback(m.id, -1)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: m.feedback === -1 ? '#dc2626' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: 0
                          }}
                          title="Not helpful"
                        >
                          <ThumbsDown size={13} />
                        </button>

                        {/* Report output */}
                        <button
                          type="button"
                          onClick={() => {
                            setReportTargetMsgId(m.id)
                            setReportModalOpen(true)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: 0
                          }}
                          title="Report inaccurate or unsafe content"
                        >
                          <Flag size={12} />
                          <span>Report</span>
                        </button>

                        {/* Regenerate if latest message */}
                        {idx === messages.length - 1 && (
                          <button
                            type="button"
                            onClick={handleRegenerate}
                            disabled={busy}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0,
                              marginLeft: 'auto'
                            }}
                          >
                            <RotateCcw size={12} />
                            <span>Regenerate</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* In-Flight Generation Indicator */}
            {busy && (
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #101a33, #273b64)',
                    color: '#f1dca1',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  <Bot size={18} />
                </div>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '3px 16px 16px 16px',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: '#475569'
                  }}
                >
                  <LoaderCircle size={16} className="spin" style={{ color: '#c5a65e' }} />
                  <span>Analyzing context, verifying sources & generating structured response...</span>
                  <button
                    type="button"
                    onClick={handleStopGenerating}
                    style={{
                      background: '#fee2e2',
                      border: '1px solid #fca5a5',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      color: '#991b1b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginLeft: '8px'
                    }}
                  >
                    <Square size={10} fill="currentColor" /> Stop
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Multiline Composer */}
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid #f1f5f9',
              background: '#ffffff'
            }}
          >
            {speechErrorNotice && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} />
                  <span>{speechErrorNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSpeechErrorNotice('')}
                  style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', padding: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <form
              onSubmit={e => {
                e.preventDefault()
                handleSend()
              }}
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '10px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '16px',
                padding: '8px 12px',
                background: '#fff',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
              }}
            >
              {/* Mic Speech Button */}
              <button
                type="button"
                onClick={handleVoiceInput}
                disabled={busy}
                title={
                  !speechSupported
                    ? 'Voice input not supported in this browser'
                    : listening
                    ? 'Listening... click to stop'
                    : 'Voice input'
                }
                style={{
                  background: listening ? '#fee2e2' : 'transparent',
                  border: 'none',
                  color: listening ? '#dc2626' : speechSupported ? '#64748b' : '#cbd5e1',
                  cursor: speechSupported ? 'pointer' : 'not-allowed',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  opacity: speechSupported ? 1 : 0.6
                }}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              {/* Multiline Input Textarea */}
              <textarea
                ref={textareaRef}
                value={question}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder={
                  listening
                    ? 'Listening to speech...'
                    : 'Ask anything — legal procedures, cyber fraud, medical orientation, technology...'
                }
                rows={1}
                disabled={busy}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  padding: '8px 4px',
                  resize: 'none',
                  fontFamily: 'inherit',
                  maxHeight: '140px'
                }}
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!question.trim() || busy}
                aria-label="Send message"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  border: 'none',
                  background:
                    question.trim() && !busy
                      ? 'linear-gradient(135deg, #c9a456, #eed99a)'
                      : '#e2e8f0',
                  color: question.trim() && !busy ? '#101a33' : '#94a3b8',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: question.trim() && !busy ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                {busy ? <LoaderCircle size={18} className="spin" /> : <ArrowUp size={18} />}
              </button>
            </form>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#94a3b8',
                marginTop: '8px',
                padding: '0 4px'
              }}
            >
              <span>Press Enter to send, Shift + Enter for new line.</span>
              <span>Always verify high-stakes decisions with official authorities.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
