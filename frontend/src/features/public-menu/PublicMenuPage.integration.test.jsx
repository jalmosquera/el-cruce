import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicApiClient } from '../../lib/publicApiClient.js'
import { PublicMenuPage } from './PublicMenuPage.jsx'

const originalAdapter = publicApiClient.defaults.adapter

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/carta']}>
      <Routes>
        <Route path="/carta" element={<PublicMenuPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  publicApiClient.defaults.adapter = originalAdapter
})

describe('PublicMenuPage API integration', () => {
  it('renders the payload-error alert when the public API response is malformed', async () => {
    publicApiClient.defaults.adapter = vi.fn((config) => Promise.resolve({
      config,
      data: { language: 'es', categories: 'invalid' },
      headers: {},
      status: 200,
      statusText: 'OK',
    }))

    renderPage()

    const alert = await screen.findByRole('alert')

    expect(within(alert).getByText('No pudimos cargar la carta.')).toBeTruthy()
    expect(within(alert).getByText(/respondió con un error o con datos inesperados/)).toBeTruthy()
  })
})
