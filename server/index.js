import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import multer from 'multer'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { authRouter } from './routes/authRoutes.js'
import { chatRouter } from './routes/chatRoutes.js'
import { verifySessionToken } from './services/authService.js'
import { getActiveAiProvider } from './services/aiProvider.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env.local or .env
const envLocal = path.resolve(process.cwd(), '.env.local')
const envDefault = path.resolve(process.cwd(), '.env')
try {
  if (fs.existsSync(envLocal)) process.loadEnvFile(envLocal)
  else if (fs.existsSync(envDefault)) process.loadEnvFile(envDefault)
} catch (e) {
  console.warn('[Server] Could not load env file:', e.message)
}

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Setup uploads directory
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
app.use('/uploads', express.static(uploadsDir))

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const bucket = req.params.bucket || 'general'
    const targetDir = path.join(uploadsDir, bucket)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    cb(null, targetDir)
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${crypto.randomUUID()}-${safeName}`)
  }
})
const upload = multer({ storage })

// Helpers
function getAuthUser(req) {
  const authHeader = req.headers.authorization
  const rawToken = req.headers['x-user-id'] || (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null)

  if (!rawToken || rawToken === 'null' || rawToken === 'undefined') {
    return null
  }

  // 1. Try JWT verification
  const decoded = verifySessionToken(rawToken)
  let effectiveId = decoded?.userId || null

  // 2. Try user_sessions database table lookup if rawToken is a session UUID/token
  if (!effectiveId) {
    const dbSession = db.prepare('SELECT user_id, expires_at FROM user_sessions WHERE token = ?').get(rawToken)
    if (dbSession && new Date(dbSession.expires_at) > new Date()) {
      effectiveId = dbSession.user_id
    }
  }

  // 3. Match explicit UUID for direct ID lookup if valid format
  if (!effectiveId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawToken)) {
    effectiveId = rawToken
  }

  if (!effectiveId) {
    return null
  }

  // Check users table
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(effectiveId)
  if (user) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone_number,
      full_name: user.full_name,
      role: user.role || 'user',
      email_verified: Boolean(user.email_verified),
      phone_verified: Boolean(user.phone_verified),
      created_at: user.created_at
    }
  }

  // Check profiles table
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(effectiveId)
  if (profile) return profile

  // Never fall back to a fake or admin user
  return null
}

// -------------------------------------------------------------
// 1. DUAL-VERIFICATION SECURE AUTH SYSTEM ROUTER
// -------------------------------------------------------------
app.use('/api/auth', authRouter)

// -------------------------------------------------------------
// 2. AUTHENTICATION & ROLE MANAGEMENT
// -------------------------------------------------------------
app.get('/api/auth/user', (req, res) => {
  const user = getAuthUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthenticated', user: null })
  }
  res.json({ user })
})

app.post('/api/auth/role', (req, res) => {
  const caller = getAuthUser(req)
  if (!caller || caller.role !== 'admin') {
    return res.status(403).json({ error: 'Admin authorization required to modify user roles' })
  }

  const { role, userId } = req.body
  if (!role || !userId) {
    return res.status(400).json({ error: 'role and userId are required' })
  }

  if (!['user', 'advocate', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role specified' })
  }

  db.prepare('UPDATE users SET role = ?, updated_at = datetime("now") WHERE id = ?').run(role, userId)
  db.prepare('UPDATE profiles SET role = ?, updated_at = datetime("now") WHERE id = ?').run(role, userId)
  const updated = db.prepare('SELECT id, full_name, email, role FROM users WHERE id = ?').get(userId)
  res.json({ ok: true, user: updated })
})

// -------------------------------------------------------------
// 2. ADVOCATE DIRECTORY & APPLICATIONS
// -------------------------------------------------------------
app.get('/api/advocates', (req, res) => {
  const rows = db.prepare("SELECT * FROM advocate_profiles WHERE verification_status = 'approved' ORDER BY display_name").all()
  const mapped = rows.map(r => ({
    ...r,
    practice_areas: JSON.parse(r.practice_areas || '[]')
  }))
  res.json(mapped)
})

app.post('/api/advocates/apply', upload.fields([{ name: 'bar_certificate' }, { name: 'law_degree' }]), (req, res) => {
  const user = getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Sign in before submitting an application' })

  const { display_name, email, city, practice_areas } = req.body
  const barFile = req.files?.bar_certificate?.[0]
  const degreeFile = req.files?.law_degree?.[0]

  if (!barFile || !degreeFile) {
    return res.status(400).json({ error: 'Both bar certificate and law degree documents are required.' })
  }

  const id = crypto.randomUUID()
  const areas = typeof practice_areas === 'string' ? practice_areas.split(',').map(s => s.trim()).filter(Boolean) : (practice_areas || [])

  db.prepare(`
    INSERT INTO advocate_applications (id, user_id, display_name, email, city, practice_areas, bar_certificate_path, law_degree_path, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, user.id, display_name, email, city, JSON.stringify(areas), barFile.path, degreeFile.path)

  res.json({ ok: true, message: 'Application submitted for admin review.', applicationId: id })
})

