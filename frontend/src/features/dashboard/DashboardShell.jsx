import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuthSession } from '../auth/useAuthSession.js'

const NAVIGATION_BY_ROLE = {
  administrator: [{ to: '/dashboard', label: 'Resumen', end: true }, { to: '/dashboard/administracion', label: 'Administración' }, { to: '/dashboard/operaciones', label: 'Operaciones' }],
  manager: [{ to: '/dashboard', label: 'Resumen', end: true }, { to: '/dashboard/operaciones', label: 'Operaciones' }],
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
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-amber-300 focus:px-4 focus:py-2" href="#dashboard-content">
        Ir al contenido principal
      </a>
      <header className="border-b border-stone-200 bg-stone-950 text-stone-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-amber-300 uppercase">El Cruce</p>
            <p className="display-font text-xl">Panel de gestión</p>
          </div>
           <div className="flex items-center gap-3">
             <p className="text-right text-sm leading-5"><span className="block font-medium">{user.username}</span><span className="text-stone-300">{ROLE_LABELS[user.role] ?? user.role}</span></p>
             <button className="min-h-11 rounded-md border border-stone-500 px-3 text-sm font-semibold hover:border-amber-300 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300" onClick={handleLogout} type="button">Cerrar sesión</button>
           </div>
           {logoutError ? <p className="w-full text-right text-sm text-red-200" role="alert">{logoutError}</p> : null}
         </div>
      </header>
      <div className="mx-auto grid max-w-7xl md:grid-cols-[14rem_1fr]">
        <nav aria-label="Navegación del panel" className="border-b border-stone-200 bg-white p-4 md:min-h-[calc(100vh-5.5rem)] md:border-b-0 md:border-r">
          <ul className="flex gap-2 overflow-x-auto md:flex-col">
            {navigation.map((item) => (
              <li key={item.to}>
                <NavLink className={({ isActive }) => `block min-h-11 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-600 ${isActive ? 'bg-stone-900 text-white' : 'hover:bg-stone-100'}`} end={item.end} to={item.to}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="p-4 sm:p-6" id="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function DashboardHome() {
  const { user } = useAuthSession()
  return <section><h1 className="display-font text-3xl">Bienvenido, {user.username}</h1><p className="mt-3 max-w-xl text-stone-700">Seleccioná una sección para consultar y gestionar la operación de El Cruce.</p></section>
}

export function DashboardPlaceholder({ title }) {
  return <section><h1 className="display-font text-3xl">{title}</h1><p className="mt-3 text-stone-700">Este módulo estará disponible próximamente.</p></section>
}
