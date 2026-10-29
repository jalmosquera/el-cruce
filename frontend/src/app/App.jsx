import { Route, Routes } from 'react-router'
import { AuthProvider } from '../features/auth/AuthSession.jsx'
import { LoginPage } from '../features/auth/LoginPage.jsx'
import { PrivateRoute } from '../features/auth/PrivateRoute.jsx'
import { DashboardHome, DashboardPlaceholder, DashboardShell } from '../features/dashboard/DashboardShell.jsx'
import { PublicLanding } from '../features/public-landing/PublicLanding.jsx'
import { PublicMenuPage } from '../features/public-menu/PublicMenuPage.jsx'
import { RoomsPage } from '../features/rooms/RoomsPage.jsx'

function App({ authService }) {
  return (
    <AuthProvider authService={authService}>
      <Routes>
        <Route path="/" element={<PublicLanding />} />
        <Route path="/carta" element={<PublicMenuPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardShell />}>
            <Route index element={<DashboardHome />} />
            <Route path="administracion" element={<DashboardPlaceholder title="Administración" />} />
            <Route path="habitaciones" element={<RoomsPage />} />
            <Route path="operaciones" element={<DashboardPlaceholder title="Operaciones" />} />
            <Route path="mi-jornada" element={<DashboardPlaceholder title="Mi jornada" />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
