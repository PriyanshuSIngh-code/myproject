/**
 * Comprehensive Multi-Domain Intelligent AI Chat Engine.
 * Combines Crisis Detection, Domain Classification, Source Verification,
 * and OpenAI API Integration with an authentic, grounded Local Fallback Engine.
 */

import { detectCrisis } from './crisisDetector.js'
import { classifyQuery } from './categoryClassifier.js'
import { getVerifiedSources } from './sourceRegistry.js'
import { extractCaseDetails, generateIntelligentResponse } from './caseReasoner.js'
import { getActiveAiProvider, callRealAiModel } from './aiProvider.js'

export async function processChatMessage(input) {
  const { message, conversationHistory = [], language = 'English', jurisdiction = '' } = input
  const cleanMessage = (message || '').trim()

  // 1. Run Crisis & Emergency Detection Layer FIRST
  const crisis = detectCrisis(cleanMessage)

  // 2. Extract deep case details, facts, and conversation context
  const caseDetails = extractCaseDetails(cleanMessage, conversationHistory, language)

  // 3. Classify Category and Intent
  const classification = classifyQuery(cleanMessage)

  // Align classification with extracted issue type if specialized
  if (caseDetails.issueType === 'legal_notice_received') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Civil & Criminal Procedure: Legal Notice Response'
  } else if (caseDetails.issueType === 'tenancy_eviction_without_notice' || caseDetails.issueType === 'tenancy_dispute') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Tenancy Law: Eviction & Tenant Rights'
  } else if (caseDetails.issueType === 'money_lent_recovery') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Debt Recovery: Loans & Money Disputes'
  } else if (caseDetails.issueType === 'police_station_summon') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Criminal Procedure: Police Inquiries & Station Summons'
  } else if (caseDetails.issueType === 'theft_robbery') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Criminal Law: Theft, Robbery & Burglary'
  } else if (caseDetails.issueType === 'property_dispute') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Property & Real Estate Law'
  } else if (caseDetails.issueType === 'labour_employment') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Employment & Labour Law: Unpaid Wages'
  } else if (caseDetails.issueType === 'criminal_threat') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Criminal Law & Personal Safety'
  } else if (caseDetails.issueType === 'fir_refusal') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Criminal Procedure & Police FIR'
  } else if (caseDetails.issueType === 'consumer_protection') {
    classification.category = 'Finance & Consumer Rights'
    classification.subCategory = 'Consumer Disputes & Product Liability'
  } else if (caseDetails.issueType === 'stolen_goods_cheating') {
    classification.category = 'Legal Assistance'
    classification.subCategory = 'Criminal Law: Cheating & Stolen Goods'
  } else if (caseDetails.issueType === 'tech_programming') {
    classification.category = 'Technology & Troubleshooting'
    classification.subCategory = 'Web Development & System Troubleshooting'
  }

  // 4. Retrieve Verified Sources
  const sources = getVerifiedSources(classification.category, cleanMessage)

  // 5. Try Real AI Provider (OpenAI, Groq, Gemini, Ollama) if configured
  const activeProvider = getActiveAiProvider()
  if (activeProvider && !process.env.DISABLE_CLOUD_AI_IN_TESTS) {
    try {
      const aiResponse = await callRealAiModel({
        message: cleanMessage,
        conversationHistory,
        language,
        jurisdiction,
        crisis,
        classification,
        caseDetails
      })
      if (aiResponse) {
        const responseText = typeof aiResponse === 'object' && aiResponse?.text ? aiResponse.text : String(aiResponse)
        const responseModel = typeof aiResponse === 'object' && aiResponse?.modelUsed ? aiResponse.modelUsed : `${activeProvider.type}:${activeProvider.model}`

        return {
          text: responseText,
          category: classification.category,
          subCategory: classification.subCategory,
          urgency: crisis.urgency,
          isEmergency: crisis.isEmergency,
          immediateAction: crisis.immediateAction,
          sources,
          followUpSuggestions: classification.followUpSuggestions,
          requiresJurisdictionCheck: classification.requiresJurisdictionCheck,
          language: caseDetails?.languagePreference === 'hinglish' ? 'Hinglish' :
                    caseDetails?.languagePreference === 'hi' ? 'हिन्दी' :
                    caseDetails?.languagePreference === 'pa' ? 'ਪੰਜਾਬੀ' :
                    language,
          modelUsed: responseModel
        }
      }
    } catch (err) {
      console.warn(`[ChatEngine] AI provider (${activeProvider.type}) failed:`, err.message)
      throw new Error(err.message || `AI Provider Error (${activeProvider.type})`)
    }
  }

  // 6. Intelligent Grounded Multi-Domain Case Reasoner
  const localResponse = generateGroundedLocalResponse({
    message: cleanMessage,
    crisis,
    classification,
    caseDetails,
    language,
    jurisdiction
  })

  return {
    text: localResponse,
    category: classification.category,
    subCategory: classification.subCategory,
    urgency: crisis.urgency,
    isEmergency: crisis.isEmergency,
    immediateAction: crisis.immediateAction,
    sources,
    followUpSuggestions: classification.followUpSuggestions,
    requiresJurisdictionCheck: classification.requiresJurisdictionCheck,
    language: caseDetails?.languagePreference === 'hinglish' ? 'Hinglish' :
              caseDetails?.languagePreference === 'hi' ? 'हिन्दी' :
              caseDetails?.languagePreference === 'pa' ? 'ਪੰਜਾਬੀ' :
              language,
    modelUsed: 'nayaya-deep-case-engine-v3'
  }
}

