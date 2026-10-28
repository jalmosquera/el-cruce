import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

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
    render(
      <MemoryRouter initialEntries={['/']}>
        <App authService={authService} />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'Un lugar para encontrarse.', level: 1 }),
    ).toBeTruthy()
  })

  it('renders the public menu page at /carta', async () => {
    render(
      <MemoryRouter initialEntries={['/carta']}>
        <App authService={authService} />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: 'La carta de El Cruce.', level: 1 }),
    ).toBeTruthy()
    expect(await screen.findByText('La carta todavía no tiene platos publicados.')).toBeTruthy()
  })
})
