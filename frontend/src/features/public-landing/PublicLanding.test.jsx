import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PublicLanding } from './PublicLanding.jsx'
import { Header } from './sections/Header.jsx'

describe('PublicLanding', () => {
  it('provides a semantic public-page structure with the approved sections', () => {
    render(<PublicLanding />)

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('main').getAttribute('id')).toBe('contenido')
    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Un lugar para encontrarse.', level: 1 })).toBeTruthy()

    expect(screen.getByRole('region', { name: 'Una mesa abierta a lo que está por contar.' }).getAttribute('id')).toBe('restaurante')
    expect(screen.getByRole('region', { name: 'El descanso empieza con una buena bienvenida.' }).getAttribute('id')).toBe('estancia')
    expect(screen.getByRole('region', { name: 'Una carta aún por descubrir.' }).getAttribute('id')).toBe('carta')
    expect(screen.getByRole('region', { name: 'Pronto, todos los caminos llegarán aquí.' }).getAttribute('id')).toBe('contacto')
  })

  it('discloses that operational details and visuals are placeholders', () => {
    render(<PublicLanding />)

    expect(screen.getByText('Una primera mirada a El Cruce. La información de esta página está pendiente de verificación.')).toBeTruthy()
    expect(screen.getAllByText('Visual abstracto · no es fotografía')).toHaveLength(2)
    expect(screen.getByText('Previsualización editorial. Los platos, alérgenos y precios no están publicados.')).toBeTruthy()
    expect(screen.getByText('No se muestran habitaciones, servicios ni tarifas mientras no haya datos verificados.')).toBeTruthy()
    expect(screen.getByText('Sin reservas en línea')).toBeTruthy()
  })

  it('links primary navigation and skip navigation to public sections', () => {
    render(<PublicLanding />)

    expect(screen.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href')).toBe('#contenido')

    const primaryNavigation = screen.getByRole('navigation', { name: 'Navegación principal' })

    expect(within(primaryNavigation).getByRole('link', { name: 'Restaurante' }).getAttribute('href')).toBe('#restaurante')
    expect(within(primaryNavigation).getByRole('link', { name: 'Estancia' }).getAttribute('href')).toBe('#estancia')
    expect(within(primaryNavigation).getByRole('link', { name: 'Carta' }).getAttribute('href')).toBe('#carta')
    expect(within(primaryNavigation).getByRole('link', { name: 'Ubicación' }).getAttribute('href')).toBe('#contacto')
  })
})

describe('Header mobile navigation', () => {
  it('opens with an accessible control and closes after a destination is selected', () => {
    render(<Header />)

    const menuButton = screen.getByRole('button', { name: 'Abrir navegación' })

    expect(menuButton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('navigation', { name: 'Navegación móvil' })).toBeNull()

    fireEvent.click(menuButton)

    expect(screen.getByRole('button', { name: 'Cerrar navegación' }).getAttribute('aria-expanded')).toBe('true')
    const mobileNavigation = screen.getByRole('navigation', { name: 'Navegación móvil' })
    const menuLink = within(mobileNavigation).getByRole('link', { name: 'Carta' })

    expect(menuLink.getAttribute('href')).toBe('#carta')

    fireEvent.click(menuLink)

    expect(screen.getByRole('button', { name: 'Abrir navegación' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('navigation', { name: 'Navegación móvil' })).toBeNull()
  })
})
