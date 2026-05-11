import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { LOCALIDADES } from '../../constants/localidades'
import './SettingsScreen.css'

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  if (!user) return null

  const localidadNombre = LOCALIDADES.find((l) => l.id === user.localidad_id)?.nombre ?? 'No especificada'

  return (
    <div className="settings-screen screen">
      <div className="settings__header">
        <h1 className="settings__title">Mi perfil</h1>
      </div>

      <div className="settings__avatar">
        <div className="settings__avatar-circle">
          {user.nombre.charAt(0)}{user.apellido.charAt(0)}
        </div>
        <h2 className="settings__name">{user.nombre} {user.apellido}</h2>
        <span className={`badge ${user.rol === 'admin' ? 'badge--active' : 'badge--closed'}`}>
          {user.rol === 'admin' ? 'Administrador' : 'Ciudadano'}
        </span>
      </div>

      <div className="settings__info">
        <div className="settings__info-item">
          <span className="settings__info-label">Cédula</span>
          <span className="settings__info-value">{user.cc}</span>
        </div>
        {user.telefono && (
          <div className="settings__info-item">
            <span className="settings__info-label">Teléfono</span>
            <span className="settings__info-value">{user.telefono}</span>
          </div>
        )}
        <div className="settings__info-item">
          <span className="settings__info-label">Localidad</span>
          <span className="settings__info-value">{localidadNombre}</span>
        </div>
      </div>

      {user.rol === 'admin' && (
        <button className="btn btn--ghost settings__admin-btn" onClick={() => navigate('/admin')}>
          Panel de administración
        </button>
      )}

      <button className="btn settings__logout-btn" onClick={handleLogout}>
        Cerrar sesión
      </button>
    </div>
  )
}
