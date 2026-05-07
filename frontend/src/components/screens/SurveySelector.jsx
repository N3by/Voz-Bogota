import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import './SurveySelector.css'

export default function SurveySelector() {
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/surveys')
      .then(({ data }) => setSurveys(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="survey-selector screen">
        <div className="survey-selector__header">
          <h1 className="survey-selector__title">Encuestas</h1>
        </div>
        <div className="survey-selector__loading">
          {[1, 2, 3].map((i) => <div key={i} className="survey-card-skeleton" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="survey-selector screen">
      <div className="survey-selector__header">
        <h1 className="survey-selector__title">Encuestas activas</h1>
        <p className="text-muted">Selecciona una encuesta para participar</p>
      </div>

      {surveys.length === 0 ? (
        <div className="survey-selector__empty">
          <span>📋</span>
          <p>No hay encuestas activas en este momento</p>
        </div>
      ) : (
        <div className="survey-selector__list">
          {surveys.map((survey) => (
            <button
              key={survey.id}
              className="survey-card"
              onClick={() => navigate(`/encuestas/${survey.id}`)}
            >
              <div className="survey-card__top">
                <span className="badge badge--active">Activa</span>
                {survey.categoria && (
                  <span className="survey-card__category">{survey.categoria}</span>
                )}
              </div>
              <h3 className="survey-card__title">{survey.titulo}</h3>
              {survey.descripcion && (
                <p className="survey-card__desc">{survey.descripcion}</p>
              )}
              <div className="survey-card__meta">
                <span className="survey-card__meta-item">
                  ⏱ {survey.duracion_min} min
                </span>
                <span className="survey-card__meta-item">
                  👥 {survey.participant_count} participantes
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
