import { useState } from 'react'
import { CheckCircle2, Download, FileText, LoaderCircle, Mic, Sparkles, Volume2, BookmarkCheck } from 'lucide-react'
import { localClient } from '../lib/localClient'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const sampleScenarios = [
  {
    label: 'Cheque Bounce (Sec 138 NI Act)',
    kind: 'Legal notice for cheque bounce (Sec 138 NI Act)',
    facts: `1. Complainant supplied industrial machinery parts worth Rs. 12,50,000 to the Accused on 15th August 2026 under Invoice No. INV-2026-889.
2. In discharge of the admitted debt, the Accused issued Cheque No. 445821 dated 10th September 2026 for Rs. 12,50,000 drawn on HDFC Bank, Connaught Place Branch.
3. Upon presentation through Punjab National Bank on 24th September 2026, the cheque was returned dishonoured with bank return memo dated 25th September 2026 citing "FUNDS INSUFFICIENT".
4. The drawer had full knowledge of insufficient balance at the time of issuing the cheque.`,
    relief: 'Pay the entire cheque amount of Rs. 12,50,000 within 15 days of notice receipt, along with 18% per annum interest and Rs. 15,000 notice fees, failing which criminal complaint under Section 138/142 NI Act and Section 318(4) BNS shall be filed.'
  },
  {
    label: 'Consumer Complaint (Flat Delay)',
    kind: 'Consumer complaint (Consumer Protection Act 2019)',
    facts: `1. Complainant booked residential apartment No. 1204 in Tower B at "Apex Emerald Heights", Sector 75, Noida on 10th January 2022.
2. Total consideration of Rs. 85,00,000 was agreed, out of which Complainant has paid Rs. 78,50,000 (over 90%) as per construction linked plan.
3. Builder-Buyer Agreement committed handover with Occupancy Certificate on or before 31st December 2024 with a 6-month grace period ending 30th June 2025.
4. Construction remains stalled at 60% completion; builder has failed to deliver possession for over 22 months past the grace period.`,
    relief: 'Immediate handover of completed flat with Occupancy Certificate or full refund of Rs. 78,50,000 with 12% delay compensation per annum from due date, plus Rs. 2,00,000 for mental agony and Rs. 50,000 litigation costs.'
  },
  {
    label: 'Cyber Fraud / Phishing (FIR)',
    kind: 'Police complaint application (Cyber fraud / Cheating)',
    facts: `1. On 5th October 2026 at 3:15 PM, Complainant received a phone call from individual impersonating an electricity board billing officer threatening power disconnection within 2 hours.
2. Complainant was instructed to install an APK file for verification and pay Rs. 10 through a fraudulent link.
3. Immediately thereafter, an unauthorized debit of Rs. 85,000 occurred from Complainant's SBI Account No. 30291829102 via IMPS to Axis Bank Beneficiary Account No. 918273645012 (UTR: SBIN928374619).
4. Complainant immediately reported to 1930 Cyber Helpline with Acknowledgement No. 20261005882.`,
    relief: 'Registration of FIR under Section 66D Information Technology Act 2000 and Section 318(4) Bharatiya Nyaya Sanhita 2023, issuance of freeze notice to beneficiary bank under Section 106 BNSS, and restitution of stolen funds.'
  },
  {
    label: 'Tenant Eviction & Arrears',
    kind: 'Eviction & rent recovery notice to tenant',
    facts: `1. Complainant is lawful landlord of Commercial Shop No. G-4, Sector 18 Market, Noida.
2. Tenant was inducted under registered lease agreement dated 1st March 2024 at agreed monthly rent of Rs. 50,000 payable by the 7th of each calendar month.
3. Tenant has failed and neglected to pay monthly rent from June 2026 to October 2026 (5 consecutive months arrears totaling Rs. 2,50,000).
4. Tenant has also carried out unauthorized structural alterations without prior written consent.`,
    relief: 'Termination of tenancy under Section 106 Transfer of Property Act 1882, handover of vacant and peaceful possession within 15 days, and full payment of rent arrears amounting to Rs. 2,50,000 plus damages at Rs. 2,000 per day of unauthorized overstay.'
  }
]

