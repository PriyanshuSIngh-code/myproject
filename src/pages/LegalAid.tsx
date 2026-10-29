import { ExternalLink, Landmark, PhoneCall, FileText, ShieldAlert, Scale, HelpCircle } from 'lucide-react'

const officialServices = [
  {
    name: 'National Legal Services Authority (NALSA)',
    desc: 'Constitutional legal-aid body providing free legal counsel to women, children, undertrials, SC/ST citizens, and low-income individuals.',
    helpline: '15100 (Toll-Free 24x7)',
    url: 'https://nalsa.gov.in/',
    icon: Landmark,
    category: 'Free Legal Aid'
  },
  {
    name: 'Tele-Law Scheme (Department of Justice)',
    desc: 'Ministry of Law & Justice initiative enabling pre-litigation consultation with panel advocates via video conferencing and 500,000+ CSCs.',
    helpline: '14430 (Toll-Free)',
    url: 'https://www.tele-law.in/',
    icon: PhoneCall,
    category: 'Government Initiative'
  },
  {
    name: 'National Cyber Crime Reporting Helpline',
    desc: 'Ministry of Home Affairs portal for immediate reporting of cyber financial fraud, unauthorized online debits, and cyber crimes.',
    helpline: '1930 (Immediate Financial Freeze)',
    url: 'https://cybercrime.gov.in/',
    icon: ShieldAlert,
    category: 'Emergency Cyber Support'
  },
  {
    name: 'National Consumer Helpline (NCH)',
    desc: 'Department of Consumer Affairs guidance for deficiency of service, eCommerce fraud, and lodging complaints before Consumer Commissions.',
    helpline: '1915 (Toll-Free) or SMS 8800001915',
    url: 'https://consumerhelpline.gov.in/',
    icon: HelpCircle,
    category: 'Consumer Redressal'
  },
  {
    name: 'Supreme Court Legal Services Committee (SCLSC)',
    desc: 'Provides free legal representation and advocates for qualified litigants before the Supreme Court of India.',
    helpline: '011-23388322 / 23381257',
    url: 'https://sclsc.gov.in/',
    icon: Scale,
    category: 'Apex Court Legal Aid'
  },
  {
    name: 'eCourts Services & Case Tracking',
    desc: 'Official case status, court orders, cause lists, and caveat searches across 3,000+ district and high court complexes across India.',
    helpline: 'eCourts Mobile App / Portal',
    url: 'https://services.ecourts.gov.in/',
    icon: FileText,
    category: 'Court Services'
  },
  {
    name: 'India Code — Central & State Acts',
    desc: 'Digital repository of all Central Acts, Bharatiya Nyaya Sanhita, Consumer Protection Act, and updated state statutes.',
    helpline: 'Ministry of Law & Justice',
    url: 'https://www.indiacode.nic.in/',
    icon: Landmark,
    category: 'Official Legislation'
  }
]

export default function LegalAid() {
  return (
    <section className="section container">
      <div className="eyebrow">OFFICIAL GOVERNMENT & INSTITUTIONAL RESOURCES</div>
      <h1 className="page-title">Verified Indian <span className="gradient-text">Legal Aid Services.</span></h1>
      <p className="page-lede">
        Access official toll-free statutory helplines and portals created by the Government of India and the Supreme Court.
      </p>

      {/* Emergency Help Banner */}
      <div className="notice-panel" style={{ borderColor: 'var(--gold, #c7a45b)', background: 'rgba(199, 164, 91, 0.08)', marginBottom: 28 }}>
        <PhoneCall size={26} style={{ color: 'var(--gold, #c7a45b)' }}/>
        <div>
          <strong style={{ fontSize: '1.05rem' }}>National Legal Aid 24x7 Toll-Free Helpline: Dial 15100</strong>
          <p style={{ margin: '4px 0 0 0' }}>
            Inaugurated by the Chief Justice of India. Free consultation and representation for eligible citizens across all Indian states.
          </p>
        </div>
      </div>

      <div className="resource-grid">
        {officialServices.map(s => {
          const Icon = s.icon
          return (
            <a className="resource-card" href={s.url} target="_blank" rel="noreferrer" key={s.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="resource-icon"><Icon size={22}/></span>
                <span className="count-pill">{s.category}</span>
              </div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
              <div style={{ margin: '10px 0', fontSize: '0.88rem', color: 'var(--gold, #c7a45b)', fontWeight: 600 }}>
                Helpline: {s.helpline}
              </div>
              <span className="text-link">Open official portal <ExternalLink size={14}/></span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
