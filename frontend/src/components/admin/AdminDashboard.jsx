import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api from '../../services/api'
import './AdminDashboard.css'

const COLORS = ['#C8102E', '#1a1a2e', '#6b7280', '#2e7d32', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899']

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [surveys, setSurveys] = useState([])
  const navigate = useNavigate()
  const mapRef = useRef(null)

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/surveys')])
      .then(([statsRes, surveysRes]) => {
        setStats(statsRes.data)
        setSurveys(surveysRes.data)
      })
  }, [])

  useEffect(() => {
    if (!stats || !mapRef.current) return
    let mapInstance = null

    const initAdminMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet.heat')

      mapInstance = L.map(mapRef.current, { center: [4.6097, -74.0817], zoom: 10, zoomControl: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(mapInstance)

      const { data } = await api.get('/admin/heatmap')
      const points = data.filter((d) => d.intensidad > 0).map((d) => [d.lat, d.lng, Math.min(d.intensidad / 5, 1)])
      if (points.length > 0) {
        L.heatLayer(points, { radius: 40, blur: 30, gradient: { 0.2: '#FFEB3B', 0.5: '#FF9800', 1.0: '#C8102E' } }).addTo(mapInstance)
      }
    }

    initAdminMap()
    return () => { if (mapInstance) mapInstance.remove() }
  }, [stats])

  if (!stats) {
    return <div className="admin-dashboard screen"><div className="admin__loading">Cargando analítica...</div></div>
  }

  const barData = stats.participaciones_por_localidad
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const pieData = surveys.reduce((acc, s) => {
    const cat = s.categoria || 'Sin categoría'
    const idx = acc.findIndex((d) => d.name === cat)
    if (idx >= 0) acc[idx].value += 1
    else acc.push({ name: cat, value: 1 })
    return acc
  }, [])

  return (
    <div className="admin-dashboard screen">
      <div className="admin__header">
        <div>
          <h1 className="admin__title">Panel Admin</h1>
          <p className="text-muted">Analítica en tiempo real</p>
        </div>
        <button className="btn btn--ghost admin__surveys-btn" onClick={() => navigate('/admin/encuestas')}>
          Encuestas
        </button>
      </div>

      <div className="admin__kpis">
        {[
          { label: 'Usuarios', value: stats.total_usuarios, icon: '👥' },
          { label: 'Encuestas', value: stats.total_encuestas, icon: '📋' },
          { label: 'Activas', value: stats.encuestas_activas, icon: '✅' },
          { label: 'Participaciones', value: stats.total_participaciones, icon: '🗳️' },
        ].map((kpi) => (
          <div key={kpi.label} className="admin__kpi-card">
            <span className="admin__kpi-icon">{kpi.icon}</span>
            <span className="admin__kpi-value">{kpi.value}</span>
            <span className="admin__kpi-label">{kpi.label}</span>
          </div>
        ))}
      </div>

      {barData.length > 0 && (
        <div className="admin__chart-section">
          <h3 className="admin__section-title">Participación por localidad</h3>
          <div className="admin__chart">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                <XAxis dataKey="localidad" tick={{ fontSize: 9, fill: '#6b7280' }} angle={-45} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                <Tooltip />
                <Bar dataKey="total" fill="#C8102E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {pieData.length > 0 && (
        <div className="admin__chart-section">
          <h3 className="admin__section-title">Encuestas por categoría</h3>
          <div className="admin__chart">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="admin__chart-section">
        <h3 className="admin__section-title">Mapa de calor</h3>
        <div ref={mapRef} className="admin__map" />
      </div>
    </div>
  )
}
