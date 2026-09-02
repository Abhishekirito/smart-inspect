// Six-box one-time-code input. Handles typing, paste, backspace and arrow keys,
// and reports the joined value up via onChange. Purely presentational — the
// parent owns the value/verify logic.
import { useRef } from 'react'

const LEN = 6

export default function OtpInput({ value = '', onChange, onComplete, disabled }) {
  const refs = useRef([])
  const digits = value.padEnd(LEN, ' ').slice(0, LEN).split('')

  const emit = (next) => {
    const joined = next.join('').replace(/\s/g, '')
    onChange?.(joined)
    if (joined.length === LEN) onComplete?.(joined)
  }

  const setAt = (i, d) => {
    const next = [...digits]
    next[i] = d
    emit(next)
  }

  const handleChange = (i, raw) => {
    const only = raw.replace(/\D/g, '')
    if (!only) return
    if (only.length > 1) {
      // Pasted / autofilled several digits into one box.
      const next = [...digits]
      for (let k = 0; k < only.length && i + k < LEN; k++) next[i + k] = only[k]
      emit(next)
      const land = Math.min(i + only.length, LEN - 1)
      refs.current[land]?.focus()
      return
    }
    setAt(i, only)
    if (i < LEN - 1) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i].trim()) {
        setAt(i, ' ')
      } else if (i > 0) {
        refs.current[i - 1]?.focus()
        setAt(i - 1, ' ')
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < LEN - 1) {
      refs.current[i + 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, LEN)
    if (!text) return
    e.preventDefault()
    const next = Array(LEN).fill(' ')
    for (let k = 0; k < text.length; k++) next[k] = text[k]
    emit(next)
    refs.current[Math.min(text.length, LEN - 1)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length: LEN }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digits[i].trim()}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="h-14 w-11 rounded-xl border border-slate-300 bg-white text-center text-2xl font-bold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:opacity-50 sm:w-12"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
