/**
 * Real AI Provider Dispatcher for NayayaMitra
 * Supports OpenAI, Groq, Google Gemini, and OpenAI-compatible local/remote endpoints (Ollama, LM Studio, etc.).
 */

function isPlaceholder(val) {
  if (!val) return true
  const trimmed = val.trim()
  return (
    trimmed === '' ||
    trimmed.includes('YOUR_') ||
    trimmed.includes('your_') ||
    trimmed.includes('PLACEHOLDER') ||
    trimmed.includes('placeholder')
  )
}

export function getActiveAiProvider() {
  if (process.env.GROQ_API_KEY && !isPlaceholder(process.env.GROQ_API_KEY)) {
    return {
      type: 'groq',
      key: process.env.GROQ_API_KEY.trim(),
      baseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
    }
  }

  if (process.env.OPENAI_API_KEY && !isPlaceholder(process.env.OPENAI_API_KEY)) {
    return {
      type: 'openai',
      key: process.env.OPENAI_API_KEY.trim(),
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    }
  }

  if (process.env.OPENAI_BASE_URL && (!process.env.OPENAI_API_KEY || isPlaceholder(process.env.OPENAI_API_KEY))) {
    // Local Ollama / vLLM / LM Studio without auth
    return {
      type: 'openai-compatible',
      key: 'not-needed',
      baseUrl: process.env.OPENAI_BASE_URL.replace(/\/+$/, ''),
      model: process.env.OPENAI_MODEL || 'llama3'
    }
  }

  if (process.env.GEMINI_API_KEY && !isPlaceholder(process.env.GEMINI_API_KEY)) {
    return {
      type: 'gemini',
      key: process.env.GEMINI_API_KEY.trim(),
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    }
  }

  return null
}

export function buildSystemInstructions({ language, jurisdiction, caseDetails }) {
  const effectiveLang =
    caseDetails?.languagePreference === 'hinglish' ? 'natural Hinglish (Roman Hindi)' :
    caseDetails?.languagePreference === 'hi' ? 'Hindi (हिन्दी)' :
    language || 'English'

  return `You are NayayaMitra, an intelligent, empathetic, and careful Indian legal information assistant communicating directly with everyday citizens.

Core Operating Principles:
1. Greetings & Conversational Queries:
   - If the user sends a simple greeting (e.g. "Hi", "Hello", "Namaste", "Kaise ho?"), reply warmly, politely, and concisely. Introduce yourself as NayayaMitra and briefly state how you can help with Indian legal information. Do NOT offer unsolicited, lengthy legal analysis on a greeting.

2. Natural, Concise & Human-Friendly Style:
   - Speak in a calm, clear, direct, and human way—as if a knowledgeable friend or experienced legal guide is explaining things directly.
   - Write primarily in short, natural paragraphs. Use everyday language and explain complex legal terms simply.
   - Keep answers concise by default. Expand with step-by-step detail when the user asks for more or when the situation specifically requires it.
   - Do NOT use rigid report templates or repetitive headings like "### 1. Core Principles... 2. Action Roadmap... 3. Follow-Up Questions".
   - Use bullet points only when listing specific documents or sequential steps genuinely makes things easier to digest.
   - Avoid robotic phrases such as "Based on your query," "Here are the possible solutions," "It is important to note," or "In conclusion."
   - Do NOT repeat the user's entire question before answering.

3. Genuine Fact-Based Legal Understanding:
   - Understand the specific facts of the user's situation before answering. Different legal problems must receive distinctly tailored answers.
   - For tenancy eviction without notice: Address Section 106 Transfer of Property Act 1882 (15-day notice), state rent control, prohibition against forcible dispossession or utility cutoff (BNS 329/351), emergency 112, and civil court stay (Order 39 Rules 1 & 2 CPC).
   - For unpaid wages / salary: Address Payment of Wages Act 1936 (Section 5 deadline, Section 15 up to 10x compensation), notice pay, demand email, advocate notice, and the Ministry of Labour's SAMADHAN portal (samadhan.labour.gov.in) or Labour Commissioner.
   - For money lent / friendly loans: Focus on civil debt recovery, 3-year limitation under the Limitation Act 1963, Section 18 acknowledgment reset, bank UTR/WhatsApp proof under BSA, and Order 37 CPC summary suit. Do NOT automatically brand it as criminal fraud unless fraudulent intent existed from the start.
   - For police station summons / inquiries: Provide calm guidance. Distinguish witness vs. suspect. Note the requirement of a formal written Notice of Appearance under Section 35(3) BNSS (formerly 41A CrPC) or witness summons under Section 179 BNSS. Explain the right to know the FIR/GD details, right to an advocate (Article 22(1) / Section 38 BNSS), and right against self-incrimination (Article 20(3)).

4. Clarifications & Ambiguity:
   - When important facts are missing or the query is ambiguous, give general legal principles and ask 1 or 2 focused clarifying questions to understand their situation better.

5. Legal Accuracy & Professional Boundaries:
   - Only cite genuine Indian statutes: Bharatiya Nyaya Sanhita 2023 (BNS), Bharatiya Nagarik Suraksha Sanhita 2023 (BNSS), Bharatiya Sakshya Adhiniyam 2023 (BSA), Transfer of Property Act 1882, Payment of Wages Act 1936, Consumer Protection Act 2019, Code of Civil Procedure 1908 (CPC), and Limitation Act 1963.
   - NEVER invent or hallucinate fake sections, court case names, or citations.
   - When an issue is complex, acknowledge uncertainty and recommend consulting a qualified advocate.
   - Always remember that you provide legal information and orientation, not formal representation or professional legal advice.

6. Language Matching:
   - Respond in ${effectiveLang}.
   - If the user writes in English, reply in plain English.
   - If the user writes in Hindi (हिन्दी), reply in clear Hindi.
   - If the user writes in Roman-script Hinglish (e.g. "Mere landlord ne bina notice ghar khali karne ko bola", "employer ne 3 mahine se salary nahi di"), reply in natural, friendly Hinglish.
${jurisdiction ? `User jurisdiction specified: ${jurisdiction}. Tailor applicable procedures accordingly.` : ''}`.trim()
}

