import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PinInput from '../common/PinInput'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import './LoginScreen.css'

export default function LoginScreen() {
  const [cc, setCc] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!cc.trim() || pin.length !== 4) return

    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login', { cc: cc.trim(), pin })
      login(data.user, data.access_token)
      navigate(data.user.rol === 'admin' ? '/admin' : '/encuestas', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Cédula o PIN incorrecto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen screen screen--no-nav">
      <div className="login__header">
        <button className="btn btn--text login__back" onClick={() => navigate('/')}>← Volver</button>
        <h2 className="login__title">Bienvenido</h2>
        <p className="text-muted text-center">Ingresa con tu cédula y PIN</p>
      </div>

      <form className="login__form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Número de cédula</label>
          <input
            className="input"
            type="tel"
            inputMode="numeric"
            placeholder="Ej. 1234567890"
            value={cc}
            onChange={(e) => setCc(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
        </div>

        <div className="login__pin-section">
          <p className="input-label text-center">Tu PIN de 4 dígitos</p>
          <PinInput value={pin} onChange={setPin} disabled={loading} />
        </div>

        {error && <p className="login__error">{error}</p>}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={loading || !cc.trim() || pin.length !== 4}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <div className="login__footer">
        <Link to="/olvide-pin" className="login__forgot">¿Olvidaste tu PIN?</Link>
        <Link to="/registro" className="login__register">Crear cuenta →</Link>
      </div>
    </div>
  )
}
