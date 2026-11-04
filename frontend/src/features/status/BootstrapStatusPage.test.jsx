import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BootstrapStatusPage } from './BootstrapStatusPage.jsx'

describe('BootstrapStatusPage', () => {
  it('presents the application status with a semantic page heading', () => {
    render(<BootstrapStatusPage />)

    expect(screen.getByRole('main')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Frontend en preparación', level: 1 }),
    ).toBeTruthy()
    expect(screen.getByText('El Cruce')).toBeTruthy()
    expect(screen.getByText('La base de la aplicación está lista para su desarrollo.')).toBeTruthy()
  })
})
