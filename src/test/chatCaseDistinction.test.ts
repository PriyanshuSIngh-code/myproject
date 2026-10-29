import { describe, it, expect } from 'vitest'
// @ts-expect-error JS import in TS test
import { processChatMessage } from '../../server/services/chatEngine.js'

describe('NayayaMitra Multi-Domain Case Distinction & Intelligence Engine', () => {
  it('correctly analyzes a Property Ownership Dispute with title deeds and limitation rules', async () => {
    const input = 'My ancestral agricultural land was encroached by a distant relative who created fake registration papers without my consent.'
    const res = await processChatMessage({ message: input })

    expect(res.category).toBe('Legal Assistance')
    expect(res.subCategory).toBe('Property & Real Estate Law')
    expect(res.text).toContain('Specific Relief Act')
    expect(res.text).toContain('Declaration of Title')
    expect(res.text).toMatch(/12[- ]years?/i)
    expect(res.text).toContain('Jamabandi')
    // Should NOT contain consumer or cheque bounce boilerplate
    expect(res.text).not.toContain('Section 138')
    expect(res.text).not.toContain('National Consumer Helpline')
  })

  it('correctly analyzes a Consumer Complaint about a defective product with CPA 2019 provisions', async () => {
    const input = 'I bought a laptop from an authorized online store 3 months ago. The motherboard failed and the service center is refusing warranty repair or replacement.'
    const res = await processChatMessage({ message: input })

    expect(res.category).toBe('Finance & Consumer Rights')
    expect(res.subCategory).toBe('Consumer Disputes & Product Liability')
    expect(res.text).toContain('Consumer Protection Act, 2019')
    expect(res.text).toContain('Product Liability')
    expect(res.text).toContain('1915')
    expect(res.text).toContain('e-Daakhil')
    expect(res.text).toContain('2 years')
    // Should NOT confuse with stolen property or criminal cheating
    expect(res.text).not.toContain('Bona fide purchaser')
    expect(res.text).not.toContain('Section 138')
  })

  it('correctly analyzes Criminal Threats and Extimidation under modern BNS provisions', async () => {
    const input = 'A local moneylender is calling me repeatedly, threatening to kill me and beat up my family if I do not pay him 5 lakhs by tomorrow.'
    const res = await processChatMessage({ message: input })

    expect(res.category).toBe('Legal Assistance')
    expect(res.subCategory).toBe('Criminal Law & Personal Safety')
    expect(res.text).toContain('Section 351, BNS, 2023')
    expect(res.text).toContain('Criminal Intimidation')
    expect(res.text).toContain('112')
    expect(res.text).toContain('Section 173')
    // Must NOT treat as a simple civil contract breach
    expect(res.text).not.toContain('Consumer Commission')
    expect(res.text).not.toContain('Specific Relief Act')
  })

  it('correctly analyzes an Employment Salary Dispute under Payment of Wages & Industrial Disputes laws', async () => {
    const input = 'My company has withheld my salary for the last 3 months and terminated me immediately without serving the 30-day notice period in my contract.'
    const res = await processChatMessage({ message: input })

    expect(res.category).toBe('Legal Assistance')
    expect(res.subCategory).toContain('Employment & Labour Law')
    expect(res.text).toContain('Payment of Wages Act, 1936')
    expect(res.text).toContain('Section 5')
    expect(res.text).toContain('Labour Commissioner')
    expect(res.text).toContain('samadhan.labour.gov.in')
    expect(res.text).toContain('notice pay')
    // Must NOT give property or consumer advice
    expect(res.text).not.toContain('Jamabandi')
    expect(res.text).not.toContain('e-Daakhil')
  })

  it('correctly analyzes an Online Financial Fraud incident with 1930 Golden Hour and RBI zero liability', async () => {
    const input = 'I clicked on a link and 65,000 rupees was debited from my bank account just 20 minutes ago. How do I get my money back?'
    const res = await processChatMessage({ message: input })

    expect(res.isEmergency).toBe(true)
    expect(res.urgency).toBe('urgent')
    expect(res.text).toContain('1930')
    expect(res.text).toContain('Golden Hour')
    expect(res.text).toContain('cybercrime.gov.in')
    expect(res.text).toMatch(/zero[- ]liability/i)
  })

  it('correctly handles Police Refusal to register an FIR under Section 173/175 BNSS', async () => {
    const input = 'I went to the police station to report a robbery and the SHO refused to register my FIR and sent me away. What can I do?'
    const res = await processChatMessage({ message: input })

    expect(res.category).toBe('Legal Assistance')
    expect(res.subCategory).toBe('Criminal Procedure & Police FIR')
    expect(res.text).toContain('Section 173')
    expect(res.text).toContain('BNSS')
    expect(res.text).toContain('Lalita Kumari')
    expect(res.text).toContain('Superintendent of Police')
    expect(res.text).toContain('Section 175(3) BNSS')
    expect(res.text).toContain('Zero FIR')
  })

  it('identifies Insufficient Facts in an ambiguous query and asks focused follow-up questions', async () => {
    const input = 'Can I take legal action?'
    const res = await processChatMessage({ message: input })

    expect(res.text).toContain('Additional Specific Details Needed')
    expect(res.text).toContain('What specific event or dispute occurred?')
    expect(res.text).toContain('Who is the opposing party?')
    expect(res.text).toContain('What written or digital proof exists?')
    // Does NOT pretend to give a definitive legal decree
    expect(res.text).not.toContain('Under Section 138')
  })

  it('answers non-legal programming / tech questions technically without legal jargon', async () => {
    const input = 'How do I fix a CORS error in React with Express backend?'
    const res = await processChatMessage({ message: input })

    expect(res.category).toBe('Technology & Troubleshooting')
    expect(res.text).toContain('Cross-Origin Resource Sharing')
    expect(res.text).toContain('npm install cors')
    expect(res.text).toContain('app.use(cors(')
    // Must NOT contain court or Indian statute references
    expect(res.text).not.toContain('Specific Relief Act')
    expect(res.text).not.toContain('BNS')
    expect(res.text).not.toContain('Limitation Act')
  })

  it('resolves conversation context for follow-up questions in an ongoing thread', async () => {
    const history = [
      { role: 'user', content: 'My ancestral property was encroached by my uncle.' },
      { role: 'assistant', content: 'Under the Specific Relief Act, you can file a suit for declaration of title...' }
    ]

    const followUpRes = await processChatMessage({
      message: 'What documents do I need to file that?',
      conversationHistory: history
    })

    expect(followUpRes.category).toBe('Legal Assistance')
    expect(followUpRes.text).toContain('Registered Sale Deed')
    expect(followUpRes.text).toContain('Jamabandi / Khatoni')
    expect(followUpRes.text).toContain('Encumbrance Certificate')
    expect(followUpRes.text).toContain('Site Plan / Aksh Shajra')
  })

  it('meaningfully distinguishes two similar cases involving mobile phones', async () => {
    // Case 1: Defective retail phone -> Consumer Protection Act
    const caseA = await processChatMessage({
      message: 'I bought a phone 2 months ago from an authorized store and the display stopped working. The service center refuses warranty repair.'
    })

    // Case 2: OLX second-hand phone turned out stolen -> Criminal Cheating & Stolen Property
    const caseB = await processChatMessage({
      message: 'I bought a phone yesterday from a guy on OLX and paid cash. Today the police seized it saying it is stolen property.'
    })

    // Assert that the two answers are completely distinct in law, statutes, and remedies
    expect(caseA.text).toContain('Consumer Protection Act, 2019')
    expect(caseA.text).toContain('e-Daakhil')
    expect(caseA.text).not.toContain('Section 318, Bharatiya Nyaya Sanhita')
    expect(caseA.text).not.toContain('Bona fide purchaser')

    expect(caseB.text).toContain('Section 318, Bharatiya Nyaya Sanhita, 2023 (BNS)')
    expect(caseB.text).toMatch(/bona fide purchaser/i)
    expect(caseB.text).toContain('OLX')
    expect(caseB.text).toContain('Superdari')
    expect(caseB.text).not.toContain('e-Daakhil')
    expect(caseB.text).not.toContain('National Consumer Helpline')
  })

  it('correctly analyzes Theft, Burglary and Robbery queries including Hinglish spelling variations', async () => {
    // English query
    const res1 = await processChatMessage({
      message: 'There is robery held in my house, the thieves took jewelry and cash. What should I do?'
    })
    expect(res1.category).toBe('Legal Assistance')
    expect(res1.subCategory).toContain('Theft')
    expect(res1.text).toContain('Section 305 BNS')
    expect(res1.text).toContain('112')
    expect(res1.text).toContain('Section 173 BNSS')
    expect(res1.text).toContain('ceir.gov.in')

    // Hinglish query (user exact query)
    const res2 = await processChatMessage({
      message: 'mere sath cjori hua hai mujhe kya krna chahiye'
    })
    expect(res2.category).toBe('Legal Assistance')
    expect(res2.text).toContain('चोरी')
    expect(res2.text).toContain('112')
    expect(res2.text).toContain('धारा 305')
    expect(res2.text).toContain('BNSS')
    expect(res2.text).not.toContain('Limitation Act, 1963:\n\n- Most civil claims')
  })

  it('correctly provides contextual follow-up guidance when suggestion chips are clicked in an ongoing thread', async () => {
    const theftHistory = [
      { role: 'user', content: 'mere sath cjori hua hai mujhe kya krna chahiye' },
      { role: 'assistant', content: 'चोरी / डकैती की स्थिति में तुरंत 112 पर कॉल करें...' }
    ]

    // Chip 1: Could you explain this in simpler terms or provide an example?
    const chip1Res = await processChatMessage({
      message: 'Could you explain this in simpler terms or provide an example?',
      conversationHistory: theftHistory
    })
    expect(chip1Res.text).toContain('Theft & Robbery Explained in Simple Everyday Terms')
    expect(chip1Res.text).toContain('Theft vs. Robbery')
    expect(chip1Res.text).not.toContain('Most civil claims for debt recovery')

    // Chip 2: What are the most practical next steps I can take right now?
    const chip2Res = await processChatMessage({
      message: 'What are the most practical next steps I can take right now?',
      conversationHistory: theftHistory
    })
    expect(chip2Res.text).toContain('Practical Checklist: Immediate Actions Following Theft')
    expect(chip2Res.text).toContain('Preserve the Crime Scene')
    expect(chip2Res.text).toContain('ceir.gov.in')

    // Chip 3: What important details should I consider for my specific situation?
    const chip3Res = await processChatMessage({
      message: 'What important details should I consider for my specific situation?',
      conversationHistory: theftHistory
    })
    expect(chip3Res.text).toContain('Critical Nuances to Keep in Mind for Theft & Robbery Cases')
    expect(chip3Res.text).toContain('Dwelling House vs. Street Theft')
    expect(chip3Res.text).toContain('Superdari')

    // Chip 4: Are there official or trusted references I should verify?
    const chip4Res = await processChatMessage({
      message: 'Are there official or trusted references I should verify?',
      conversationHistory: theftHistory
    })
    expect(chip4Res.text).toContain('Official Trusted Portals & Statutory References for Theft')
    expect(chip4Res.text).toContain('112')
    expect(chip4Res.text).toContain('ceir.gov.in')
  })

  it('correctly handles the 5 core user queries with case-specific legal analysis and distinct Hinglish/English responses', async () => {
    // 1. Landlord eviction without notice (English)
    const resLandlordEn = await processChatMessage({
      message: 'My landlord is asking me to vacate without notice.'
    })
    expect(resLandlordEn.category).toBe('Legal Assistance')
    expect(resLandlordEn.subCategory).toContain('Tenancy')
    expect(resLandlordEn.text).toContain('Transfer of Property Act, 1882')
    expect(resLandlordEn.text).toContain('Section 106')
    expect(resLandlordEn.text).toContain('Order 39, Rules 1 & 2')
    expect(resLandlordEn.text).toMatch(/without due process of law/i)

    // 2. Money lent recovery (English)
    const resMoneyRecovery = await processChatMessage({
      message: 'Someone has not repaid the money I lent them.'
    })
    expect(resMoneyRecovery.category).toBe('Legal Assistance')
    expect(resMoneyRecovery.subCategory).toContain('Debt Recovery')
    expect(resMoneyRecovery.text).toContain('Order 37')
    expect(resMoneyRecovery.text).toContain('Code of Civil Procedure')
    expect(resMoneyRecovery.text).toContain('Summary Suit')
    expect(resMoneyRecovery.text).toContain('Limitation Act, 1963')
    expect(resMoneyRecovery.text).toContain('3 years')

    // 3. Unpaid salary for 3 months (Hinglish)
    const resSalaryHinglish = await processChatMessage({
      message: 'Mere employer ne 3 mahine ki salary nahi di.'
    })
    expect(resSalaryHinglish.category).toBe('Legal Assistance')
    expect(resSalaryHinglish.subCategory).toContain('Employment')
    expect(resSalaryHinglish.text).toContain('Payment of Wages Act, 1936')
    expect(resSalaryHinglish.text).toContain('Labour Commissioner')
    expect(resSalaryHinglish.text).toContain('samadhan.labour.gov.in')
    expect(resSalaryHinglish.text).toMatch(/salary|vetan/i)

    // 4. Received a legal notice (English)
    const resLegalNotice = await processChatMessage({
      message: 'I received a legal notice. What should I do.'
    })
    expect(resLegalNotice.category).toBe('Legal Assistance')
    expect(resLegalNotice.subCategory).toContain('Legal Notice')
    expect(resLegalNotice.text).toContain('Preserve the Postal Envelope')
    expect(resLegalNotice.text).toMatch(/never ignore/i)
    expect(resLegalNotice.text).toContain('Registered Post with Acknowledgment Due (RPAD)')

    // 5. Landlord eviction without notice (Hinglish)
    const resLandlordHinglish = await processChatMessage({
      message: 'Mere landlord ne bina notice ghar khali karne ko bola.'
    })
    expect(resLandlordHinglish.category).toBe('Legal Assistance')
    expect(resLandlordHinglish.subCategory).toContain('Tenancy')
    expect(resLandlordHinglish.text).toContain('Transfer of Property Act, 1882')
    expect(resLandlordHinglish.text).toMatch(/106/i)
    expect(resLandlordHinglish.text).toContain('112')
    expect(resLandlordHinglish.text).toMatch(/makan malik|landlord/i)

    // Verify all 5 answers are mutually unique and distinct
    const allAnswers = [
      resLandlordEn.text,
      resMoneyRecovery.text,
      resSalaryHinglish.text,
      resLegalNotice.text,
      resLandlordHinglish.text
    ]
    const uniqueAnswers = new Set(allAnswers)
    expect(uniqueAnswers.size).toBe(5)
  })
})
