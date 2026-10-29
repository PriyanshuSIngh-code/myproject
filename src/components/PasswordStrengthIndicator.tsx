import React from 'react'
import { Check, X } from 'lucide-react'

interface PasswordStrengthProps {
  password: string
}

export function evaluatePasswordRules(password: string) {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'One number (0-9)', met: /[0-9]/.test(password) },
    { label: 'One special symbol (!@#$%^&*...)', met: /[^A-Za-z0-9]/.test(password) }
  ]
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthProps) {
  if (!password) return null

  const rules = evaluatePasswordRules(password)
  const score = rules.filter(r => r.met).length

  let strengthLabel = 'Weak'
  let barColor = '#e53e3e' // red
  let widthPct = '20%'

  if (score === 5) {
    strengthLabel = 'Strong'
    barColor = '#38a169' // green
    widthPct = '100%'
  } else if (score >= 4) {
    strengthLabel = 'Good'
    barColor = '#d69e2e' // yellow
    widthPct = '80%'
  } else if (score >= 3) {
    strengthLabel = 'Fair'
    barColor = '#dd6b20' // orange
    widthPct = '60%'
  } else if (score >= 2) {
    strengthLabel = 'Moderate'
    barColor = '#e53e3e'
    widthPct = '40%'
  }

  return (
    <div style={{ marginTop: '10px', fontSize: '11px', color: '#58637b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Password strength:</span>
        <strong style={{ color: barColor }}>{strengthLabel}</strong>
      </div>
      <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
        <div
          style={{
            width: widthPct,
            height: '100%',
            background: barColor,
            transition: 'width 0.25s ease, background-color 0.25s ease'
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '5px', marginTop: '10px' }}>
        {rules.map((rule, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: rule.met ? '#2f855a' : '#a0aec0' }}>
            {rule.met ? <Check size={13} style={{ color: '#38a169', flexShrink: 0 }} /> : <X size={13} style={{ color: '#cbd5e0', flexShrink: 0 }} />}
            <span style={{ fontSize: '11px' }}>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
