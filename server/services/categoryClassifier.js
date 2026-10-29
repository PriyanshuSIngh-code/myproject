/**
 * Intelligent Category Classifier and Contextual Follow-Up Generator.
 * Accurately analyzes query intent, assigns primary categories,
 * inspects jurisdiction requirements, and proposes proactive follow-up suggestions.
 */

const CATEGORY_RULES = [
  {
    category: 'Cybercrime & Fraud',
    subCategory: 'Financial Fraud & Digital Security',
    keywords: /\b(cyber\s*crime|hacked|phishing|scam|fraud|money\s*(stolen|debited)|fake\s*call|apk\s*file|sim\s*swap|unauthorized\s*transaction|1930|lottery\s*fraud|telegram\s*task|online\s*cheating|it\s*act|66d)\b/i,
    suggestions: [
      'How do I file an online complaint on cybercrime.gov.in?',
      'How does the 1930 Golden Hour freeze process work?',
      'What documents do I need to dispute an unauthorized bank transaction?',
      'How can I check if a suspicious APK file or link is dangerous?'
    ]
  },
  {
    category: 'Legal Assistance',
    subCategory: 'Civil & Criminal Procedure: Legal Notice Response',
    keywords: /\b(legal\s*notice|court\s*notice|lawyer\s*notice|advocate\s*notice)\b/i,
    suggestions: [
      'What happens if I do not reply to a legal notice within the deadline?',
      'How do I verify if the advocate who sent the notice is genuine?',
      'What documents should I gather to draft a formal legal reply?',
      'How much time do I legally have to respond to a legal notice?'
    ]
  },
  {
    category: 'Legal Assistance',
    subCategory: 'Tenancy Law: Eviction & Tenant Rights',
    keywords: /\b(landlord|tenant|tenancy|makan\s*malik|kirayedar|evict|vacate|security\s*deposit|rent\s*agreement)\b/i,
    suggestions: [
      'Can a landlord evict a tenant without giving 15 days statutory notice?',
      'What should I do if my landlord cuts my electricity, water, or locks the door?',
      'How can I get an injunction / stay order against forcible eviction from court?',
      'How do I legally recover my security deposit if the landlord refuses to refund it?'
    ]
  },
  {
    category: 'Legal Assistance',
    subCategory: 'Debt Recovery: Loans & Money Disputes',
    keywords: /\b(lent|loaned|borrowed|repaid|repay|friendly\s*loan|money\s*i\s*lent|udhar|paise\s*wapas|debt\s*recovery|summary\s*suit|order\s*37)\b/i,
    suggestions: [
      'Can I file a Summary Suit under Order 37 CPC to recover money lent without a formal contract?',
      'Are WhatsApp chats and bank UPI transfer receipts admissible proof of debt in court?',
      'What is the 3-year statutory limitation period for money recovery suits in India?',
      'When can unpaid loan recovery become a criminal cheating case under Section 318 BNS?'
    ]
  },
  {
    category: 'Legal Assistance',
    subCategory: 'Employment & Labour Law: Unpaid Wages',
    keywords: /\b(salary|wages|tankha|vetan|unpaid\s*salary|withheld\s*salary|delayed\s*salary|employer|wrongful\s*termination|notice\s*pay|gratuity|labour\s*court)\b/i,
    suggestions: [
      'How do I file an online wage complaint on the Ministry of Labour SAMADHAN portal?',
      'Can the Payment of Wages Authority award up to 10x compensation for withheld salary?',
      'What legal notice should be sent to company directors for unpaid salary?',
      'What is the statutory limitation period to claim unpaid salary in India?'
    ]
  },
  {
    category: 'Legal Assistance',
    subCategory: 'Criminal Law: Theft, Robbery & Burglary',
    keywords: /\b(theft|theift|robery|robbery|burglary|housebreak|broken\s*into|stolen|chori|cjori|dacoity|loot|daka|ghus\s*gaya|chor\s*ne|snatch(ing|ed)?|pocket\s*mar|pocket\s*maar|bag\s*chori|wallet\s*stolen)\b|चोरी|डकैती|लूट|डाका|चोर/i,
    suggestions: [
      'What immediate steps should I take to preserve evidence before police arrive?',
      'How do I block a stolen phone\'s IMEI on the CEIR portal?',
      'What should I do if the local police station refuses to register my FIR?',
      'What documents are required to file an insurance claim for stolen property?'
    ]
  },
  {
    category: 'Legal Assistance',
    subCategory: 'Rights, Disputes & Court Procedures',
    keywords: /\b(legal|law|advocate|lawyer|court|fir|police|complaint|notice|section\s*\d+|bns|ipc|crpc|divorce|maintenance|alimony|property|cheque|cheques|bounc(e|ed|ing)|138|consumer|nalsa|dlsa|bail|affidavit|agreement|contract|tenancy|tenant|landlord|eviction|labour|salary\s*unpaid|arrest|defamation|case|stolen|theft|robbery)\b/i,
    suggestions: [
      'What are the statutory limitation deadlines for this matter?',
      'How can I get free legal aid from DLSA / NALSA?',
      'What documents and written proof should I assemble first?',
      'When is sending a formal legal notice legally required?'
    ]
  },
  {
    category: 'Mental Health Support',
    subCategory: 'Emotional Wellbeing & Psychosocial Care',
    keywords: /\b(depress(ed|ion)|anxiety|panic\s*attack|mental\s*health|stress|counsel(or|ing)|therapy|lonely|hopeless|burnout|can'?t\s*sleep|grief|trauma|breakup|tele-?manas)\b/i,
    suggestions: [
      'How can I contact a certified counselor free of charge on Tele-MANAS (14416)?',
      'What are healthy grounding techniques for severe anxiety or panic?',
      'How do I know when it is time to seek professional psychiatric support?',
      'What daily habits help manage high chronic workplace or personal stress?'
    ]
  },
  {
    category: 'Medical Information',
    subCategory: 'Health Education & Symptom Orientation',
    keywords: /\b(doctor|medicine|tablet|symptom|fever|cough|headache|stomach\s*pain|blood\s*pressure|diabetes|infection|allergy|rash|vomiting|diarrhea|treatment|dosage|pain\s*killer|antibiotic|health)\b/i,
    suggestions: [
      'What warning signs indicate I should see a doctor immediately?',
      'What basic non-medicinal supportive care is recommended at home?',
      'What questions should I prepare to ask my consulting physician?',
      'How can I check authentic medical information on the National Health Portal?'
    ]
  },
  {
    category: 'Government Services & Schemes',
    subCategory: 'Public Welfare & Administrative Procedures',
    keywords: /\b(aadhaar|pan\s*card|passport|ration\s*card|voter\s*id|driving\s*licen[sc]e|rti|right\s*to\s*information|ayushman\s*bharat|pm-?jay|pension|epfo|pf\s*withdrawal|domicile|caste\s*certificate|birth\s*certificate|digilocker)\b/i,
    suggestions: [
      'What official documents are needed to apply for this service?',
      'How do I track my application status online on the official portal?',
      'How can I file an RTI application if the department delays processing?',
      'Where is the official government grievance portal (CPGRAMS)?'
    ]
  },
  {
    category: 'Finance & Consumer Rights',
    subCategory: 'Banking, Credit & Consumer Redressal',
    keywords: /\b(bank|loan|credit\s*card|cibil|emi|recovery\s*agent|interest\s*rate|refund|defective\s*product|warranty|e-?commerce\s*cheat|overcharged|mrp|consumer\s*forum|consumer\s*helpline)\b/i,
    suggestions: [
      'How do I lodge a complaint on the National Consumer Helpline (1915)?',
      'What are the RBI guidelines regarding loan recovery agent harassment?',
      'How can I dispute an incorrect report on my CIBIL credit score?',
      'What is the procedure to file a case in the District Consumer Commission?'
    ]
  },
  {
    category: 'Education & Career',
    subCategory: 'Academic Guidance & Career Growth',
    keywords: /\b(college|university|exam|admission|scholarship|degree|syllabus|upsc|ssc|neet|jee|clat|career|resume|interview|job\s*search|internship|ugc|study)\b/i,
    suggestions: [
      'What are the recognized eligibility criteria and deadlines for this?',
      'How should I structure my preparation schedule effectively?',
      'What official portals provide verified scholarships and funding?',
      'How can I optimize my CV / portfolio for relevant opportunities?'
    ]
  },
  {
    category: 'Technology & Troubleshooting',
    subCategory: 'Software, Hardware & Coding Solutions',
    keywords: /\b(code|programming|python|javascript|typescript|react|html|css|bug|error|git|database|sql|windows|mac|linux|wifi|software|install|crash|server)\b/i,
    suggestions: [
      'Could you provide a step-by-step code example with best practices?',
      'What common error causes this issue and how can I debug it?',
      'How do I safely test this configuration without breaking existing code?',
      'What are the performance or security implications of this approach?'
    ]
  }
]

export function classifyQuery(text) {
  const clean = (text || '').trim()

  // Detect language hints
  let detectedLanguageHint = 'English'
  if (/[\u0900-\u097F]/.test(clean)) {
    detectedLanguageHint = 'Hindi'
  } else if (/[\u0A00-\u0A7F]/.test(clean)) {
    detectedLanguageHint = 'Punjabi'
  } else if (/[\u0980-\u09FF]/.test(clean)) {
    detectedLanguageHint = 'Bengali'
  } else if (/[\u0B80-\u0BFF]/.test(clean)) {
    detectedLanguageHint = 'Tamil'
  }

  // Iterate category rules
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.test(clean)) {
      const requiresJurisdictionCheck = rule.category === 'Legal Assistance' && !/\b(delhi|mumbai|punjab|haryana|up|uttar\s*pradesh|bihar|karnataka|bengaluru|tamil\s*nadu|kerala|maharashtra|rajasthan|gujarat|india|supreme\s*court|high\s*court)\b/i.test(clean)

      return {
        category: rule.category,
        subCategory: rule.subCategory,
        requiresJurisdictionCheck,
        followUpSuggestions: rule.suggestions,
        detectedLanguageHint
      }
    }
  }

  // Default General Knowledge / Everyday Problem Solving
  return {
    category: 'General Knowledge',
    subCategory: 'Practical Problem Solving & Guidance',
    requiresJurisdictionCheck: false,
    followUpSuggestions: [
      'Could you explain this in simpler terms or provide an example?',
      'What are the most practical next steps I can take right now?',
      'Are there official or trusted references I should verify?',
      'What important details should I consider for my specific situation?'
    ],
    detectedLanguageHint
  }
}
