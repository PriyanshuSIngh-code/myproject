import { describe, it, expect } from 'vitest'

describe('Domain and Input Validations', () => {
  it('validates email format as used in Login authentication', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    expect(emailRegex.test('advocate@example.com')).toBe(true)
    expect(emailRegex.test('user.test@court.gov.in')).toBe(true)
    expect(emailRegex.test('invalid-email')).toBe(false)
    expect(emailRegex.test('user@')).toBe(false)
    expect(emailRegex.test('@domain.com')).toBe(false)
    expect(emailRegex.test('user@domain')).toBe(false)
  })

  it('validates UPI UTR format as used in payment claims', () => {
    const isValidUtr = (ref: string) => {
      const trimmed = ref.trim()
      return trimmed.length >= 8 && trimmed.length <= 40 && /^[A-Za-z0-9-]+$/.test(trimmed)
    }

    expect(isValidUtr('123456789012')).toBe(true)
    expect(isValidUtr('UPI-REF-99887766')).toBe(true)
    expect(isValidUtr('SHORT')).toBe(false)
    expect(isValidUtr('INVALID SPECIAL #$%')).toBe(false)
    expect(isValidUtr('')).toBe(false)
  })

  it('sanitizes advocate document upload filenames', () => {
    const safeFilename = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_')

    expect(safeFilename('Bar Certificate (Final).pdf')).toBe('Bar_Certificate__Final_.pdf')
    expect(safeFilename('my degree copy 2024.png')).toBe('my_degree_copy_2024.png')
    expect(safeFilename('file-name_123.jpg')).toBe('file-name_123.jpg')
  })
})
