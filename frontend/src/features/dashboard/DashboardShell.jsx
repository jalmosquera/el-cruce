import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuthSession } from '../auth/useAuthSession.js'

const NAVIGATION_BY_ROLE = {
  administrator: [
    { to: '/dashboard', label: 'Resumen', end: true },
    { to: '/dashboard/administracion', label: 'Administración' },
    { to: '/dashboard/operaciones', label: 'Operaciones' },
    { to: '/dashboard/habitaciones', label: 'Habitaciones' },
    { to: '/dashboard/reservas', label: 'Reservas' },
    { to: '/dashboard/huespedes', label: 'Huéspedes' },
  ],
  manager: [
    { to: '/dashboard', label: 'Resumen', end: true },
    { to: '/dashboard/operaciones', label: 'Operaciones' },
    { to: '/dashboard/habitaciones', label: 'Habitaciones' },
    { to: '/dashboard/reservas', label: 'Reservas' },
    { to: '/dashboard/huespedes', label: 'Huéspedes' },
  ],
  employee: [{ to: '/dashboard', label: 'Resumen', end: true }, { to: '/dashboard/mi-jornada', label: 'Mi jornada' }],
}

const ROLE_LABELS = {
  administrator: 'Administrador',
  manager: 'Gerente',
  employee: 'Empleado',
}

export function DashboardShell() {
  const { signOut, user } = useAuthSession()
  const navigate = useNavigate()
  const navigation = NAVIGATION_BY_ROLE[user.role] ?? []
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    let robots = document.querySelector('meta[name="robots"]')
    const createdRobots = !robots

    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.append(robots)
    }

    const previousContent = robots.content
    robots.content = 'noindex, nofollow'

    return () => {
      if (createdRobots) {
        robots.remove()
      } else {
        robots.content = previousContent
      }
    }
  }, [])

  async function handleLogout() {
    setLogoutError('')

    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      setLogoutError('No pudimos cerrar sesión. Intentá nuevamente.')
    }
  }

  return (
    <div className="min-h-screen bg-cruce-ink text-cruce-ink" data-dashboard-shell="true">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:min-h-11 focus:rounded-md focus:bg-cruce-amber focus:px-4 focus:py-3 focus:font-semibold focus:text-cruce-ink focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-ink" href="#dashboard-content">
        Ir al contenido principal
      </a>
      <header className="border-b border-cruce-panel-muted bg-cruce-ink text-cruce-ivory">
        <div className="mx-auto flex max-w-[82rem] flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-cruce-amber uppercase">El Cruce</p>
            <p className="display-font mt-0.5 text-2xl leading-none">Panel de gestión</p>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <p className="min-w-0 text-sm leading-5 sm:text-right"><span className="block truncate font-semibold">{user.username}</span><span className="block text-cruce-ivory/70">{ROLE_LABELS[user.role] ?? user.role}</span></p>
            <button className="min-h-11 shrink-0 rounded-md border border-cruce-ivory/45 px-4 py-2 text-sm font-semibold text-cruce-ivory hover:border-cruce-amber hover:bg-cruce-panel hover:text-cruce-amber focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-ink" onClick={handleLogout} type="button">Cerrar sesión</button>
          </div>
          {logoutError ? <p className="w-full text-sm text-cruce-danger-soft md:text-right" role="alert">{logoutError}</p> : null}
        </div>
      </header>
      <div className="mx-auto grid max-w-[82rem] md:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Navegación del panel" className="border-b border-cruce-panel-muted bg-cruce-panel px-4 py-3 text-cruce-ivory md:min-h-[calc(100vh-6.5rem)] md:border-r md:border-b-0 md:px-5 md:py-6">
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
            {navigation.map((item) => (
              <li className="shrink-0 md:shrink" key={item.to}>
                <NavLink className={({ isActive }) => `block min-h-11 rounded-md border px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-panel ${isActive ? 'border-cruce-amber bg-cruce-amber text-cruce-ink shadow-sm' : 'border-transparent text-cruce-ivory/80 hover:border-cruce-ivory/20 hover:bg-cruce-panel-muted hover:text-cruce-ivory'}`} end={item.end} to={item.to}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 bg-cruce-ivory p-4 sm:p-6 lg:p-8" id="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function DashboardHome() {
  const { user } = useAuthSession()
  return <section className="max-w-4xl"><p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">El Cruce</p><h1 className="display-font mt-2 text-3xl sm:text-4xl">Bienvenido, {user.username}</h1><p className="mt-4 max-w-xl leading-7 text-cruce-muted">Seleccioná una sección para consultar y gestionar la operación de El Cruce.</p></section>
}

export function DashboardPlaceholder({ title }) {
  return <section className="max-w-4xl"><p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">Panel de gestión</p><h1 className="display-font mt-2 text-3xl sm:text-4xl">{title}</h1><p className="mt-4 leading-7 text-cruce-muted">Este módulo estará disponible próximamente.</p></section>
}
