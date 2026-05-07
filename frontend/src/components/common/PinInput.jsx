import { useRef, useState } from 'react'
import './PinInput.css'

export default function PinInput({ value = '', onChange, disabled = false }) {
  const inputRef = useRef(null)

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    onChange(raw)
  }

  const dots = Array.from({ length: 4 }, (_, i) => ({
    filled: i < value.length,
  }))

  return (
    <div className="pin-wrapper" onClick={() => inputRef.current?.focus()}>
      <div className="pin-dots">
        {dots.map((dot, i) => (
          <span key={i} className={`pin-dot ${dot.filled ? 'pin-dot--filled' : ''}`} />
        ))}
      </div>
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="pin-input-hidden"
        maxLength={4}
        autoComplete="one-time-code"
      />
    </div>
  )
}
