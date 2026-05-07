import './ProgressBar.css'

export default function ProgressBar({ current, total, label }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="progress-container">
      {label && <span className="progress-label">{label}</span>}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-steps">{current} de {total}</span>
    </div>
  )
}
