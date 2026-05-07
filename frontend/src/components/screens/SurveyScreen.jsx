import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ProgressBar from '../common/ProgressBar'
import PostSurveyModal from './PostSurveyModal'
import api from '../../services/api'
import './SurveyScreen.css'

export default function SurveyScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/surveys/${id}`).then(({ data }) => setSurvey(data))
  }, [id])

  if (!survey) {
    return (
      <div className="survey-screen screen">
        <div className="survey-screen__loading">Cargando encuesta...</div>
      </div>
    )
  }

  const question = survey.questions[currentQ]
  const isLast = currentQ === survey.questions.length - 1

  const selectOption = (optionId) => {
    setAnswers((prev) => ({ ...prev, [question.id]: { option_id: optionId } }))
  }

  const selectScale = (val) => {
    setAnswers((prev) => ({ ...prev, [question.id]: { option_id: val } }))
  }

  const setFreeText = (text) => {
    setAnswers((prev) => ({ ...prev, [question.id]: { texto_libre: text } }))
  }

  const canContinue = () => {
    const ans = answers[question?.id]
    if (!ans) return false
    if (question.tipo === 'texto_libre') return ans.texto_libre?.trim().length > 0
    return ans.option_id != null
  }

  const handleNext = async () => {
    if (!isLast) { setCurrentQ((q) => q + 1); return }

    setSubmitting(true)
    setError('')
    try {
      const payload = {
        survey_id: survey.id,
        answers: Object.entries(answers).map(([qid, ans]) => ({
          question_id: Number(qid),
          option_id: ans.option_id ?? null,
          texto_libre: ans.texto_libre ?? null,
        })),
      }
      await api.post('/responses', payload)
      setShowModal(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar la respuesta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="survey-screen screen screen--no-nav">
      <div className="survey-screen__header">
        <button className="btn btn--text" onClick={() => navigate('/encuestas')}>← Salir</button>
        <div className="survey-screen__progress">
          <ProgressBar current={currentQ + 1} total={survey.questions.length} />
        </div>
      </div>

      <div className="survey-screen__body">
        <p className="survey-screen__survey-title">{survey.titulo}</p>
        <h2 className="survey-screen__question">{question.texto}</h2>

        {question.tipo === 'opcion_multiple' && (
          <div className="survey-screen__options">
            {question.options.map((opt) => (
              <button
                key={opt.id}
                className={`survey-option ${answers[question.id]?.option_id === opt.id ? 'survey-option--selected' : ''}`}
                onClick={() => selectOption(opt.id)}
              >
                {opt.texto}
              </button>
            ))}
          </div>
        )}

        {question.tipo === 'escala' && (
          <div className="survey-screen__scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`scale-btn ${answers[question.id]?.option_id === n ? 'scale-btn--selected' : ''}`}
                onClick={() => selectScale(n)}
              >
                {n}
              </button>
            ))}
            <div className="scale-labels">
              <span>Muy malo</span><span>Excelente</span>
            </div>
          </div>
        )}

        {question.tipo === 'texto_libre' && (
          <textarea
            className="input survey-screen__textarea"
            placeholder="Escribe tu respuesta..."
            rows={5}
            value={answers[question.id]?.texto_libre || ''}
            onChange={(e) => setFreeText(e.target.value)}
          />
        )}

        {error && <p className="survey-screen__error">{error}</p>}
      </div>

      <div className="survey-screen__footer">
        <button
          className="btn btn--primary"
          onClick={handleNext}
          disabled={!canContinue() || submitting}
        >
          {submitting ? 'Enviando...' : isLast ? 'Enviar respuestas' : 'Siguiente →'}
        </button>
      </div>

      <PostSurveyModal isOpen={showModal} onClose={() => { setShowModal(false); navigate('/encuestas') }} />
    </div>
  )
}
