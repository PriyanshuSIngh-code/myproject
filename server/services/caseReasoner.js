/**
 * Comprehensive Intelligent Legal & Multi-Domain Case Reasoner.
 * 
 * Analyzes query intent, extracts concrete facts, applies modern statutory
 * provisions (Bharatiya Nyaya Sanhita 2023, BNSS 2023, BSA 2023, CPA 2019,
 * Transfer of Property Act 1882, Payment of Wages Act 1936, NI Act 1881),
 * identifies factual gaps, maintains thread context for genuine follow-ups,
 * and produces evidence-grounded, case-specific guidance in English, Hindi, and Hinglish.
 */

// -------------------------------------------------------------
// LANGUAGE DETECTION & HINGLISH SUPPORT
// -------------------------------------------------------------

export function isHinglishText(text) {
  if (!text) return false
  const lower = text.toLowerCase()
  // Indic Roman Hindi vocabulary that do NOT collide with standard English words
  const hinglishTokens = /\b(mere|meri|mera|mujhe|mujhko|maine|tumne|usne|unhone|kisi|kya|kyu|kyon|kaise|karo|karein|karna|karu|krna|chahiye|nahi|nhi|tha|thi|thay|hai|hain|raha|rahi|rahe|diya|diye|rakha|bola|hoga|hogi|hoge|bina|ghar|paise|pesa|paisa|khali|kamra|makan|dost|naukri|vetan|tankha|maalik|malik|kiraya|kirayedar|pulis|thana|chori|cjori|dhamki|bheja|mila|mile|karoonga|bataye|madad|gaya|gayi|liya|liye|bolo|batao|apne|apna|apni|bhai|bhen|parivar|ladai|jhagda|adalat|kagaz|saboot|gawah|dhokha|farzi|froud|rok|wapas|chhod|nikal|nikala|bataiye|mahine|mahina|unka|unki|iske|iski)\b/i
  const matches = (lower.match(new RegExp(hinglishTokens.source, 'gi')) || []).length
  return matches >= 2 || (matches >= 1 && /\b(bina|khali|paise|pesa|dhamki|chori|cjori|thana|malik|maalik|kiraya|nhi|nahi|diya|diye|chahiye|mahine)\b/i.test(lower))
}

export function determineLanguage(text, requestedLanguage = 'English') {
  if (requestedLanguage === 'हिन्दी' || /[\u0900-\u097F]/.test(text || '')) {
    return 'hi'
  }
  if (requestedLanguage === 'ਪੰਜਾਬੀ' || /[\u0A00-\u0A7F]/.test(text || '')) {
    return 'pa'
  }
  if (requestedLanguage === 'Hinglish' || isHinglishText(text)) {
    return 'hinglish'
  }
  return 'en'
}

// -------------------------------------------------------------
// FACT EXTRACTION & CASE CLASSIFICATION
// -------------------------------------------------------------

export function extractCaseDetails(text, conversationHistory = [], requestedLanguage = 'English') {
  const clean = (text || '').trim()
  const lower = clean.toLowerCase()

  // 1. Detect if this is a follow-up query requiring conversation context
  const isFollowUp = isFollowUpQuery(lower)
  let contextualTopic = null

  if (isFollowUp && conversationHistory.length > 0) {
    contextualTopic = resolveContextualTopic(conversationHistory)
  }

  // 2. Identify primary issue domain
  const issueType = detectIssueType(lower, contextualTopic)

  // 3. Extract concrete facts from message
  const facts = {
    hasDates: /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d+\s*(days?|months?|years?|mahine|saal)\s*(ago)?|today|yesterday|recently|aaj|kal)\b/i.test(clean),
    hasAmounts: /\b(rs\.?|inr|rupees?|₹|\$)\s*[\d,]+|\b\d+[\d,]*\s*(lakhs?|crores?|hazaar|k)\b/i.test(clean),
    hasAgreements: /\b(agreement|contract|lease|rent\s*agreement|deed|receipt|invoice|bill|appointment\s*letter|salary\s*slip|kagaz|dastavej)\b/i.test(clean),
    hasEvidence: /\b(whatsapp|sms|email|recording|photo|video|cctv|screenshot|bank\s*statement|saboot|proof)\b/i.test(clean),
    hasPoliceAction: /\b(fir|police|complaint|chowki|than[ae]|sp|dcp|magistrate|pulis)\b/i.test(clean),
    hasCourtAction: /\b(court|notice|suit|petition|advocate|lawyer|judge|vakil)\b/i.test(clean)
  }

  // 4. Determine language
  const languagePreference = determineLanguage(clean, requestedLanguage)
  const isHindi = languagePreference === 'hi'
  const isPunjabi = languagePreference === 'pa'
  const isHinglish = languagePreference === 'hinglish'

  return {
    rawMessage: clean,
    lower,
    issueType,
    isFollowUp,
    contextualTopic,
    facts,
    languagePreference,
    isHindi,
    isPunjabi,
    isHinglish
  }
}

export function isFollowUpQuery(lower) {
  const followUpTriggers = [
    /^(what\s*(should|shold|do)\s*i\s*(do|to\s*do)?\s*(next|now|first)?\??)$/i,
    /^(what\s*to\s*do\s*(next|now)?\??)$/i,
    /^(aage\s*kya\s*(karein|kare|karu|krna\s*chahiye)\??)$/i,
    /could\s*you\s*explain\s*(this\s*)?in\s*simpler\s*terms/i,
    /provide\s*an?\s*example/i,
    /explain\s*(this\s*)?in\s*(simpler|simple|easy)\s*terms/i,
    /saral\s*bhasha|aasan\s*shabdon/i,
    /what\s*are\s*the\s*most\s*practical\s*next\s*steps/i,
    /practical\s*next\s*steps/i,
    /what\s*important\s*details\s*should\s*i\s*consider/i,
    /are\s*there\s*official\s*or\s*trusted\s*references/i,
    /what\s*documents?\s*(are|do\s*i)\s*need/i,
    /what\s*evidence\s*(do\s*i\s*need|is\s*needed)/i,
    /kya\s*documents?\s*(chahiye|lagte\s*hain)/i,
    /what\s*is\s*the\s*limitation\s*(period|deadline)/i,
    /how\s*much\s*time\s*do\s*i\s*have/i,
    /can\s*(they|he|she)\s*(arrest|file|sue)\s*me/i,
    /how\s*do\s*i\s*file\s*(that|this|it)/i,
    /where\s*should\s*i\s*go/i,
    /what\s*if\s*(they|he|she)\s*(refuses?|fails?|does\s*not)/i,
    /can\s*i\s*get\s*(a\s*)?(refund|compensation|bail)/i,
    /what\s*details\s*should\s*i/i,
    /trusted\s*references/i,
    /next\s*steps\s*(i\s*can\s*take)?/i
  ]
  return followUpTriggers.some(rgx => rgx.test(lower.trim()))
}

export function detectFollowUpKind(lower) {
  if (/simpler\s*terms|explain\s*(this\s*)?in\s*simple|provide\s*an?\s*example|give.*example|saral\s*bhasha|aasan\s*bhasha/i.test(lower)) {
    return 'simpler_example'
  }
  if (/practical\s*next\s*steps|next\s*steps|what\s*(should|shold|do)\s*i\s*do\s*(next|now|first)|kya\s*karein|kya\s*krna\s*chahiye|aage\s*kya\s*kare/i.test(lower)) {
    return 'practical_steps'
  }
  if (/important\s*details|details\s*should\s*i\s*consider|specific\s*situation|critical\s*factors|things\s*to\s*consider/i.test(lower)) {
    return 'details_to_consider'
  }
  if (/official\s*(or\s*trusted\s*)?references|trusted\s*references|verified\s*sources|official\s*portals|helpline/i.test(lower)) {
    return 'official_references'
  }
  if (/documents?|evidence|proof|kya\s*kagaz|kya\s*saboot/i.test(lower)) {
    return 'documents_evidence'
  }
  return 'general_followup'
}

function resolveContextualTopic(history) {
  // Search backward through user & assistant history
  for (let i = history.length - 1; i >= 0; i--) {
    const text = (history[i]?.content || '').toLowerCase()
    if (text.includes('received a legal notice') || text.includes('legal notice received') || text.includes('court notice')) return 'legal_notice_received'
    if (text.includes('vacate without notice') || text.includes('bina notice') || text.includes('unlawful eviction')) return 'tenancy_eviction_without_notice'
    if (text.includes('repaid') || text.includes('money i lent') || text.includes('paise udhar') || text.includes('lent money')) return 'money_lent_recovery'
    if (text.includes('salary') || text.includes('wages') || text.includes('employer') || text.includes('tankha') || text.includes('vetan')) return 'labour_employment'
    if (text.includes('police station') || text.includes('police are asking') || text.includes('station') || text.includes('thana bulaya')) return 'police_station_summon'
    if (text.includes('police refuse') || text.includes('sho refuse') || text.includes('refused to register') || text.includes('refuse my fir')) return 'fir_refusal'
    if (text.includes('olx') || (text.includes('second-hand') && text.includes('seized'))) return 'stolen_goods_cheating'
    if (
      text.includes('theft') ||
      text.includes('theift') ||
      text.includes('robery') ||
      text.includes('robbery') ||
      text.includes('burglary') ||
      text.includes('housebreak') ||
      text.includes('stolen') ||
      text.includes('chori') ||
      text.includes('cjori') ||
      text.includes('dacoity') ||
      text.includes('loot') ||
      text.includes('daka') ||
      text.includes('snatch') ||
      text.includes('चोरी') ||
      text.includes('डकैती')
    ) return 'theft_robbery'
    if (text.includes('property') || text.includes('land') || text.includes('ancestral') || text.includes('sale deed') || text.includes('encroach')) return 'property_dispute'
    if (text.includes('cheque') || text.includes('bounce') || text.includes('138')) return 'cheque_bounce'
    if (text.includes('consumer') || text.includes('defective') || text.includes('warranty') || text.includes('refund')) return 'consumer_protection'
    if (text.includes('threat') || text.includes('intimidation') || text.includes('blackmail') || text.includes('extortion')) return 'criminal_threat'
    if (text.includes('cyber') || text.includes('1930') || text.includes('hacked') || text.includes('debited')) return 'cybercrime_fraud'
    if (text.includes('divorce') || text.includes('maintenance') || text.includes('custody')) return 'family_matrimonial'
    if (text.includes('tenant') || text.includes('landlord') || text.includes('evict') || text.includes('deposit')) return 'tenancy_dispute'
    if (text.includes('cors') || text.includes('code') || text.includes('react') || text.includes('express') || text.includes('javascript') || text.includes('python')) return 'tech_programming'
  }
  return null
}

