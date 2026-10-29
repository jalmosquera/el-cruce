import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { apiClient } from '../lib/apiClient.js'

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

describe('App', () => {
  it('renders the public landing page at the public root route', () => {
    renderApp('/', { refresh: () => Promise.reject(new Error('No session')) })

    expect(
      screen.getByRole('heading', { name: 'Un lugar para encontrarse.', level: 1 }),
    ).toBeTruthy()
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

  it('keeps the rooms route reachable for an employee while hiding its navigation entry', async () => {
    mockRoomsResponse()

    renderApp('/dashboard/habitaciones', createAuthService('employee'))

    expect(await screen.findByRole('heading', { name: 'Habitaciones' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Habitaciones' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Mi jornada' })).toBeTruthy()
  })
})
