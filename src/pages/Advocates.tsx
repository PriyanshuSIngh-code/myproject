import { useEffect, useState } from 'react'
import { MapPin, Search, ShieldCheck, UserRound, AlertCircle } from 'lucide-react'
import { getPublicAdvocates, type Advocate } from '../lib/api'
import { Link } from 'react-router-dom'
export default function Advocates() {
  const [items,setItems] = useState<Advocate[]>([])
  const [query,setQuery] = useState('')
  const [error,setError] = useState('')
  useEffect(()=>{getPublicAdvocates().then(setItems).catch(()=>setError('Unable to load directory right now. Please try again later.'))},[])
  const filtered = items.filter(a=>`${a.display_name} ${a.city??''} ${a.state??''} ${(a.practice_areas??[]).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="section container"><div className="eyebrow">ADVOCATE DIRECTORY</div><h1 className="page-title">Find support for <span className="gradient-text">your situation.</span></h1><p className="page-lede">Search approved directory listings. Always independently confirm enrollment, experience, fees and availability before engaging an advocate.</p>
    <div className="directory-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, city or practice area…"/></div>
    {error&&<p className="notice">{error}</p>}
    {filtered.length===0?<div className="empty-state"><span className="empty-icon"><UserRound size={28}/></span><h3>{query?'No matching approved listings':'No approved advocate listings yet'}</h3><p>This starter project intentionally contains no fabricated advocate records. Add real records only after verifying them through reliable sources and obtaining consent.</p><Link className="button button-ghost" to="/advocate/join">Advocate registration</Link></div>:
    <div className="advocate-grid">{filtered.map(a=><article className="advocate-card" key={a.id}><div className="advocate-avatar"><UserRound size={25}/></div><div className="verified-label"><ShieldCheck size={14}/> Approved listing</div><h3>{a.display_name}</h3><p className="location-line"><MapPin size={14}/>{[a.city,a.state].filter(Boolean).join(', ')||'Location not provided'}</p><p>{a.bio||'Profile details have not been added.'}</p><div className="tag-row">{(a.practice_areas??[]).map(p=><span className="tag" key={p}>{p}</span>)}</div><span className="listing-type">{a.listing_type==='legal_aid'?'Legal-aid listing':'Private advocate listing'}</span></article>)}</div>}
    <div className="notice-panel"><AlertCircle/><div><strong>About verification</strong><p>A badge should only appear after an administrator completes and records the required checks. This interface displays only records whose status is approved in the database.</p></div></div>
  </section>
}
