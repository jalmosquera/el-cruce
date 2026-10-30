import { Navigate, Route, Routes, useParams } from 'react-router'
import { AuthProvider } from '../features/auth/AuthSession.jsx'
import { LoginPage } from '../features/auth/LoginPage.jsx'
import { PrivateRoute } from '../features/auth/PrivateRoute.jsx'
import { DashboardHome, DashboardPlaceholder, DashboardShell } from '../features/dashboard/DashboardShell.jsx'
import { OperationsPage } from '../features/operations/OperationsPage.jsx'
import { PublicLanding } from '../features/public-landing/PublicLanding.jsx'
import { PublicMenuPage } from '../features/public-menu/PublicMenuPage.jsx'
import { GuestsPage } from '../features/guests/GuestsPage.jsx'
import { MENU_LANGUAGES } from '../features/public-menu/menuApi.js'
import { RoomsPage } from '../features/rooms/RoomsPage.jsx'
import { ReservationsPage } from '../features/reservations/ReservationsPage.jsx'
import { MenuAdminPage } from '../features/menu-admin/MenuAdminPage.jsx'

function PublicMenuLanguageRoute() {
  const { language } = useParams()
  const isSupportedLanguage = MENU_LANGUAGES.some((option) => option.code === language)

  if (!isSupportedLanguage) {
    return <Navigate replace to="/carta/es" />
  }

  return <PublicMenuPage pathLanguage={language} />
}

function App({ authService }) {
  return (
    <AuthProvider authService={authService}>
      <Routes>
        <Route path="/" element={<PublicLanding />} />
        <Route path="/carta" element={<PublicMenuPage />} />
        <Route path="/carta/:language" element={<PublicMenuLanguageRoute />} />
        <Route path="/carta/*" element={<Navigate replace to="/carta/es" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardShell />}>
            <Route index element={<DashboardHome />} />
            <Route path="administracion" element={<DashboardPlaceholder title="Administración" />} />
            <Route path="habitaciones" element={<RoomsPage />} />
            <Route path="reservas" element={<ReservationsPage />} />
            <Route path="huespedes" element={<GuestsPage />} />
            <Route path="operaciones" element={<OperationsPage />} />
            <Route path="carta" element={<MenuAdminPage />} />
            <Route path="mi-jornada" element={<DashboardPlaceholder title="Mi jornada" />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
