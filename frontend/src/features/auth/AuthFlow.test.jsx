import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from '../../app/App.jsx'

function createAuthService(overrides = {}) {
  return {
    refresh: vi.fn().mockRejectedValue(new Error('No refresh session')),
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function renderApp(initialEntry, authService) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App authService={authService} />
    </MemoryRouter>,
  )
}

describe('authentication flow', () => {
  it('redirects anonymous dashboard visitors to the login form after restoration completes', async () => {
    renderApp('/dashboard', createAuthService())

    expect(screen.getByRole('status').textContent).toContain('Restaurando tu sesión…')
    expect(await screen.findByRole('heading', { name: 'Acceso al equipo' })).toBeTruthy()
  })

  it('validates required credentials without submitting', async () => {
    const authService = createAuthService()
    renderApp('/login', authService)

    await screen.findByRole('heading', { name: 'Acceso al equipo' })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(screen.getByRole('alert').textContent).toContain('Ingresá tu usuario y contraseña para continuar.')
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('signs in with the approved payload then loads the authenticated dashboard', async () => {
    const authService = createAuthService({
      login: vi.fn().mockResolvedValue({ access: 'access-token' }),
      getCurrentUser: vi.fn().mockResolvedValue({ id: 7, username: 'ana', role: 'manager' }),
    })
    renderApp('/login', authService)

    await screen.findByRole('heading', { name: 'Acceso al equipo' })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: ' ana ' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('heading', { name: 'Bienvenido, ana' })).toBeTruthy()
    expect(authService.login).toHaveBeenCalledWith({ username: 'ana', password: 'secreta' })
    expect(screen.getByRole('link', { name: 'Operaciones' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull()
  })

  it('shows a safe invalid-credentials message after a rejected login', async () => {
    const authService = createAuthService({
      login: vi.fn().mockRejectedValue({ response: { status: 401 } }),
    })
    renderApp('/login', authService)

    await screen.findByRole('heading', { name: 'Acceso al equipo' })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect((await screen.findByRole('alert')).textContent).toContain('El usuario o la contraseña no son válidos.')
  })

  it('shows a generic recovery message when login cannot reach the server', async () => {
    const authService = createAuthService({
      login: vi.fn().mockRejectedValue(new Error('Network failure')),
    })
    renderApp('/login', authService)

    await screen.findByRole('heading', { name: 'Acceso al equipo' })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos iniciar sesión. Intentá nuevamente.')
  })

  it('restores a refresh-cookie session before rendering protected content', async () => {
    const authService = createAuthService({
      refresh: vi.fn().mockResolvedValue({ access: 'renewed-access-token' }),
      getCurrentUser: vi.fn().mockResolvedValue({ id: 3, username: 'luis', role: 'employee' }),
    })
    renderApp('/dashboard', authService)

    expect(await screen.findByRole('heading', { name: 'Bienvenido, luis' })).toBeTruthy()
    expect(authService.refresh).toHaveBeenCalledTimes(1)
    expect(authService.getCurrentUser).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Mi jornada' })).toBeTruthy()
  })

  it('allows a manager to open a direct dashboard route while keeping unavailable navigation hidden', async () => {
    const authService = createAuthService({
      refresh: vi.fn().mockResolvedValue({ access: 'renewed-access-token' }),
      getCurrentUser: vi.fn().mockResolvedValue({ id: 3, username: 'luis', role: 'manager' }),
    })
    renderApp('/dashboard/administracion', authService)

    expect(await screen.findByRole('heading', { name: 'Administración' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull()
  })

  it('retains the active session and announces an error when logout fails', async () => {
    const authService = createAuthService({
      refresh: vi.fn().mockResolvedValue({ access: 'renewed-access-token' }),
      getCurrentUser: vi.fn().mockResolvedValue({ id: 3, username: 'luis', role: 'employee' }),
      logout: vi.fn().mockRejectedValue(new Error('Network failure')),
    })
    renderApp('/dashboard', authService)

    await screen.findByRole('heading', { name: 'Bienvenido, luis' })
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos cerrar sesión. Intentá nuevamente.')
    expect(screen.getByRole('heading', { name: 'Bienvenido, luis' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Acceso al equipo' })).toBeNull()
    expect(authService.logout).toHaveBeenCalledTimes(1)
  })
})
