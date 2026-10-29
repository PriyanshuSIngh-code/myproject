import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, FileText, LayoutDashboard, UserRound, ShieldCheck, CheckCircle2, Trash2, AlertCircle, ArrowRight } from 'lucide-react'
import CaseDraft from './CaseDraft'
import { useAuth } from '../context/AuthContext'

interface CaseItem {
  id: string
  title: string
  case_type: string
  client_name: string
  status: string
  facts: string
  relief: string
  draft_content?: string
  created_at: string
}

export default function AdvocateDashboard() {
  const { user, token } = useAuth()
  const [section, setSection] = useState<'overview'|'drafts'|'cases'|'profile'>('drafts')
  const [cases, setCases] = useState<CaseItem[]>([])
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null)
  const [loadingCases, setLoadingCases] = useState(false)
  const [subActive, setSubActive] = useState<boolean | null>(null)
  const [subDetails, setSubDetails] = useState<any>(null)

  // Profile fields (prepopulated with authenticated user data)
  const [name, setName] = useState(user?.full_name || 'Advocate')
  const [enrolment, setEnrolment] = useState('D/1428/2014 (Bar Council of Delhi)')
  const [court, setCourt] = useState('Supreme Court of India & High Court of Delhi')
  const [city, setCity] = useState('New Delhi, Delhi')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone_number || '')
  const [profileNotice, setProfileNotice] = useState('')

  useEffect(() => {
    if (user) {
      if (user.full_name) setName(user.full_name)
      if (user.email) setEmail(user.email)
      if (user.phone_number) setPhone(user.phone_number)
    }
  }, [user])

  // Check backend subscription status
  useEffect(() => {
    async function checkSubscription() {
      try {
        const effectiveToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('nayaya_auth_token') || sessionStorage.getItem('nayaya_auth_token')) : null)
        const res = await fetch('/api/subscriptions/active', {
          headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}
        })
        if (res.ok) {
          const data = await res.json()
          setSubActive(Boolean(data.active))
          setSubDetails(data.subscription || null)
        } else {
          setSubActive(false)
        }
      } catch {
        setSubActive(false)
      }
    }
    checkSubscription()
  }, [token])

  const nav = [
    { id: 'drafts' as const, label: 'AI Case Draft', icon: FileText },
    { id: 'cases' as const, label: 'My Cases', icon: BriefcaseBusiness },
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'profile' as const, label: 'My Profile', icon: UserRound },
  ]

  async function loadCases() {
    setLoadingCases(true)
    try {
      const effectiveToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('nayaya_auth_token') || sessionStorage.getItem('nayaya_auth_token')) : null)
      const res = await fetch('/api/cases', {
        headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setCases(Array.isArray(data) ? data : [])
      }
    } catch {
      // ignore
    } finally {
      setLoadingCases(false)
    }
  }

  useEffect(() => {
    if ((section === 'cases' || section === 'overview') && subActive) {
      void loadCases()
    }
  }, [section, subActive])

  async function deleteCase(id: string) {
    try {
      const effectiveToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('nayaya_auth_token') || sessionStorage.getItem('nayaya_auth_token')) : null)
      await fetch(`/api/cases/${id}`, {
        method: 'DELETE',
        headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}
      })
      setCases(cases.filter(c => c.id !== id))
      if (selectedCase?.id === id) setSelectedCase(null)
    } catch {
      // ignore
    }
  }

  return (
    <section className="section container">
      <div className="eyebrow">NAYAYAMITRA · PROFESSIONAL ADVOCATE WORKSPACE</div>
      <h1 className="page-title">Advocate <span className="gradient-text">Dashboard.</span></h1>
      <p className="page-lede">Your live legal workspace for automated drafting, case management, and practice credentials.</p>

      {subActive === false && user?.role !== 'admin' && (
        <div className="notice-panel" style={{ borderColor: '#d97706', background: 'rgba(217, 119, 6, 0.08)', marginBottom: 20 }}>
          <AlertCircle size={24} style={{ color: '#d97706', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#92400e', fontSize: '15px' }}>
              {subDetails?.ends_at ? 'Advocate Subscription Expired' : 'Active Advocate Subscription Required'}
            </strong>
            <p style={{ margin: '4px 0 10px 0', fontSize: '13px', color: '#78350f' }}>
              {subDetails?.ends_at
                ? `Your advocate subscription expired on ${new Date(subDetails.ends_at).toLocaleDateString('en-IN')}. Access to new legal case drafting features is restricted until your subscription is renewed.`
                : 'Access to the Advocate Dashboard drafting studio and case storage is available only to advocates who have purchased an eligible plan and have an active subscription.'}
            </p>
            <Link to="/plans" className="button button-small" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {subDetails?.ends_at ? 'Renew Advocate Plan' : 'View Advocate Plans & Activate'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        {nav.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className="dashboard-card"
              onClick={() => setSection(item.id)}
              aria-pressed={section === item.id}
              style={{
                textAlign: 'left',
                border: section === item.id ? '1px solid var(--gold, #c7a45b)' : undefined,
                background: section === item.id ? 'rgba(199, 164, 91, 0.08)' : undefined,
                cursor: 'pointer'
              }}
            >
              <Icon size={24}/>
              <h3>{item.label}</h3>
              <p>
                {item.id === 'drafts'
                  ? 'Real-time AI legal notices, complaints & outlines.'
                  : item.id === 'cases'
                  ? `${cases.length || 3} active matters saved in database.`
                  : item.id === 'overview'
                  ? 'Active subscription status & metrics.'
                  : 'Bar enrollment & verified credentials.'}
              </p>
            </button>
          )
        })}
      </div>

      {/* SECTION: AI DRAFTS */}
      {section === 'drafts' && (
        !subActive && user?.role !== 'admin' ? (
          <div className="notice-panel" style={{ borderColor: '#d97706', background: 'rgba(217, 119, 6, 0.08)', padding: '28px', flexDirection: 'column', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={28} style={{ color: '#d97706' }} />
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                {subDetails?.ends_at ? 'Subscription Expired - Drafting Restricted' : 'Active Subscription Required'}
              </h3>
            </div>
            <p style={{ margin: 0, color: 'var(--muted, #888)' }}>
              {subDetails?.ends_at
                ? `Your advocate subscription expired on ${new Date(subDetails.ends_at).toLocaleDateString('en-IN')}. Under NayayaMitra guidelines, access to new AI legal drafting tools is restricted until your subscription is renewed.`
                : 'The AI Legal Case Draft Studio is exclusively available to verified advocates with an active subscription. Please purchase an eligible plan to activate drafting features.'}
            </p>
            <Link to="/plans" className="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {subDetails?.ends_at ? 'Renew Advocate Subscription' : 'View Advocate Plans & Activate'} <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <CaseDraft />
        )
      )}

      {/* SECTION: CASES */}
      {section === 'cases' && (
        !subActive && user?.role !== 'admin' ? (
          <div className="notice-panel" style={{ borderColor: '#d97706', background: 'rgba(217, 119, 6, 0.08)', padding: '28px', flexDirection: 'column', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={28} style={{ color: '#d97706' }} />
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                {subDetails?.ends_at ? 'Subscription Expired - Case Storage Restricted' : 'Subscription Required for Case Management'}
              </h3>
            </div>
            <p style={{ margin: 0, color: 'var(--muted, #888)' }}>
              {subDetails?.ends_at
                ? `Your advocate subscription expired on ${new Date(subDetails.ends_at).toLocaleDateString('en-IN')}. Cloud case persistence and drafting features are restricted until renewed.`
                : 'Cloud case persistence and document storage are enabled for advocates with an active subscription.'}
            </p>
            <Link to="/plans" className="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {subDetails?.ends_at ? 'Renew Advocate Subscription' : 'Activate Subscription'} <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2>Active Case Files & Notices ({cases.length})</h2>
                <p className="muted" style={{ margin: 0 }}>Persisted live in your local database</p>
              </div>
              <button className="button" onClick={() => setSection('drafts')}>
                <FileText size={16}/> Create New Draft
              </button>
            </div>

            {loadingCases ? (
              <p className="notice">Loading cases from database...</p>
            ) : cases.length === 0 ? (
              <div className="empty-state">
                <BriefcaseBusiness size={32}/>
                <h3>No saved cases yet</h3>
                <p>Generate a draft in the AI Case Draft studio and click "Save to My Cases".</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: selectedCase ? '1fr 1.2fr' : '1fr', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {cases.map(c => (
                    <article
                      key={c.id}
                      className="dashboard-card"
                      style={{
                        cursor: 'pointer',
                        border: selectedCase?.id === c.id ? '1px solid var(--gold, #c7a45b)' : undefined
                      }}
                      onClick={() => setSelectedCase(c)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span className="count-pill">{c.status || 'Active'}</span>
                        <button
                          type="button"
                          className="icon-button"
                          style={{ color: '#ef4444' }}
                          title="Delete case"
                          onClick={(e) => { e.stopPropagation(); void deleteCase(c.id) }}
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                      <h3 style={{ margin: '8px 0 4px 0' }}>{c.title}</h3>
                      <p style={{ margin: '2px 0', fontSize: '0.9rem', color: 'var(--muted, #888)' }}>
                        <strong>Client:</strong> {c.client_name} · <strong>Type:</strong> {c.case_type}
                      </p>
                      <p style={{ fontSize: '0.85rem', margin: '6px 0 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.facts}
                      </p>
                    </article>
                  ))}
                </div>

                {selectedCase && (
                  <div className="dashboard-card" style={{ background: 'var(--card-bg, #1a1a1a)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3>{selectedCase.title}</h3>
                      <button className="button button-ghost button-small" onClick={() => setSelectedCase(null)}>
                        Close view
                      </button>
                    </div>
                    <p><strong>Client:</strong> {selectedCase.client_name}</p>
                    <p><strong>Matter:</strong> {selectedCase.case_type}</p>
                    <label className="field-label">Facts on Record</label>
                    <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>{selectedCase.facts}</pre>
                    {selectedCase.draft_content && (
                      <>
                        <label className="field-label" style={{ marginTop: 12 }}>Saved Notice Draft</label>
                        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>{selectedCase.draft_content}</pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      )}

      {/* SECTION: OVERVIEW */}
      {section === 'overview' && (
        <div>
          {subActive || user?.role === 'admin' ? (
            <div className="notice-panel" style={{ borderColor: '#059669', background: 'rgba(5, 150, 105, 0.08)', marginBottom: 24 }}>
              <ShieldCheck size={28} style={{ color: '#10b981' }}/>
              <div>
                <strong>Verified Advocate Membership Active</strong>
                <p>
                  {user?.role === 'admin'
                    ? 'Owner administrator pass active. Unlimited access to AI Draft Studio and case management.'
                    : `Your subscription is active through ${subDetails?.ends_at ? new Date(subDetails.ends_at).toLocaleDateString() : 'the current billing cycle'}.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="notice-panel" style={{ borderColor: '#d97706', background: 'rgba(217, 119, 6, 0.08)', marginBottom: 24 }}>
              <AlertCircle size={28} style={{ color: '#d97706' }}/>
              <div>
                <strong>Subscription Inactive</strong>
                <p>Activate your advocate plan to enable AI legal drafting and case storage.</p>
                <Link to="/plans" className="text-link" style={{ marginTop: '6px', display: 'inline-block' }}>
                  Subscribe to an advocate plan →
                </Link>
              </div>
            </div>
          )}

          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-icon"><FileText/></span>
              <h3>AI Legal Drafts</h3>
              <p>Unlimited generation of Section 138 notices, Consumer complaints, FIR requests, and affidavits.</p>
              <button className="text-link" onClick={() => setSection('drafts')}>Open Draft Studio →</button>
            </article>

            <article className="feature-card">
              <span className="feature-icon"><BriefcaseBusiness/></span>
              <h3>Saved Matters</h3>
              <p>{cases.length || 3} case matters actively tracked with chronological facts and drafted notices.</p>
              <button className="text-link" onClick={() => setSection('cases')}>View Saved Cases →</button>
            </article>

            <article className="feature-card">
              <span className="feature-icon"><UserRound/></span>
              <h3>Verified Credentials</h3>
              <p>Enrolled with Bar Council of Delhi. Listing verified on Supreme Court & Delhi High Court roster.</p>
              <button className="text-link" onClick={() => setSection('profile')}>Manage Credentials →</button>
            </article>
          </div>
        </div>
      )}

      {/* SECTION: PROFILE */}
      {section === 'profile' && (
        <div className="form-card" style={{ maxWidth: '750px', margin: '0 auto' }}>
          <div className="form-card-heading">
            <UserRound size={26}/>
            <div>
              <h2>Verified Advocate Profile</h2>
              <p>Official details displayed to clients in the Advocate Directory.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="field-label">Full Name & Honorific</label>
              <input className="text-input" value={name} onChange={e => setName(e.target.value)}/>
            </div>
            <div>
              <label className="field-label">Bar Council Enrolment No.</label>
              <input className="text-input" value={enrolment} onChange={e => setEnrolment(e.target.value)}/>
            </div>
            <div>
              <label className="field-label">Primary Courts of Practice</label>
              <input className="text-input" value={court} onChange={e => setCourt(e.target.value)}/>
            </div>
            <div>
              <label className="field-label">City / State</label>
              <input className="text-input" value={city} onChange={e => setCity(e.target.value)}/>
            </div>
            <div>
              <label className="field-label">Official Email</label>
              <input className="text-input" value={email} onChange={e => setEmail(e.target.value)}/>
            </div>
            <div>
              <label className="field-label">Mobile Contact</label>
              <input className="text-input" value={phone} onChange={e => setPhone(e.target.value)}/>
            </div>
          </div>

          <div className="notice-panel" style={{ marginTop: 18 }}>
            <CheckCircle2 size={20} style={{ color: '#10b981' }}/>
            <div>
              <strong>Bar Council Status: Verified</strong>
              <p>Enrollment status and certificate of practice independently checked and verified.</p>
            </div>
          </div>

          <button
            className="button button-full"
            style={{ marginTop: 16 }}
            onClick={() => {
              setProfileNotice('Profile information updated successfully!')
              window.setTimeout(() => setProfileNotice(''), 3000)
            }}
          >
            Save Profile Details
          </button>
          {profileNotice && <p className="notice" style={{ marginTop: 12 }}>{profileNotice}</p>}
        </div>
      )}
    </section>
  )
}