function generateGroundedLocalResponse(params) {
  const { message, crisis, classification, caseDetails, language } = params

  // -------------------------------------------------------------
  // A. CRISIS / EMERGENCY SCENARIOS FIRST
  // -------------------------------------------------------------
  if (crisis.isEmergency) {
    if (crisis.emergencyType === 'self_harm') {
      return `### **Support and Safety Guidance**

**Please know that your life and wellbeing matter, and support is available right now.** Whatever you are facing, you do not have to carry it alone.

**Immediate Action Steps:**
1. **Connect With a Counselor Immediately**: Call **14416** or **1800-891-4416** to reach **Tele-MANAS** (Government of India 24/7 Free Mental Health Service). Dedicated, trained psychologists are on call to listen and assist in multiple Indian languages.
2. **Reach Out to Vandrevala Foundation**: Call or WhatsApp **+91 9999 666 555** for 24/7 free emotional crisis assistance.
3. **Stay in Safe Surroundings**: Please move to a safe, quiet room or reach out to a trusted family member, close friend, or neighbor.

*If you are in immediate physical danger, dial **112** (National Emergency Helpline) or go to the emergency department of the nearest hospital immediately.*`
    }

    if (crisis.emergencyType === 'active_cyber_fraud') {
      return `### **Active Financial Cybercrime Protocol — Act Immediately**

If money was debited without your authorization or you mistakenly shared an OTP:

1. **Dial 1930 Immediately (Golden Hour Intervention)**:
   - Call the **National Cybercrime Reporting Helpline at 1930**.
   - State operators immediately record the transaction and contact the Indian Cyber Crime Coordination Centre (**I4C**) to freeze the stolen funds across intermediate and beneficiary mule accounts before cash withdrawal occurs.

2. **Block Your Banking Channels Immediately**:
   - Open your mobile banking app or call your bank's dedicated 24x7 toll-free helpline.
   - **Freeze your debit/credit card**, temporarily lock UPI access, and block netbanking credentials.

3. **Preserve Crucial Digital Evidence**:
   - Take screenshots of the SMS debit alerts, payment app screens, **UTR reference numbers**, and transaction dates/timestamps.
   - Do not delete fraudulent chat logs, WhatsApp chats, or call records.

4. **Register Formal Complaint**:
   - File a detailed cyber complaint on the official portal: **[https://cybercrime.gov.in](https://cybercrime.gov.in)**.
   - Obtain the acknowledgment number to present to your home bank branch within **3 business days** to preserve statutory zero-liability protection under RBI guidelines.`
    }

    if (crisis.emergencyType === 'medical_critical') {
      return `### **Critical Medical Emergency Instructions**

**Immediate Priority: Obtain Professional Medical Transport Right Now.**

1. **Call for an Ambulance**: Dial **108** or **102** immediately. Do not attempt to drive yourself to a clinic or hospital.
2. **If Chest Pain or Breathing Distress is Present**:
   - Sit down in a supported, upright or semi-reclined position on the floor to reduce physical strain on the heart.
   - Loosen tight clothing around the neck, chest, and waist.
   - Stay calm and take slow, steady breaths while emergency services are on the way.
3. **If Stroke Symptoms are Observed (FAST Protocol)**:
   - **F (Face)**: Check for facial drooping on one side.
   - **A (Arms)**: Check if one arm drifts downward when raised.
   - **S (Speech)**: Check for slurred or unusual speech.
   - **T (Time)**: Note the exact time symptoms began and convey this to arriving paramedics immediately.

*Disclaimer: This automated system provides informational emergency guidance only and is not a substitute for clinical diagnostics or hospital emergency treatment.*`
    }
  }

  // -------------------------------------------------------------
  // B. INTELLIGENT DEEP CASE REASONER
  // -------------------------------------------------------------
  if (caseDetails && caseDetails.issueType && caseDetails.issueType !== 'general_legal') {
    return generateIntelligentResponse(caseDetails, language)
  }

  // -------------------------------------------------------------
  // C. SPECIALIZED NON-LEGAL DOMAINS
  // -------------------------------------------------------------
  if (classification.category === 'Mental Health Support') {
    return `### **Mental Wellbeing & Supportive Care Guidance**

Taking care of your mental health is just as important as your physical health. If you are experiencing high stress, anxiety, or emotional exhaustion:

1. **Free 24/7 Professional Counseling in India**:
   - Call **Tele-MANAS** at **14416** or **1800-891-4416** (National Tele Mental Health Programme of India).
   - Qualified counselors and mental health professionals provide free, confidential counseling in over 20 regional Indian languages.

2. **Immediate Grounding Technique (5-4-3-2-1 Method)**:
   - If feeling acute anxiety, focus on your immediate physical space:
     - Notice **5 things you can see** around you.
     - Notice **4 things you can physically touch** (your desk, fabric, chair).
     - Notice **3 distinct sounds you can hear**.
     - Notice **2 things you can smell**.
     - Notice **1 thing you can taste** or take a slow sip of water.
   - Practice box breathing: Inhale for **4 seconds**, hold for **4 seconds**, exhale for **4 seconds**, hold for **4 seconds**.

3. **When to Seek Consultation**:
   - If persistent sadness, panic episodes, or disrupted sleep continue for more than **2 consecutive weeks**, consulting a certified clinical psychologist or psychiatrist is recommended.`
  }

  if (classification.category === 'Medical Information') {
    return `### **Health Education & Symptom Orientation**

**Important Medical Clarification**: This system provides general health education and orientation. It does not provide definitive medical diagnoses or replace examination by a registered medical practitioner.

**General Evaluation & Supportive Measures:**
1. **Track Symptom Progression**:
   - Note the exact duration, intensity, and any factors that worsen or alleviate the symptom.
   - Record body temperature, blood pressure, or blood glucose levels using home monitoring devices if applicable.
2. **Crucial Warning Signs That Require Immediate Medical Evaluation**:
   - High fever persisting beyond **3 days** or unresponsive to standard antipyretics.
   - Inability to retain fluids, severe dehydration, or sudden extreme dizziness.
   - Persistent localized severe pain, confusion, or difficulty breathing.
3. **Safe Medication Practice**:
   - Never start prescription antibiotics, corticosteroids, or strong painkillers without a written doctor's prescription.
   - Always inform your doctor of existing conditions (such as kidney disease, liver conditions, or pregnancy) before taking new medications.`
  }

  if (classification.category === 'Government Services & Schemes') {
    return `### **Government Citizen Services & Scheme Procedures**

**Key Digital Portals & Guidelines:**
1. **Official Citizen Gateway**:
   - Access verified public welfare schemes, certificate applications, and administrative workflows via the **National Portal of India** at **[india.gov.in](https://www.india.gov.in/)**.
2. **Legally Valid Digital Records via DigiLocker**:
   - Under Rule 9A of the Information Technology (Preservation and Retention of Information by Intermediaries) Rules, digital documents issued to your **DigiLocker account** ([digilocker.gov.in](https://www.digilocker.gov.in/)) are legally on par with original physical documents across Indian authorities.
3. **Public Grievances & RTI Access**:
   - If a government department delays processing beyond standard service charter timelines, file a grievance on **CPGRAMS** ([pgportal.gov.in](https://pgportal.gov.in/)).
   - For official administrative records or queries, file an online Right to Information request via **RTI Online** ([rtionline.gov.in](https://rtionline.gov.in/)).`
  }

  // Fallback to case reasoner's general case response
  return generateIntelligentResponse(caseDetails || { issueType: 'general_legal' }, language)
}
