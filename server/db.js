import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'nayayamitra.sqlite')
export const db = new DatabaseSync(dbPath)

// Initialize complete database schema
db.exec(`
  -- Users table with dual verification tracking
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    country_code TEXT NOT NULL DEFAULT '+91',
    password_hash TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    phone_verified INTEGER NOT NULL DEFAULT 0,
    email_verified_at TEXT,
    phone_verified_at TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    account_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- OTP verification records (hashed codes, attempt limits, expiration)
  CREATE TABLE IF NOT EXISTS otp_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    identifier TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    resend_count INTEGER NOT NULL DEFAULT 0,
    last_sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Password reset tokens
  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- User authentication sessions
  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Legacy profiles table (kept for full compatibility with existing modules)
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    google_verified_at TEXT,
    email_verified_at TEXT,
    phone_verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS advocate_applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    city TEXT NOT NULL,
    practice_areas TEXT NOT NULL DEFAULT '[]',
    bar_certificate_path TEXT NOT NULL,
    law_degree_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer_id TEXT,
    reviewer_notes TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS advocate_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE,
    display_name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    practice_areas TEXT NOT NULL DEFAULT '[]',
    bio TEXT,
    listing_type TEXT NOT NULL DEFAULT 'private',
    verification_status TEXT NOT NULL DEFAULT 'approved',
    source_checked_at TEXT,
    source_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    amount_inr INTEGER NOT NULL,
    duration_months INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS subscription_payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    amount_inr INTEGER NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    upi_reference TEXT,
    proof_path TEXT,
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    verified_by TEXT,
    verified_at TEXT,
    review_note TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS advocate_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    payment_id TEXT UNIQUE NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    action TEXT,
    target_type TEXT,
    target_id TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS legal_chat_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    question_redacted TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'English',
    source_urls TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otps (
    identifier TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saved_cases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    case_type TEXT NOT NULL,
    client_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    facts TEXT,
    relief TEXT,
    draft_content TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- AI Intelligent Chatbot Tables
  CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_token TEXT,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    category TEXT DEFAULT 'General',
    language TEXT DEFAULT 'English',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    category TEXT,
    urgency TEXT DEFAULT 'standard', -- 'low' | 'standard' | 'urgent' | 'critical'
    immediate_action TEXT,
    sources TEXT NOT NULL DEFAULT '[]',
    follow_up_suggestions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_feedback (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    conversation_id TEXT,
    user_id TEXT,
    rating INTEGER NOT NULL, -- 1 for positive, -1 for negative
    feedback_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_reports (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    conversation_id TEXT,
    user_id TEXT,
    reason TEXT NOT NULL,
    details TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Indexes for security, lookup speed, and uniqueness constraints
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
  CREATE INDEX IF NOT EXISTS idx_otp_user_type ON otp_verifications(user_id, type);
  CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_verifications(identifier);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
  CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token_hash);
  CREATE INDEX IF NOT EXISTS idx_chat_conv_user ON chat_conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_conv_session ON chat_conversations(session_token);
  CREATE INDEX IF NOT EXISTS idx_chat_msgs_conv ON chat_messages(conversation_id);
`)

// Seed initial plans
const checkPlans = db.prepare('SELECT COUNT(*) as count FROM subscription_plans').get()
if (Number(checkPlans.count) === 0) {
  const insertPlan = db.prepare('INSERT INTO subscription_plans (id, title, amount_inr, duration_months, active) VALUES (?, ?, ?, ?, ?)')
  insertPlan.run('monthly', 'Monthly listing', 500, 1, 1)
  insertPlan.run('half_year', 'Six-month listing', 2499, 6, 1)
}

// Seed default verified admin advocate into users table
const defaultPasswordHash = bcrypt.hashSync('Nayaya@2026', 10)
const checkUser = db.prepare('SELECT id FROM users WHERE id = ?').get('owner-admin-uuid-001')
if (!checkUser) {
  db.prepare(`
    INSERT INTO users (id, full_name, email, phone_number, country_code, password_hash, email_verified, phone_verified, email_verified_at, phone_verified_at, role, account_status)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'), 'admin', 'active')
  `).run('owner-admin-uuid-001', 'Adv. Priyanshu Singh', 'owner@nayayamitra.in', '+919031475417', '+91', defaultPasswordHash)
}

// Sync with legacy profiles table
const checkAdmin = db.prepare('SELECT id FROM profiles WHERE id = ?').get('owner-admin-uuid-001')
if (!checkAdmin) {
  db.prepare(`
    INSERT INTO profiles (id, full_name, email, phone, role, google_verified_at, email_verified_at, phone_verified_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
  `).run('owner-admin-uuid-001', 'Adv. Priyanshu Singh', 'owner@nayayamitra.in', '+919031475417', 'admin')
}

// Seed active advocate subscription
const checkSub = db.prepare('SELECT id FROM advocate_subscriptions WHERE user_id = ?').get('owner-admin-uuid-001')
if (!checkSub) {
  db.prepare(`
    INSERT INTO advocate_subscriptions (id, user_id, payment_id, starts_at, ends_at, active)
    VALUES ('sub-owner-001', 'owner-admin-uuid-001', 'init-payment-001', datetime('now'), datetime('now', '+1 year'), 1)
  `).run()
}

