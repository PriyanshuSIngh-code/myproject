import { describe, it, expect } from 'vitest'
// @ts-expect-error JS module in TS test
import { processChatMessage } from '../../server/services/chatEngine.js'

describe('NayayaMitra AI Legal Intelligence Benchmarks (Questions A, B, C, D)', () => {
  it('Question A: handles landlord eviction without notice with Section 106 & Order 39 CPC in natural paragraphs', async () => {
    const res = await processChatMessage({
      message: 'My landlord is asking me to vacate the house without notice.'
    })

    expect(res.category).toBe('Legal Assistance')
    expect(res.subCategory).toContain('Tenancy')
    expect(res.text).toContain('Section 106')
    expect(res.text).toContain('Transfer of Property Act, 1882')
    expect(res.text).toContain('Order 39, Rules 1 & 2')
    expect(res.text).toMatch(/without due process of law/i)
    expect(res.text).toContain('112')

    // Must NOT have rigid template headings
    expect(res.text).not.toContain('### **Headline**')
    expect(res.text).not.toContain('**1. Core Principles**')
    expect(res.text).not.toContain('**2. Recommended Next Steps**')
    expect(res.text).not.toContain('**3. Clarifying Follow-Up Questions**')

    // Must NOT confuse with unpaid salary, friendly loan, or police summons
    expect(res.text).not.toContain('Payment of Wages Act')
    expect(res.text).not.toContain('Order 37')
    expect(res.text).not.toContain('Section 35(3)')
  })

  it('Question B: handles unpaid salary for three months under Payment of Wages Act & SAMADHAN portal', async () => {
    const res = await processChatMessage({
      message: 'My employer has not paid my salary for three months.'
    })

    expect(res.category).toBe('Legal Assistance')
    expect(res.subCategory).toContain('Employment')
    expect(res.text).toContain('Payment of Wages Act, 1936')
    expect(res.text).toContain('Section 5')
    expect(res.text).toContain('Section 15')
    expect(res.text).toContain('Labour Commissioner')
    expect(res.text).toContain('samadhan.labour.gov.in')
    expect(res.text).toContain('12 months')

    // Must NOT have rigid template headings
    expect(res.text).not.toContain('### **Headline**')
    expect(res.text).not.toContain('**1. Core Principles**')
    expect(res.text).not.toContain('**2. Recommended Next Steps**')

    // Must NOT confuse with landlord or cheque bounce
    expect(res.text).not.toContain('Transfer of Property Act')
    expect(res.text).not.toContain('Section 138')
  })

  it('Question C: handles money lent recovery as civil debt under Order 37 CPC & Section 18 Limitation Act', async () => {
    const res = await processChatMessage({
      message: 'I lent money to a friend, but they refuse to repay me.'
    })

    expect(res.category).toBe('Legal Assistance')
    expect(res.subCategory).toContain('Debt Recovery')
    expect(res.text).toContain('Order 37')
    expect(res.text).toContain('Summary Suit')
    expect(res.text).toContain('Limitation Act, 1963')
    expect(res.text).toContain('Section 18')
    expect(res.text).toContain('3 years')
    expect(res.text).toMatch(/RPAD|Registered Post/i)

    // Should emphasize civil recovery, not purely criminal cheating
    expect(res.text).toMatch(/civil breach|civil law|civil matter/i)

    // Must NOT have rigid template headings
    expect(res.text).not.toContain('### **Headline**')
    expect(res.text).not.toContain('**1. Core Principles**')

    // Must NOT confuse with landlord eviction or salary
    expect(res.text).not.toContain('Transfer of Property Act')
    expect(res.text).not.toContain('Payment of Wages Act')
  })

  it('Question D: handles police asking to come to station with Section 35(3) BNSS, Section 179 BNSS & constitutional rights', async () => {
    const res = await processChatMessage({
      message: 'Police are asking me to come to the station.'
    })

    expect(res.category).toBe('Legal Assistance')
    expect(res.subCategory).toContain('Police Inquiries')
    expect(res.text).toContain('Section 35(3)')
    expect(res.text).toContain('BNSS')
    expect(res.text).toContain('Section 179')
    expect(res.text).toContain('Article 22(1)')
    expect(res.text).toContain('Article 20(3)')
    expect(res.text).toMatch(/witness or (a )?suspect/i)
    expect(res.text).toMatch(/Notice of Appearance/i)

    // Must NOT have rigid template headings
    expect(res.text).not.toContain('### **Headline**')
    expect(res.text).not.toContain('**1. Core Principles**')

    // Must NOT confuse with landlord eviction, debt recovery, or salary
    expect(res.text).not.toContain('Transfer of Property Act')
    expect(res.text).not.toContain('Payment of Wages Act')
    expect(res.text).not.toContain('Order 37')
  })

  it('All 4 benchmark responses are mutually distinct and specific to their respective legal issues', async () => {
    const qA = await processChatMessage({ message: 'My landlord is asking me to vacate the house without notice.' })
    const qB = await processChatMessage({ message: 'My employer has not paid my salary for three months.' })
    const qC = await processChatMessage({ message: 'I lent money to a friend, but they refuse to repay me.' })
    const qD = await processChatMessage({ message: 'Police are asking me to come to the station.' })

    const texts = [qA.text, qB.text, qC.text, qD.text]
    const uniqueTexts = new Set(texts)
    expect(uniqueTexts.size).toBe(4)

    const subCategories = [qA.subCategory, qB.subCategory, qC.subCategory, qD.subCategory]
    const uniqueSubs = new Set(subCategories)
    expect(uniqueSubs.size).toBe(4)
  })

  it('Supports natural Roman Hinglish queries accurately and conversationally', async () => {
    const hinglishLandlord = await processChatMessage({
      message: 'Mere landlord ne bina notice ghar khali karne ko bola.'
    })
    expect(hinglishLandlord.text).toContain('Transfer of Property Act')
    expect(hinglishLandlord.text).toContain('Dhara 106')
    expect(hinglishLandlord.text).toContain('112')
    expect(hinglishLandlord.text).toContain('makan malik')

    const hinglishSalary = await processChatMessage({
      message: 'Bhai mere employer ne 3 mahine se salary nahi di.'
    })
    expect(hinglishSalary.text).toContain('Payment of Wages Act, 1936')
    expect(hinglishSalary.text).toContain('Dhara 5')
    expect(hinglishSalary.text).toContain('samadhan.labour.gov.in')
    expect(hinglishSalary.text).toContain('vetan')

    const hinglishLoan = await processChatMessage({
      message: 'Dost ko paise udhar diye the wapas nahi de raha hai.'
    })
    expect(hinglishLoan.text).toContain('Order 37')
    expect(hinglishLoan.text).toContain('Limitation Act')
    expect(hinglishLoan.text).toContain('3 saal')
    expect(hinglishLoan.text).toContain('Section 18')

    const hinglishPolice = await processChatMessage({
      message: 'Police thane aane ko bol rahi hai kya karu?'
    })
    expect(hinglishPolice.text).toContain('35(3)')
    expect(hinglishPolice.text).toContain('BNSS')
    expect(hinglishPolice.text).toContain('Section 179')
    expect(hinglishPolice.text).toMatch(/Notice of Appearance|likhit notice/i)
  })
})
