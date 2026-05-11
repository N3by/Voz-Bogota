import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../common/ProgressBar'
import PinInput from '../common/PinInput'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import { LOCALIDADES } from '../../constants/localidades'
import './RegisterScreen.css'


const STEP_LABELS = ['Datos personales', 'Contacto y localidad', 'Crear PIN']

export default function RegisterScreen() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nombre: '', apellido: '', cc: '',
    telefono: '', localidad_id: '',
    pin: '', pinConfirm: '',
  })

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const setPin = (field) => (val) => setForm((f) => ({ ...f, [field]: val }))

  const canNext = () => {
    if (step === 1) return form.nombre.trim() && form.apellido.trim() && form.cc.trim().length >= 6
    if (step === 2) return true
    if (step === 3) return form.pin.length === 4 && form.pin === form.pinConfirm
    return false
  }

  const handleNext = () => {
    if (step < 3) { setStep(step + 1); setError('') }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/register', {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        cc: form.cc.trim(),
        telefono: form.telefono.trim() || undefined,
        localidad_id: form.localidad_id ? Number(form.localidad_id) : undefined,
        pin: form.pin,
      })
      login(data.user, data.access_token)
      navigate('/encuestas', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-screen screen screen--no-nav">
      <div className="register__header">
        <button className="btn btn--text" onClick={() => (step > 1 ? setStep(step - 1) : navigate('/'))}>
          ← {step > 1 ? 'Atrás' : 'Volver'}
        </button>
        <h2 className="register__title">Crear cuenta</h2>
        <div className="register__progress">
          <ProgressBar current={step} total={3} label={STEP_LABELS[step - 1]} />
        </div>
      </div>

      <div className="register__body">
        {step === 1 && (
          <div className="register__step">
            <div className="input-group">
              <label className="input-label">Nombre</label>
              <input className="input" placeholder="Tu nombre" value={form.nombre} onChange={set('nombre')} autoFocus />
            </div>
            <div className="input-group">
              <label className="input-label">Apellido</label>
              <input className="input" placeholder="Tu apellido" value={form.apellido} onChange={set('apellido')} />
            </div>
            <div className="input-group">
              <label className="input-label">Número de cédula</label>
              <input
                className="input"
                type="tel"
                inputMode="numeric"
                placeholder="Ej. 1234567890"
                value={form.cc}
                onChange={(e) => setForm((f) => ({ ...f, cc: e.target.value.replace(/\D/g, '') }))}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="register__step">
            <div className="input-group">
              <label className="input-label">Teléfono (opcional)</label>
              <input
                className="input"
                type="tel"
                placeholder="Ej. 3001234567"
                value={form.telefono}
                onChange={set('telefono')}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Localidad de Bogotá</label>
              <select className="input input-select" value={form.localidad_id} onChange={set('localidad_id')}>
                <option value="">Selecciona tu localidad</option>
                {LOCALIDADES.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="register__step">
            <div className="register__pin-group">
              <p className="input-label text-center">Crea tu PIN de 4 dígitos</p>
              <PinInput value={form.pin} onChange={setPin('pin')} />
            </div>
            <div className="register__pin-group">
              <p className="input-label text-center">Confirma tu PIN</p>
              <PinInput value={form.pinConfirm} onChange={setPin('pinConfirm')} />
              {form.pinConfirm.length === 4 && form.pin !== form.pinConfirm && (
                <p className="register__pin-error">Los PIN no coinciden</p>
              )}
            </div>
          </div>
        )}

        {error && <p className="register__error">{error}</p>}
      </div>

      <div className="register__footer">
        {step < 3 ? (
          <button className="btn btn--primary" onClick={handleNext} disabled={!canNext()}>
            Continuar
          </button>
        ) : (
          <button className="btn btn--primary" onClick={handleSubmit} disabled={!canNext() || loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        )}
      </div>
    </div>
  )
}
