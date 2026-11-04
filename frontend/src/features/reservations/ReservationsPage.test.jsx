import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReservationsPage } from './ReservationsPage.jsx'

const rooms = [{ id: 1, code: '101', name: 'Doble', capacity: 2, status: 'operational' }, { id: 2, code: '102', name: 'Suite', capacity: 3, status: 'operational' }]
const guests = [{ id: 8, display_name: 'Ana Pérez', document_number: 'SECRET' }]
const reservation = { id: 4, room: 1, guest: 8, check_in: '2026-11-10', check_out: '2026-11-12', guest_count: 2, status: 'pending', internal_notes: 'Late arrival' }

function renderPage(overrides = {}) {
  const reservationsService = { listReservations: vi.fn().mockResolvedValue([reservation]), getAvailability: vi.fn().mockResolvedValue({ rooms: [rooms[1]] }), createReservation: vi.fn(), updateReservation: vi.fn(), ...overrides }
  render(<ReservationsPage guestsService={{ listGuests: vi.fn().mockResolvedValue(guests) }} reservationsService={reservationsService} roomsService={{ listRooms: vi.fn().mockResolvedValue(rooms) }} />)
  return reservationsService
}

describe('ReservationsPage', () => {
  it('renders a semantic occupancy grid without exposing guest sensitive data', async () => {
    renderPage()
    expect(await screen.findByRole('table', { name: /Ocupación por habitación y fecha/ })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: /101/ })).toBeTruthy()
    expect(screen.queryByText('SECRET')).toBeNull()
  })

  it('consults availability before creating but sends the final request to Django', async () => {
    const service = renderPage({ createReservation: vi.fn().mockResolvedValue({ ...reservation, id: 5, room: 2 }) })
    await screen.findByRole('heading', { name: 'Reservas' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva reserva' }))
    fireEvent.change(screen.getByLabelText('Habitación'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Huésped'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '2026-11-10' } })
    fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '2026-11-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }))
    await waitFor(() => expect(service.getAvailability).toHaveBeenCalledWith({ checkIn: '2026-11-10', checkOut: '2026-11-12' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear reserva' }))
    await waitFor(() => expect(service.createReservation).toHaveBeenCalledWith(expect.objectContaining({ room: 2, guest: 8, check_in: '2026-11-10', check_out: '2026-11-12' })))
  })

  it('preserves form values and surfaces backend overlap errors', async () => {
    const service = renderPage({ createReservation: vi.fn().mockRejectedValue({ response: { status: 400, data: { non_field_errors: ['This room already has an overlapping reservation.'] } } }) })
    await screen.findByRole('heading', { name: 'Reservas' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva reserva' }))
    fireEvent.change(screen.getByLabelText('Habitación'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Huésped'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '2026-11-10' } })
    fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '2026-11-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear reserva' }))
    await waitFor(() => expect(service.createReservation).toHaveBeenCalled())
    expect(screen.getAllByRole('alert').some((alert) => alert.textContent.includes('overlapping reservation'))).toBe(true)
    expect(screen.getByLabelText('Entrada').value).toBe('2026-11-10')
  })

  it('renders only permitted status actions and cancels through PATCH', async () => {
    const service = renderPage({ updateReservation: vi.fn().mockResolvedValue({ ...reservation, status: 'cancelled' }) })
    await screen.findByRole('button', { name: 'Cancelar' })
    expect(screen.queryByRole('button', { name: 'Finalizada' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(service.updateReservation).toHaveBeenCalledWith(4, { status: 'cancelled' }))
    expect(screen.getByText('Cancelada')).toBeTruthy()
  })

  it('keeps the backend status field error visible when a transition is rejected', async () => {
    const service = renderPage({
      updateReservation: vi.fn().mockRejectedValue({
        response: { status: 400, data: { status: ['Invalid status transition.'] } },
      }),
    })
    await screen.findByRole('button', { name: 'Confirmada' })

    fireEvent.click(screen.getByRole('button', { name: 'Confirmada' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('No se pudo actualizar el estado de la reserva.')
    expect(alert.textContent).toContain('Invalid status transition.')
    expect(service.updateReservation).toHaveBeenCalledWith(4, { status: 'confirmed' })
  })

  it('preserves the exact backend 409 detail for a rejected transition', async () => {
    const detail = 'The reservation was changed by another user.'
    renderPage({
      updateReservation: vi.fn().mockRejectedValue({ response: { status: 409, data: { detail } } }),
    })
    await screen.findByRole('button', { name: 'Cancelar' })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect((await screen.findByRole('alert')).textContent).toContain(detail)
  })

  it('announces field errors with labelled accessible controls', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Reservas' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva reserva' }))
    expect(screen.getByRole('dialog', { name: 'Nueva reserva' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Crear reserva' }))
    expect(screen.getAllByRole('alert').some((alert) => alert.textContent.includes('Seleccioná una habitación'))).toBe(true)
    expect(screen.getByLabelText('Habitación').getAttribute('aria-invalid')).toBe('true')
  })

  it('allows adjacent stays on the check-out day and ignores terminal reservations in occupancy', async () => {
    renderPage({
      listReservations: vi.fn().mockResolvedValue([
        reservation,
        { ...reservation, id: 5, check_in: '2026-11-12', check_out: '2026-11-13' },
        { ...reservation, id: 6, room: 2, status: 'checked_out' },
      ]),
    })
    await screen.findByRole('heading', { name: 'Reservas' })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-10' } })
    fireEvent.change(screen.getByLabelText('Hasta (salida exclusiva)'), { target: { value: '2026-11-13' } })

    expect(await screen.findByRole('button', { name: 'Editar reserva de 101, 2026-11-10' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Editar reserva de 101, 2026-11-12' })).toBeTruthy()
    expect(screen.getByLabelText('102 libre el 2026-11-11')).toBeTruthy()
  })

  it('creates a modal dialog, traps focus, closes with Escape, and restores the trigger focus', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Reservas' })
    const trigger = screen.getByRole('button', { name: 'Nueva reserva' })
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Nueva reserva' })
    const closeButton = within(dialog).getByRole('button', { name: 'Cerrar' })
    const cancelButton = within(dialog).getByRole('button', { name: 'Cancelar' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(closeButton)

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(cancelButton)
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('retains the saving dialog context and prevents Escape from closing it', async () => {
    let resolveCreate
    const createReservation = vi.fn(() => new Promise((resolve) => { resolveCreate = resolve }))
    renderPage({ createReservation })
    await screen.findByRole('heading', { name: 'Reservas' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva reserva' }))
    fireEvent.change(screen.getByLabelText('Habitación'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Huésped'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '2026-11-10' } })
    fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '2026-11-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear reserva' }))

    await waitFor(() => expect(createReservation).toHaveBeenCalledTimes(1))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-busy')).toBe('true')
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()

    await act(async () => {
      resolveCreate({ ...reservation, id: 5 })
    })
    expect(await screen.findByText('Reserva creada.')).toBeTruthy()
  })
})