// -------------------------------------------------------------
// 3. STORAGE UPLOAD
// -------------------------------------------------------------
app.post('/api/storage/upload/:bucket', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const relativePath = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/')
  res.json({ data: { path: relativePath }, error: null })
})

// -------------------------------------------------------------
// 4. PLANS & PAYMENTS
// -------------------------------------------------------------
app.get('/api/plans', (req, res) => {
  const plans = db.prepare('SELECT * FROM subscription_plans WHERE active = 1').all()
  res.json(plans)
})

app.post('/api/payments/claim', (req, res) => {
  const user = getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Please sign in first' })

  const { plan_id, upi_reference, proof_path } = req.body
  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ? AND active = 1').get(plan_id)
  if (!plan) return res.status(400).json({ error: 'Invalid subscription plan selected' })

  const ref = (upi_reference || '').trim()
  if (ref.length < 8 || ref.length > 40) {
    return res.status(400).json({ error: 'Valid UTR / transaction reference number required (8-40 chars)' })
  }

  const id = crypto.randomUUID()
  const idempotencyKey = crypto.randomUUID()

  db.prepare(`
    INSERT INTO subscription_payments (id, user_id, plan_id, amount_inr, method, status, upi_reference, proof_path, idempotency_key)
    VALUES (?, ?, ?, ?, 'upi_manual', 'submitted', ?, ?, ?)
  `).run(id, user.id, plan_id, plan.amount_inr, ref, proof_path || null, idempotencyKey)

  res.json({ ok: true, message: 'Payment claim submitted for owner verification.', paymentId: id })
})

app.get('/api/admin/payments', (req, res) => {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Owner admin access required' })
  }

  const rows = db.prepare("SELECT * FROM subscription_payments WHERE status = 'submitted' ORDER BY created_at ASC").all()
  res.json(rows)
})

app.post('/api/admin/review', (req, res) => {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Owner admin access required' })
  }

  const { payment_id, decision, note } = req.body
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be approve or reject' })
  }

  const payment = db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(payment_id)
  if (!payment) return res.status(404).json({ error: 'Payment record not found' })

  const now = new Date().toISOString()

  if (decision === 'approve') {
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(payment.plan_id)
    const months = plan ? plan.duration_months : 1

    const endsDate = new Date()
    endsDate.setMonth(endsDate.getMonth() + months)

    db.prepare(`
      UPDATE subscription_payments
      SET status = 'verified', verified_by = ?, verified_at = ?, review_note = ?
      WHERE id = ?
    `).run(user.id, now, note || 'Payment verified by owner', payment_id)

    const subId = crypto.randomUUID()
    db.prepare(`
      INSERT INTO advocate_subscriptions (id, user_id, payment_id, starts_at, ends_at, active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(payment_id) DO UPDATE SET active = 1, ends_at = excluded.ends_at
    `).run(subId, payment.user_id, payment.id, now, endsDate.toISOString())

    // Also upgrade user role to advocate in both tables if not already admin
    db.prepare("UPDATE profiles SET role = 'advocate' WHERE id = ? AND role != 'admin'").run(payment.user_id)
    db.prepare("UPDATE users SET role = 'advocate', updated_at = datetime('now') WHERE id = ? AND role != 'admin'").run(payment.user_id)
  } else {
    if (!note || note.trim().length < 4) {
      return res.status(400).json({ error: 'Rejection reason must be at least 4 characters' })
    }
    db.prepare(`
      UPDATE subscription_payments
      SET status = 'rejected', verified_by = ?, verified_at = ?, review_note = ?
      WHERE id = ?
    `).run(user.id, now, note.trim(), payment_id)
  }

  // Audit event
  db.prepare(`
    INSERT INTO audit_events (id, actor_id, action, target_type, target_id, metadata)
    VALUES (?, ?, ?, 'subscription_payment', ?, ?)
  `).run(crypto.randomUUID(), user.id, `payment_${decision}`, payment_id, JSON.stringify({ note }))

  res.json({ ok: true, status: decision === 'approve' ? 'verified' : 'rejected' })
})

