import { Check, CreditCard, QrCode, ShieldCheck, Copy } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const UPI_ID = '9031475417@ptyes'
export default function Plans() {
  const location = useLocation()
  const routeNotice = (location.state as any)?.notice
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'halfyear'>('monthly')
  const [copied, setCopied] = useState(false)
  const [utr, setUtr] = useState('')
  const [claimBusy, setClaimBusy] = useState(false)
  const [claimNotice, setClaimNotice] = useState('')
  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(UPI_ID)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  const amount = selectedPlan === 'monthly' ? '₹500' : '₹2,499'
  async function submitPaymentClaim(e: React.FormEvent) {
    e.preventDefault(); setClaimNotice('')
    if (!supabase) { setClaimNotice('Payment submission is disabled until Supabase is configured.'); return }
    const ref = utr.trim()
    if (ref.length < 8 || ref.length > 40 || !/^[A-Za-z0-9-]+$/.test(ref)) { setClaimNotice('Enter a valid UTR/reference number (8–40 letters, numbers or hyphens).'); return }
    setClaimBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setClaimNotice('Please sign in and verify your email and phone before submitting a payment claim.'); return }
      const { data: profile } = await supabase.from('profiles').select('phone_verified_at,email_verified_at').eq('id',user.id).maybeSingle()
      if (!profile?.phone_verified_at || !profile?.email_verified_at) { setClaimNotice('Both verified email and verified phone are required. If your profile schema lacks these fields, configure the dual-verification migration first.'); return }
      const { error } = await supabase.from('subscription_payments').insert({user_id:user.id,plan_id:selectedPlan==='monthly'?'monthly':'half_year',amount_inr:selectedPlan==='monthly'?500:2499,method:'upi_manual',status:'submitted',upi_reference:ref,idempotency_key:crypto.randomUUID()})
      if (error) throw error
      setClaimNotice('Payment claim submitted for owner review. Your subscription is not active until the owner verifies the transaction.'); setUtr('')
    } catch (err) { setClaimNotice(err instanceof Error ? err.message : 'Could not submit payment claim. Check the backend configuration and try again.') } finally { setClaimBusy(false) }
  }
  return <section className="section container">
    {routeNotice && (
      <div style={{
        background: 'rgba(199, 164, 91, 0.12)',
        border: '1px solid #c7a45b',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '14px',
        fontWeight: 500,
        color: '#0f172a'
      }}>
        <ShieldCheck size={20} style={{ color: '#c7a45b', flexShrink: 0 }} />
        <span>{routeNotice}</span>
      </div>
    )}
    <div className="eyebrow">FOR ADVOCATES</div><h1 className="page-title">A professional presence, <span className="gradient-text">built on trust.</span></h1><p className="page-lede">Apply for a listing and complete verification before your profile is published.</p>
    <div className="plans-grid"><article className={`plan-card ${selectedPlan === 'monthly' ? 'featured-plan' : ''}`}><div className="plan-name">MONTHLY</div><h2>₹500<span>/month</span></h2><p>For advocates who want a flexible listing plan.</p><ul><li><Check/> Profile listing after approval</li><li><Check/> Practice areas and location</li><li><Check/> Document review required</li></ul><button className="button button-ghost button-full" onClick={() => setSelectedPlan('monthly')} aria-pressed={selectedPlan === 'monthly'}>{selectedPlan === 'monthly' ? 'Selected plan' : 'Choose monthly plan'}</button></article>
    <article className={`plan-card ${selectedPlan === 'halfyear' ? 'featured-plan' : ''}`}><div className="plan-ribbon">SIX-MONTH PLAN</div><div className="plan-name">HALF-YEARLY</div><h2>₹2,499<span>/6 months</span></h2><p>A longer plan with one payment period.</p><ul><li><Check/> Profile listing after approval</li><li><Check/> Practice areas and location</li><li><Check/> Document review required</li></ul><button className="button button-full" onClick={() => setSelectedPlan('halfyear')} aria-pressed={selectedPlan === 'halfyear'}>{selectedPlan === 'halfyear' ? 'Selected plan' : 'Choose six months'}</button></article></div>
    <section className="owner-qr-panel"><div><div className="eyebrow"><QrCode size={15}/> UPI MANUAL PAYMENT</div><h2>Pay {amount} for your selected plan</h2><p>Scan this QR with your UPI app. Confirm the payee details in your app before authorising payment.</p><div className="upi-id-line"><span><strong>UPI ID</strong><br/>{UPI_ID}</span><button className="button button-ghost" onClick={copyUpi}><Copy size={15}/>{copied ? 'Copied' : 'Copy UPI ID'}</button></div><p className="muted">Payee shown on the supplied QR: Priyanshu Singh. Please verify the name and amount in your UPI app before paying.</p></div><div className="owner-qr-image-wrap"><img src="/owner-upi-qr.jpg" alt="Owner-provided UPI QR code"/><strong>Scan to pay {amount}</strong><span>Selected plan: {selectedPlan === 'monthly' ? 'Monthly · 1 month' : 'Half-yearly · 6 months'}</span></div></section>
    <form className="payment-claim-form dashboard-card" onSubmit={submitPaymentClaim}><div className="eyebrow">AFTER YOU PAY</div><h2>Submit payment for owner verification</h2><p>Enter the UTR/reference from your UPI app. This submits a claim only; it does not activate your plan.</p><label className="field-label" htmlFor="utr">UPI UTR / transaction reference</label><input id="utr" className="text-input" value={utr} onChange={e=>setUtr(e.target.value)} minLength={8} maxLength={40} placeholder="Enter transaction reference" required/><button className="button" type="submit" disabled={claimBusy||!utr.trim()}>{claimBusy?'Submitting…':'Submit for verification'}</button>{claimNotice&&<p className="notice" role="status">{claimNotice}</p>}</form>
    <div className="payment-methods"><div><QrCode/><strong>UPI transfer</strong><p>After paying, keep the UTR/reference number and transaction receipt to submit for manual review.</p></div><div><CreditCard/><strong>Online payment</strong><p>Payment gateway integration requires server-side order creation and verified webhooks before activation.</p></div><div><ShieldCheck/><strong>Activation safeguards</strong><p>Subscription should activate only after confirmed payment and advocate-document approval.</p></div></div>
    <p className="notice">Important: this QR is displayed from the image provided by the owner. This starter does not yet submit payment claims to a live database or activate subscriptions. Do not assume a payment is approved until the production backend and owner-only admin verification flow are configured and tested.</p>
    <div className="centered"><Link className="button button-ghost" to="/advocate/join">Continue to advocate registration</Link></div>
  </section>
}
