import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clearAccessToken, setAccessToken } from '../../lib/apiClient.js'
import * as defaultAuthService from './authApi.js'
import { AuthSessionContext } from './useAuthSession.js'

function getMessage(error, fallback) {
  if (error?.response?.status === 401) {
    return 'El usuario o la contraseña no son válidos.'
  }

  return fallback
}

export function AuthProvider({ children, authService = defaultAuthService }) {
  const [user, setUser] = useState(null)
  const [isRestoring, setIsRestoring] = useState(true)
  const restorePromiseRef = useRef(null)

  const clearSession = useCallback(() => {
    clearAccessToken()
    setUser(null)
  }, [])

  const establishSession = useCallback(
    async (access) => {
      setAccessToken(access)

      try {
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
        return currentUser
      } catch (error) {
        clearSession()
        throw error
      }
    },
    [authService, clearSession],
  )

  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
      try {
        if (!restorePromiseRef.current) {
          restorePromiseRef.current = authService.refresh().then(async ({ access }) => {
            setAccessToken(access)
            return authService.getCurrentUser()
          })
        }

        const currentUser = await restorePromiseRef.current
        if (isMounted) {
          setUser(currentUser)
        }
      } catch {
        if (isMounted) {
          clearSession()
        }
      } finally {
        if (isMounted) {
          setIsRestoring(false)
        }
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [authService, clearSession])

  const signIn = useCallback(
    async (credentials) => {
      try {
        const { access } = await authService.login(credentials)
        return await establishSession(access)
      } catch (error) {
        clearSession()
        throw new Error(getMessage(error, 'No pudimos iniciar sesión. Intentá nuevamente.'), { cause: error })
      }
    },
    [authService, clearSession, establishSession],
  )

  const signOut = useCallback(async () => {
    await authService.logout()
    clearSession()
  }, [authService, clearSession])

  const value = useMemo(
    () => ({
      user,
      isRestoring,
      isAuthenticated: Boolean(user),
      signIn,
      signOut,
    }),
    [isRestoring, signIn, signOut, user],
  )

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}