app.get('/api/subscriptions/active', (req, res) => {
  const user = getAuthUser(req)
  if (!user) return res.status(401).json({ active: false, role: null, error: 'Authentication required' })

  if (user.role === 'admin') {
    return res.json({
      active: true,
      role: 'admin',
      subscription: { plan_id: 'admin_pass', active: 1, ends_at: '2099-12-31T23:59:59.999Z' }
    })
  }

  const now = new Date().toISOString()
  const sub = db.prepare(`
    SELECT * FROM advocate_subscriptions
    WHERE user_id = ? AND active = 1 AND ends_at > ?
    ORDER BY ends_at DESC LIMIT 1
  `).get(user.id, now)

  res.json({
    active: Boolean(sub),
    role: user.role,
    subscription: sub || null
  })
})

// -------------------------------------------------------------
// 5. INTELLIGENT MULTI-DOMAIN AI CHATBOT ROUTER
// -------------------------------------------------------------
app.use('/api/chat', chatRouter)

function generateLegalDraft(kind, language, facts, relief) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const factLines = facts.split('\n').filter(Boolean).map((line, idx) => `   ${idx + 1}. ${line}`).join('\n\n')

  if (kind.includes('138') || kind.toLowerCase().includes('cheque')) {
    return `LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881
(FOR DISHONOUR OF CHEQUE FOR INSUFFICIENT FUNDS)

REGISTERED A.D. / SPEED POST / COURIER & EMAIL

Date: ${today}
Place: New Delhi / [Jurisdiction]

TO:
1. [Name of Drawer / Accused / Company Director]
   [Registered Office / Residential Address Line 1]
   [Address Line 2, City, State, PIN Code]

FROM:
[Name of Payee / Complainant]
Through Counsel: [Advocate Name, Enrolment No. D/1428/2012]
Chamber No. [Chamber Address, High Court / District Courts Complex]

SUBJECT: STATUTORY DEMAND NOTICE UNDER CLAUSE (B) OF PROVISO TO SECTION 138 READ WITH SECTION 141 & 142 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881 (AS AMENDED UP TO DATE)

Sir / Madam,

Under instructions from and on behalf of my client [Name of Payee], I hereby serve upon you this Statutory Legal Notice as follows:

1. That my client is an individual/entity engaged in lawful business, having office/residence at [Client Address].

2. That in discharge of your legally enforceable debt and liability toward my client, you issued the following cheque:
   - Cheque Number: [e.g. 445821]
   - Dated: [Date of Cheque]
   - Drawn on: [Bank Name & Branch]
   - Amount: Rs. [Cheque Amount] (Rupees [Amount in Words] only).

3. CHRONOLOGY OF FACTS:
${factLines}

4. That my client presented the said cheque for encashment through their banker, but to their utter shock, the said cheque was returned unpaid and dishonoured by the bank with Return Memo dated [Date of Memo] bearing remarks: "FUNDS INSUFFICIENT" / "EXCEEDS ARRANGEMENT".

5. That the receipt of the cheque return memo constitutes commission of a cognizable offence under Section 138 of the Negotiable Instruments Act, 1881.

6. DEMAND AND STATUTORY 15-DAY NOTICE:
${relief ? `My client demands: ${relief}` : `My client hereby calls upon you to pay the full cheque amount along with 18% p.a. interest within 15 (fifteen) days from the receipt of this notice.`}

7. Take notice that if you fail to remit the aforesaid payment within 15 days of the receipt of this notice, my client shall be constrained to initiate criminal proceedings against you under Section 138/142 of the Negotiable Instruments Act, 1881 and Section 318(4) of Bharatiya Nyaya Sanhita, 2023, wherein you shall be liable for imprisonment up to 2 years and fine up to twice the amount of the cheque, entirely at your risk, costs and consequences.

Yours faithfully,

_____________________________
[Advocate Signature]
Advocate for the Complainant`
  }

  if (kind.toLowerCase().includes('consumer')) {
    return `BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION
AT [DISTRICT / CITY NAME, STATE]

CONSUMER COMPLAINT NO. ______ / 2026
UNDER SECTION 35 OF THE CONSUMER PROTECTION ACT, 2019

IN THE MATTER OF:
[Complainant Full Name]
Residing at [Residential Address]
                                                      ... COMPLAINANT
VERSUS
[Opposite Party / Company Name]
Having Registered Office at [Corporate Address]
Through its Managing Director / Principal Officer
                                                      ... OPPOSITE PARTY

MEMORANDUM OF COMPLAINT UNDER SECTION 35 OF THE CONSUMER PROTECTION ACT, 2019

MOST RESPECTFULLY SHOWETH:

1. PARTIES:
That the Complainant is a "Consumer" within the meaning of Section 2(7) of the Consumer Protection Act, 2019, having purchased goods / availed services from the Opposite Party for valuable consideration.

2. JURISDICTION:
That this Hon'ble District Commission has pecuniary and territorial jurisdiction to entertain this complaint as the value of goods/services and compensation claimed does not exceed statutory limits, and the transaction took place within the territorial limits of this Commission.

3. STATEMENT OF FACTS & CHRONOLOGY:
${factLines}

4. DEFICIENCY IN SERVICE AND UNFAIR TRADE PRACTICE:
That the acts and omissions of the Opposite Party constitute gross "Deficiency in Service" under Section 2(11) and "Unfair Trade Practice" under Section 2(47) of the Consumer Protection Act, 2019, causing severe financial loss and mental harassment to the Complainant.

5. PRAYER / RELIEF SOUGHT:
In the premises aforesaid, the Complainant most respectfully prays that this Hon'ble Commission may be pleased to:
   (a) Direct the Opposite Party to: ${relief || 'refund the entire consideration amount paid along with 12% interest per annum;'};
   (b) Award a sum of Rs. 1,00,000/- toward compensation for mental agony, distress and harassment;
   (c) Award litigation costs of Rs. 25,000/- in favor of the Complainant;
   (d) Pass such other and further order(s) as this Hon'ble Commission may deem fit in the interest of justice.

DATED: ${today}
PLACE: [City Name]

COMPLAINANT
THROUGH COUNSEL:

_____________________________
[Advocate Name, Enrolment No.]
Counsel for the Complainant

VERIFICATION:
I, the Complainant above named, do hereby verify that the contents of paragraphs 1 to 5 are true to my knowledge and belief. Verified at [City] on this ${today}.

DEPONENT / COMPLAINANT`
  }

  if (kind.toLowerCase().includes('police') || kind.toLowerCase().includes('cyber')) {
    return `APPLICATION FOR REGISTRATION OF FIRST INFORMATION REPORT (FIR)
FOR OFFENCES UNDER SECTION 66D OF THE INFORMATION TECHNOLOGY ACT, 2000
AND SECTION 318(4) OF THE BHARATIYA NYAYA SANHITA, 2023 (INDIAN PENAL CODE SECTION 420)

Date: ${today}
To,
The Station House Officer (SHO) /
The Officer-in-Charge, Cyber Crime Police Station,
[Police Station Name / District, City, State]

SUBJECT: COMPLAINT AGAINST UNKNOWN ACCUSED PERSONS FOR COMMITTING CYBER FINANCIAL FRAUD, IMPERSONATION, CHEATING, AND ILLEGAL TRANSFER OF FUNDS.

Respected Sir / Madam,

I, [Complainant Full Name], residing at [Address], Mobile: [Mobile Number], Email: [Email], hereby submit this formal complaint:

1. STATEMENT OF INCIDENT AND SEQUENCE OF EVENTS:
${factLines}

2. TRANSACTION & FRAUDULENT BENEFICIARY DETAILS:
   - Date & Time of Debit: [Date & Time]
   - Amount Debited: Rs. [Amount]
   - Mode: UPI / IMPS / Net Banking
   - UTR / Transaction Reference No: [UTR Number]
   - Beneficiary Account / UPI ID: [Suspect Account / UPI ID]

3. PRAYER FOR IMMEDIATE POLICE ACTION:
${relief ? `Relief demanded: ${relief}` : `I earnestly request you to:
   (a) Register an FIR under Section 66D IT Act and Section 318(4) BNS / IPC 420;
   (b) Direct the nodal officer of the beneficiary bank under Section 106 BNSS to immediately freeze the beneficiary account to prevent siphoning of stolen funds;
   (c) Trace the IP address and call logs of the accused;
   (d) Aid in restitution of the fraudulently debited amount to my account.`}

Enclosures: Bank statement, transaction screenshot, WhatsApp / SMS chat records.

Yours faithfully,

_____________________________
[Complainant Signature & Name]
Mobile: [Mobile Number]`
  }

  if (kind.toLowerCase().includes('eviction') || kind.toLowerCase().includes('tenant')) {
    return `NOTICE FOR TERMINATION OF MONTH-TO-MONTH TENANCY AND VACATION OF PREMISES
UNDER SECTION 106 OF THE TRANSFER OF PROPERTY ACT, 1882

REGISTERED A.D. / SPEED POST
Date: ${today}

TO:
[Name of Tenant / Occupant]
Tenant in occupation of [Tenancy Property Address]

FROM:
[Name of Landlord / Property Owner]
Through Counsel: [Advocate Name, Enrolment Number]
Office: [Chamber / Office Address]

SUBJECT: LEGAL NOTICE TERMINATING TENANCY UNDER SECTION 106 OF THE TRANSFER OF PROPERTY ACT, 1882 AND DEMAND FOR VACANT POSSESSION AND ARREARS.

Sir / Madam,

Under instructions from my client [Landlord Name], I state as follows:

1. That my client is the absolute lawful owner and landlord of the premises situated at [Tenancy Property Address].

2. That you were inducted as a monthly tenant at an agreed rent of Rs. [Monthly Rent] per month, excluding electricity and water charges.

3. FACTS AND CAUSE FOR NOTICE:
${factLines}

4. TERMINATION OF LEASE:
That by virtue of this Notice, my client hereby DETERMINES AND TERMINATES your tenancy with effect from 15 days following the receipt of this notice.

5. DEMAND:
${relief ? relief : 'You are hereby called upon to quit, vacate and deliver peaceful vacant possession of the premises to my client, and clear all outstanding rent arrears within 15 days.'}

6. In default, my client shall initiate eviction proceedings under the relevant Rent Control Act and suit for mesne profits and damages at Rs. 2,000/- per day of unauthorized occupation, at your entire risk and cost.

Yours faithfully,

_____________________________
[Advocate Signature]
Advocate for the Landlord`
  }

  // General Legal Notice / Representation
  return `LEGAL NOTICE / FORMAL WRITTEN REPRESENTATION
REGISTERED POST A.D. / SPEED POST / COURIER

Date: ${today}
Place: [City / Jurisdiction]

TO:
1. [Name of Opposite Party / Addressee]
   [Address Line 1]
   [Address Line 2, City, State, PIN Code]

FROM:
[Name of Client / Claimant]
Through Counsel: [Advocate Name & Enrolment Number]
Chamber / Office: [Advocate Office Address]

SUBJECT: LEGAL NOTICE IN RESPECT OF: ${kind.toUpperCase()}

Sir / Madam,

Under instructions from and on behalf of my client named above, I hereby address you as follows:

1. PRELIMINARY STATEMENT:
That my client is a bona fide citizen / commercial entity entitled to statutory rights and protections under Indian law.

2. STATEMENT OF FACTS AND TIMELINE:
${factLines}

3. STATUTORY GRIEVANCE:
That your failure, inaction, and breaches constitute a direct violation of enforceable covenants and statutory duties under Indian law, causing severe prejudice and loss to my client.

4. DEMAND / COMPLIANCE SOUGHT:
${relief ? `My client demands that you immediately: ${relief}` : 'My client hereby demands immediate redressal of the grievance, fulfillment of contractual commitments, and compensation for damages incurred.'}

5. NOTICE PERIOD:
You are granted a period of 15 (fifteen) days from the receipt of this notice to comply with the demands set out herein. Failure to comply shall leave my client with no option but to file civil and/or criminal proceedings before the competent court of jurisdiction, holding you liable for all legal costs and consequences.

A copy of this notice is preserved in my office for evidence and future court proceedings.

Sincerely,

_____________________________
[Advocate Signature]
[Advocate Name, Enrolment No.]
Advocate for the Claimant`
}

