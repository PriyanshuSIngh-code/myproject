import React, { useRef, useEffect } from 'react'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
}

export default function OtpInput({ value, onChange, disabled = false, error = false, autoFocus = false }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Ensure digits array always has 6 slots
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

  useEffect(() => {
    if (autoFocus && inputsRef.current[0] && !disabled) {
      inputsRef.current[0].focus()
    }
  }, [autoFocus, disabled])

  function handleDigitChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value
    // If user typed or pasted more than 1 char in this box
    if (rawVal.length > 1) {
      const clean = rawVal.replace(/\D/g, '').slice(0, 6)
      if (clean) {
        onChange(clean)
        const nextIndex = Math.min(clean.length, 5)
        inputsRef.current[nextIndex]?.focus()
      }
      return
    }

    const char = rawVal.replace(/\D/g, '')
    const newDigits = [...digits]
    newDigits[index] = char
    const combined = newDigits.join('').slice(0, 6)
    onChange(combined)

    if (char && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to prev and clear
        inputsRef.current[index - 1]?.focus()
        const newDigits = [...digits]
        newDigits[index - 1] = ''
        onChange(newDigits.join(''))
        e.preventDefault()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) {
      onChange(pasted)
      const targetIndex = Math.min(pasted.length, 5)
      inputsRef.current[targetIndex]?.focus()
    }
  }

  return (
    <div
      role="group"
      aria-label="6-digit verification code"
      style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'center',
        margin: '18px 0 12px 0'
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputsRef.current[i] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i] || ''}
          onChange={e => handleDigitChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          style={{
            width: '46px',
            height: '52px',
            textAlign: 'center',
            fontSize: '22px',
            fontWeight: '700',
            fontFamily: 'Manrope, monospace',
            borderRadius: '10px',
            border: error
              ? '2px solid #e53e3e'
              : digits[i]
              ? '2px solid #c5a65e'
              : '1.5px solid #d5dbe6',
            background: disabled ? '#f4f6fa' : '#ffffff',
            color: '#101a33',
            outline: 'none',
            boxShadow: digits[i] ? '0 2px 8px rgba(197, 166, 94, 0.2)' : 'none',
            transition: 'all 0.18s ease-in-out'
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = '#c5a65e'
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(213, 181, 107, 0.25)'
          }}
          onBlur={e => {
            if (!digits[i] && !error) {
              e.currentTarget.style.borderColor = '#d5dbe6'
              e.currentTarget.style.boxShadow = 'none'
            }
          }}
        />
      ))}
    </div>
  )
}
