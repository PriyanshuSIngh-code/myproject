/**
 * Dedicated Emergency and Crisis Detection Layer.
 * Analyzes incoming queries before ordinary response generation.
 * Flags critical life safety, medical emergencies, self-harm, active violence, poisoning,
 * and active financial cyber fraud.
 */

const SELF_HARM_REGEX = /\b(suicid(e|al)|kill\s*myself|end\s*my\s*life|want\s*to\s*die|hang\s*myself|cut\s*my\s*wrists?|jump\s*off|take\s*all\s*my\s*pills|no\s*reason\s*to\s*live|death\s*wish|खुदकुशी|आत्महत्या|मरना\s*चाहता|ਜਾਨ\s*ਦੇਣਾ)\b/i

const MEDICAL_CRITICAL_REGEX = /\b(chest\s*pain|heart\s*attack|stroke|facial\s*droop|arm\s*numbness|slurred\s*speech|can'?t\s*breathe|cannot\s*breathe|severe\s*shortness\s*of\s*breath|gasping|heavy\s*bleeding|unconscious(ness)?|collapsed|seizure\s*not\s*stopping|heart\s*stopped|severe\s*allergic\s*reaction|anaphylaxis|छाती\s*में\s*दर्द|दौरा|सांस\s*नहीं\s*आ\s*रही)\b/i

const POISONING_REGEX = /\b(swallowed\s*.*poison|drank\s*.*poison|ingested\s*(acid|bleach|pesticide|rat\s*poison|phenyl|kerosene)|rat\s*poison|poison(ing|ous)?|overdosed\s*on\s*pills|toxic\s*substance|ਜ਼ਹਿਰ|जहर\s*पी\s*लिया)\b/i

const VIOLENCE_DANGER_REGEX = /\b(someone\s*is\s*attacking\s*me|break-?in|intruder\s*in\s*my\s*house|being\s*beaten|domestic\s*violence\s*now|active\s*fire|building\s*on\s*fire|kidnapped|threatened\s*with\s*(gun|knife)|sexual\s*assault\s*happening|मार\s*रहा\s*है|घर\s*में\s*घुस\s*गया|आग\s*लग\s*गई)\b/i

const ACTIVE_CYBER_FRAUD_REGEX = /\b((money|amount|\d+[\d,.]*|\w+)\s*(was|is|got|just)?\s*(debited|deducted|stolen|transferred|lost)\b.*(bank|account|card|upi|wallet|now|today)|(debited|deducted|unauthorized\s*transaction).*(from\s*my\s*(bank|account))|otp\s*(shared|given|sent|asked)|(gave|shared)\s*otp|got\s*scammed|bank\s*account\s*hacked|sim\s*swap|unauthorized\s*transaction|पैसे\s*कट\s*गए|ओटीपी\s*दे\s*दिया|खाता\s*खाली)\b/i

export function detectCrisis(text) {
  if (!text || typeof text !== 'string') {
    return { isEmergency: false, urgency: 'standard', emergencyType: null, immediateAction: null }
  }

  const clean = text.trim()

  // 1. Suicidal Crisis or Self-Harm Risk
  if (SELF_HARM_REGEX.test(clean)) {
    return {
      isEmergency: true,
      urgency: 'critical',
      emergencyType: 'self_harm',
      immediateAction: {
        title: 'Immediate Crisis Support & Safety Assistance',
        severity: 'critical',
        badge: 'CRISIS ALERT — YOU ARE NOT ALONE',
        directives: [
          'If you or someone you know is in distress or feeling overwhelmed, please connect with a compassionate crisis counselor right now.',
          'Free, 24/7 confidential professional help is available immediately by phone or WhatsApp.',
          'Please stay with someone you trust or move to a safe, quiet space while you contact support.'
        ],
        contacts: [
          {
            label: 'Tele-MANAS (Govt. of India — 24/7 Free)',
            number: '14416 / 1800-891-4416',
            description: 'Toll-free 24x7 mental health tele-counseling in 20+ Indian languages',
            url: 'https://telemanas.mohfw.gov.in/'
          },
          {
            label: 'KIRAN National Mental Health Helpline',
            number: '1800-599-0019',
            description: 'Ministry of Social Justice 24/7 psychosocial support helpline'
          },
          {
            label: 'Vandrevala Foundation Helpline',
            number: '+91 9999 666 555',
            description: 'Free 24x7 crisis counseling via Call and WhatsApp'
          },
          {
            label: 'National Emergency Response System',
            number: '112',
            description: 'Single emergency helpline for urgent police or ambulance intervention across India'
          }
        ],
        disclaimer: 'This automated assistant cannot provide emergency medical rescue. If you are in immediate danger of injury, please call 112 or visit the nearest hospital emergency room immediately.'
      }
    }
  }

  // 2. Poisoning / Chemical Ingestion
  if (POISONING_REGEX.test(clean)) {
    return {
      isEmergency: true,
      urgency: 'critical',
      emergencyType: 'poisoning',
      immediateAction: {
        title: 'Emergency Poisoning Protocol — Act Immediately',
        severity: 'critical',
        badge: 'TOXICITY / POISONING EMERGENCY',
        directives: [
          'DO NOT induce vomiting unless explicitly instructed by a qualified doctor or poison specialist.',
          'Keep the chemical container, bottle, or medicine strip nearby so medical staff know the exact active substance.',
          'Immediately call the National Poison Centre or call an ambulance to the nearest hospital emergency room.'
        ],
        contacts: [
          {
            label: 'National Poisons Information Centre (AIIMS, New Delhi)',
            number: '1800-116-117 / 011-26593677',
            description: '24x7 specialist toxicological guidance from AIIMS Emergency Department'
          },
          {
            label: 'Ambulance Emergency',
            number: '108 / 102',
            description: 'Immediate medical transport dispatch'
          },
          {
            label: 'National Emergency Helpline',
            number: '112',
            description: 'Integrated emergency assistance across India'
          }
        ],
        disclaimer: 'Immediate hospital clinical management is mandatory for chemical or pharmaceutical poisonings. Do not rely solely on online guidance.'
      }
    }
  }

  // 3. Acute Critical Medical Emergencies (Heart, Stroke, Respiratory Arrest)
  if (MEDICAL_CRITICAL_REGEX.test(clean)) {
    return {
      isEmergency: true,
      urgency: 'critical',
      emergencyType: 'medical_critical',
      immediateAction: {
        title: 'Potential Life-Threatening Medical Emergency',
        severity: 'critical',
        badge: 'URGENT MEDICAL ACTION REQUIRED',
        directives: [
          'Call for an ambulance immediately (Dial 108 or 102). Do not attempt to drive yourself to the hospital.',
          'If chest pain is present: Sit in a comfortable resting position (preferably supported on the floor with knees bent) to relieve heart strain.',
          'If stroke symptoms are suspected (Face drooping, Arm weakness, Slurred speech — FAST): Note the exact time symptoms started for emergency physicians.'
        ],
        contacts: [
          {
            label: 'Medical Ambulance Services',
            number: '108 / 102',
            description: 'Government 24/7 emergency medical response & ambulance'
          },
          {
            label: 'Unified National Emergency',
            number: '112',
            description: 'Pan-India emergency dispatch (Ambulance, Police, Rescue)'
          }
        ],
        disclaimer: 'This system provides educational and informational orientation only. It is not a substitute for diagnostic medical evaluation or emergency hospital care.'
      }
    }
  }

  // 4. Physical Danger / Active Violence / Fire
  if (VIOLENCE_DANGER_REGEX.test(clean)) {
    return {
      isEmergency: true,
      urgency: 'critical',
      emergencyType: 'violence_danger',
      immediateAction: {
        title: 'Immediate Physical Safety & Police / Fire Response',
        severity: 'critical',
        badge: 'SAFETY & EMERGENCY INTERVENTION',
        directives: [
          'Prioritize your physical safety: Move to a locked, lit, or populated area if possible.',
          'Dial 112 immediately to dispatch the nearest emergency police patrol or fire brigade.',
          'If facing domestic or gender-based violence, specialized confidential women helpline responders can provide immediate shelter and legal protection.'
        ],
        contacts: [
          {
            label: 'Police / Unified Emergency',
            number: '112 / 100',
            description: 'Immediate police patrol dispatch and rescue'
          },
          {
            label: 'Women Helpline (Domestic Violence / Distress)',
            number: '1091 / 181',
            description: '24x7 toll-free emergency support for women in distress'
          },
          {
            label: 'Fire Services',
            number: '101',
            description: 'Emergency fire and disaster rescue'
          }
        ],
        disclaimer: 'Always prioritize your physical security and follow official directions from emergency police and rescue personnel.'
      }
    }
  }

  // 5. Active Cybercrime & Financial Fraud in Progress
  if (ACTIVE_CYBER_FRAUD_REGEX.test(clean)) {
    return {
      isEmergency: true,
      urgency: 'urgent',
      emergencyType: 'active_cyber_fraud',
      immediateAction: {
        title: 'Golden Hour Cybercrime Protocol — Act Now to Freeze Funds',
        severity: 'high',
        badge: 'ACTIVE FINANCIAL FRAUD ALERT',
        directives: [
          'ACT IMMEDIATELY (Golden Hour): Dial 1930 (National Cybercrime Reporting Helpline) right now. Police operators coordinate with the Indian Cyber Crime Coordination Centre (I4C) to freeze fraudulent transfers across beneficiary bank accounts.',
          'Call your bank helpline immediately or use your mobile banking app to block your debit/credit card, disable UPI, and freeze netbanking credentials.',
          'Preserve all digital evidence: Take screenshots of payment confirmations, SMS alerts, UTR numbers, caller ID numbers, and transaction reference IDs.'
        ],
        contacts: [
          {
            label: 'National Cybercrime Helpline (Citizen Financial Cyber Fraud Reporting System)',
            number: '1930',
            description: 'Government 24/7 helpline to block illicit fund transfers',
            url: 'https://cybercrime.gov.in/'
          },
          {
            label: 'National Cyber Crime Reporting Portal',
            number: 'cybercrime.gov.in',
            description: 'Official Ministry of Home Affairs incident reporting portal',
            url: 'https://cybercrime.gov.in/'
          },
          {
            label: 'Chakshu (DoT Fraud Communications Portal)',
            number: 'sancharsaathi.gov.in',
            description: 'Department of Telecommunications portal to report fraudulent phone numbers and WhatsApp calls',
            url: 'https://sancharsaathi.gov.in/sfc/'
          }
        ],
        disclaimer: 'Banks and law enforcement never ask for your UPI PIN or OTP to reverse unauthorized transactions.'
      }
    }
  }

  return { isEmergency: false, urgency: 'standard', emergencyType: null, immediateAction: null }
}
