import { createContext, useContext } from 'react'

export const AuthSessionContext = createContext(null)

export function useAuthSession() {
  const context = useContext(AuthSessionContext)

  if (!context) {
    throw new Error('useAuthSession debe usarse dentro de AuthProvider.')
  }

  return context
}
