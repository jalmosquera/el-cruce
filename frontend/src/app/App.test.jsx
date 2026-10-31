import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { apiClient } from '../lib/apiClient.js'
import { fetchPublicMenu } from '../features/public-menu/menuApi.js'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function createAuthService(role) {
  return {
    refresh: vi.fn().mockResolvedValue({ access: 'access-token' }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1, username: 'ana', role }),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  }
}

function mockRoomsResponse(rooms = []) {
  const adapter = vi.fn((config) => Promise.resolve({
    config,
    data: rooms,
    headers: {},
    status: 200,
    statusText: 'OK',
  }))

  apiClient.defaults.adapter = adapter
  return adapter
}

function renderApp(initialEntry, authService) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App authService={authService} />
    </MemoryRouter>,
  )
}

vi.mock('../features/public-menu/menuApi.js', async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    fetchPublicMenu: vi.fn(() => Promise.resolve({ language: 'es', categories: [] })),
  }
})

const authService = { refresh: () => Promise.reject(new Error('No session')) }

describe('App', () => {
  it('renders the public landing page at the public root route', () => {
    renderApp('/', { refresh: () => Promise.reject(new Error('No session')) })

    expect(
      screen.getByRole('heading', { name: 'Un lugar para encontrarse.', level: 1 }),
    ).toBeTruthy()
  })

  it('renders the public menu page at /carta', async () => {
    renderApp('/carta', authService)

    expect(
      await screen.findByRole('heading', { name: 'La carta de El Cruce.', level: 1 }),
    ).toBeTruthy()
    expect(await screen.findByText('La carta todavía no tiene platos publicados.')).toBeTruthy()
  })

  it('selects a localized menu path and safely redirects an invalid path to Spanish', async () => {
    renderApp('/carta/en', authService)

    await screen.findByRole('heading', { name: 'La carta de El Cruce.', level: 1 })
    expect(fetchPublicMenu).toHaveBeenLastCalledWith('en', expect.any(Object))

    renderApp('/carta/pt', authService)

    await screen.findAllByRole('heading', { name: 'La carta de El Cruce.', level: 1 })
    expect(fetchPublicMenu).toHaveBeenLastCalledWith('es', expect.any(Object))
  })

  it('renders the rooms dashboard and navigation entry for an administrator', async () => {
    const adapter = mockRoomsResponse()

    renderApp('/dashboard/habitaciones', createAuthService('administrator'))

    expect(await screen.findByRole('heading', { name: 'Habitaciones' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Habitaciones' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Administración' })).toBeTruthy()
    expect(adapter.mock.calls[0][0].url).toBe('/rooms/')
  })

  it('shows the rooms navigation entry for a manager', async () => {
    mockRoomsResponse()

    renderApp('/dashboard/habitaciones', createAuthService('manager'))

    expect(await screen.findByRole('heading', { name: 'Habitaciones' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Habitaciones' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Operaciones' })).toBeTruthy()
  })

  it('shows the menu administration navigation and route to managers without a frontend role block', async () => {
    mockRoomsResponse([])

    renderApp('/dashboard/carta', createAuthService('manager'))

    expect(await screen.findByRole('heading', { name: 'Carta' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Carta' }).getAttribute('aria-current')).toBe('page')
  })

  it('isolates the dashboard and restores focus for the menu administration modal', async () => {
    mockRoomsResponse([])
    renderApp('/dashboard/carta', createAuthService('manager'))

    await screen.findByRole('heading', { name: 'Carta' })
    const dashboardShell = document.querySelector('[data-dashboard-shell]')
    const trigger = await screen.findByRole('button', { name: 'Nueva categoría' })
    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'Nueva categoría' })
    const closeButton = screen.getByRole('button', { name: 'Cerrar' })
    expect(dashboardShell.hasAttribute('inert')).toBe(true)
    expect(dialog.closest('[data-dashboard-shell]')).toBeNull()
    expect(document.activeElement).toBe(closeButton)

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(dashboardShell.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('does not expose the menu administration navigation to employees', async () => {
    mockRoomsResponse([])

    renderApp('/dashboard', createAuthService('employee'))

    await screen.findByRole('heading', { name: 'Bienvenido, ana' })
    expect(screen.queryByRole('link', { name: 'Carta' })).toBeNull()
  })

  it('renders QR management and navigation for managers without a frontend route role block', async () => {
    const adapter = mockRoomsResponse([])
    renderApp('/dashboard/codigos-qr', createAuthService('manager'))
    expect(await screen.findByRole('heading', { name: 'Códigos QR' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Códigos QR' }).getAttribute('aria-current')).toBe('page')
    await waitFor(() => expect(adapter.mock.calls[0][0].url).toBe('/qr-codes/'))
  })

  it('portals QR previews outside the inert dashboard shell and restores shell controls after Escape', async () => {
    mockRoomsResponse([{ id: 4, identifier: 'stable-identifier', name: 'Carta terraza', target_path: '/carta', is_active: true }])
    renderApp('/dashboard/codigos-qr', createAuthService('manager'))

    await screen.findByRole('heading', { name: 'Códigos QR' })
    const dashboardShell = document.querySelector('[data-dashboard-shell]')
    const logoutButton = screen.getByRole('button', { name: 'Cerrar sesión' })
    const previewTrigger = await screen.findByRole('button', { name: 'Vista previa de Carta terraza' })

    fireEvent.click(previewTrigger)

    const dialog = await screen.findByRole('dialog', { name: 'Vista previa: Carta terraza' })
    expect(dashboardShell.hasAttribute('inert')).toBe(true)
    expect(logoutButton.closest('[inert]')).toBe(dashboardShell)
    expect(dialog.closest('[data-dashboard-shell]')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }))

    fireEvent.keyDown(document.activeElement, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Descargar SVG' }))
    fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }))

    fireEvent.keyDown(dialog, { key: 'Escape' })

    await waitFor(() => expect(dashboardShell.hasAttribute('inert')).toBe(false))
    expect(logoutButton.closest('[inert]')).toBeNull()
    expect(document.activeElement).toBe(previewTrigger)
  })

  it('shows QR management navigation to administrators', async () => {
    mockRoomsResponse([])
    renderApp('/dashboard', createAuthService('administrator'))
    expect(await screen.findByRole('heading', { name: 'Bienvenido, ana' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Códigos QR' })).toBeTruthy()
  })

  it('marks the authenticated dashboard as non-indexable at runtime', async () => {
    renderApp('/dashboard', createAuthService('administrator'))

    await screen.findByRole('heading', { name: 'Bienvenido, ana' })

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
  })

  it('keeps the rooms route reachable for an employee while hiding its navigation entry', async () => {
    mockRoomsResponse()

    renderApp('/dashboard/habitaciones', createAuthService('employee'))

    expect(await screen.findByRole('heading', { name: 'Habitaciones' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Habitaciones' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Mi jornada' })).toBeTruthy()
  })

  it('renders the guests dashboard and exposes its navigation entry to a manager', async () => {
    const adapter = mockRoomsResponse()

    renderApp('/dashboard/huespedes', createAuthService('manager'))

    expect(await screen.findByRole('heading', { name: 'Huéspedes' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Huéspedes' }).getAttribute('aria-current')).toBe('page')
    expect(adapter.mock.calls[0][0].url).toBe('/guests/')
  })

  it('renders reservations and navigation for managers without a frontend route role block', async () => {
    const adapter = mockRoomsResponse([])
    renderApp('/dashboard/reservas', createAuthService('manager'))
    expect(await screen.findByRole('heading', { name: 'Reservas' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Reservas' }).getAttribute('aria-current')).toBe('page')
    await waitFor(() => {
      expect(adapter.mock.calls.map(([config]) => config.url)).toEqual(
        expect.arrayContaining(['/reservations/', '/rooms/', '/guests/']),
      )
    })
  })

  it('inerts all dashboard controls while the reservation dialog is open and restores them after close', async () => {
    mockRoomsResponse([])
    renderApp('/dashboard/reservas', createAuthService('manager'))

    await screen.findByRole('heading', { name: 'Reservas' })

    const dashboardShell = document.querySelector('[data-dashboard-shell]')
    const skipLink = dashboardShell.querySelector('a[href="#dashboard-content"]')
    const logoutButton = screen.getByRole('button', { name: 'Cerrar sesión' })
    const newReservationButton = screen.getByRole('button', { name: 'Nueva reserva' })

    await waitFor(() => expect(newReservationButton.disabled).toBe(false))
    fireEvent.click(newReservationButton)

    const dialog = await waitFor(() => {
      const currentDialog = document.querySelector('[role="dialog"]')
      expect(currentDialog).not.toBeNull()
      return currentDialog
    })
    expect(dashboardShell.hasAttribute('inert')).toBe(true)
    expect(skipLink.closest('[inert]')).toBe(dashboardShell)
    expect(logoutButton.closest('[inert]')).toBe(dashboardShell)
    expect(dialog.closest('[data-dashboard-shell]')).toBeNull()

    fireEvent.click(dialog.querySelector('button'))

    await waitFor(() => expect(dashboardShell.hasAttribute('inert')).toBe(false))
    expect(skipLink.closest('[inert]')).toBeNull()
    expect(logoutButton.closest('[inert]')).toBeNull()
  })
})
