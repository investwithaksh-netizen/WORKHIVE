import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Team from './pages/Team'
import AuditLogs from './pages/AuditLogs'
import CalendarPage from './pages/Calendar'
import Templates from './pages/Templates'
import NotFound from './pages/NotFound'

function AppRoutes() {
  const { isAuthenticated, fetchMe, user } = useAuthStore()
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      fetchMe().finally(() => setBooting(false))
    } else {
      setBooting(false)
    }
  }, [])

  if (booting) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{
          width: 48, height: 48,
          background: 'linear-gradient(135deg, var(--brand-600), var(--brand-400))',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', fontWeight: 800, color: 'white',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>W</div>
        <p style={{ color: 'var(--gray-400)', fontSize: 'var(--text-sm)' }}>Loading WorkHive…</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/signup"
        element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/dashboard"
        element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/projects"
        element={isAuthenticated ? <Projects /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/projects/:projectId"
        element={isAuthenticated ? <ProjectDetail /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/team"
        element={isAuthenticated ? <Team /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/calendar"
        element={isAuthenticated ? <CalendarPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/audit"
        element={isAuthenticated && user?.role === 'L1' ? <AuditLogs /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/templates"
        element={isAuthenticated && user?.role === 'L1' ? <Templates /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