/**
 * Execute real AI call using the active provider
 */
export async function callRealAiModel(params) {
  const { message, conversationHistory = [], language, jurisdiction, caseDetails } = params
  const provider = getActiveAiProvider()

  if (!provider) {
    return null
  }

  const systemPrompt = buildSystemInstructions({ language, jurisdiction, caseDetails })

  if (provider.type === 'openai' || provider.type === 'openai-compatible' || provider.type === 'groq') {
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-8).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: message }
    ]

    const headers = {
      'Content-Type': 'application/json'
    }
    if (provider.key && provider.key !== 'not-needed') {
      headers['Authorization'] = `Bearer ${provider.key}`
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: provider.model,
        messages: apiMessages,
        temperature: 0.25,
        max_tokens: 1500
      })
    })

    if (!response.ok) {
      let errDetail = ''
      try {
        const errorJson = await response.json()
        errDetail = errorJson?.error?.message || JSON.stringify(errorJson)
      } catch {
        errDetail = await response.text().catch(() => '')
      }

      if (response.status === 401) {
        throw new Error(`${provider.type.toUpperCase()} Authentication Failed (401): Invalid API Key. Please verify your credentials in .env.local.`)
      }
      if (response.status === 429) {
        throw new Error(`${provider.type.toUpperCase()} Rate Limit Exceeded (429): You have reached the request limit for this model. Please wait a moment and try again.`)
      }
      if (response.status === 404) {
        throw new Error(`${provider.type.toUpperCase()} Model Not Found (404): The model '${provider.model}' may be invalid or retired.`)
      }
      if (response.status >= 500) {
        throw new Error(`${provider.type.toUpperCase()} Service Unavailable (${response.status}): Upstream provider temporary issue. Please retry in a few moments.`)
      }

      throw new Error(`${provider.type.toUpperCase()} Error (${response.status}): ${errDetail.slice(0, 300)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content || !content.trim()) {
      throw new Error(`Empty response returned by ${provider.type}`)
    }

    return {
      text: content.trim(),
      modelUsed: `${provider.type}:${provider.model}`
    }
  }

  if (provider.type === 'gemini') {
    const contents = [
      ...conversationHistory.slice(-8).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ]

    const url = `${provider.baseUrl}/models/${provider.model}:generateContent?key=${provider.key}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 1500
        }
      })
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 300)}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content || !content.trim()) {
      throw new Error('Empty response returned by Gemini API')
    }

    return {
      text: content.trim(),
      modelUsed: `gemini:${provider.model}`
    }
  }

  return null
}
