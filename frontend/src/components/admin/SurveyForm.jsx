import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../services/api'
import QuestionsEditor from './QuestionsEditor'
import './SurveyForm.css'

const CATEGORIAS = ['Movilidad', 'Seguridad', 'Salud', 'Educación', 'Ambiente', 'Cultura', 'Servicios', 'Otros']

export default function SurveyForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    titulo: '', descripcion: '', categoria: '', duracion_min: 5,
  })
  const [questions, setQuestions] = useState([])

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    api.get(`/surveys/${id}`)
      .then(({ data }) => {
        setForm({
          titulo: data.titulo,
          descripcion: data.descripcion || '',
          categoria: data.categoria || '',
          duracion_min: data.duracion_min,
        })
        setQuestions(data.questions)
      })
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await api.put(`/surveys/${id}`, form)
        navigate('/admin/encuestas')
      } else {
        const { data } = await api.post('/surveys', { ...form, duracion_min: Number(form.duracion_min), questions: [] })
        navigate(`/admin/encuestas/${data.id}/editar`)
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      let msg = 'Error al guardar'
      if (!err.response) msg = 'Sin conexión con el servidor'
      else if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail)) msg = detail.map((d) => d.msg ?? JSON.stringify(d)).join(', ')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="survey-form screen"><p className="text-muted">Cargando...</p></div>

  return (
    <div className="survey-form screen screen--no-nav">
      <div className="survey-form__header">
        <button className="btn btn--text" onClick={() => navigate('/admin/encuestas')}>← Cancelar</button>
        <h1 className="survey-form__title">{isEdit ? 'Editar encuesta' : 'Nueva encuesta'}</h1>
      </div>

      <div className="survey-form__body">
        <div className="input-group">
          <label className="input-label">Título *</label>
          <input className="input" placeholder="Ej. Movilidad en mi localidad" value={form.titulo} onChange={set('titulo')} autoFocus />
        </div>
        <div className="input-group">
          <label className="input-label">Descripción</label>
          <textarea className="input" rows={3} placeholder="Describe el objetivo de la encuesta" value={form.descripcion} onChange={set('descripcion')} style={{ resize: 'none' }} />
        </div>
        <div className="survey-form__row">
          <div className="input-group">
            <label className="input-label">Categoría</label>
            <select className="input input-select" value={form.categoria} onChange={set('categoria')}>
              <option value="">Seleccionar</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Duración (min)</label>
            <input className="input" type="number" min={1} max={60} value={form.duracion_min} onChange={set('duracion_min')} />
          </div>
        </div>

        {isEdit && (
          <div className="survey-form__questions">
            <h3 className="survey-form__section">Preguntas</h3>
            <QuestionsEditor surveyId={id} questions={questions} onUpdate={setQuestions} />
          </div>
        )}

        {error && <p className="survey-form__error">{error}</p>}
      </div>

      <div className="survey-form__footer">
        <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear encuesta'}
        </button>
        {!isEdit && (
          <p className="text-muted survey-form__hint">
            Después de crear podrás agregar las preguntas
          </p>
        )}
      </div>
    </div>
  )
}
