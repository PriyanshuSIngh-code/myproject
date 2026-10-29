import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'node:crypto'
// @ts-expect-error JS module in server
import { db } from '../../server/db.js'
// @ts-expect-error JS module in server
import { signSessionToken } from '../../server/services/authService.js'

describe('Dashboard Access Control & Case Drafting Isolation', () => {
  const runId = Date.now()
  const normalUserId = crypto.randomUUID()
  const advocateNoSubId = crypto.randomUUID()
  const advocateExpiredSubId = crypto.randomUUID()
  const advocateActiveSubId = crypto.randomUUID()
  const adminUserId = crypto.randomUUID()

  const randomPhone = () => `+9191${Math.floor(10000000 + Math.random() * 89999999)}`

  let normalUserToken: string
  let advocateNoSubToken: string
  let advocateExpiredSubToken: string
  let advocateActiveSubToken: string
  let adminToken: string

  beforeAll(() => {
    // 1. Create a Normal User
    const citizenEmail = `citizen.${runId}@example.com`
    db.prepare(`
      INSERT INTO users (id, full_name, email, phone_number, password_hash, email_verified, phone_verified, role, account_status)
      VALUES (?, 'Normal Citizen', ?, ?, 'hashed', 1, 1, 'user', 'active')
    `).run(normalUserId, citizenEmail, randomPhone())
    db.prepare(`
      INSERT INTO profiles (id, full_name, email, phone, role)
      VALUES (?, 'Normal Citizen', ?, ?, 'user')
    `).run(normalUserId, citizenEmail, randomPhone())
    normalUserToken = signSessionToken({ userId: normalUserId, email: citizenEmail, role: 'user' })

    // 2. Create an Advocate with NO subscription
    const noSubEmail = `advocate.nosub.${runId}@example.com`
    db.prepare(`
      INSERT INTO users (id, full_name, email, phone_number, password_hash, email_verified, phone_verified, role, account_status)
      VALUES (?, 'Advocate Unsubscribed', ?, ?, 'hashed', 1, 1, 'advocate', 'active')
    `).run(advocateNoSubId, noSubEmail, randomPhone())
    db.prepare(`
      INSERT INTO profiles (id, full_name, email, phone, role)
      VALUES (?, 'Advocate Unsubscribed', ?, ?, 'advocate')
    `).run(advocateNoSubId, noSubEmail, randomPhone())
    advocateNoSubToken = signSessionToken({ userId: advocateNoSubId, email: noSubEmail, role: 'advocate' })

    // 3. Create an Advocate with an EXPIRED subscription (ended 5 days ago)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
    const expiredEmail = `advocate.expired.${runId}@example.com`
    db.prepare(`
      INSERT INTO users (id, full_name, email, phone_number, password_hash, email_verified, phone_verified, role, account_status)
      VALUES (?, 'Advocate Expired', ?, ?, 'hashed', 1, 1, 'advocate', 'active')
    `).run(advocateExpiredSubId, expiredEmail, randomPhone())
    db.prepare(`
      INSERT INTO profiles (id, full_name, email, phone, role)
      VALUES (?, 'Advocate Expired', ?, ?, 'advocate')
    `).run(advocateExpiredSubId, expiredEmail, randomPhone())
    db.prepare(`
      INSERT INTO advocate_subscriptions (id, user_id, payment_id, starts_at, ends_at, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(crypto.randomUUID(), advocateExpiredSubId, `pay-expired-${runId}`, thirtyDaysAgo, fiveDaysAgo)
    advocateExpiredSubToken = signSessionToken({ userId: advocateExpiredSubId, email: expiredEmail, role: 'advocate' })

    // 4. Create an Advocate with an ACTIVE subscription (ends 30 days from now)
    const now = new Date().toISOString()
    const thirtyDaysFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const activeEmail = `advocate.active.${runId}@example.com`
    db.prepare(`
      INSERT INTO users (id, full_name, email, phone_number, password_hash, email_verified, phone_verified, role, account_status)
      VALUES (?, 'Advocate Active', ?, ?, 'hashed', 1, 1, 'advocate', 'active')
    `).run(advocateActiveSubId, activeEmail, randomPhone())
    db.prepare(`
      INSERT INTO profiles (id, full_name, email, phone, role)
      VALUES (?, 'Advocate Active', ?, ?, 'advocate')
    `).run(advocateActiveSubId, activeEmail, randomPhone())
    db.prepare(`
      INSERT INTO advocate_subscriptions (id, user_id, payment_id, starts_at, ends_at, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(crypto.randomUUID(), advocateActiveSubId, `pay-active-${runId}`, now, thirtyDaysFuture)
    advocateActiveSubToken = signSessionToken({ userId: advocateActiveSubId, email: activeEmail, role: 'advocate' })

    // 5. Create an Admin User
    const adminEmail = `admin.master.${runId}@example.com`
    db.prepare(`
      INSERT INTO users (id, full_name, email, phone_number, password_hash, email_verified, phone_verified, role, account_status)
      VALUES (?, 'Admin Master', ?, ?, 'hashed', 1, 1, 'admin', 'active')
    `).run(adminUserId, adminEmail, randomPhone())
    db.prepare(`
      INSERT INTO profiles (id, full_name, email, phone, role)
      VALUES (?, 'Admin Master', ?, ?, 'admin')
    `).run(adminUserId, adminEmail, randomPhone())
    adminToken = signSessionToken({ userId: adminUserId, email: adminEmail, role: 'admin' })
  })

  afterAll(() => {
    const ids = [normalUserId, advocateNoSubId, advocateExpiredSubId, advocateActiveSubId, adminUserId]
    for (const id of ids) {
      try {
        db.prepare('DELETE FROM advocate_subscriptions WHERE user_id = ?').run(id)
        db.prepare('DELETE FROM saved_cases WHERE user_id = ?').run(id)
        db.prepare('DELETE FROM profiles WHERE id = ?').run(id)
        db.prepare('DELETE FROM users WHERE id = ?').run(id)
      } catch {
        // ignore
      }
    }
  })

  // --------------------------------------------------------------------------
  // Requirement 4: All legal case drafting features must be available
  // exclusively inside Advocate Dashboard; normal users must NOT be able to use.
  // --------------------------------------------------------------------------
  it('blocks unauthenticated requests to POST /api/draft (401)', async () => {
    const res = await fetch('http://localhost:3001/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'Legal notice', facts: 'Facts of case' })
    })
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toContain('Authentication required')
  })

  it('blocks normal registered users from POST /api/draft (403 Forbidden)', async () => {
    const res = await fetch('http://localhost:3001/api/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${normalUserToken}`
      },
      body: JSON.stringify({ kind: 'Legal notice', facts: 'Facts of case' })
    })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('Legal case drafting is exclusively available to verified advocates')
  })

  // --------------------------------------------------------------------------
  // Requirement 3: Advocate Dashboard accessible only to advocates with active plan
  // --------------------------------------------------------------------------
  it('blocks advocates without any subscription from POST /api/draft (403 subscriptionRequired)', async () => {
    const res = await fetch('http://localhost:3001/api/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advocateNoSubToken}`
      },
      body: JSON.stringify({ kind: 'Legal notice', facts: 'Facts of case' })
    })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.subscriptionRequired).toBe(true)
    expect(data.error).toContain('Active advocate subscription required')
  })

  // --------------------------------------------------------------------------
  // Requirement 5: If an advocate subscription expires, access to new drafting
  // features must be restricted until subscription is renewed.
  // --------------------------------------------------------------------------
  it('strictly blocks advocates with an EXPIRED subscription from POST /api/draft', async () => {
    const res = await fetch('http://localhost:3001/api/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advocateExpiredSubToken}`
      },
      body: JSON.stringify({ kind: 'Legal notice', facts: 'Dishonoured cheque case' })
    })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.subscriptionRequired).toBe(true)
    expect(data.error).toContain('Active advocate subscription required to generate legal drafts')
  })

  it('reports active: false for advocate with expired subscription via /api/subscriptions/active', async () => {
    const res = await fetch('http://localhost:3001/api/subscriptions/active', {
      headers: { 'Authorization': `Bearer ${advocateExpiredSubToken}` }
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.active).toBe(false)
  })

  it('allows advocates with an ACTIVE subscription to generate legal drafts via POST /api/draft', async () => {
    const res = await fetch('http://localhost:3001/api/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advocateActiveSubToken}`
      },
      body: JSON.stringify({
        kind: 'Legal notice for cheque bounce (Sec 138 NI Act)',
        facts: 'Cheque No 445821 returned with memo Funds Insufficient.',
        relief: 'Demand payment within 15 days.'
      })
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.draft).toBeDefined()
    expect(typeof data.draft).toBe('string')
    expect(data.draft.length).toBeGreaterThan(50)
  })

  it('allows administrators to generate legal drafts via POST /api/draft', async () => {
    const res = await fetch('http://localhost:3001/api/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        kind: 'Eviction notice',
        facts: 'Tenant failed to pay rent for 3 months.',
        relief: 'Vacate premises in 15 days.'
      })
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.draft).toBeDefined()
  })

  // --------------------------------------------------------------------------
  // Case persistence isolation checks
  // --------------------------------------------------------------------------
  it('blocks normal users from accessing saved cases at GET /api/cases', async () => {
    const res = await fetch('http://localhost:3001/api/cases', {
      headers: { 'Authorization': `Bearer ${normalUserToken}` }
    })
    expect(res.status).toBe(403)
  })

  it('blocks expired advocates from creating new cases at POST /api/cases', async () => {
    const res = await fetch('http://localhost:3001/api/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advocateExpiredSubToken}`
      },
      body: JSON.stringify({
        title: 'Dispute 101',
        case_type: 'Civil',
        client_name: 'Raman'
      })
    })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.subscriptionRequired).toBe(true)
  })

  it('allows active advocates to save cases at POST /api/cases and retrieve via GET /api/cases', async () => {
    const postRes = await fetch('http://localhost:3001/api/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advocateActiveSubToken}`
      },
      body: JSON.stringify({
        title: 'State vs Sharma',
        case_type: 'Sec 138 NI Act',
        client_name: 'Anil Kumar',
        facts: 'Invoice unpaid and cheque bounced',
        relief: 'Full recovery with interest'
      })
    })
    expect(postRes.status).toBe(200)
    const postData = await postRes.json()
    expect(postData.ok).toBe(true)

    const getRes = await fetch('http://localhost:3001/api/cases', {
      headers: { 'Authorization': `Bearer ${advocateActiveSubToken}` }
    })
    expect(getRes.status).toBe(200)
    const cases = await getRes.json()
    expect(Array.isArray(cases)).toBe(true)
    expect(cases.some((c: any) => c.title === 'State vs Sharma')).toBe(true)
  })
})