function detectIssueType(lower, contextualTopic) {
  // Only inherit prior topic if this query is truly a contextual follow-up (NOT a new legal problem!)
  if (contextualTopic && isFollowUpQuery(lower)) {
    return contextualTopic
  }

  // 1. Non-legal tech/programming questions
  if (
    /\b(cors|react|javascript|typescript|python|express|node\.?js|html|css|api\s*route|sql\s*query|npm|build\s*error|git\s*(commit|push)|docker|redux)\b/i.test(lower) &&
    !/\b(section|court|police|bns|ipc|fir|lawsuit)\b/i.test(lower)
  ) {
    return 'tech_programming'
  }

  // 2. Ambiguous / Insufficient facts queries (only when truly empty and generic)
  if (
    /^(can\s*i\s*(sue|take\s*legal\s*action)\??)$/i.test(lower) ||
    /^(i\s*need\s*legal\s*(help|advice)\??)$/i.test(lower) ||
    /^(what\s*are\s*my\s*rights\??)$/i.test(lower) ||
    /^(someone\s*cheated\s*me\??)$/i.test(lower) ||
    /^(mujhe\s*madad\s*chahiye\??)$/i.test(lower) ||
    /^(kya\s*karein\??)$/i.test(lower)
  ) {
    return 'ambiguous_insufficient_facts'
  }

  // 3. Legal Notice Received (User received a legal notice from someone)
  if (
    /\b(received\s*(a\s*)?legal\s*notice|got\s*(a\s*)?legal\s*notice|legal\s*notice\s*received|notice\s*received|served\s*(with\s*)?(a\s*)?(legal\s*)?notice|received\s*(a\s*)?notice)\b/i.test(lower) ||
    /\b(legal\s*notice\s*(aaya|mila|bheja|aa\s*gaya)|court\s*ka\s*notice\s*mila|vakil\s*ka\s*notice|legal\s*notice.*what\s*(should\s*i|to)\s*do|notice.*kya\s*(karu|karein))\b/i.test(lower)
  ) {
    return 'legal_notice_received'
  }

  // 4. Tenancy: Eviction Without Notice / Forcible Dispossession
  if (
    (/\b(landlord|makan\s*malik|owner)\b/i.test(lower) && /\b(vacat(e|ing)|evict(ion|ed)?|leave|khali|nikal)\b/i.test(lower) && /\b(without\s*notice|no\s*notice|bina\s*notice|immediately|turant|force|forcibly|dhamki|taala|lock)\b/i.test(lower)) ||
    /\b(landlord.*vacate.*without\s*notice|bina\s*notice.*ghar\s*khali|ghar\s*khali.*bina\s*notice|evict.*without\s*notice|eviction.*without\s*notice)\b/i.test(lower)
  ) {
    return 'tenancy_eviction_without_notice'
  }

  // 5. Money Lent Recovery / Friendly Loan Dispute (Someone hasn't repaid)
  if (
    /\b(repaid|repay|lent|loaned|lend|borrowed|friendly\s*loan|give\s*back\s*my\s*money|return\s*my\s*money|money\s*(i\s*)?lent|not\s*returning\s*(my\s*)?money|owe(s)?\s*me\s*money|someone\s*has\s*not\s*repaid)\b/i.test(lower) ||
    /\b(paise?\s*(udhar|diye|de\s*rakhe|diya\s*tha)|udhar\s*diya|wapas\s*n(ahi|hi)\s*(de\s*raha|kar\s*raha)|paise\s*fase|paise\s*n(ahi|hi)\s*lotaye|paise\s*n(ahi|hi)\s*diye|udhar\s*liye\s*wapas)\b/i.test(lower)
  ) {
    return 'money_lent_recovery'
  }

  // 6. Police Inquiries / Calling to Police Station / Notice of Appearance
  if (
    /\b(police\s*(are\s*)?(calling|asked|asking|summon(ed|ing)?|want\s*me\s*to\s*(come|visit)|call(ed)?\s*me)|come\s*to\s*(the\s*)?(police\s*)?station|visit\s*(the\s*)?(police\s*)?station|notice\s*of\s*appearance|41a\b|35\(3\)\s*bnss)\b/i.test(lower) ||
    (/\b(police|police\s*station|thana|thane|chowki)\b/i.test(lower) && /\b(aane\s*ko|bulaya|bula\s*rahi|bula\s*rahe|call\s*kar\s*rahi|summon)\b/i.test(lower)) ||
    /\b(thana|thane)\s*(bulaya|bula\s*rahe|bula\s*rahi|aane\s*ko\s*(bola|bol\s*rahi|bol\s*rahe))\b/i.test(lower)
  ) {
    return 'police_station_summon'
  }

  // 7. Police FIR Refusal & Criminal Procedure
  if (
    /\b(police\s*(refus(ed|ing)|not\s*registering|won'?t\s*take)|(sho|police|officer)\s*refus(ed|ing)|refus(ed|ing)\s*(to\s*)?(register|take|file)\s*(my\s*)?(fir|complaint)|zero\s*fir|sp\s*representation|156\(3\)|175\(3\))\b/i.test(lower)
  ) {
    return 'fir_refusal'
  }

  // 7. Stolen phone / goods bought on OLX / second-hand from individual
  if (
    /\b(stolen|olx|second-?hand|bought\s*from\s*(a\s*)?(person|someone|guy)|seized\s*by\s*police)\b/i.test(lower) &&
    /\b(phone|mobile|bike|laptop|vehicle|olx)\b/i.test(lower)
  ) {
    return 'stolen_goods_cheating'
  }

  // 8. Theft, Housebreaking, Robbery & Burglary
  if (
    /\b(theft|theift|robery|robbery|burglary|housebreak|broken\s*into|stolen|chori|cjori|dacoity|loot|daka|ghus\s*gaya|chor\s*ne|snatch(ing|ed)?|pocket\s*mar|pocket\s*maar|bag\s*chori|wallet\s*stolen)\b/i.test(lower) ||
    /[\u0900-\u097F]/.test(lower) && /\b(चोरी|डकैती|लूट|डाका|चोर)\b/.test(lower) ||
    /mere\s*sath\s*(c?jori|chori)/i.test(lower)
  ) {
    return 'theft_robbery'
  }

  // 9. Labour & Unpaid Wages / Wrongful Termination
  if (
    /\b(salary|wages|tankha|vetan|remuneration)\b/i.test(lower) &&
    /\b(unpaid|withheld|delayed|pending|not\s*paid|rok\s*li|n(ahi|hi)\s*di|n(ahi|hi)\s*mila|n(ahi|hi)\s*mile|employer|company|termination|fired|3\s*mahine)\b/i.test(lower) ||
    /\b(employer\s*ne.*salary|salary\s*unpaid|unpaid\s*salary|wrongful\s*terminat(ion|ed)|notice\s*pay|gratuity|pf\s*not\s*credited|labour\s*court)\b/i.test(lower)
  ) {
    return 'labour_employment'
  }

  // 10. Consumer Protection: Defective goods / Service deficiency
  if (
    /\b(service\s*center|warranty|defective|display\s*stopped|flipkart|amazon|retailer|authorized|cpa|consumer|e-daakhil|replacement)\b/i.test(lower) &&
    /\b(phone|mobile|laptop|tv|fridge|appliance|product|item)\b/i.test(lower)
  ) {
    return 'consumer_protection'
  }

  // 11. Property & Land Disputes
  if (
    /\b(property|land|ancestral|plot|flat|boundary|encroach(ment|ed)?|illegal\s*possession|khata|jamabandi|khatoni|sale\s*deed|partition\s*suit|mutation|adverse\s*possession|trespass|registry|forged\s*deed|zamin|zameen)\b/i.test(lower)
  ) {
    return 'property_dispute'
  }

  // 12. Criminal Threats, Intimidation & Extortion
  if (
    /\b(threat(en|ened|ening)?|threats?\s*to\s*(kill|harm|destroy)|extort(ion)?|blackmail|criminal\s*intimidation|stalk(ing|ed)?|harass(ment|ing)?|fear\s*for\s*life|marne\s*ki\s*dhamki)\b/i.test(lower)
  ) {
    return 'criminal_threat'
  }

  // 13. Cheque Dishonour / NI Act 138
  if (
    /\b(cheque|138|dishonour|bounce|bounced|bank\s*return\s*memo|drawer|payee|statutory\s*notice)\b/i.test(lower)
  ) {
    return 'cheque_bounce'
  }

  // 14. Tenancy & Landlord-Tenant Disputes (general)
  if (
    /\b(landlord|tenant|tenancy|security\s*deposit|evict(ion|ed)?|rent\s*(agreement|hike|arrears)|vacat(e|ing)|model\s*tenancy|kirayedar|makan\s*malik)\b/i.test(lower)
  ) {
    return 'tenancy_dispute'
  }

  // 15. Family & Matrimonial Law
  if (
    /\b(divorce|maintenance|alimony|custody|child\s*custody|domestic\s*violence|pwdva|restitution|conjugal|dowry|498a|talaq)\b/i.test(lower)
  ) {
    return 'family_matrimonial'
  }

  // 16. Contracts & Commercial Debt Recovery
  if (
    /\b(contract|breach\s*of\s*contract|commercial\s*dispute|arbitration|mou|agreement\s*breach)\b/i.test(lower)
  ) {
    return 'contract_recovery'
  }

  // 17. Cybercrime & Financial Digital Fraud
  if (
    /\b(cyber|1930|phishing|otp\s*scam|unauthorized\s*debit|bank\s*fraud|upi\s*scam|apk|telegram\s*scam|part\s*time\s*job\s*scam|sim\s*swap)\b/i.test(lower)
  ) {
    return 'cybercrime_fraud'
  }

  return 'general_legal'
}

// -------------------------------------------------------------
// INTELLIGENT CASE-SPECIFIC GENERATORS
// -------------------------------------------------------------

export function generateIntelligentResponse(caseDetails, language = 'English') {
  const { issueType, isFollowUp, contextualTopic, facts, rawMessage, isHindi, isPunjabi, isHinglish, lower } = caseDetails
  
  // Resolve effective language:
  const lang = (language === 'हिन्दी' || isHindi) ? 'hi' :
               (language === 'Hinglish' || isHinglish) ? 'hinglish' :
               (language === 'ਪੰਜਾਬੀ' || isPunjabi) ? 'pa' : 'en'

  const activeTopic = contextualTopic || (issueType && issueType !== 'general_legal' ? issueType : null)
  const followUpKind = detectFollowUpKind(lower || '')

  // Contextual Follow-Up Resolver
  if (isFollowUp && activeTopic) {
    const contextualResult = generateContextualFollowUpResponse(activeTopic, followUpKind, caseDetails, lang)
    if (contextualResult) {
      return contextualResult
    }
  }

  switch (issueType) {
    case 'legal_notice_received':
      return generateLegalNoticeReceivedResponse(caseDetails, lang)

    case 'tenancy_eviction_without_notice':
      return generateTenancyEvictionWithoutNoticeResponse(caseDetails, lang)

    case 'money_lent_recovery':
      return generateMoneyLentRecoveryResponse(caseDetails, lang)

    case 'police_station_summon':
      return generatePoliceStationSummonResponse(caseDetails, lang)

    case 'labour_employment':
      return generateLabourEmploymentResponse(caseDetails, lang)

    case 'theft_robbery':
      return generateTheftRobberyResponse(caseDetails, lang)

    case 'property_dispute':
      return generatePropertyDisputeResponse(caseDetails, lang)

    case 'consumer_protection':
      return generateConsumerProtectionResponse(caseDetails, lang)

    case 'stolen_goods_cheating':
      return generateStolenGoodsCheatingResponse(caseDetails, lang)

    case 'criminal_threat':
      return generateCriminalThreatResponse(caseDetails, lang)

    case 'fir_refusal':
      return generateFirRefusalResponse(caseDetails, lang)

    case 'cheque_bounce':
      return generateChequeBounceResponse(caseDetails, lang)

    case 'tenancy_dispute':
      return generateTenancyDisputeResponse(caseDetails, lang)

    case 'family_matrimonial':
      return generateFamilyMatrimonialResponse(caseDetails, lang)

    case 'contract_recovery':
      return generateContractRecoveryResponse(caseDetails, lang)

    case 'cybercrime_fraud':
      return generateCybercrimeResponse(caseDetails, lang)

    case 'tech_programming':
      return generateTechProgrammingResponse(caseDetails, lang)

    case 'ambiguous_insufficient_facts':
      return generateAmbiguousFactsResponse(caseDetails, lang)

    default:
      return generateDynamicCaseAnalysis(caseDetails, lang)
  }
}

// -------------------------------------------------------------
// 1. LEGAL NOTICE RECEIVED
// -------------------------------------------------------------
function generateLegalNoticeReceivedResponse(details, lang) {
  if (lang === 'hinglish') {
    return `Legal notice milne par ghabrayein nahi. Notice ka matlab yeh bilkul nahi hota ki court ne koi faisla de diya hai ya police karyavahi karne aa rahi hai. Yeh opposite party ke advocate dwara bheja gaya ek pre-litigation kadam hota hai jisme unki maangein aur grievances likhi hoti hain.

Sabse buniyadi niyam yeh hai: Never Ignore a Legal Notice (kisi bhi legal notice ko nazarandaz na karein). Agar aap samay par jawab nahi dete, toh kal ko adalat me opposite party yeh dastaavej pesh kar sakti hai ki aapne unke arop ko chupchap swikar kar liya. Iske alawa, notice me aamtaur par jawab dene ke liye 15 din ya 30 din ka statutory time diya jata hai. Jis registered post ya speed post lifafe me notice aaya hai, us postal envelope ko barcode aur delivery stamp sahit surakshit rakhein (Preserve the Postal Envelope), kyunki kanoonan samay-seema delivery date se shuru hoti hai.

Abhi aapko yeh kadam uthane chahiye:
- Notice ko dhyan se padh kar dekhein ki mukaddama kis vishay par hai (jaise Section 138 cheque bounce, recovery of debt, tenancy, ya matrimonial).
- Jo baatein sach hain aur jo arop bilkul galat hain, unhe alag-alag mark karein.
- Apne sabhi supporting dastaavej aur digital records (bank statements, payment slips, WhatsApp chat backups) nikaal kar rakhein.
- Ek qualified advocate ke madhyam se point-by-point formal reply draft karwayein aur use Registered Post with Acknowledgment Due (RPAD) aur speed post ke zariye stipulated time ke bheetar bhejein.

Aapki behtar madad ke liye: yeh legal notice kis vishay par aaya hai, aur usme reply ke liye kitne din (jaise 15 din ya 30 din) ka time diya gaya hai?`
  }

  if (lang === 'hi') {
    return `लीगल नोटिस प्राप्त होने पर घबराएं नहीं। लीगल नोटिस का अर्थ न्यायालय का निर्णय अथवा गिरफ्तारी नहीं होता, बल्कि यह विपक्षी पक्ष द्वारा मुकदमा दायर करने से पूर्व प्रेषित की जाने वाली वैधानिक चेतावनी होती है।

अनिवार्य सिद्धांत: Never Ignore a Legal Notice (नोटिस की कभी अनदेखी न करें)। यदि आप निर्धारित समय-सीमा में औपचारिक प्रतिउत्तर नहीं देते, तो न्यायालय में इसे तथ्यों की मौन स्वीकृति के रूप में प्रस्तुत किया जा सकता है। नोटिस में उत्तर देने हेतु सामान्यतः 15 से 30 दिवस की समय-सीमा दी जाती है। जिस स्पीड पोस्ट अथवा निबंधित डाक के लिफाफे में नोटिस प्राप्त हुआ है, उस डाक लिफाफे (Preserve the Postal Envelope) को बारकोड व डिलीवरी मुहर सहित सुरक्षित रखें, क्योंकि विधि के अनुसार परिसीमा नोटिस प्राप्ति की वास्तविक तिथि से प्रारंभ होती है।

वर्तमान में निम्नलिखित व्यावहारिक कदम उठाएं:
- विवाद का कारण समझें कि नोटिस चेक अनादर (Section 138 NI Act), धन वसूली, बेदखली, अथवा पारिवारिक विवाद से संबंधित है।
- नोटिस में वर्णित वास्तविक तथ्यों तथा असत्य आरोपों का पृथक्करण करें।
- संबंधित प्राथमिक दस्तावेज, बैंक अंतरण विवरण, तथा इलेक्ट्रॉनिक साक्ष्य एकत्र करें।
- एक योग्य अधिवक्ता के परामर्श से बिंदुवार औपचारिक विधिक प्रतिउत्तर तैयार कर Registered Post with Acknowledgment Due (RPAD) द्वारा निर्धारित समय में प्रेषित कराएं।

स्पष्टीकरण हेतु: यह नोटिस किस विषय से संबंधित है, तथा इसमें उत्तर देने हेतु कितने दिवस की समयावधि निर्धारित की गई है?`
  }

  return `Receiving a formal legal notice is not a court judgment or an arrest warrant. Under Indian civil procedure, it is a pre-litigation step served by an opposing party's advocate outlining their grievances and demands before initiating court proceedings.

The most fundamental rule is: Never Ignore a Legal Notice. Failing to respond to a formal legal notice can lead the court to draw an adverse inference that you had no defense to the allegations. Most statutory notices specify a firm compliance timeline—typically 15 to 30 days depending on the matter (such as 15 days under Section 138 of the Negotiable Instruments Act, or 30 days for general contractual disputes). Always Preserve the Postal Envelope: keep the registered post envelope containing the postal tracking barcode and delivery stamp, as limitation under law begins strictly from the date of receipt/service, not the date typed on the paper.

Here is the prudent roadmap you should follow:
- Ascertain whether the notice concerns a civil debt, tenancy eviction, matrimonial dispute, or a statutory complaint.
- Mark the claims into admitted facts versus false or exaggerated allegations.
- Assemble your supporting records: agreements, bank statements, UPI transaction IDs, and relevant email or WhatsApp exchanges.
- Have an advocate prepare a formal, point-by-point reply and dispatch it via Registered Post with Acknowledgment Due (RPAD) and speed post within the stipulated window.

To help narrow down your strategy: what specific claim or allegation is stated in the notice, and what response deadline (e.g. 15 or 30 days) has been given?`
}

// -------------------------------------------------------------
// 2. TENANCY: EVICTION WITHOUT NOTICE
// -------------------------------------------------------------
function generateTenancyEvictionWithoutNoticeResponse(details, lang) {
  if (lang === 'hinglish') {
    return `Agar aapka landlord (makan malik) bina kisi formal notice ke achanak ghar ya kamra khali karne ka dabav bana raha hai, toh kanoonan landlord ko aisa karne ka bilkul koi adhikar nahi hai. Indian tenancy law ke mutabik koi bhi landlord kisi kirayedaar ko bina kanooni notice aur court order ke zabardasti bahar nahi nikal sakta.

Transfer of Property Act, 1882 ki Dhara 106 ke antargat, kisi bhi monthly tenancy ko khatam karne ke liye makan malik ko kam se kam 15 din ka formal written notice dena kanoonan anivarya hai. Iske alawa, rajyon ke Rent Control Acts kirayedaaron ko aur bhi mazboot kanooni suraksha dete hain. Landlord aapke kamre ka taala nahi tod sakta, bahar se taala nahi laga sakta, aur bijli ya pani ki supply nahi kaat sakta—aisa karna Bharatiya Nyaya Sanhita, 2023 (BNS) ki Dhara 329 (Criminal Trespass) aur Dhara 351 (Criminal Intimidation) ke tehat apradh hai.

Aapko turant yeh kadam uthane chahiye:
- Apne sabhi kirayedari dastaavej surakshit rakhein: Rent Agreement, har mahine rent transfer ki bank/UPI receipts, aur security deposit ki raseed.
- Landlord ko likhit sandesh (WhatsApp ya email) bhejein ki aap timely rent ada kar rahe hain aur kanoon ke anusar bina proper written notice ke khali karne ka dabav gair-kanooni hai.
- Agar makan malik zabardasti kare, saman bahar fekne ki dhamki de ya bijli-pani kaate, toh turant 112 par call karein. Police aakar gair-kanooni dispossession rokti hai.
- Agar dabav jari rahe, toh advocate ke madhyam se Civil Court me Order 39, Rules 1 & 2 CPC ke tehat injunction (stay order) file karke adalat se protection le sakte hain taaki bina due process of law aapko na nikala ja sake.

Kya aapka written rent agreement abhi active hai ya expire ho gaya hai, aur aap kis shehar ya state me hain?`
  }

  if (lang === 'hi') {
    return `भारतीय किरायेदारी विधि के अंतर्गत कोई भी मकान मालिक अपने किरायेदार को बिना उचित विधिक सूचना (Notice) के मनमाने ढंग से घर खाली करने के लिए विवश नहीं कर सकता। पट्टा समाप्त होने पर भी मकान मालिक को विधि की उचित प्रक्रिया (without due process of law) का उल्लंघन करने का कोई अधिकार नहीं है।

संपत्ति अंतरण अधिनियम, 1882 (Transfer of Property Act, 1882) की धारा 106 के अनुसार, मासिक किरायेदारी को समाप्त करने हेतु कम से कम 15 दिवस की पूर्व लिखित सूचना देना अनिवार्य है। इसके अतिरिक्त, मकान मालिक द्वारा जबरन ताला लगाना, सामान बाहर फेंकना अथवा बिजली-पानी काटना भारतीय न्याय संहिता, 2023 (BNS) की धारा 329 व धारा 351 के तहत आपराधिक कृत्य है।

इस स्थिति में निम्नलिखित कदम उठाएं:
- अपना किराया अनुबंध (Rent Agreement), मासिक किराया अंतरण की बैंक/UPI रसीदें तथा अमानत राशि (Security Deposit) के दस्तावेज सुरक्षित रखें।
- मकान मालिक को लिखित रूप में सूचित करें कि आप धारा 106 के तहत अनिवार्य विधिक नोटिस के हकदार हैं और जबरन बेदखली विधि-विरुद्ध है।
- किसी भी प्रकार के शारीरिक बलप्रयोग अथवा बुनियादी सुविधाओं की कटौती पर तुरंत 112 डायल करें।
- यदि उत्पीड़न जारी रहता है, तो सिविल प्रक्रिया संहिता (CPC) के आदेश 39, नियम 1 व 2 (Order 39, Rules 1 & 2) के तहत सिविल न्यायालय में स्थायी अथवा अस्थायी निषेधाज्ञा (Stay Order against Forcible Dispossession) हेतु आवेदन प्रस्तुत करें।

क्या आपका किराया अनुबंध वर्तमान में प्रभावी है तथा आप किस राज्य अथवा शहर में निवासरत हैं?`
  }

  return `Under Indian law, a landlord cannot simply order a tenant to pack up and vacate without serving proper written notice. Even if a lease has expired or a dispute has arisen, a landlord has zero legal authority to resort to self-help eviction or physically dispossess a tenant without due process of law.

Section 106 of the Transfer of Property Act, 1882 mandates that a monthly tenancy can only be terminated by serving a formal written notice of at least 15 clear days. In addition, state-specific Rent Control Acts provide robust protection against arbitrary eviction. Crucially, a landlord cannot physically lock you out, tamper with your personal belongings, or cut off essential amenities such as electricity and water. Doing so constitutes criminal offences under Section 329 (Criminal Trespass) and Section 351 (Criminal Intimidation / Wrongful Restraint) of the Bharatiya Nyaya Sanhita, 2023 (BNS).

Here is the recommended course of action:
- Consolidate all tenancy proof: your signed Rent Agreement, rent receipts, UPI transfer confirmations, and security deposit documentation.
- Send a polite, firm written reply (via WhatsApp or email) stating that you are paying rent regularly and that under Section 106 of the Transfer of Property Act, you are entitled to statutory notice and peaceful possession.
- If the landlord issues threats, locks the premises, or disconnects utilities, dial 112 immediately. The local police will record the incident and prevent unlawful dispossession.
- If harassment persists, an advocate can file an injunction suit under Order 39, Rules 1 & 2 of the Code of Civil Procedure (CPC) in the civil court to obtain a judicial stay restraining the landlord from dispossessing you without due process of law.

In which state or city are you residing, and is your written rental agreement currently active or has it lapsed?`
}

// -------------------------------------------------------------
// 3. MONEY LENT RECOVERY / FRIENDLY LOAN DISPUTES
// -------------------------------------------------------------
function generateMoneyLentRecoveryResponse(details, lang) {
  if (lang === 'hinglish') {
    return `Agar aapne kisi dost ya jaan-pehchan wale ko paise udhar diye the aur wo wapas karne se inkar kar raha hai ya taalta ja raha hai, toh kanoon ke tehat aapke paas civil debt recovery ke bohot mazboot kanooni vikalp maujood hain. Personal ya friendly loan me sabse pehla kadam civil recovery hota hai.

Civil mamlo me sabse zaroori cheez hoti hai 3 saal ki samay-seema (limitation period). Limitation Act, 1963 ke mutabik paise wapas mangne ke liye civil suit file karne ka samay aamtaur par paise dene ya repayment ki due date se 3 saal hota hai. Par ek mahatvapurna kanooni niyam yeh hai ki Section 18 ke tehat agar borrower ne WhatsApp, SMS ya email par likh kar mana hai ki 'main paise agle mahine de dunga' ya thode paise wapas kiye hain, toh us acknowledgement ki tareekh se 3 saal ka samay naye sire se reset ho jata hai.

Aapko recovery ke liye yeh vyavaharik kadam uthane chahiye:
- Apne sabhi digital aur likhit saboot nikaal kar rakhein: Bank statement jisme transfer ka UTR reference ho, UPI transaction slips, WhatsApp chats jisme paise mangne aur wapas karne ka waada tha, ya koi promissory note/cheque.
- Ek advocate ke madhyam se borrower ko Registered Speed Post (RPAD) se 15 din ka Legal Demand Notice bhejein, jisme mool rashi (principal) aur reasonable byaaj ke sath wapsi ki maang karein. Aksar notice milte hi log bina adalat gaye aapas me settle kar lete hain.
- Agar notice ke baad bhi wo paise nahi deta, toh aap District Civil Court me Order 37 of Code of Civil Procedure (CPC) ke tehat Summary Suit file kar sakte hain. Summary suit fast-track hoti hai jisme samne wale ko court tab tak defend karne ki ijaazat nahi deta jab tak wo koi thos vajah na dikhaye.
- Criminal case (cheating) ke bare me dhyan rakhein: aamtaur par udhar na chukana civil dispute hota hai. Criminal complaint (Section 318 BNS) sirf tab lagti hai agar shuru se hi uski niyat dhokhadhadi karne aur paise hadapne ki thi.

Paise bank transfer/UPI se diye gaye the ya cash me, aur kya aapke paas repayment ki koi likhit baat ya WhatsApp chat available hai?`
  }

  if (lang === 'hi') {
    return `यदि आपने किसी मित्र अथवा परिचित को धनराशि उधार दी थी और वह निर्धारित समय बीतने पर भी राशि लौटाने में टालमटोल या इनकार कर रहा है, तो भारतीय विधि के अंतर्गत सिविल ऋण वसूली (Civil Debt Recovery) के प्रभावी उपचार उपलब्ध हैं।

इस संबंध में सबसे महत्वपूर्ण नियम परिसीमा अवधि (Limitation Period) का है। भारतीय परिसीमा अधिनियम, 1963 (Limitation Act, 1963) के अनुसार ऋण वसूली हेतु वाद दायर करने की वैधानिक समय-सीमा 3 वर्ष होती है। हालांकि, धारा 18 के अनुसार यदि ऋणी ने व्हाट्सएप, ईमेल अथवा संदेश में ऋण स्वीकार किया है (Acknowledgment of Debt), तो उस लिखित अभिस्वीकृति की तिथि से 3 वर्ष की नई समय-सीमा प्रारंभ हो जाती है।

वसूली हेतु व्यावहारिक कदम इस प्रकार हैं:
- लेन-देन के सभी इलेक्ट्रॉनिक साक्ष्य एकत्र करें: बैंक खाता विवरण (Bank Statement showing UPI/NEFT UTR), व्हाट्सएप चैट, ईमेल अथवा कोई प्रॉमिसरी नोट या चेक।
- किसी अधिवक्ता के माध्यम से ऋणी को रजिस्टर्ड डाक द्वारा 15 दिन का विधिक मांग नोटिस (Legal Demand Notice) भेजें, जिसमें मूल धनराशि तथा ब्याज के भुगतान की मांग की जाए।
- यदि 15 दिन में समाधान नहीं होता, तो व्यवहार न्यायालय में सिविल प्रक्रिया संहिता के आदेश 37 (Order 37 CPC) के तहत त्वरित समरी वाद (Summary Suit for Recovery) दायर करें।
- आपराधिक धोखाधड़ी (धारा 318 BNS) केवल तभी लागू होती है जब विपक्षी की नीयत प्रारंभ से ही धन हड़पने और धोखा देने की रही हो, अन्यथा सामान्य ऋण विवाद सिविल प्रकृति का होता है।

क्या धनराशि बैंक अंतरण के माध्यम से दी गई थी अथवा नकद में, और क्या आपके पास ऋण वापसी की कोई लिखित चैट या रसीद उपलब्ध है?`
  }

  return `When you lend money to a friend or acquaintance and they later refuse or stall repayment, Indian civil law provides clear mechanisms to recover your dues. Because personal lending is primarily a contractual and civil matter, the focus should be on establishing the debt and securing formal recovery rather than treating it merely as a criminal issue.

The first critical factor to keep in mind is the statutory limitation period. Under the Limitation Act, 1963, a civil suit to recover money lent must generally be brought within 3 years from the date the loan was advanced or when repayment fell due. However, under Section 18 of the Limitation Act, any written acknowledgment of the liability—such as a WhatsApp message, email, or partial repayment—before the limitation expires resets the clock and provides a fresh 3-year limitation window from that date.

Here is the practical roadmap to recover your funds:
- Gather all financial and written evidence: your bank statements showing the debit entry with UTR/transaction reference numbers, UPI confirmations, signed promissory notes or cheques, and WhatsApp chats or emails where the borrower acknowledged borrowing the money or promised repayment.
- Have an advocate draft and issue a formal Legal Demand Notice via Registered Post with Acknowledgment Due (RPAD) giving the borrower a strict deadline of 15 days to repay the principal along with reasonable interest. In many instances, a formal legal notice resolves the matter without going to trial.
- If the borrower still refuses, you can file a Summary Suit under Order 37 of the Code of Civil Procedure, 1908 (CPC) in the jurisdictional civil court. An Order 37 suit is an expedited debt-recovery proceeding where the defendant has no automatic right to defend unless they satisfy the court that they have a genuine, triable defense.
- Regarding criminal charges: normal failure to repay a loan is a civil breach of contract, not fraud. Criminal complaints under Section 318 of the Bharatiya Nyaya Sanhita, 2023 (BNS) for cheating only apply if you can establish that the person had fraudulent and dishonest intentions right from the beginning when taking the money.

Was the money transferred electronically through bank/UPI or given in cash, and do you have any text messages or written notes where your friend acknowledged the debt?`
}

// -------------------------------------------------------------
// 3B. POLICE INQUIRY / STATION SUMMONS
// -------------------------------------------------------------
function generatePoliceStationSummonResponse(details, lang) {
  if (lang === 'hinglish') {
    return `Agar police aapko phone par ya zubaani thane aane ke liye keh rahi hai, toh sabse pehle ghabrayein nahi aur shant rahein. Thane bulane ka matlab yeh bilkul nahi hota ki aapko giraftaar kiya ja raha hai. Police aksar kisi shikayat ki jaanch (preliminary inquiry) ya gavahi (witness statement) ke liye bulati hai.

Kanooni taur par aapko apne adhikar pata hone chahiye:
- Substantive Notice: Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) ki Dhara 35(3) (purani CrPC ki Section 41A) ke tehat agar mamla 7 saal se kam saza ka hai ya koi aarop hai, toh police ko formal likhit Notice of Appearance dena zaroori hai. Sirf phone call ya verbal instruction kanooni summon nahi hoti.
- Gawah ke roop me bulana: Agar aapko kisi mamle me gawah ke roop me bulaya ja raha hai, toh BNSS ki Dhara 179 (purani CrPC 160) ke tehat likhit aadesh aana chahiye. Aur agar mahila, 15 saal se kam umra ka bachha, ya 60 saal se upar ke buzurg hain, toh police unhe thane nahi bula sakti; unka bayan unke ghar par hi liya jana anivarya hai.
- Right to Information: Aapko poora haq hai ki aap phone par police officer ka naam, designation, police station ka naam, aur FIR number ya General Diary (GD) number poochein ki kis shikayat ke silsile me bulaya ja raha hai.

Aapko yeh zaroori kadam uthane chahiye:
- Calling officer se shalinata se poochein: "Officer sahab, kis matter ya FIR/GD number ke sambandh me bulaya ja raha hai, aur kya main isme suspect hoon ya witness?"
- Unse anurodh karein ki wo BNSS Section 35(3) ya Section 179 ke tehat formal written notice WhatsApp ya email par bhej dein.
- Thane kabhi bhi akele na jayein. Apne parivar ko suchit rakhein aur kisi dost ya vakil (advocate) ko sath lekar jayein.
- Constitution ke Article 22(1) aur BNSS Section 38 ke tehat aapko apne vakil se paramarsh lene ka kanooni haq hai, aur Article 20(3) ke mutabik kisi ko bhi apne khilaf bayan dene ke liye majboor nahi kiya ja sakta.

Kya officer ne aapko koi FIR number ya specific shikayat ka zikr kiya tha, aur aap kis shehar ya state me hain?`
  }

  if (lang === 'hi') {
    return `यदि पुलिस अधिकारी आपको फोन अथवा मौखिक रूप से थाने उपस्थित होने को कह रहे हैं, तो सर्वप्रथम घबराएं नहीं। थाने बुलाए जाने का यह अर्थ कदापि नहीं है कि आपको गिरफ्तार किया जा रहा है; पुलिस प्रायः किसी शिकायत की प्राथमिक जांच अथवा साक्षी के रूप में बयान दर्ज करने के लिए भी बुलाती है।

भारतीय नागरिक सुरक्षा संहिता, 2023 (BNSS) के तहत आपके विधिक अधिकार इस प्रकार हैं:
- उपस्थिति का विधिक नोटिस (Notice of Appearance): BNSS की धारा 35(3) (पूर्व धारा 41A CrPC) के अनुसार, यदि किसी व्यक्ति के विरुद्ध 7 वर्ष तक के कारावास वाले अपराध की जांच चल रही है, तो पुलिस अधिकारी द्वारा लिखित नोटिस जारी किया जाना अनिवार्य है। मात्र फोन कॉल का कोई वैधानिक बाध्यकारी प्रभाव नहीं होता।
- साक्षी के रूप में उपस्थिति (धारा 179 BNSS): यदि आपको साक्षी के रूप में बुलाया जा रहा है, तो BNSS की धारा 179 (पूर्व धारा 160 CrPC) के तहत लिखित आदेश होना आवश्यक है। महिला, 15 वर्ष से कम आयु के बालक तथा 60 वर्ष से अधिक आयु के वरिष्ठ नागरिकों को थाने नहीं बुलाया जा सकता; उनकी जांच उनके निवास स्थान पर ही की जाएगी।
- सूचना का अधिकार: आपको बुलाने वाले अधिकारी का नाम, पदनाम, थाने का नाम तथा जीडी (General Diary) प्रविष्टि या प्राथमिकी (FIR) क्रमांक जानने का पूर्ण विधिक अधिकार है।

इस स्थिति में निम्नलिखित कदम उठाएं:
- अधिकारी से विनम्रतापूर्वक पूछें कि किस मामले अथवा एफआईआर/जीडी नंबर के तहत और किस हैसियत में (साक्षी अथवा संदेही) बुलाया जा रहा है।
- अधिकारी से अनुरोध करें कि वे धारा 35(3) अथवा धारा 179 BNSS के अंतर्गत विधिवत लिखित नोटिस प्रेषित करें।
- थाने कभी अकेले न जाएं; अपने परिवार को सूचित करें तथा किसी अधिवक्ता या विश्वसनीय व्यक्ति को साथ रखें।
- संविधान के अनुच्छेद 22(1) तथा BNSS की धारा 38 के तहत विधिक परामर्श का अधिकार तथा अनुच्छेद 20(3) के तहत आत्म-दोषारोपण से संरक्षण आपका मौलिक अधिकार है।

क्या पुलिस ने आपको किसी विशिष्ट घटना अथवा एफआईआर संख्या का विवरण दिया है, तथा आप किस राज्य अथवा शहर में हैं?`
  }

  return `If the police have contacted you asking you to come down to the police station, the first rule is to stay calm and not panic. A police call does not automatically imply arrest; officers routinely summon individuals during preliminary inquiries, verification of complaints, or to record witness statements.

Under Indian criminal procedure—specifically the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)—you have clear statutory safeguards:
- Notice of Appearance: Under Section 35(3) of the BNSS (corresponding to Section 41A of the earlier CrPC), if an allegation involves offences punishable with imprisonment up to 7 years, the investigating officer is legally mandated to issue a formal written Notice of Appearance specifying the date, time, and location. An informal telephone call has no statutory validity to compel attendance.
- Witness Examination: Under Section 179 of the BNSS (formerly Section 160 CrPC), police can summon witnesses acquainted with the facts of a case, but women, children under the age of 15, and persons above 60 years of age cannot be required to attend at the police station—they must be examined at their residence.
- Right to Information & Counsel: You are legally entitled to know the designation of the officer, the police station, the relevant General Diary (GD) entry or FIR number, and whether you are being questioned as a witness or a suspect. Under Article 22(1) of the Constitution and Section 38 of the BNSS, you have the right to consult an advocate of your choice.

Here is what you should do immediately:
- Politely ask the caller for their full name, rank, the police station they are calling from, and the specific FIR or GD complaint number under investigation.
- Respectfully request that they send a formal written notice under Section 35(3) or Section 179 of the BNSS to your address or via email/WhatsApp so you have a record of the summons.
- Never attend a police station unaccompanied. Inform your family and arrange for an advocate or trusted associate to accompany you.
- Remember that under Article 20(3) of the Constitution of India, you cannot be compelled to make self-incriminating statements or sign blank documents.

Did the calling officer disclose whether there is an FIR or complaint registered, and what is your location or jurisdiction?`
}

// -------------------------------------------------------------
// 4. LABOUR & EMPLOYMENT: UNPAID SALARY
// -------------------------------------------------------------
function generateLabourEmploymentResponse(details, lang) {
  if (lang === 'hinglish') {
    return `Agar aapke employer ya company ne aapki salary rok rakhi hai ya pichhle mahino ka vetan nahi diya hai, toh kanoonan kisi bhi employer ko employee ki mehnat ka kamaya hua vetan rokne ka bilkul koi adhikar nahi hai. Indian labour laws me employee ke vetan ki suraksha ke liye bohot kade niyam hain.

Payment of Wages Act, 1936 ki Dhara 5 ke anusar har company ko agle mahine ki 7 tareekh (ya badi company me 10 tareekh) tak vetan release karna kanoonan anivarya hai. Iske alawa Dhara 15 ke tehat Labour Commissioner ya Payment of Wages Authority ke paas yeh kanooni adhikar hai ki wo company ko pending salary ke sath-sath roki gayi rashi ka 10 guna tak muavza (compensation) dilwa sakti hai. Agar unhone bina notice period ke nikala hai, toh notice period ka pura vetan aur unavailed leaves ka encashment bhi unhe dena padega.

Aapko recovery ke liye yeh vyavaharik kadam uthane chahiye:
- Apne sabhi employment documents ekatha karein: Appointment letter, purani salary slips, bank statements jisme pehle salary aati thi, attendance records, aur resignation ya termination ke emails.
- Management, HR aur Directors ko ek formal written demand email bhejein, jisme pending mahine aur exact amount likhein aur 7 din ka clear time dein.
- Agar 7 din me salary release nahi hoti, toh advocate ke madhyam se registered speed post se Formal Legal Notice bhejein, jisme pending amount par 18% per annum byaaj ki maang karein.
- Iske sath hi aap Ministry of Labour ke official online portal samadhan.labour.gov.in par apni dispute register kar sakte hain, ya local Labour Commissioner (DLC) ke office me Payment of Wages Act ki Section 15 ke tehat written complaint file kar sakte hain. Note karein ki Labour Authority ke samne aavedan 12 mahine ke andar karna hota hai.

Company ka naam kya hai aur kya aapke paas written appointment letter aur pichhli salary slips available hain?`
  }

  if (lang === 'hi') {
    return `भारतीय श्रम कानूनों के अंतर्गत किसी भी नियोक्ता (Employer) को अपने कर्मचारी का अर्जित वेतन रोकने का कोई विधिक अधिकार नहीं है। 

मजदूरी संदाय अधिनियम, 1936 (Payment of Wages Act, 1936) की धारा 5 के अनुसार प्रत्येक संस्थान को माह समाप्त होने के 7 से 10 दिनों के भीतर वेतन का भुगतान करना अनिवार्य है। अधिनियम की धारा 15 के तहत यदि नियोक्ता जानबूझकर वेतन रोकता है, तो श्रम प्राधिकारी बकाया वेतन के साथ रोकी गई राशि के 10 गुना तक प्रतिकर (Statutory Compensation) का आदेश पारित कर सकते हैं। बिना पूर्व सूचना के सेवामुक्ति की स्थिति में अनुबंध के अनुसार नोटिस पे (Notice Pay) और अर्जित अवकाशों का नकदीकरण भी अनिवार्य होता है।

वेतन वसूली हेतु निम्नलिखित कदम उठाएं:
- अपने रोजगार संबंधी दस्तावेज सुरक्षित करें: नियुक्ति पत्र (Offer/Appointment Letter), पूर्व वेतन पर्चियां (Salary Slips), बैंक खाता विवरण, उपस्थिति प्रमाण एवं सेवामुक्ति संबंधी ईमेल।
- प्रबंधन और मानव संसाधन विभाग (HR) को औपचारिक मांग ईमेल प्रेषित करें, जिसमें बकाया महीनों, कुल राशि का स्पष्ट उल्लेख हो और 7 दिनों की समय-सीमा दें।
- यदि निर्धारित समय में भुगतान न हो, तो किसी अधिवक्ता के माध्यम से 15 दिन का वैधानिक विधिक नोटिस (Legal Notice) रजिस्टर्ड डाक द्वारा भेजें जिसमें 18% वार्षिक ब्याज की मांग शामिल हो।
- श्रम मंत्रालय के आधिकारिक समाधान पोर्टल (samadhan.labour.gov.in) पर ऑनलाइन शिकायत दर्ज करें अथवा स्थानीय उप श्रम आयुक्त (DLC) के समक्ष मजदूरी संदाय अधिनियम की धारा 15 के अंतर्गत परिवाद प्रस्तुत करें। श्रम प्राधिकारी के समक्ष 12 माह के भीतर आवेदन करना आवश्यक होता है।

क्या आपके पास नियुक्ति पत्र एवं पूर्व वेतन पर्चियां उपलब्ध हैं तथा आप किस राज्य में कार्यरत हैं?`
  }

  return `Under Indian labour and employment laws, an employer has zero legal justification to withhold earned wages or delay salary payments. The law firmly protects an employee's statutory right to timely compensation for work performed.

Under Section 5 of the Payment of Wages Act, 1936, employers are legally required to disburse monthly wages before the expiry of the 7th day (or the 10th day in larger establishments) of the following wage period. Furthermore, under Section 15 of the Act, the designated Labour Authority has the statutory power not only to order the release of your full unpaid wages but also to award penalty compensation up to ten times the withheld amount. If you were terminated without the stipulated notice period, your employer remains legally obligated to pay your full notice pay (salary in lieu of notice) and encash any accrued leave.

Here is the practical roadmap to recover your unpaid salary:
- Assemble your documentary proof: your offer letter or appointment contract, previous salary slips, bank account statements evidencing salary deposits, timesheet or attendance records, and any official email correspondence regarding your wages or exit.
- Send a polite but firm written demand email directly to HR, Finance, and the Directors stating the exact months and total amount overdue, and stipulate a clear deadline of 7 business days for disbursement.
- If they fail to comply, have an advocate serve a formal Legal Demand Notice via Registered Post with Acknowledgment Due (RPAD), giving 15 days to settle the dues along with 18% interest per annum.
- Simultaneously, you can lodge an official dispute on the Ministry of Labour and Employment's SAMADHAN portal (samadhan.labour.gov.in) or file an application under Section 15 of the Payment of Wages Act before the jurisdictional Deputy Labour Commissioner (DLC). Claims before the Labour Authority should generally be submitted within 12 months from the date wages fell due.

Do you have your signed appointment letter, and what is the city or state where your office is located?`
}

// -------------------------------------------------------------
// 5. THEFT, BURGLARY & ROBBERY
// -------------------------------------------------------------
function generateTheftRobberyResponse(details, lang) {
  const isHindi = lang === 'hi' || details.isHindi || /[\u0900-\u097F]/.test(details.rawMessage) || /mere\s*sath\s*(chori|cjori)/i.test(details.lower)

  if (isHindi) {
    return `### **चोरी / डकैती / सेंधमारी (Theft & Robbery) — तत्काल कानूनी कदम एवं अधिकार**

यदि आपके घर, दुकान या वाहन में चोरी या लूट हुई है, तो **बिना किसी देरी के निम्नलिखित कानूनी कदम उठाएं**:

**1. तुरंत किए जाने वाले प्राथमिक कार्य (First 2 Hours — Golden Hour Actions):**
- **112 पर तुरंत कॉल करें**: राष्ट्रीय आपातकालीन नंबर **112** (Police Emergency) पर कॉल करके तुरंत पुलिस पीसीआर वैन को बुलाएं।
- **घटना स्थल को सुरक्षित रखें (Preserve Crime Scene)**: पुलिस या फॉरेंसिक फिंगरप्रिंट टीम के आने तक दरवाजों के हैंडल, टूटे ताले, अलमारी, तिजोरी या बिखरे सामान को हाथ न लगाएं ताकि उंगलियों के निशान (fingerprints) नष्ट न हों।
- **डिजिटल सुरक्षा व ब्लॉकिंग**:
  - यदि मोबाइल फोन चोरी हुआ है, तो तुरंत सरकारी **CEIR पोर्टल ([ceir.gov.in](https://ceir.gov.in/))** पर जाकर फोन का IMEI ब्लॉक करें और टेलीकॉम ऑपरेटर से सिम (SIM) ब्लॉक करवाएं ताकि OTP चोरी न हो सके।
  - यदि डेबिट/क्रेडिट कार्ड या चेकबुक चोरी हुई है, तो तुरंत बैंक कस्टमर केयर या मोबाइल ऐप से खाते और कार्ड को ब्लॉक करवाएं।

**2. भारतीय न्याय संहिता, 2023 (BNS) के तहत लागू धाराएं:**
- **धारा 303(2) BNS (चोरी - Theft)**: किसी की संपत्ति बिना सहमति बेईमानी से ले जाना (3 वर्ष तक का कारावास या जुर्माना या दोनों)।
- **धारा 305 BNS (निवास स्थान / घर में चोरी - Theft in Dwelling House)**: घर या दुकान के अंदर चोरी करने पर **7 वर्ष तक का कठोर कारावास एवं जुर्माना**।
- **धारा 309 व 310 BNS (लूट व डकैती - Robbery & Dacoity)**: बल प्रयोग या हथियार दिखाकर लूट करने पर **10 से 14 वर्ष तक का कठोर कारावास**।
- **धारा 331 व 332 BNS (रात में घर में जबरन घुसना / सेंधमारी - House-Breaking by Night)**: रात के समय ताला तोड़कर घुसने पर कठोर सजा।

**3. अनिवार्य FIR दर्ज कराना (BNSS की धारा 173):**
- नजदीकी पुलिस थाने (Jurisdictional Thana) में लिखित शिकायत देकर **भारतीय नागरिक सुरक्षा संहिता, 2023 (BNSS) की धारा 173** के तहत **FIR दर्ज करवाएं**।
- **धारा 173(2) BNSS के तहत FIR की हस्ताक्षरित प्रमाणित प्रति (Certified Copy) निःशुल्क (Free of Cost) पाना आपका वैधानिक अधिकार है**।
- चोरी गए सामान की पूरी सूची (बिल, सीरियल नंबर, जेवरात की रसीद या फोटो) पुलिस को संलग्न करें।

**4. यदि पुलिस FIR दर्ज करने से मना करे:**
- BNSS की **धारा 173(3)** के तहत पुलिस अधीक्षक (SP / DCP) को स्पीड पोस्ट से लिखित शिकायत भेजें।
- या **धारा 175(3) BNSS** (पूर्व 156(3) CrPC) के तहत न्यायिक मजिस्ट्रेट के समक्ष याचिका दायर कर FIR दर्ज करने का आदेश प्राप्त करें।

**5. बीमा दावा (Insurance Claim):**
- यदि आपके घर या सामान का बीमा है, तो **24 से 48 घंटे के भीतर** बीमा कंपनी को सूचित करें और FIR की प्रति जमा करें।`
  }

  return `### **Theft, Housebreaking & Robbery: Immediate Legal & Police Action Roadmap**

Under the modern criminal jurisprudence governed by the **Bharatiya Nyaya Sanhita, 2023 (BNS)** and the **Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)**:

**1. Immediate First-Hour Priority Steps:**
- **Call 112 Immediately**: Dial **112** (Pan-India Emergency Response Support System) to report the incident and have the local PCR patrol inspect the scene.
- **Preserve Forensic Evidence at Crime Scene**:
  - Do **not touch** door handles, broken locks, opened almirahs, windows, or floor areas until the police investigating officer (IO) and fingerprint forensic unit have dusted for latent fingerprints and photographed the premises.
- **Immediate Digital Asset Protection**:
  - **Stolen Mobile Phone**: Immediately blacklist the device IMEI on the Central Equipment Identity Register (**[ceir.gov.in](https://ceir.gov.in/)**) to disable the device across all Indian telecom networks, and call your carrier to block the SIM card.
  - **Stolen ATM / Credit Cards**: Call your bank's 24x7 emergency helpline or use internet banking to freeze all debit cards, credit cards, and UPI IDs.

**2. Mandatory Statutory Penal Provisions (Bharatiya Nyaya Sanhita, 2023):**
- **Section 303(2) BNS (Theft)**: Punishment for theft with imprisonment extending up to **3 years**, or fine, or both.
- **Section 305 BNS (Theft in a Dwelling House or Building)**: Theft committed in any building, tent, or vessel used as a human dwelling or for property custody is punishable with imprisonment for a term up to **7 years and fine**.
- **Section 309 BNS (Robbery)**: Theft accompanied by violence, restraint, or threat of instant hurt is punishable with rigorous imprisonment up to **10 years** (up to **14 years** if committed on a highway between sunset and sunrise).
- **Section 331 & 332 BNS (Lurking House-Trespass & House-Breaking by Night)**: Entering or breaking into premises by night to commit an offence carries severe aggravated penal terms.

**3. Lodging the First Information Report (FIR) under Section 173 BNSS, 2023:**
- Visit the jurisdictional Police Station (Thana) and submit a detailed, written, signed complaint specifying the date, time, mode of entry, and detailed description of the stolen articles.
- **Right to a Free Certified Copy**: Under **Section 173(2) BNSS, 2023**, you have an absolute statutory right to receive a certified copy of the FIR **free of charge** immediately upon registration.
- Attach all available purchase invoices, IMEI receipts, gold hallmark certificates, or photographs of stolen property.

**4. Statutory Remedies If Police Refuse to Register FIR:**
- **Representation to SP/DCP (Section 173(3) BNSS)**: If the Station House Officer (SHO) refuses to register the FIR, send your signed complaint by Registered Post to the Superintendent of Police or Deputy Commissioner of Police.
- **Application Before Judicial Magistrate (Section 175(3) BNSS)**: If the SP fails to act, you have the right to file an application before the jurisdictional Judicial Magistrate First Class seeking an order directing the police to register the FIR and investigate.

**5. Insurance & Property Recovery (Superdari):**
- If your home or goods were insured, notify your insurance company within **24 to 48 hours** with the FIR acknowledgment.
- When the police trace and seize stolen articles from suspects, file an application for interim release of property under **Section 503 BNSS, 2023 (Superdari)** to take possession of your goods from the court.`
}

// -------------------------------------------------------------
// 6. PROPERTY & LAND DISPUTES
// -------------------------------------------------------------
function generatePropertyDisputeResponse(details, lang) {
  return `### **Property Title & Encroachment Dispute: Legal Framework & Strategy**

Under the **Specific Relief Act, 1963**, the **Transfer of Property Act, 1882**, and the **Code of Civil Procedure, 1908 (CPC)**:

**1. Primary Legal Remedies:**
- **Suit for Declaration of Title & Possession**:
  - File a civil suit under **Section 34 of the Specific Relief Act, 1963** seeking a judicial declaration that you are the lawful owner, coupled with a prayer for recovery of possession under **Section 5 or Section 6**.
- **Temporary Injunction (Order 39, Rules 1 & 2 CPC)**:
  - File an interim application along with your plaint for an injunction order restraining the encroacher from altering the physical status of the land, creating third-party interests, or continuing illegal construction during the pendency of the suit.
- **Criminal Trespass Complaint**:
  - If encroachment was done using force or intimidation, lodge a police complaint under **Section 329 of the Bharatiya Nyaya Sanhita, 2023 (BNS)** (Criminal Trespass).

**2. Mandatory Revenue & Title Evidence:**
1. **Registered Sale Deed / Title Conveyance**: Your certified primary title deed registered under the Registration Act, 1908.
2. **Current Revenue Records**: Jamabandi, Khatoni, Record of Rights (RoR), and recent Mutation entry.
3. **Encumbrance Certificate (EC)**: Reflecting transactions over the past 15–30 years.
4. **Demarcation / Boundary Survey Report**: Official survey report conducted by the local Revenue Tehsildar or Kanungo.

**3. Limitation Period:**
- Under **Article 65 of the Limitation Act, 1963**, a suit for possession of immovable property based on title has a **12-year limitation period** from the date the defendant's possession becomes adverse to the plaintiff.`
}

// -------------------------------------------------------------
// 7. CONSUMER PROTECTION & WARRANTY
// -------------------------------------------------------------
function generateConsumerProtectionResponse(details, lang) {
  return `### **Consumer Dispute & Warranty Denial: CPA 2019 Legal Framework**

Under the **Consumer Protection Act, 2019 (CPA 2019)**:

**1. Statutory Consumer Rights:**
- **Deficiency in Service & Defective Goods**: Under **Section 2(10) & 2(11) CPA 2019**, refusing warranty repair for an inherently defective product constitutes a severe deficiency in service and unfair trade practice.
- **Product Liability (Chapter VI, CPA 2019)**: Both the manufacturer and the authorized seller are strictly liable under product liability provisions to replace the defective product, refund the purchase amount, or compensate for damages caused.

**2. Recommended Step-by-Step Action:**
1. **Lodge Grievance on National Consumer Helpline (NCH)**:
   - Call toll-free **1915** or register your dispute online at **[consumerhelpline.gov.in](https://consumerhelpline.gov.in/)**.
2. **Serve Formal Legal Notice (15 Days)**:
   - Serve a written legal notice to the manufacturer and seller demanding replacement or full refund within **15 days**.
3. **File Online Complaint on e-Daakhil Portal**:
   - If unpaid, lodge a formal consumer case online on **[e-daakhil.nic.in](https://edaakhil.nic.in/)** before the District Consumer Disputes Redressal Commission. Consumer commissions have jurisdiction up to ₹50 Lakhs for District Commissions.

**3. Limitation:**
- A consumer complaint must be filed within **2 years** from the date on which the cause of action arose (Section 69, CPA 2019).`
}

// -------------------------------------------------------------
// 8. STOLEN GOODS BOUGHT ON OLX / SECOND-HAND CHEATING
// -------------------------------------------------------------
function generateStolenGoodsCheatingResponse(details, lang) {
  return `### **Stolen Property Purchased on OLX / Second-Hand: Legal Protections**

If police have seized a second-hand article (mobile, bike, laptop) you bought on OLX or from an individual:

**1. Criminal Law Implications:**
- **Bona Fide Purchaser for Value Without Notice**:
  - Under criminal jurisprudence, if you purchased the article in good faith, paid fair market consideration, and had no knowledge or reason to believe it was stolen, you cannot be charged under **Section 317(2) BNS, 2023** (dishonestly receiving stolen property).
- **Cheating by the Seller (Section 318, BNS, 2023)**:
  - The seller committed a criminal offence of **Cheating under Section 318, Bharatiya Nyaya Sanhita, 2023 (BNS)** by misrepresenting that they held clean, lawful title.

**2. Immediate Action Steps:**
1. **Cooperate with Investigating Officer (IO)**:
   - Provide the police with full purchase records: OLX chat screenshots, seller's phone number, UPI/cash receipt, and ad listing URL.
2. **Lodge Criminal Complaint Against the Seller**:
   - File an FIR under **Section 318 BNS** against the seller for cheating and fraud at the local police station.
3. **File Application for Superdari (Section 503 BNSS, 2023)**:
   - If the property is essential, your advocate can file an application under Section 503 BNSS for interim custody pending trial.`
}

// -------------------------------------------------------------
// 9. CRIMINAL THREATS & INTIMIDATION
// -------------------------------------------------------------
function generateCriminalThreatResponse(details, lang) {
  return `### **Criminal Threats & Intimidation: Emergency & Legal Safeguards**

Under the **Bharatiya Nyaya Sanhita, 2023 (BNS)** and the **Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)**:

**1. Applicable Penal Provisions:**
- **Section 351, BNS, 2023 (Criminal Intimidation)**: Whoever threatens another with injury to their person, reputation, or property with intent to cause alarm commits criminal intimidation.
- **Aggravated Threats (Section 351(3) BNS)**: If the threat is to cause death, grievous hurt, or destruction of property, it is punishable with imprisonment for up to **7 years**, or fine, or both.

**2. Immediate Safety & Legal Protocol:**
1. **Call 112 Immediately**: If there is imminent danger of physical violence or an assailant nearby, dial **112**.
2. **Preserve Complete Digital Evidence**:
   - Preserve threat WhatsApp messages, call audio recordings, and SMS. Do not delete them.
   - Obtain a certificate under **Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA)** to guarantee court admissibility.
3. **Lodge Written Complaint Under Section 173 BNSS**:
   - Submit a formal written complaint to the Station House Officer (SHO) of the jurisdictional police station requesting registration of an FIR and police protection.`
}

// -------------------------------------------------------------
// 10. POLICE FIR REFUSAL
// -------------------------------------------------------------
function generateFirRefusalResponse(details, lang) {
  return `### **Police Refusal to Register an FIR: Statutory Legal Remedies**

Under Indian criminal procedure governed by **Section 173 of the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)** and the Supreme Court Constitution Bench ruling in ***Lalita Kumari v. Govt. of UP (2014) 2 SCC 1***:

**1. Mandatory Registration of Cognizable Offences:**
- When information discloses the commission of a cognizable offence (theft, robbery, criminal threats, physical assault, cyber fraud), the police officer is legally bound to register an FIR immediately.

**2. Step-by-Step Remedies Against Police Inaction:**
1. **Demand Zero FIR**: If the crime occurred outside the station's territory, police must still register a **Zero FIR** and transfer it to the jurisdictional station.
2. **Written Representation to Superintendent of Police (Section 173(3) BNSS)**:
   - Send your detailed, signed complaint by Registered Post to the **Superintendent of Police (SP)** or Deputy Commissioner of Police (DCP).
3. **Application Before Judicial Magistrate (Section 175(3) BNSS)**:
   - If the SP fails to direct an investigation, file an application before the jurisdictional **Judicial Magistrate** under **Section 175(3) BNSS** (formerly Section 156(3) CrPC). The Magistrate can order the police to register the FIR and investigate.`
}

// -------------------------------------------------------------
// 11. CHEQUE BOUNCE / NI ACT 138
// -------------------------------------------------------------
function generateChequeBounceResponse(details, lang) {
  return `### **Cheque Dishonour: Statutory Roadmap Under Section 138, NI Act**

Under **Section 138 of the Negotiable Instruments Act, 1881 (NI Act)**:

**1. Strict Statutory Timeline:**
1. **Present Cheque Within 3 Months**: The cheque must be presented to the bank within **3 months** from the date inscribed on it.
2. **Obtain Bank Return Memo**: Obtain the written Cheque Return Memo stating 'Funds Insufficient'.
3. **Statutory Demand Notice Within 30 Days**:
   - Within **30 days** of receiving the bank memo, send a formal Legal Demand Notice giving the drawer **15 clear days** to settle the amount.
4. **Filing Criminal Complaint Within 30 Days**:
   - If unpaid after 15 days, file a criminal complaint before the Judicial Magistrate within **30 days** thereafter (**Section 142(1)(b), NI Act**).

**2. Penalties & Interim Compensation:**
- Imprisonment up to **2 years**, or fine up to **twice the amount of the cheque**, or both.
- Court can order interim compensation up to **20%** of the cheque amount under **Section 143A** during trial.`
}

// -------------------------------------------------------------
// 12. GENERAL TENANCY DISPUTES (DEPOSIT / ARREARS)
// -------------------------------------------------------------
function generateTenancyDisputeResponse(details, lang) {
  // If specific eviction without notice, delegate to specialized handler
  if (/without\s*notice|no\s*notice|bina\s*notice|vacate|khali/i.test(details.lower)) {
    return generateTenancyEvictionWithoutNoticeResponse(details, lang)
  }

  return `### **Landlord-Tenant Dispute: Rights, Eviction & Deposit Recovery**

Under Indian tenancy jurisprudence, State Rent Control Acts, and the **Transfer of Property Act, 1882**:

**1. Security Deposit Retention by Landlord:**
- Security deposits are held in trust to offset unpaid utilities or documented physical damage beyond normal wear and tear.
- Landlords have no legal right to arbitrarily forfeit security deposits. Upon peaceful surrender of keys and vacant possession, the landlord must refund the deposit within the agreement timeframe (typically 7–30 days).

**2. Unlawful Eviction Protections:**
- **No Self-Help Eviction**: A landlord cannot unlawfully disconnect water/electricity, lock premises, or forcibly throw out a tenant's belongings without due process of law. Such actions constitute criminal offences under **Section 329 & 351 BNS, 2023** (trespass and wrongful restraint).
- **Due Process Required**: Eviction requires serving a formal notice to quit under **Section 106 of the Transfer of Property Act, 1882** (giving 15 days notice for monthly tenancies), followed by an eviction petition before the Rent Controller / Civil Court.

**3. Actionable Next Steps:**
1. Document the exit condition with dated photographs/videos and an electricity meter reading.
2. Serve a formal registered legal notice for refund of the security deposit along with interest at **12% per annum**.
3. If unpaid, file a summary suit under **Order 37 of the CPC** for recovery of liquidated debt or file a dispute before the Rent Authority / Civil Court.`
}

// -------------------------------------------------------------
// 13. FAMILY & MATRIMONIAL
// -------------------------------------------------------------
function generateFamilyMatrimonialResponse(details, lang) {
  return `### **Matrimonial Rights: Maintenance, Custody & Domestic Protection**

Under Indian family law, the **Protection of Women from Domestic Violence Act, 2005 (PWDVA)**, and the **Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)**:

**1. Statutory Right to Maintenance:**
- **Section 144, BNSS, 2023** (formerly Section 125 CrPC): A wife, minor children, and elderly parents who are unable to maintain themselves are entitled to claim monthly maintenance from a spouse possessing sufficient means.
- Under Supreme Court guidelines in ***Rajnesh v. Neha (2021) 2 SCC 324***, both parties must submit comprehensive **Affidavits of Assets and Liabilities**. Interim maintenance must be decided promptly by the court.
- In addition, Hindu wives can claim maintenance under **Section 18 & 20 of the Hindu Adoptions and Maintenance Act, 1956**.

**2. Domestic Violence Protection (PWDVA, 2005):**
- Women subjected to physical, emotional, verbal, sexual, or economic abuse can file an application before the Magistrate under **Section 12 PWDVA**.
- Available reliefs include **Protection Orders (Sec 18)**, **Residence Orders (Sec 19)** preventing eviction from the shared household, and **Monetary Reliefs (Sec 20)**.

**3. Child Custody Principles:**
- Under the **Guardians and Wards Act, 1890** and the **Hindu Minority and Guardianship Act, 1956**, the paramount consideration is always the **welfare of the child** (*welfare principle*), not the proprietary rights of either parent.
- Mothers are generally granted natural custody of children below the age of **5 years** unless disqualifying factors are proven.`
}

// -------------------------------------------------------------
// 14. CONTRACT RECOVERY
// -------------------------------------------------------------
function generateContractRecoveryResponse(details, lang) {
  return `### **Contract Breach & Commercial Debt Recovery Roadmap**

Under the **Indian Contract Act, 1872**, the **Specific Relief Act, 1963**, and the **Commercial Courts Act, 2015**:

**1. Legal Grounds for Relief:**
- **Section 73, Indian Contract Act**: When a contract is broken, the party suffering from the breach is entitled to receive compensation for any loss or damage that naturally arose in the usual course of things.
- **Specific Performance (Section 10, Specific Relief Act)**: The court can direct the defaulting party to specifically perform their contractual obligations when damages do not provide adequate relief.

**2. Recovery Options:**
- **Order 37, Code of Civil Procedure (Summary Suit)**: If the debt is founded on a written contract, bill of exchange, promissory note, or clear acknowledgment of debt, a Summary Suit offers accelerated adjudication where the defendant must obtain judicial leave to defend.
- **Pre-Institution Mediation (Commercial Courts Act)**: For commercial disputes valued at ₹3 Lakhs and above, participating in mandatory pre-institution mediation through the District Legal Services Authority (DLSA) under **Section 12A** is required before filing a commercial suit (unless urgent interim relief is prayed).

**3. Limitation Window:**
- Under the **Limitation Act, 1963 (Article 18 & 55)**, civil suits for recovery of money or breach of contract carry a strict limitation period of **3 years** from the date payment was due or breach occurred.`
}

// -------------------------------------------------------------
// 15. CYBERCRIME & FRAUD
// -------------------------------------------------------------
function generateCybercrimeResponse(details, lang) {
  return `### **Cybercrime & Financial Fraud: Emergency Intervention**

If you have experienced unauthorized financial debits, phishing scams, or digital extortion:

**1. Immediate 1930 Golden Hour Intervention:**
- **Call 1930 Immediately**: The National Cybercrime Reporting Portal connects with the Indian Cyber Crime Coordination Centre (**I4C**) to issue freeze alerts across beneficiary banks before money is withdrawn at ATMs.
- **Block All Banking Access**: Contact your bank's 24x7 emergency line to block debit/credit cards, disable net banking, and lock UPI IDs.

**2. Statutory Zero Customer Liability (RBI Circular):**
- Under the **Reserve Bank of India Circular on Customer Protection (DPSS.CO.PD.No.1441/02.14.003/2017-18)**:
  - If unauthorized fraud occurs without customer negligence, and you notify your bank within **3 working days**, you are entitled to **zero liability** and a full refund.
  - If reported between 4 to 7 working days, liability is capped at ₹5,000 to ₹25,000 based on account type.

**3. Register Official Complaint:**
- File a detailed complaint on **[cybercrime.gov.in](https://cybercrime.gov.in/)**. Submit the acknowledgment reference to your home bank branch within 72 hours.`
}

// -------------------------------------------------------------
// 16. TECH & PROGRAMMING
// -------------------------------------------------------------
function generateTechProgrammingResponse(details, lang) {
  const lower = details.lower
  if (lower.includes('cors') || lower.includes('cross-origin')) {
    return `### **Resolving CORS (Cross-Origin Resource Sharing) Errors**

A **CORS error** occurs when a web browser running frontend code (e.g., at \`http://localhost:5173\`) attempts to request an API resource on a different origin, port, or protocol (e.g., \`http://localhost:3001\`) without proper backend HTTP access headers.

**1. Recommended Solution in Node.js / Express Backend:**
Install and register the official \`cors\` middleware:

\`\`\`bash
npm install cors
\`\`\`

In your Express server configuration (\`server.js\` or \`index.js\`):

\`\`\`javascript
import express from 'express'
import cors from 'cors'

const app = express()

// Enable CORS for frontend development and production domains
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}))

app.use(express.json())
\`\`\`

**2. Frontend Vite Proxy Configuration (Alternative & Robust):**
In \`vite.config.ts\`, proxy \`/api\` calls directly to eliminate cross-origin requests in development:

\`\`\`typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
\`\`\`

*Note: Avoid setting \`Access-Control-Allow-Origin: *\` in production environments when using credentialed sessions or cookies.*`
  }

  return `### **Technical Programming Guidance**

Here is the recommended, production-tested approach for your implementation:

1. **Root Cause Analysis**: Verify input data types, environment variable availability, and asynchronous control flow.
2. **Error Handling**: Always wrap asynchronous API operations in \`try...catch\` blocks with explicit user-friendly error boundaries.
3. **Configuration Check**: Ensure network ports, dependencies, and environment keys are loaded correctly before runtime.`
}

// -------------------------------------------------------------
// 17. AMBIGUOUS FACTS
// -------------------------------------------------------------
function generateAmbiguousFactsResponse(details, lang) {
  return `### **Case Analysis: Additional Specific Details Needed**

To provide you with an accurate legal roadmap, relevant statutory sections, and deadlines under Indian law, **more specific facts about your situation are needed**.

**Please reply with answers to these key questions:**
1. **What specific event or dispute occurred?** (e.g., unpaid salary, boundary dispute, cheque bounce, online fraud, criminal threat, family dispute)
2. **Who is the opposing party?** (e.g., employer, private individual, bank, family member, landlord)
3. **What written or digital proof exists?** (e.g., written agreement, WhatsApp messages, bank statements, receipts)
4. **Has any police complaint or legal notice already been issued?**
5. **What primary outcome do you want?** (e.g., financial refund, criminal prosecution, injunction, peace of mind)

Once you share these details, I will provide a tailored step-by-step legal plan.`
}

// -------------------------------------------------------------
// 18. DYNAMIC CASE ANALYSIS (FOR UNCLASSIFIED REAL-WORLD MATTERS)
// -------------------------------------------------------------
function generateDynamicCaseAnalysis(details, lang) {
  const query = (details.rawMessage || '').trim()
  const lower = details.lower || ''

  // Extract factual cues from query
  const mentionsPolice = /\b(police|fir|thana|chowki|sho|arrest|cop)\b/i.test(lower)
  const mentionsCourt = /\b(court|lawyer|advocate|judge|vakil|case|suit)\b/i.test(lower)
  const mentionsMoney = /\b(\d+|rupees?|rs\.?|inr|lakh|crore|hazaar|paise)\b/i.test(lower)
  const mentionsAgreement = /\b(agreement|contract|deed|receipt|invoice|bill|kagaz|papers)\b/i.test(lower)
  const mentionsFamily = /\b(wife|husband|father|mother|brother|sister|son|daughter|relative|uncle|patni|pati)\b/i.test(lower)

  if (lang === 'hinglish') {
    return `Aapki batayi gayi sthiti ko samajhte hue, yeh mamla mukhyatah ${mentionsPolice ? 'criminal kanoon aur police inquiry/investigation' : mentionsCourt ? 'civil court proceedings aur dastaaveji vivaad' : 'civil aur vyaktigat kanooni adhikaaron'} se juda lagta hai.

${mentionsMoney ? 'Kyunki isme aarthik lenden ya paise ka mamla shamil hai, isliye bank transfer receipts, UPI reference numbers aur payment slips sabse aham saboot bante hain. ' : ''}${mentionsAgreement ? 'Aapke paas written agreement ya kagazaat hona aapke paksh ko kanoonan kaafi mazboot banata hai. ' : 'Agar koi formal written agreement nahi hai, toh digital saboot jaise WhatsApp messages, audio recordings, emails aur SMS bhi Bharatiya Sakshya Adhiniyam, 2023 (BSA) ke tehat adalat me maanya saboot hote hain.'}

Is mamle me aage badhne ke liye yeh vyavaharik kadam kargar rahenge:
- Sabhi digital aur physical sabooton ka ek alag folder banakar timeline ke hisab se surakshit rakhein. Kisi bhi original file ya chat ko delete na karein.
- ${mentionsPolice ? 'Agar police thane ya kisi apradh ka mamla hai, toh shalinata se complaint ya FIR number ki jankari lein aur akele na jakar kisi vishwaspatra vyakti ya advocate ke sath jayein.' : 'Civil ya aarthik vivad me kisi bhi court case se pehle opposite party ko ek formal written demand ya advocate ke zariye 15 din ka Legal Notice bhejna behtar rehta hai, jisse aamtaur par mamla bina court jaye hi settle ho jata hai.'}
- Agar aarthik sthiti kamzor hai, toh har district court me District Legal Services Authority (DLSA) dwara muft kanooni salah aur government advocate ki suvidha bhi milti hai.

Is sthiti par thos rasta nikalne ke liye: samne wala paksh kaun hai (koyi company, vyakti ya parivar), aur kya aapke paas is mamle se juda koi likhit kagaz ya message maujood hai?`
  }

  if (lang === 'hi') {
    return `आपकी प्रस्तुत समस्या के संदर्भ में, यह प्रकरण मुख्य रूप से ${mentionsPolice ? 'आपराधिक विधि एवं पुलिस प्रक्रिया' : mentionsCourt ? 'सिविल वाद एवं अदालती प्रक्रिया' : 'सिविल अधिकारों एवं संविदात्मक दायित्वों'} से संबंधित प्रतीत होता है।

${mentionsMoney ? 'चूंकि इस प्रकरण में वित्तीय लेन-देन या धनराशि का प्रश्न शामिल है, इसलिए बैंक अंतरण विवरण, यूपीआई संदर्भ संख्या एवं रसीदें प्राथमिक साक्ष्य का कार्य करेंगी। ' : ''}${mentionsAgreement ? 'लिखित अनुबंध अथवा विलेख का होना आपके विधिक पक्ष को अत्यधिक सशक्त बनाता है। ' : 'यदि कोई औपचारिक लिखित अनुबंध नहीं है, तो भी भारतीय साक्ष्य अधिनियम, 2023 (BSA) के अंतर्गत व्हाट्सएप संदेश, ईमेल, ऑडियो रिकॉर्डिंग एवं कॉल रिकॉर्ड भी न्यायालय में वैध साक्ष्य माने जाते हैं।'}

इस संबंध में व्यावहारिक रूप से निम्नलिखित कदम उठाना उचित होगा:
- विवाद से संबंधित समस्त लिखित अभिलेखों एवं डिजिटल साक्ष्यों को कालक्रमानुसार एक सुरक्षित फाइल में संकलित करें।
- ${mentionsPolice ? 'यदि पुलिस अथवा किसी आपराधिक शिकायत का मामला है, तो संबंधित थाने या अधिकारी से शिकायत/एफआईआर का विवरण प्राप्त करें और थाने कभी भी अकेले न जाएं।' : 'अदालत में वाद दायर करने से पूर्व अधिवक्ता के माध्यम से 15 से 30 दिनों का वैधानिक विधिक नोटिस (Legal Notice) प्रेषित करना व्यावहारिक समाधान का सर्वोत्तम मार्ग है।'}
- आर्थिक रूप से असहाय व्यक्तियों के लिए प्रत्येक जिला न्यायालय में विधिक सेवा प्राधिकरण (DLSA) द्वारा निःशुल्क अधिवक्ता एवं कानूनी सहायता उपलब्ध कराई जाती है।

इस विषय में सटीक विधिक सलाह हेतु: विपक्षी पक्ष कौन है, तथा आपके पास इस विवाद से संबंधित क्या मुख्य साक्ष्य अथवा लिखित संदेश उपलब्ध हैं?`
  }

  return `Looking closely at your situation, this matter primarily falls under ${mentionsPolice ? 'criminal procedure and police inquiry' : mentionsCourt ? 'civil litigation and formal court dispute' : 'civil and statutory legal rights'}.

${mentionsMoney ? 'Because financial transactions are involved, your primary evidentiary focus must be on bank account statements, UPI transaction references, and payment receipts. ' : ''}${mentionsAgreement ? 'Having written agreements or official documentation gives you a strong legal foundation. ' : 'Even in the absence of a formal written contract, digital correspondence such as WhatsApp chats, emails, and SMS trail carry full legal evidentiary value under Section 61 and Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA).'}

Here are practical, balanced next steps to protect your position:
- Consolidate all physical and electronic evidence into a chronological folder and make secure backups without editing or altering any metadata.
- ${mentionsPolice ? 'If the situation involves a police station or inquiry, respectfully ascertain the GD or FIR entry number and avoid attending unaccompanied; always have an advocate or trusted associate with you.' : 'In contractual or financial disputes, having an advocate issue a formal 15-day Legal Demand Notice via Registered Post is usually the most effective first move before initiating formal litigation.'}
- If financial constraints are an issue, note that free legal representation and pre-litigation counseling are accessible through your local District Legal Services Authority (DLSA).

To help tailor this advice further: who is the other party involved (an individual, company, or landlord), and what written proof or messages do you currently hold?`
}

// -------------------------------------------------------------
// CONTEXTUAL FOLLOW-UP REASONER
// -------------------------------------------------------------
function generateContextualFollowUpResponse(topic, kind, details, lang) {
  // 1. THEFT & ROBBERY FOLLOW-UPS
  if (topic === 'theft_robbery') {
    if (kind === 'simpler_example') {
      return `### **Theft & Robbery Explained in Simple Everyday Terms**

**Plain Language / सरल भाषा:**
Under Indian law, when someone takes away your belongings (cash, phone, jewelry, laptop) without your permission and with dishonest intent, it is **Theft (Chori)**.
- **Theft vs. Robbery**: If the offender entered quietly or stole while you were away, it is **Theft** (Section 303 / 305 BNS). But if they used force, threatened you with physical harm, or held weapons, it becomes **Robbery (Loot)** (Section 309 BNS) with much harsher punishment up to 10–14 years.

**Real-Life Example:**
Suppose you returned home and found your door lock broken, and gold jewelry worth ₹2 Lakhs along with your mobile phone missing:
1. You immediately dial **112** for the police to visit the site.
2. You do not touch door handles or the almirah so the police can collect latent fingerprints.
3. You go to the police station and receive a **free copy of the registered FIR** under **Section 173 BNSS**.
4. You go to **ceir.gov.in** and block your phone's IMEI number so the thief cannot use or sell it.`
    }

    if (kind === 'practical_steps') {
      return `### **Practical Checklist: Immediate Actions Following Theft**

**Step 1: First 2 Hours (Emergency Response)**
- Call **112** immediately to alert the local police patrol.
- **Preserve the Crime Scene**: Strictly avoid cleaning up or touching handles, broken latches, or locks until forensics completes fingerprint examination.
- **Block Mobile Phone**: Visit **[ceir.gov.in](https://ceir.gov.in/)** (Department of Telecommunications) to block your handset IMEI nationwide. Call your telecom provider to block your SIM.
- **Block Bank Cards**: If cards or wallet were stolen, open your banking app or call the bank helpline to freeze all cards and UPI immediately.

**Step 2: Within 24 Hours**
- Visit the local police station (Thana) and submit a written, signed complaint detailing the incident.
- Insist on registering an **FIR under Section 173 BNSS, 2023** (Section 305 BNS for home theft).
- Demand your **free certified FIR copy** under Section 173(2) BNSS.
- Notify your home/property insurance provider within 24–48 hours attaching the FIR.`
    }

    if (kind === 'details_to_consider') {
      return `### **Critical Nuances to Keep in Mind for Theft & Robbery Cases**

1. **Dwelling House vs. Street Theft**: Theft committed inside a residential house or workplace (**Section 305 BNS**) is an aggravated, non-bailable offence carrying up to **7 years imprisonment**, unlike simple street theft (Section 303 BNS, up to 3 years).
2. **Police Refusal Safeguards**: Police officers cannot legally refuse to lodge an FIR for theft because it is a **cognizable offence**. If the local police hesitate:
   - Send the complaint to the **Superintendent of Police (SP/DCP)** under **Section 173(3) BNSS**.
   - Approach the **Judicial Magistrate** under **Section 175(3) BNSS** (formerly 156(3) CrPC) for court-mandated investigation.
3. **Retrieving Recovered Stolen Property**: Once the police catch the culprit and recover your articles, they are deposited in the court *malkhana*. To regain custody before trial ends, your advocate must file an application under **Section 503 BNSS (Superdari)**.`
    }

    if (kind === 'official_references') {
      return `### **Official Trusted Portals & Statutory References for Theft**

1. **Police Emergency Helpline**: Dial **112** (Pan-India 24x7 Emergency Response Support System).
2. **Central Equipment Identity Register (CEIR)**: **[https://ceir.gov.in](https://ceir.gov.in)** (Official Government of India portal to block and trace lost/stolen mobile phones).
3. **National Crime Records Bureau (NCRB) Citizen Services**: **[https://digitalpolice.gov.in](https://digitalpolice.gov.in)**.
4. **Governing Criminal Statutes**:
   - **Bharatiya Nyaya Sanhita, 2023 (BNS)**: Section 303 (Theft), Section 305 (Theft in dwelling house), Section 309 (Robbery), Section 331 (House-breaking by night).
   - **Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)**: Section 173 (Mandatory FIR), Section 175 (Magistrate directions), Section 503 (Superdari property release).`
    }
  }

  // 2. CHEQUE BOUNCE FOLLOW-UPS
  if (topic === 'cheque_bounce') {
    if (kind === 'simpler_example') {
      return `### **Section 138 Cheque Dishonour Explained in Simple Terms**

**Plain Language:**
When someone gives you a cheque to settle a debt and the bank returns it unpaid due to 'Insufficient Funds', Indian law treats this as both a civil debt and a criminal offence.

**Real-Life Example:**
A client issues you a cheque of ₹2 Lakhs on January 10th.
1. You deposit the cheque in your bank within 3 months.
2. The bank returns the cheque with a memo stating *"Funds Insufficient"*.
3. You have **30 days** from receiving the memo to send a formal legal demand notice via Speed Post.
4. The drawer gets **15 days** to pay. If they don't, you file a criminal case within the next **30 days** in Magistrate court.`
    }

    if (kind === 'practical_steps') {
      return `### **Practical Checklist: Step-by-Step for Cheque Dishonour**

1. **Collect the Bank Return Memo**: Immediately collect the original returned cheque and written Memo from your bank.
2. **Dispatch Statutory Demand Notice (Within 30 Days)**: Send a formal legal notice under Section 138(b) NI Act via Registered Post with Acknowledgment Due (RPAD) giving the drawer **15 clear days** to pay.
3. **Track Speed Post Delivery**: Print the India Post delivery confirmation showing the date the notice was delivered.
4. **File Criminal Complaint (Within Next 30 Days)**: If unpaid after 15 days, have your advocate file a complaint under Section 138 in the Magistrate Court within **30 days** of default.`
    }

    if (kind === 'details_to_consider') {
      return `### **Critical Nuances to Keep in Mind for Cheque Bounce**

1. **Strict Timelines Cannot Be Waived Easily**: Missing the 30-day notice window or 30-day filing window can invalidate your case unless court condones delay for exceptional cause.
2. **Interim Compensation (Section 143A)**: You can request the court to direct the accused to deposit up to **20% of the cheque amount** as interim compensation during trial.
3. **Where to File**: The case must be filed in the court where your bank account is located (Section 142(2) NI Act).`
    }

    if (kind === 'official_references') {
      return `### **Official Trusted References for Cheque Bounce**

1. **Governing Statute**: Section 138 to 147, Negotiable Instruments Act, 1881.
2. **e-Courts Services Portal**: **[https://services.ecourts.gov.in](https://services.ecourts.gov.in/)**.
3. **Supreme Court Landmark Precedents**: *Meters and Instruments Pvt Ltd v. Kanchan Mehta (2018)*, *Dashrath Rupsingh Rathod v. State of Maharashtra (2014)*.`
    }
  }

  // 3. PROPERTY DISPUTE FOLLOW-UPS
  if (topic === 'property_dispute') {
    if (kind === 'documents_evidence') {
      return `### **Essential Documents Required for Property Dispute Litigation**

1. **Registered Sale Deed / Title Conveyance**: Your certified primary title deed registered under the Registration Act, 1908.
2. **Current Revenue Records (Jamabandi / Khatoni)**: Updated Record of Rights from the local revenue department.
3. **Encumbrance Certificate (EC)**: Reflecting transactions over the past 15–30 years.
4. **Site Plan / Aksh Shajra**: Revenue village map and architectural demarcation plan showing the exact disputed boundary.
5. **Mutation Extract (Dakhil Kharij)**: Revenue entry recording transfer of rights.`
    }
  }

  // 4. LEGAL NOTICE RECEIVED FOLLOW-UPS
  if (topic === 'legal_notice_received') {
    if (kind === 'practical_steps') {
      return `### **Practical Checklist: What to Do After Receiving a Legal Notice**

1. **Preserve the Delivery Envelope**: Do not throw away the envelope; the postal stamp and tracking barcode prove the date of receipt.
2. **Check the Stated Deadline**: Determine whether you have 15 days or 30 days to send a reply.
3. **Assemble Counter-Documents**: Gather receipts, agreements, emails, WhatsApp chats, and bank statements that dispute the sender's claims.
4. **Draft and Dispatch Formal Reply via RPAD**: Engage a qualified advocate to prepare a point-by-point reply and send it via Registered Post with Acknowledgment Due (RPAD).`
    }

    if (kind === 'simpler_example') {
      return `### **Understanding a Legal Notice in Simple Terms**

A legal notice is like a formal written warning from the other side's lawyer before going to court. It tells you what they are demanding and gives you a deadline (usually 15 to 30 days) to respond or comply.

**Example**:
If a bank or individual sends you a notice demanding ₹1 Lakh, you do not need to panic. You and your lawyer will review their claims, write back explaining why their claims are incorrect or proposing an amicable settlement, and preserve your legal defense for court.`
    }
  }

  // 5. TENANCY EVICTION WITHOUT NOTICE FOLLOW-UPS
  if (topic === 'tenancy_eviction_without_notice') {
    if (kind === 'practical_steps') {
      return `### **Practical Checklist: Stopping Unlawful Eviction**

1. **Keep Rent Receipts & Agreement Ready**: Have digital photos and printed copies readily accessible at home.
2. **Issue Written Resistance**: Message the landlord stating that Section 106 of the Transfer of Property Act requires a minimum 15-day formal notice.
3. **Call 112 on Physical Intimidation**: If the landlord attempts to throw your bags, change locks, or cut power/water, dial **112**.
4. **Apply for Injunction (Stay Order)**: File a civil petition under Order 39 Rules 1 & 2 CPC in the local Civil Court to obtain a judicial stay against forcible dispossession.`
    }
  }

  // 6. MONEY LENT RECOVERY FOLLOW-UPS
  if (topic === 'money_lent_recovery') {
    if (kind === 'practical_steps') {
      return `### **Practical Checklist: Recovering Money Lent**

1. **Extract Bank Transfer Evidence**: Download bank statements with UTR transaction numbers showing the exact transfer of money.
2. **Preserve WhatsApp Acknowledgments**: Screenshot and export chat backups where the borrower promised repayment or acknowledged receiving the loan.
3. **Send 15-Day Advocate Demand Notice**: Serve a formal Legal Demand Notice via Registered Speed Post.
4. **File Order 37 Summary Suit**: If unpaid after 15 days, institute a fast-track Summary Suit in District Court within the 3-year limitation window.`
    }
  }

  // 7. LABOUR UNPAID SALARY FOLLOW-UPS
  if (topic === 'labour_employment') {
    if (kind === 'practical_steps') {
      return `### **Practical Checklist: Recovering Unpaid Salary from Employer**

1. **Collect Employment Proof**: Appointment letter, payslips, bank statements, attendance records, and resignation/termination emails.
2. **Send 7-Day Demand Email**: Send an email to HR, Finance, and company Directors specifying the exact unpaid wage amount.
3. **Serve Formal Legal Notice**: Have an advocate serve a registered legal demand notice claiming unpaid salary plus statutory interest.
4. **Lodge SAMADHAN Complaint**: File a dispute online on the Ministry of Labour portal (**[samadhan.labour.gov.in](https://samadhan.labour.gov.in/)**) or approach the local Labour Commissioner under Section 15 of the Payment of Wages Act.`
    }
  }

  return null
}