app.post('/api/draft', async (req, res) => {
  const user = getAuthUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' })
  }

  if (user.role !== 'advocate' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted: Legal case drafting is exclusively available to verified advocates.' })
  }

  // If advocate, verify active subscription in database
  if (user.role === 'advocate') {
    const now = new Date().toISOString()
    const activeSub = db.prepare(`
      SELECT * FROM advocate_subscriptions
      WHERE user_id = ? AND active = 1 AND ends_at > ?
      LIMIT 1
    `).get(user.id, now)

    if (!activeSub) {
      return res.status(403).json({
        error: 'Active advocate subscription required to generate legal drafts.',
        subscriptionRequired: true
      })
    }
  }

  const { kind = 'Legal notice / reply', language = 'English', facts = '', relief = '' } = req.body
  if (!facts.trim()) return res.status(400).json({ error: 'Facts are required' })

  // Use configured server AI provider (Groq / OpenAI / etc.)
  const provider = getActiveAiProvider()
  if (provider && (provider.type === 'groq' || provider.type === 'openai' || provider.type === 'openai-compatible')) {
    try {
      const instructions = `You are a Senior Indian Advocate. Prepare a formal, complete, structured legal draft in Indian law. Document type: ${kind}. Desired outcome: ${relief}. Facts: ${facts}. Language: ${language}. Include title, parties, jurisdiction, chronological numbered paragraphs, statutory references (Acts/Sections), clear demands/prayers, verification, date/place placeholders, and advocate signature block. Do not hallucinate fake citations.`
      const aiRes = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: 'Generate the complete formal draft now.' }
          ],
          temperature: 0.3
        })
      })
      if (aiRes.ok) {
        const data = await aiRes.json()
        const draft = data.choices?.[0]?.message?.content
        if (draft) return res.json({ draft })
      }
    } catch (err) {
      console.error('AI draft generation error:', err)
    }
  }

  // Fallback to specialized structured legal draft generator
  const draft = generateLegalDraft(kind, language, facts, relief)
  res.json({ draft })
})

