import { render, screen } from '@testing-library/react'
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
})