export default function CaseDraft() {
  const { token } = useAuth()
  const [kind, setKind] = useState('Legal notice for cheque bounce (Sec 138 NI Act)')
  const [language, setLanguage] = useState('English')
  const [facts, setFacts] = useState(sampleScenarios[0].facts)
  const [relief, setRelief] = useState(sampleScenarios[0].relief)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)
  const [clientName, setClientName] = useState('Sumit Bansal')

  function applyScenario(s: typeof sampleScenarios[0]) {
    setKind(s.kind)
    setFacts(s.facts)
    setRelief(s.relief)
    setDraft('')
    setNotice('')
    setSavedNotice(false)
  }

  function voiceInput() {
    const w = window as Window & { webkitSpeechRecognition?: new () => any; SpeechRecognition?: new () => any }
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Rec) { setNotice('Microphone input is not supported in this browser. Please type the facts.'); return }
    const rec = new Rec(); rec.lang = language === 'English' ? 'en-IN' : 'hi-IN'; rec.onresult = (e: any) => setFacts((old) => `${old}${old ? '\n' : ''}${e.results[0][0].transcript}`); rec.start()
  }

  function speakDraft() {
    if (!('speechSynthesis' in window)) { setNotice('Voice output is not supported in this browser.'); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(draft)
    u.lang = language === 'English' ? 'en-IN' : 'hi-IN'
    window.speechSynthesis.speak(u)
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!facts.trim()) return
    setBusy(true)
    setNotice('')
    setSavedNotice(false)

    const effectiveToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('nayaya_auth_token') || sessionStorage.getItem('nayaya_auth_token')) : null)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`
    }

    try {
      // 1. Try local backend draft engine with secure authorization
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind, language, facts, relief })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.draft) {
          setDraft(data.draft)
          return
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          setNotice('Authentication required. Please log in with your verified advocate credentials.')
          return
        }
        if (res.status === 403) {
          if (errData.subscriptionRequired) {
            setNotice('Your advocate subscription has expired or is inactive. Please renew your subscription to generate new legal drafts.')
          } else {
            setNotice(errData.error || 'Access restricted. Legal case drafting is exclusively available to verified advocates.')
          }
          return
        }
        throw new Error(errData.error || 'Draft generation error.')
      }

      // 2. Try Supabase cloud function if configured
      if (supabase) {
        const { data } = await supabase.functions.invoke('case-draft', { body: { kind, language, facts, relief } })
        if (data?.draft) {
          setDraft(data.draft)
          return
        }
      }

      // 3. Fallback to localClient
      const clientRes = await localClient.functions.invoke('case-draft', { body: { kind, language, facts, relief } })
      if (clientRes?.data?.draft) {
        setDraft(clientRes.data.draft)
      } else {
        throw new Error('Unable to generate draft at this moment. Please check server.')
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Draft generation error.')
    } finally {
      setBusy(false)
    }
  }

  async function saveToCases() {
    try {
      const effectiveToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('nayaya_auth_token') || sessionStorage.getItem('nayaya_auth_token')) : null)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`
      }

      const res = await fetch('/api/cases', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: `${kind.split('(')[0].trim()} - ${clientName}`,
          case_type: kind,
          client_name: clientName,
          status: 'Draft Prepared',
          facts,
          relief,
          draft_content: draft
        })
      })
      if (res.ok) {
        setSavedNotice(true)
        window.setTimeout(() => setSavedNotice(false), 3000)
      } else {
        const errData = await res.json().catch(() => ({}))
        if (errData.subscriptionRequired) {
          setNotice('Active subscription required to save cases. Please renew your advocate plan.')
        } else {
          setNotice(errData.error || 'Could not save to My Cases database.')
        }
      }
    } catch {
      setNotice('Could not save to My Cases database.')
    }
  }

  function downloadDraft() {
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Legal_Draft_${kind.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="section container">
      <div className="eyebrow"><Sparkles size={14}/> ADVOCATE AI WORKSPACE · REAL-TIME GENERATION</div>
      <h1 className="page-title">AI Legal Draft <span className="gradient-text">Studio.</span></h1>
      <p className="page-lede">
        Select a real Indian legal draft type or load a verified scenario to produce formatted, court-referenced drafts in real-time.
      </p>

      {/* Preset scenario shortcuts */}
      <div className="scenario-pills" style={{ marginBottom: 20 }}>
        <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted, #888)', marginBottom: 8 }}>
          TEST WITH REAL INDIAN CASE SCENARIOS (CLICK TO AUTOFILL):
        </strong>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sampleScenarios.map((s, idx) => (
            <button
              key={idx}
              type="button"
              className="button button-ghost"
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={() => applyScenario(s)}
            >
              <FileText size={14} style={{ marginRight: 4 }}/> {s.label}
            </button>
          ))}
        </div>
      </div>

      <form className="draft-form" onSubmit={generate}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div>
            <label className="field-label">Document Type</label>
            <select className="text-input" value={kind} onChange={e => setKind(e.target.value)}>
              <option>Legal notice for cheque bounce (Sec 138 NI Act)</option>
              <option>Consumer complaint (Consumer Protection Act 2019)</option>
              <option>Police complaint application (Cyber fraud / Cheating)</option>
              <option>Eviction & rent recovery notice to tenant</option>
              <option>Notice of demand for unpaid salary / dues</option>
              <option>RTI application outline (RTI Act 2005)</option>
              <option>Affidavit & verification outline</option>
              <option>Legal notice / general reply</option>
            </select>
          </div>

          <div>
            <label className="field-label">Draft Language</label>
            <select className="text-input" value={language} onChange={e => setLanguage(e.target.value)}>
              <option>English</option>
              <option>Hindi</option>
              <option>Hinglish</option>
            </select>
          </div>

          <div>
            <label className="field-label">Client / Complainant Name</label>
            <input
              className="text-input"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="e.g. Sumit Bansal"
            />
          </div>
        </div>

        <label className="field-label" style={{ marginTop: 12 }}>
          Facts, Dates & Sequence of Events
        </label>
        <textarea
          className="text-input"
          rows={7}
          value={facts}
          onChange={e => setFacts(e.target.value)}
          placeholder="State chronological facts, relevant dates, transaction references, notice memos..."
          required
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" className="button button-ghost" onClick={voiceInput}>
            <Mic size={16}/> Dictate facts with voice
          </button>
        </div>

        <label className="field-label" style={{ marginTop: 12 }}>
          Relief / Demanded Outcome
        </label>
        <textarea
          className="text-input"
          rows={3}
          value={relief}
          onChange={e => setRelief(e.target.value)}
          placeholder="Demanded payment amount, notice compliance period, return of property, or damages..."
        />

        <button className="button button-full" type="submit" disabled={busy || !facts.trim()} style={{ marginTop: 16 }}>
          {busy ? (
            <><LoaderCircle size={18} className="spin"/> Generating Real-Time Legal Draft...</>
          ) : (
            <><Sparkles size={18}/> Generate Court-Ready Draft Outline</>
          )}
        </button>
      </form>

      {notice && <p className="notice" role="status" style={{ marginTop: 16 }}>{notice}</p>}

      {draft && (
        <div className="draft-output" style={{ marginTop: 32 }}>
          <div className="admin-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0 }}>Generated Legal Draft</h2>
              <small style={{ color: 'var(--muted, #888)' }}>Format: Indian Bar Council & High Court Standard Style</small>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="button button-ghost" onClick={speakDraft}>
                <Volume2 size={16}/> Read aloud
              </button>
              <button type="button" className="button button-ghost" onClick={() => navigator.clipboard?.writeText(draft)}>
                Copy draft
              </button>
              <button type="button" className="button button-ghost" onClick={downloadDraft}>
                <Download size={16}/> Download (.txt)
              </button>
              <button type="button" className="button" onClick={saveToCases}>
                <BookmarkCheck size={16}/> {savedNotice ? 'Saved!' : 'Save to My Cases'}
              </button>
            </div>
          </div>
          {savedNotice && (
            <p className="notice" style={{ background: '#0e3a1f', color: '#6ee7b7', borderColor: '#059669', marginTop: 12 }}>
              <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }}/> Draft successfully saved to your active cases database!
            </p>
          )}
          <pre style={{ maxHeight: '600px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 16 }}>
            {draft}
          </pre>
        </div>
      )}
    </section>
  )
}
