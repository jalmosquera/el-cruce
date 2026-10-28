import { Navigate, Outlet } from 'react-router'
import { SessionLoading } from './LoginPage.jsx'
import { useAuthSession } from './useAuthSession.js'

export function PrivateRoute() {
  const { isAuthenticated, isRestoring } = useAuthSession()

  if (isRestoring) {
    return <SessionLoading />
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
