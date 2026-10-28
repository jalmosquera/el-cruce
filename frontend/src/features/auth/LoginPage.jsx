import { useState } from 'react'
import { Navigate } from 'react-router'
import { useAuthSession } from './useAuthSession.js'

export function LoginPage() {
  const { isAuthenticated, isRestoring, signIn } = useAuthSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isRestoring) {
    return <SessionLoading />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Ingresá tu usuario y contraseña para continuar.')
      return
    }

    setIsSubmitting(true)

    try {
      await signIn({ username: username.trim(), password })
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-10 text-stone-100">
      <section className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-2xl sm:p-8">
        <p className="text-sm font-semibold tracking-[0.18em] text-amber-300 uppercase">El Cruce</p>
        <h1 className="display-font mt-3 text-4xl text-stone-50">Acceso al equipo</h1>
        <p className="mt-3 text-sm leading-6 text-stone-300">Ingresá con tus credenciales de trabajo.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="block text-sm font-medium text-stone-100" htmlFor="username">
              Usuario
            </label>
            <input
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={Boolean(error)}
              autoComplete="username"
              className="mt-2 min-h-11 w-full rounded-lg border border-stone-600 bg-stone-950 px-3 text-stone-100 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/40"
              id="username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-100" htmlFor="password">
              Contraseña
            </label>
            <input
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={Boolean(error)}
              autoComplete="current-password"
              className="mt-2 min-h-11 w-full rounded-lg border border-stone-600 bg-stone-950 px-3 text-stone-100 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/40"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-400/50 bg-red-950/40 p-3 text-sm text-red-100" id="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="min-h-11 w-full rounded-lg bg-amber-300 px-4 py-2 font-semibold text-stone-950 transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  )
}

export function SessionLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-950 px-4 text-stone-100">
      <p aria-live="polite" role="status">Restaurando tu sesión…</p>
    </main>
  )
}
