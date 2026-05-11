import { useState } from 'react'
import api from '../../services/api'
import './QuestionsEditor.css'

const TIPOS = [
  { value: 'opcion_multiple', label: 'Opción múltiple' },
  { value: 'escala', label: 'Escala 1-5' },
  { value: 'texto_libre', label: 'Texto libre' },
]

export default function QuestionsEditor({ surveyId, questions, onUpdate }) {
  const [newQ, setNewQ] = useState({ texto: '', tipo: 'opcion_multiple', options: [{ texto: '' }, { texto: '' }] })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const addQuestion = async () => {
    if (!newQ.texto.trim()) return
    if (newQ.tipo === 'opcion_multiple' &&
        newQ.options.filter((o) => o.texto.trim()).length < 2) {
      setAddError('Agrega al menos 2 opciones')
      return
    }
    setSaving(true)
    setAddError('')
    try {
      const payload = {
        texto: newQ.texto,
        tipo: newQ.tipo,
        orden: questions.length,
        options: newQ.tipo === 'opcion_multiple'
          ? newQ.options.filter((o) => o.texto.trim()).map((o, i) => ({ texto: o.texto, valor: i }))
          : [],
      }
      const { data } = await api.post(`/surveys/${surveyId}/questions`, payload)
      onUpdate(data.questions)
      setNewQ({ texto: '', tipo: 'opcion_multiple', options: [{ texto: '' }, { texto: '' }] })
      setShowForm(false)
    } catch {
      setAddError('Error al guardar la pregunta. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const deleteQuestion = async (qId) => {
    if (!window.confirm('¿Eliminar esta pregunta?')) return
    try {
      await api.delete(`/questions/${qId}`)
      onUpdate(questions.filter((q) => q.id !== qId))
    } catch {
      alert('No se pudo eliminar la pregunta. Intenta de nuevo.')
    }
  }

  const setOptionText = (i, value) => {
    setNewQ((prev) => {
      const opts = [...prev.options]
      opts[i] = { ...opts[i], texto: value }
      return { ...prev, options: opts }
    })
  }

  return (
    <div className="q-editor">
      {questions.length === 0 && !showForm && (
        <p className="text-muted q-editor__empty">No hay preguntas aún</p>
      )}

      <div className="q-editor__list">
        {questions.map((q, idx) => (
          <div key={q.id} className="q-editor__item">
            <div className="q-editor__item-top">
              <span className="q-editor__num">{idx + 1}</span>
              <span className="q-editor__tipo">{TIPOS.find((t) => t.value === q.tipo)?.label}</span>
              <button className="btn btn--text q-editor__delete" onClick={() => deleteQuestion(q.id)}>✕</button>
            </div>
            <p className="q-editor__texto">{q.texto}</p>
            {q.options?.length > 0 && (
              <div className="q-editor__opts">
                {q.options.map((o) => <span key={o.id} className="q-editor__opt">{o.texto}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="q-editor__form">
          <div className="input-group">
            <label className="input-label">Texto de la pregunta</label>
            <textarea
              className="input"
              rows={2}
              style={{ resize: 'none' }}
              value={newQ.texto}
              onChange={(e) => setNewQ((p) => ({ ...p, texto: e.target.value }))}
              placeholder="¿Cómo califica...?"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label className="input-label">Tipo de respuesta</label>
            <select
              className="input input-select"
              value={newQ.tipo}
              onChange={(e) => setNewQ((p) => ({ ...p, tipo: e.target.value }))}
            >
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {newQ.tipo === 'opcion_multiple' && (
            <div className="q-editor__new-opts">
              <label className="input-label">Opciones</label>
              {newQ.options.map((opt, i) => (
                <input
                  key={i}
                  className="input"
                  placeholder={`Opción ${i + 1}`}
                  value={opt.texto}
                  onChange={(e) => setOptionText(i, e.target.value)}
                />
              ))}
              <button
                className="btn btn--text"
                onClick={() => setNewQ((p) => ({ ...p, options: [...p.options, { texto: '' }] }))}
              >
                + Agregar opción
              </button>
            </div>
          )}

          {addError && <p className="survey-form__error">{addError}</p>}
          <div className="q-editor__form-actions">
            <button className="btn btn--primary" onClick={addQuestion} disabled={saving}>
              {saving ? 'Guardando...' : 'Agregar pregunta'}
            </button>
            <button className="btn btn--ghost" onClick={() => { setShowForm(false); setAddError('') }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="btn btn--ghost" onClick={() => setShowForm(true)}>
          + Agregar pregunta
        </button>
      )}
    </div>
  )
}
