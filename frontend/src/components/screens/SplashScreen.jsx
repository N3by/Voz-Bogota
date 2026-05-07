import { useNavigate } from 'react-router-dom'
import './SplashScreen.css'

const FEATURES = [
  {
    icon: '🗳️',
    title: 'Tu voz cuenta',
    desc: 'Responde encuestas sobre tu comunidad y localidad',
  },
  {
    icon: '🗺️',
    title: 'Ve el impacto',
    desc: 'Mapa en tiempo real con la opinión de cada localidad',
  },
  {
    icon: '🔒',
    title: 'Simple y seguro',
    desc: 'Solo tu cédula y un PIN de 4 dígitos',
  },
]

export default function SplashScreen() {
  const navigate = useNavigate()

  return (
    <div className="splash">
      <div className="splash__hero">
        <div className="splash__logo">
          <span className="splash__logo-icon">🏙️</span>
          <h1 className="splash__logo-text">Voz Bogotá</h1>
          <p className="splash__tagline">Participa. Opina. Transforma.</p>
        </div>
      </div>

      <div className="splash__features">
        {FEATURES.map((f, i) => (
          <div key={i} className="splash__feature">
            <span className="splash__feature-icon">{f.icon}</span>
            <div>
              <p className="splash__feature-title">{f.title}</p>
              <p className="splash__feature-desc">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="splash__actions">
        <button className="btn btn--primary" onClick={() => navigate('/registro')}>
          Comenzar
        </button>
        <button className="btn btn--ghost" onClick={() => navigate('/login')}>
          Ya tengo cuenta
        </button>
      </div>
    </div>
  )
}
