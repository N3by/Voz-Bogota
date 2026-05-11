import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import './AdminSurveys.css'

export default function AdminSurveys() {
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api.get('/surveys?include_closed=true').then(({ data }) => setSurveys(data)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const toggleStatus = async (survey) => {
    const accion = survey.estado === 'activa' ? 'cerrar' : 'activar'
    if (!window.confirm(`¿Seguro que deseas ${accion} "${survey.titulo}"?`)) return
    const nuevoEstado = survey.estado === 'activa' ? 'cerrada' : 'activa'
    try {
      await api.patch(`/surveys/${survey.id}/status`, { estado: nuevoEstado })
      load()
    } catch {
      alert('No se pudo actualizar el estado. Intenta de nuevo.')
    }
  }

  return (
    <div className="admin-surveys screen">
      <div className="admin-surveys__header">
        <button className="btn btn--text" onClick={() => navigate('/admin')}>← Dashboard</button>
        <h1 className="admin-surveys__title">Encuestas</h1>
      </div>

      <button className="btn btn--primary" onClick={() => navigate('/admin/encuestas/nueva')}>
        + Nueva encuesta
      </button>

      {loading ? (
        <p className="text-muted">Cargando...</p>
      ) : (
        <div className="admin-surveys__list">
          {surveys.map((s) => (
            <div key={s.id} className="admin-survey-card">
              <div className="admin-survey-card__top">
                <span className={`badge badge--${s.estado === 'activa' ? 'active' : 'closed'}`}>
                  {s.estado}
                </span>
                <span className="text-muted">{s.participant_count ?? 0} participantes</span>
              </div>
              <h3 className="admin-survey-card__title">{s.titulo}</h3>
              {s.categoria && <span className="admin-survey-card__cat">{s.categoria}</span>}
              <div className="admin-survey-card__actions">
                <button
                  className="btn btn--text admin-survey-card__btn"
                  onClick={() => navigate(`/admin/encuestas/${s.id}/editar`)}
                >
                  Editar
                </button>
                <button
                  className={`btn btn--text admin-survey-card__btn ${s.estado === 'activa' ? 'admin-survey-card__btn--danger' : 'admin-survey-card__btn--success'}`}
                  onClick={() => toggleStatus(s)}
                >
                  {s.estado === 'activa' ? 'Cerrar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
