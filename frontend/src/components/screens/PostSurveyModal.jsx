import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'
import './PostSurveyModal.css'

const COUNTDOWN = 5

export default function PostSurveyModal({ isOpen, onClose }) {
  const [seconds, setSeconds] = useState(COUNTDOWN)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) { setSeconds(COUNTDOWN); return }
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(id)
          navigate('/mapa')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isOpen, navigate])

  const pct = ((COUNTDOWN - seconds) / COUNTDOWN) * 100

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeOnOverlay={false}>
      <div className="post-modal">
        <div className="post-modal__icon">🎉</div>
        <h2 className="post-modal__title">¡Gracias por participar!</h2>
        <p className="post-modal__desc">Tu respuesta ha sido registrada y contribuye a la ciudad.</p>

        <div className="post-modal__countdown">
          <div className="post-modal__bar-track">
            <div className="post-modal__bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="post-modal__seconds">Redirigiendo al mapa en {seconds}s</p>
        </div>

        <button className="btn btn--primary" onClick={() => navigate('/mapa')}>
          Ver mapa ahora →
        </button>
        <button className="btn btn--text post-modal__skip" onClick={onClose}>
          Volver a encuestas
        </button>
      </div>
    </Modal>
  )
}
