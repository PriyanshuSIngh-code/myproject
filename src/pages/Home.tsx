import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, MessageCircle, Search, Landmark, Sparkles, CheckCircle2, Scale } from 'lucide-react'

export default function Home() {
  return <>
    <section className="hero container">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-dot"/> MADE FOR LEGAL CLARITY IN INDIA</div>
        <h1>Know your rights.<br/><span className="gradient-text">Find your way forward.</span></h1>
        <p className="hero-lede">Understand legal processes, explore trusted resources, and take your next step with greater confidence.</p>
        <div className="hero-actions"><Link className="button" to="/chat">Ask a legal question <ArrowRight size={17}/></Link><Link className="button button-ghost" to="/advocates">Find an advocate</Link></div>
        <div className="trust-row"><ShieldCheck size={17}/><span>India-focused resources</span><span className="trust-sep">·</span><span>Privacy-conscious design</span></div>
      </div>
      <div className="hero-art" aria-label="Illustration of justice scales">
        <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
        <div className="art-glow"/>
        <div className="hero-emblem"><Scale size={84} strokeWidth={1.1}/></div>
        <div className="floating-card card-top"><span className="mini-icon"><ShieldCheck size={17}/></span><span><strong>Know your rights</strong><small>Start with clear information</small></span></div>
        <div className="floating-card card-bottom"><span className="mini-icon gold-mini"><Landmark size={17}/></span><span><strong>Official resources</strong><small>Explore trusted sources</small></span></div>
        <div className="art-caption">ACCESS TO JUSTICE, REIMAGINED</div>
      </div>
    </section>
    <section className="stats-strip"><div className="container stats-inner"><div><strong>01</strong><span>Ask questions</span></div><div><strong>02</strong><span>Explore options</span></div><div><strong>03</strong><span>Take informed action</span></div><div className="stats-note">A clearer first step<br/>starts here.</div></div></section>
    <section className="section container">
      <div className="section-heading"><div><div className="eyebrow">YOUR NEXT STEP</div><h2>Legal support, <span className="gradient-text">made simpler.</span></h2></div><p>Start with the help that fits your situation. Always confirm important decisions with an eligible legal professional.</p></div>
      <div className="feature-grid">
        <article className="feature-card"><span className="feature-icon"><MessageCircle/></span><h3>AI Legal Guide</h3><p>Explore general legal information and get directed to reliable official sources.</p><Link to="/chat" className="text-link">Ask a question <ArrowRight size={16}/></Link></article>
        <article className="feature-card"><span className="feature-icon"><Search/></span><h3>Find an Advocate</h3><p>Browse approved listings when available. Verification status should be based on real checks.</p><Link to="/advocates" className="text-link">Explore directory <ArrowRight size={16}/></Link></article>
        <article className="feature-card"><span className="feature-icon"><Landmark/></span><h3>Legal Aid Resources</h3><p>Find official starting points for free legal services and court-related information.</p><Link to="/legal-aid" className="text-link">View resources <ArrowRight size={16}/></Link></article>
      </div>
    </section>
    <section className="cta-wrap"><div className="container cta-panel"><div><div className="eyebrow">A MORE INFORMED FIRST STEP</div><h2>Questions are a good place to start.</h2><p>Get oriented, then verify your options through trusted sources.</p></div><Link className="button button-light" to="/chat">Explore the legal guide <ArrowRight size={17}/></Link><Sparkles className="cta-spark" size={100}/></div></section>
    <section className="section container why-row"><div><div className="eyebrow">BUILT WITH CARE</div><h2>Clarity first.<br/><span className="gradient-text">Trust always.</span></h2></div><ul className="check-list"><li><CheckCircle2/> Official-source-first approach</li><li><CheckCircle2/> Clear distinction between legal information and legal advice</li><li><CheckCircle2/> Advocate listings only after actual review</li><li><CheckCircle2/> Privacy and secure access designed into the architecture</li></ul></section>
    <div className="disclaimer-band"><div className="container"><strong>Important:</strong> NayayaMitra provides general legal information, not legal advice. It does not create an advocate-client relationship. For urgent or case-specific matters, contact a qualified advocate or the relevant legal-aid authority.</div></div>
  </>
}
