/**
 * Verified Source Registry.
 * Contains vetted, authentic official portals, legislative repositories,
 * healthcare authorities, and government registries.
 * Sources are mapped strictly according to topic; fake or non-existent URLs are never generated.
 */

export const VERIFIED_SOURCES = {
  'Legal Assistance': [
    {
      title: 'India Code — Official Legislative Repository',
      url: 'https://www.indiacode.nic.in/',
      description: 'Authentic digital repository of all Central & State Acts and Statutes',
      domain: 'indiacode.nic.in'
    },
    {
      title: 'eCourts Services — Case Status & Cause Lists',
      url: 'https://ecourts.gov.in/',
      description: 'Official District & High Court digital justice portal across India',
      domain: 'ecourts.gov.in'
    },
    {
      title: 'NALSA — National Legal Services Authority',
      url: 'https://nalsa.gov.in/',
      description: 'Free legal aid, Lok Adalat schedules & DLSA legal aid clinics',
      domain: 'nalsa.gov.in'
    },
    {
      title: 'Supreme Court of India Official Portal',
      url: 'https://www.sci.gov.in/',
      description: 'Apex court judgments, case status, practice directions & cause lists',
      domain: 'sci.gov.in'
    }
  ],

  'Cybercrime & Fraud': [
    {
      title: 'National Cyber Crime Reporting Portal (MHA)',
      url: 'https://cybercrime.gov.in/',
      description: 'Helpline 1930 & official digital reporting portal for cyber financial fraud',
      domain: 'cybercrime.gov.in'
    },
    {
      title: 'Chakshu — Suspected Fraud Communications (DoT)',
      url: 'https://sancharsaathi.gov.in/sfc/',
      description: 'Report fraudulent WhatsApp calls, fake SMS alerts & malicious numbers',
      domain: 'sancharsaathi.gov.in'
    },
    {
      title: 'RBI Sachet — Unregistered Financial Schemes Redressal',
      url: 'https://sachet.rbi.org.in/',
      description: 'Reserve Bank of India portal against illegal deposits & fraudulent lenders',
      domain: 'sachet.rbi.org.in'
    },
    {
      title: 'CERT-In — Indian Computer Emergency Response Team',
      url: 'https://www.cert-in.org.in/',
      description: 'National cybersecurity vulnerability advisories & incident reporting',
      domain: 'cert-in.org.in'
    }
  ],

  'Mental Health Support': [
    {
      title: 'Tele-MANAS — National Tele Mental Health Programme',
      url: 'https://telemanas.mohfw.gov.in/',
      description: 'Ministry of Health 24/7 free toll-free mental health tele-counseling (14416)',
      domain: 'telemanas.mohfw.gov.in'
    },
    {
      title: 'National Health Portal (MoHFW)',
      url: 'https://www.nhp.gov.in/',
      description: 'Authoritative health education, verified helpline numbers & public hospitals',
      domain: 'nhp.gov.in'
    }
  ],

  'Medical Information': [
    {
      title: 'National Health Portal — Ministry of Health & Family Welfare',
      url: 'https://www.nhp.gov.in/',
      description: 'Verified clinical information, disease orientation & public health guidelines',
      domain: 'nhp.gov.in'
    },
    {
      title: 'All India Institute of Medical Sciences (AIIMS New Delhi)',
      url: 'https://www.aiims.edu/',
      description: 'Premier national medical institute & National Poisons Information Centre',
      domain: 'aiims.edu'
    },
    {
      title: 'Ayushman Bharat PM-JAY Official Health Portal',
      url: 'https://pmjay.gov.in/',
      description: 'National public health insurance scheme eligibility & empanelled hospitals',
      domain: 'pmjay.gov.in'
    }
  ],

  'Government Services & Schemes': [
    {
      title: 'National Portal of India — Single Window Access',
      url: 'https://www.india.gov.in/',
      description: 'Single-window access to all Central & State government citizen services',
      domain: 'india.gov.in'
    },
    {
      title: 'DigiLocker — National Digital Document Wallet',
      url: 'https://www.digilocker.gov.in/',
      description: 'Legally valid electronic document repository under IT Act Section 9A',
      domain: 'digilocker.gov.in'
    },
    {
      title: 'RTI Online — Right to Information Portal',
      url: 'https://rtionline.gov.in/',
      description: 'Submit and track Right to Information requests to Central ministries',
      domain: 'rtionline.gov.in'
    },
    {
      title: 'CPGRAMS — Centralized Public Grievance Redress System',
      url: 'https://pgportal.gov.in/',
      description: 'Official portal to lodge citizen grievances regarding government departments',
      domain: 'pgportal.gov.in'
    }
  ],

  'Finance & Consumer Rights': [
    {
      title: 'National Consumer Helpline (NCH 1915)',
      url: 'https://consumerhelpline.gov.in/',
      description: 'Ministry of Consumer Affairs pre-litigation dispute redressal portal',
      domain: 'consumerhelpline.gov.in'
    },
    {
      title: 'e-Daakhil — Consumer Commission Online Filing',
      url: 'https://edaakhil.nic.in/',
      description: 'Online filing of consumer disputes before District, State & National Commissions',
      domain: 'edaakhil.nic.in'
    },
    {
      title: 'Reserve Bank of India — Consumer Education & Ombudsman',
      url: 'https://cms.rbi.org.in/',
      description: 'RBI Integrated Ombudsman Scheme for banking and NBFC grievance redressal',
      domain: 'cms.rbi.org.in'
    }
  ],

  'Education & Career': [
    {
      title: 'UGC — University Grants Commission of India',
      url: 'https://www.ugc.gov.in/',
      description: 'National apex higher education regulatory body and university verification',
      domain: 'ugc.gov.in'
    },
    {
      title: 'National Scholarship Portal (NSP)',
      url: 'https://scholarships.gov.in/',
      description: 'Official Government of India national scholarship application gateway',
      domain: 'scholarships.gov.in'
    }
  ],

  'Technology & Troubleshooting': [
    {
      title: 'MDN Web Docs — Web Standards Documentation',
      url: 'https://developer.mozilla.org/',
      description: 'Authoritative documentation for JavaScript, CSS, HTML and web APIs',
      domain: 'developer.mozilla.org'
    },
    {
      title: 'Python Official Documentation',
      url: 'https://docs.python.org/3/',
      description: 'Standard library reference and official tutorials for Python',
      domain: 'docs.python.org'
    }
  ]
}

export function getVerifiedSources(category, queryText = '') {
  const matches = VERIFIED_SOURCES[category]
  if (matches && matches.length > 0) {
    return matches.slice(0, 4)
  }

  // Fallback verified legal and public sources
  return [
    {
      title: 'India Code — Official Legislation Portal',
      url: 'https://www.indiacode.nic.in/',
      domain: 'indiacode.nic.in'
    },
    {
      title: 'National Portal of India',
      url: 'https://www.india.gov.in/',
      domain: 'india.gov.in'
    },
    {
      title: 'NALSA — Legal Services Authority',
      url: 'https://nalsa.gov.in/',
      domain: 'nalsa.gov.in'
    }
  ]
}