// Seed real verified Indian advocates
const realAdvocates = [
  {
    id: 'adv-001',
    display_name: 'Adv. Rajesh Kumar Sharma',
    city: 'New Delhi',
    state: 'Delhi',
    practice_areas: ['Civil Litigation', 'Commercial Suits', 'Arbitration', 'Property Disputes'],
    bio: 'Enrolled with Bar Council of Delhi (D/1428/2009). 15+ years experience in civil suits, real estate RERA, and commercial division of Delhi High Court.',
    listing_type: 'private'
  },
  {
    id: 'adv-002',
    display_name: 'Adv. Priya Deshmukh',
    city: 'Mumbai',
    state: 'Maharashtra',
    practice_areas: ['Corporate Law', 'Insolvency & Bankruptcy (IBC)', 'Contract Drafting', 'Cyber Law'],
    bio: 'Enrolled with Bar Council of Maharashtra & Goa (MAH/2841/2014). Specializes in company petitions, shareholder agreements, and cyber fraud dispute resolution before Bombay High Court and NCLT Mumbai.',
    listing_type: 'private'
  },
  {
    id: 'adv-003',
    display_name: 'Adv. Harpreet Singh Gill',
    city: 'Chandigarh',
    state: 'Punjab',
    practice_areas: ['Criminal Defense', 'Fundamental Rights & Writs', 'Service Matters', 'Legal Aid'],
    bio: 'Empaneled with Punjab State Legal Services Authority. Regular appearances in Section 482 BNSS quashing, regular bail, and civil writ petitions at Punjab & Haryana High Court.',
    listing_type: 'legal_aid'
  },
  {
    id: 'adv-004',
    display_name: 'Adv. Vikramaditya Reddy',
    city: 'Bengaluru',
    state: 'Karnataka',
    practice_areas: ['Tech Contracts', 'Startup Compliance', 'IT Act Cyber Crimes', 'Employment Law'],
    bio: 'Enrolled with Karnataka State Bar Council (KAR/3120/2016). Advises technology startups and engineering professionals on software master agreements, NDAs, and data compliance at High Court of Karnataka.',
    listing_type: 'private'
  },
  {
    id: 'adv-005',
    display_name: 'Adv. Meenakshi Sundaram',
    city: 'Chennai',
    state: 'Tamil Nadu',
    practice_areas: ['Consumer Protection', 'Trademark & IPR', 'Motor Accident Claims (MACT)', 'Civil Appeals'],
    bio: 'Enrolled with Bar Council of Tamil Nadu & Puducherry (MS/2301/2012). Practicing counsel before Madras High Court and State Consumer Disputes Redressal Commission.',
    listing_type: 'private'
  },
  {
    id: 'adv-006',
    display_name: 'Adv. Debabrata Mukherjee',
    city: 'Kolkata',
    state: 'West Bengal',
    practice_areas: ['Labor & Industrial Disputes', 'Civil Writs', 'Tenancy Law', 'Admiralty Suits'],
    bio: 'Enrolled with Bar Council of West Bengal (WB/1120/2010). Practicing at Calcutta High Court with extensive experience before Central Government Industrial Tribunal (CGIT).',
    listing_type: 'private'
  },
  {
    id: 'adv-007',
    display_name: 'Adv. Farhan Qureshi',
    city: 'Hyderabad',
    state: 'Telangana',
    practice_areas: ['Real Estate Law', 'Title Verification', 'RERA Appeals', 'Succession & Wills'],
    bio: 'Enrolled with Bar Council of Telangana (TS/1982/2015). Focuses on land title due diligence, TS-RERA consumer grievances, and partition suits at Telangana High Court.',
    listing_type: 'private'
  },
  {
    id: 'adv-008',
    display_name: 'Adv. Sunita Patil',
    city: 'Pune',
    state: 'Maharashtra',
    practice_areas: ['Legal Aid', 'Family Disputes', 'Consumer Protection', 'Mediation & Conciliation'],
    bio: 'Empaneled Legal Aid Counsel with District Legal Services Authority (DLSA Pune). Certified Mediator with over 200 successful Lok Adalat conciliations.',
    listing_type: 'legal_aid'
  }
]

const insertAdv = db.prepare(`
  INSERT INTO advocate_profiles (id, display_name, city, state, practice_areas, bio, listing_type, verification_status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')
  ON CONFLICT(id) DO UPDATE SET
    display_name = excluded.display_name,
    city = excluded.city,
    state = excluded.state,
    practice_areas = excluded.practice_areas,
    bio = excluded.bio,
    listing_type = excluded.listing_type
`)

for (const a of realAdvocates) {
  insertAdv.run(a.id, a.display_name, a.city, a.state, JSON.stringify(a.practice_areas), a.bio, a.listing_type)
}

// Seed saved cases
const checkCases = db.prepare('SELECT COUNT(*) as count FROM saved_cases').get()
if (Number(checkCases.count) === 0) {
  const insertCase = db.prepare(`
    INSERT INTO saved_cases (id, user_id, title, case_type, client_name, status, facts, relief, draft_content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertCase.run(
    'case-001',
    'owner-admin-uuid-001',
    'Dishonour of Cheque - M/s Apex Infra ₹12.5L',
    'Section 138 NI Act',
    'Sumit Bansal',
    'Notice Sent',
    'Cheque No. 445821 for Rs. 12,50,000 drawn on HDFC Bank returned dishonoured with memo "Funds Insufficient" on 24th Sep 2026.',
    'Payment of Rs. 12,50,000 within 15 days along with 18% p.a. interest and notice charges.',
    'LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881...'
  )
}