// -------------------------------------------------------------
// 6. SAVED CASES ENDPOINTS (STRICT ADVOCATE AUTHORIZATION)
// -------------------------------------------------------------
app.get('/api/cases', (req, res) => {
  const user = getAuthUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' })
  }

  if (user.role !== 'advocate' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to verified advocate accounts.' })
  }

  // If advocate, verify active subscription in database
  if (user.role === 'advocate') {
    const now = new Date().toISOString()
    const activeSub = db.prepare(`
      SELECT * FROM advocate_subscriptions
      WHERE user_id = ? AND active = 1 AND ends_at > ?
      LIMIT 1
    `).get(user.id, now)

    if (!activeSub) {
      return res.status(403).json({
        error: 'Active advocate subscription required.',
        subscriptionRequired: true
      })
    }
  }

  const rows = db.prepare('SELECT * FROM saved_cases WHERE user_id = ? ORDER BY created_at DESC').all(user.id)
  res.json(rows)
})

app.post('/api/cases', (req, res) => {
  const user = getAuthUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' })
  }

  if (user.role !== 'advocate' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to verified advocate accounts.' })
  }

  if (user.role === 'advocate') {
    const now = new Date().toISOString()
    const activeSub = db.prepare(`
      SELECT * FROM advocate_subscriptions
      WHERE user_id = ? AND active = 1 AND ends_at > ?
      LIMIT 1
    `).get(user.id, now)

    if (!activeSub) {
      return res.status(403).json({
        error: 'Active advocate subscription required to create and save cases.',
        subscriptionRequired: true
      })
    }
  }

  const { title, case_type, client_name, status, facts, relief, draft_content } = req.body
  const id = req.body.id || crypto.randomUUID()

  db.prepare(`
    INSERT INTO saved_cases (id, user_id, title, case_type, client_name, status, facts, relief, draft_content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      case_type = excluded.case_type,
      client_name = excluded.client_name,
      status = excluded.status,
      facts = excluded.facts,
      relief = excluded.relief,
      draft_content = excluded.draft_content
  `).run(id, user.id, title || 'New Matter', case_type || 'General Legal Notice', client_name || 'Client', status || 'Active', facts || '', relief || '', draft_content || '')

  res.json({ ok: true, caseId: id })
})

