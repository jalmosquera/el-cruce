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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl sm:p-8">
        <p className="text-sm font-semibold tracking-[0.18em] text-secondary uppercase">El Cruce</p>
        <h1 className="display-font mt-3 text-4xl text-foreground">Acceso al equipo</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Ingresá con tus credenciales de trabajo.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="username">
              Usuario
            </label>
            <input
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={Boolean(error)}
              autoComplete="username"
              className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-focus-on-dark focus:ring-2 focus:ring-focus-on-dark/40"
              id="username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="password">
              Contraseña
            </label>
            <input
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={Boolean(error)}
              autoComplete="current-password"
              className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-focus-on-dark focus:ring-2 focus:ring-focus-on-dark/40"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/50 bg-destructive-soft p-3 text-sm text-destructive" id="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-focus-on-dark focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
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
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <p aria-live="polite" role="status">Restaurando tu sesión…</p>
    </main>
  )
}
