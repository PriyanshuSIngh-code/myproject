import { useState } from 'react'
import { FileCheck2, LockKeyhole } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
export default function AdvocateJoin() {
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [city,setCity] = useState('')
  const [areas,setAreas] = useState('')
  const [barFile,setBarFile] = useState<File|null>(null)
  const [degreeFile,setDegreeFile] = useState<File|null>(null)
  const [notice,setNotice] = useState('')
  const [busy,setBusy] = useState(false)
  async function submit(e:React.FormEvent) {
    e.preventDefault()
    if (!barFile || !degreeFile) {setNotice('Please choose both required documents.');return}
    if (!isSupabaseConfigured || !supabase) {setNotice('Demo mode: no documents were uploaded. Configure Supabase, private storage buckets and server-side validation first.');return}
    setBusy(true)
    try {
      const {data:sessionData,error:sessionError}=await supabase.auth.getUser()
      if(sessionError||!sessionData.user) throw new Error('Sign in before submitting an advocate application.')
      const uid=sessionData.user.id
      const safeName=(f:File)=>`${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
      const barPath=`${uid}/${safeName(barFile)}`
      const degreePath=`${uid}/${safeName(degreeFile)}`
      const [barUpload,degreeUpload]=await Promise.all([
        supabase.storage.from('advocate-documents').upload(barPath,barFile,{upsert:false}),
        supabase.storage.from('advocate-documents').upload(degreePath,degreeFile,{upsert:false})
      ])
      if(barUpload.error) throw barUpload.error
      if(degreeUpload.error) throw degreeUpload.error
      const {error}=await supabase.from('advocate_applications').insert({
        user_id:uid,display_name:name,email,city,practice_areas:areas.split(',').map(s=>s.trim()).filter(Boolean),
        bar_certificate_path:barPath,law_degree_path:degreePath,status:'pending'
      })
      if(error) throw error
      setNotice('Application submitted for review. Your listing is not active until documents are approved and payment is verified.')
    } catch(err) {setNotice(err instanceof Error?err.message:'Unable to submit application. Check setup and try again.')}
    finally {setBusy(false)}
  }
  return <section className="section container narrow"><div className="eyebrow">ADVOCATE ONBOARDING</div><h1 className="page-title">Build your <span className="gradient-text">professional presence.</span></h1><p className="page-lede">Applications remain pending until an administrator reviews credentials and confirms payment.</p>
    <form className="form-card" onSubmit={submit}><div className="form-card-heading"><FileCheck2/><div><h2>Advocate registration</h2><p>Complete all required fields.</p></div></div>
      <label className="field-label">Full name</label><input className="text-input" required value={name} onChange={e=>setName(e.target.value)} placeholder="Name as on enrollment records"/>
      <label className="field-label">Contact email</label><input className="text-input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
      <label className="field-label">City / State</label><input className="text-input" required value={city} onChange={e=>setCity(e.target.value)} placeholder="e.g. Amritsar, Punjab"/>
      <label className="field-label">Practice areas (comma-separated)</label><input className="text-input" value={areas} onChange={e=>setAreas(e.target.value)} placeholder="Civil, family, consumer…"/>
      <label className="field-label">Bar Council / enrollment certificate (required)</label><input className="file-input" type="file" accept=".pdf,.jpg,.jpeg,.png" required onChange={e=>setBarFile(e.target.files?.[0]??null)}/>
      <label className="field-label">Law degree certificate (required)</label><input className="file-input" type="file" accept=".pdf,.jpg,.jpeg,.png" required onChange={e=>setDegreeFile(e.target.files?.[0]??null)}/>
      <div className="private-note"><LockKeyhole size={17}/><span>These documents are sensitive. Store them in a private bucket and allow access only to the applicant and authorized reviewers.</span></div>
      <button className="button button-full" disabled={busy}>{busy?'Submitting…':'Submit for verification'}</button>{notice&&<p className="notice" role="status">{notice}</p>}
    </form>
  </section>
}
