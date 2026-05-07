import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import BottomNav from './components/common/BottomNav'

import SplashScreen from './components/screens/SplashScreen'
import LoginScreen from './components/screens/LoginScreen'
import RegisterScreen from './components/screens/RegisterScreen'
import SurveySelector from './components/screens/SurveySelector'
import SurveyScreen from './components/screens/SurveyScreen'
import MapScreen from './components/screens/MapScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import AdminDashboard from './components/admin/AdminDashboard'
import AdminSurveys from './components/admin/AdminSurveys'
import SurveyForm from './components/admin/SurveyForm'

const NO_NAV_PATHS = ['/', '/login', '/registro', '/olvide-pin']

function RequireAuth({ children }) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  if (!user || !token) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const user = useAuthStore((s) => s.user)
  if (!user || user.rol !== 'admin') return <Navigate to="/encuestas" replace />
  return children
}

export default function App() {
  const location = useLocation()
  const showNav = !NO_NAV_PATHS.includes(location.pathname) &&
    !location.pathname.startsWith('/encuestas/') &&
    !location.pathname.startsWith('/admin')

  return (
    <div className="app-shell">
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<SplashScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/registro" element={<RegisterScreen />} />
        <Route path="/olvide-pin" element={<div style={{padding:'2rem',textAlign:'center'}}>Función próximamente disponible</div>} />

        {/* Ciudadano */}
        <Route path="/encuestas" element={<RequireAuth><SurveySelector /></RequireAuth>} />
        <Route path="/encuestas/:id" element={<RequireAuth><SurveyScreen /></RequireAuth>} />
        <Route path="/mapa" element={<RequireAuth><MapScreen /></RequireAuth>} />
        <Route path="/perfil" element={<RequireAuth><SettingsScreen /></RequireAuth>} />

        {/* Admin */}
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/encuestas" element={<RequireAdmin><AdminSurveys /></RequireAdmin>} />
        <Route path="/admin/encuestas/nueva" element={<RequireAdmin><SurveyForm /></RequireAdmin>} />
        <Route path="/admin/encuestas/:id/editar" element={<RequireAdmin><SurveyForm /></RequireAdmin>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showNav && <BottomNav />}
    </div>
  )
}
