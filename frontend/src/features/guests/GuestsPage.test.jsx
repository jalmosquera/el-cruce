import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GuestsPage } from './GuestsPage.jsx'
import { filterGuests, maskDocumentNumber } from './guestsUtils.js'

const GUEST = { id: 1, display_name: 'Ana López', email: 'ana@example.com', phone: '+34600123456', document_type: 'dni', document_number: '12345678Z', internal_notes: 'Late arrival.' }
const SECOND_GUEST = { id: 2, display_name: 'Bruno Díaz', email: null, phone: '600111222', document_type: null, document_number: null, internal_notes: '' }

function createService(overrides = {}) {
  return { listGuests: vi.fn().mockResolvedValue([]), createGuest: vi.fn(), updateGuest: vi.fn(), removeGuest: vi.fn(), ...overrides }
}

function renderPage(service) { return render(<GuestsPage guestsService={service} />) }

async function openCreateForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo huésped' }))
  await screen.findByRole('heading', { name: 'Nuevo huésped' })
}

function fillForm(values) {
  Object.entries(values).forEach(([label, value]) => fireEvent.change(screen.getByLabelText(label), { target: { value } }))
}

describe('GuestsPage', () => {
  it('uses an accessible table and minimizes sensitive data in the list', async () => {
    renderPage(createService({ listGuests: vi.fn().mockResolvedValue([GUEST, SECOND_GUEST]) }))
    const table = await screen.findByRole('table', { name: 'Huéspedes registrados' })
    expect(within(table).getByText('Ana López')).toBeTruthy()
    expect(within(table).getByText('ana@example.com')).toBeTruthy()
    expect(table.textContent).not.toContain('12345678Z')
    const region = screen.getByRole('region', { name: 'Huéspedes registrados' })
    expect(region.getAttribute('tabindex')).toBe('0')
  })

  it('filters fetched records client-side without searching document numbers', () => {
    expect(filterGuests([GUEST, SECOND_GUEST], 'ana@example.com', 'all')).toEqual([GUEST])
    expect(filterGuests([GUEST, SECOND_GUEST], '12345678Z', 'all')).toEqual([])
    expect(filterGuests([GUEST, SECOND_GUEST], '', 'without-document')).toEqual([SECOND_GUEST])
  })

  it('filters the rendered list through accessible search and document controls', async () => {
    renderPage(createService({ listGuests: vi.fn().mockResolvedValue([GUEST, SECOND_GUEST]) }))
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Buscar huéspedes'), { target: { value: 'bruno' } })
    expect(screen.getByText('Bruno Díaz')).toBeTruthy()
    expect(screen.queryByText('Ana López')).toBeNull()
    fireEvent.change(screen.getByLabelText('Documento'), { target: { value: 'with-document' } })
    expect(screen.getByText('No encontramos huéspedes con esos filtros.')).toBeTruthy()
  })

  it('shows a masked document only in the accessible details dialog', async () => {
    renderPage(createService({ listGuests: vi.fn().mockResolvedValue([GUEST]) }))
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles de Ana López' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.textContent).toContain('DNI: •••• 678Z')
    expect(dialog.textContent).not.toContain('12345678Z')
    expect(maskDocumentNumber('1234')).toBe('•••• 1234')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ver detalles de Ana López' }))
  })

  it('creates a guest using allowed API fields and announces the result', async () => {
    const created = { ...GUEST, id: 3, display_name: 'Carla Ruiz', document_number: null, document_type: null }
    const service = createService({ createGuest: vi.fn().mockResolvedValue(created) })
    renderPage(service)
    await openCreateForm()
    fillForm({ Nombre: ' Carla Ruiz ', 'Correo electrónico': 'carla@example.com', Teléfono: '+34 600 123 456', 'Tipo de documento': '', 'Número de documento': '', 'Notas internas': 'Preferencia de habitación tranquila' })
    fireEvent.click(screen.getByRole('button', { name: 'Crear huésped' }))
    expect(await screen.findByText('Huésped Carla Ruiz creado.')).toBeTruthy()
    expect(service.createGuest).toHaveBeenCalledWith({ display_name: ' Carla Ruiz ', email: 'carla@example.com', phone: '+34 600 123 456', document_type: '', document_number: '', internal_notes: 'Preferencia de habitación tranquila' })
    expect(screen.queryByRole('heading', { name: 'Nuevo huésped' })).toBeNull()
  })

  it('edits only supported guest fields and keeps a failed form intact', async () => {
    const service = createService({
      listGuests: vi.fn().mockResolvedValue([GUEST]),
      updateGuest: vi.fn().mockRejectedValue({ response: { status: 400, data: { phone: ['Phone must contain between 6 and 15 digits.'] } } }),
    })
    renderPage(service)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Editar huésped Ana López' }))
    fillForm({ Teléfono: '123' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert', { name: 'Revisá los datos del formulario.' })).toBeTruthy()
    expect(screen.getByLabelText('Teléfono').value).toBe('123')
    expect(screen.getByLabelText('Teléfono').getAttribute('aria-invalid')).toBe('true')
    expect(service.updateGuest).toHaveBeenCalledWith(1, expect.objectContaining({ display_name: 'Ana López', phone: '123', document_number: '12345678Z' }))
  })

  it('updates a guest and reflects the normalized server response', async () => {
    const updated = { ...GUEST, display_name: 'Ana María López', phone: '+34600999888' }
    const service = createService({ listGuests: vi.fn().mockResolvedValue([GUEST]), updateGuest: vi.fn().mockResolvedValue(updated) })
    renderPage(service)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Editar huésped Ana López' }))
    fillForm({ Nombre: ' Ana María López ', Teléfono: '+34 600 999 888' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Huésped Ana María López actualizado.')).toBeTruthy()
    expect(screen.getByText('Ana María López')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Editar huésped/ })).toBeNull()
  })

  it('validates document pairs before submitting and focuses the invalid required name', async () => {
    const service = createService()
    renderPage(service)
    await openCreateForm()
    fillForm({ 'Número de documento': '12345678Z' })
    fireEvent.click(screen.getByRole('button', { name: 'Crear huésped' }))
    const summary = screen.getByRole('alert', { name: 'Revisá los datos del formulario.' })
    expect(within(summary).getByText('Ingresá el nombre del huésped.')).toBeTruthy()
    expect(within(summary).getByText('Seleccioná el tipo de documento.')).toBeTruthy()
    expect(service.createGuest).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Nombre')))
  })

  it('deletes with an accessible confirmation and explains protected deletes', async () => {
    const service = createService({ listGuests: vi.fn().mockResolvedValue([GUEST]), removeGuest: vi.fn().mockRejectedValue({ response: { status: 409 } }) })
    renderPage(service)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar huésped Ana López' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar Ana López' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Este huésped está asociado a reservas y no se puede eliminar.')
    expect(screen.getByText('Ana López')).toBeTruthy()
  })

  it('deletes a guest after confirmation and restores focus to the page heading', async () => {
    const service = createService({ listGuests: vi.fn().mockResolvedValue([GUEST]), removeGuest: vi.fn().mockResolvedValue(undefined) })
    renderPage(service)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar huésped Ana López' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar Ana López' }))
    expect(await screen.findByText('Huésped Ana López eliminado.')).toBeTruthy()
    expect(service.removeGuest).toHaveBeenCalledWith(1)
    expect(screen.getByText(/Todavía no hay huéspedes registrados/)).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Huéspedes' }))
  })

  it('handles empty, loading and network error states', async () => {
    let resolveList
    const service = createService({ listGuests: vi.fn(() => new Promise((resolve) => { resolveList = resolve })) })
    renderPage(service)
    expect(screen.getByRole('status').textContent).toContain('Cargando huéspedes…')
    resolveList([])
    expect(await screen.findByText(/Todavía no hay huéspedes registrados/)).toBeTruthy()

    renderPage(createService({ listGuests: vi.fn().mockRejectedValue(new Error('Network Error')) }))
    expect((await screen.findAllByRole('alert'))[0].textContent).toContain('No pudimos cargar los huéspedes.')
  })
})