app.delete('/api/cases/:id', (req, res) => {
  const user = getAuthUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' })
  }

  if (user.role !== 'advocate' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to verified advocate accounts.' })
  }

  if (user.role === 'admin') {
    db.prepare('DELETE FROM saved_cases WHERE id = ?').run(req.params.id)
  } else {
    db.prepare('DELETE FROM saved_cases WHERE id = ? AND user_id = ?').run(req.params.id, user.id)
  }
  res.json({ ok: true })
})

// -------------------------------------------------------------
// 6. COMPATIBILITY HANDLERS FOR SUPABASE JS CLIENT
// -------------------------------------------------------------
app.all('/api/rest/v1/:table', (req, res) => {
  const table = req.params.table
  const method = req.method

  if (method === 'GET') {
    let sql = `SELECT * FROM ${table}`
    const where = []
    const params = []

    for (const [key, val] of Object.entries(req.query)) {
      if (key === 'select' || key === 'order' || key === 'limit') continue
      // handle eq. filters e.g. status=eq.submitted
      const cleanVal = String(val).replace(/^eq\./, '')
      where.push(`${key} = ?`)
      params.push(cleanVal)
    }

    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`
    }

    try {
      const rows = db.prepare(sql).all(...params)
      // JSON fields parsing
      const mapped = rows.map(r => {
        if (r.practice_areas && typeof r.practice_areas === 'string' && r.practice_areas.startsWith('[')) {
          return { ...r, practice_areas: JSON.parse(r.practice_areas) }
        }
        return r
      })
      res.json(mapped)
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  } else if (method === 'POST') {
    const data = req.body
    const keys = Object.keys(data)
    const placeholders = keys.map(() => '?').join(', ')
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`
    try {
      db.prepare(sql).run(...Object.values(data))
      res.json({ data, error: null })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  } else {
    res.status(405).json({ error: 'Method not supported' })
  }
})

app.post('/api/rpc/:functionName', (req, res) => {
  const fn = req.params.functionName
  if (fn === 'admin_review_payment') {
    const { p_payment_id, p_decision, p_note } = req.body
    // forward to review endpoint
    req.body = { payment_id: p_payment_id, decision: p_decision, note: p_note }
    return app._router.handle({ ...req, url: '/api/admin/review', method: 'POST' }, res)
  }
  res.status(404).json({ error: `Function ${fn} not found` })
})

export const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NayayaMitra Backend] Server listening on http://localhost:${PORT}`)
})

export { app }
export default app
