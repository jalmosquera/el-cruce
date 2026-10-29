import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OperationsPage } from './OperationsPage.jsx'
import { toLocalDateTime, toOffsetDateTime } from './operationsUtils.js'

const USERS = [{ id: 4, username: 'ana', role: 'manager' }, { id: 7, username: 'luis', role: 'employee' }]
const EMPLOYEES = [{ id: 1, user: 4 }]
const SHIFTS = [{ id: 8, employee: 1, starts_at: '2026-10-28T09:00:00+01:00', ends_at: '2026-10-28T17:00:00+01:00' }]

function createService(overrides = {}) {
  return {
    getUserDirectory: vi.fn().mockResolvedValue(USERS),
    getEmployees: vi.fn().mockResolvedValue(EMPLOYEES),
    getShifts: vi.fn().mockResolvedValue(SHIFTS),
    createEmployee: vi.fn().mockResolvedValue({ id: 2, user: 7 }),
    updateEmployee: vi.fn().mockResolvedValue({ id: 1, user: 7 }),
    deleteEmployee: vi.fn().mockResolvedValue(),
    createShift: vi.fn().mockResolvedValue({ id: 9, employee: 1, starts_at: '2026-10-29T09:00:00+01:00', ends_at: '2026-10-29T17:00:00+01:00' }),
    updateShift: vi.fn().mockResolvedValue({ id: 8, employee: 1, starts_at: '2026-10-30T09:00:00+01:00', ends_at: '2026-10-30T17:00:00+01:00' }),
    deleteShift: vi.fn().mockResolvedValue(),
    ...overrides,
  }
}

async function renderLoaded(service = createService()) {
  render(<OperationsPage operationsService={service} />)
  await screen.findByRole('heading', { name: 'Operaciones' })
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  return service
}

afterEach(() => vi.restoreAllMocks())

describe('OperationsPage', () => {
  it('lists directory users with their role in the employee selector', async () => {
    await renderLoaded()
    expect(screen.getByRole('option', { name: 'ana — manager' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'luis — employee' })).toBeTruthy()
  })

  it('creates and deletes an employee after confirmation', async () => {
    const service = await renderLoaded()
    fireEvent.change(screen.getByLabelText('Usuario interno *'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar empleado' }))
    await waitFor(() => expect(service.createEmployee).toHaveBeenCalledWith({ user: 7 }))
    expect(screen.getAllByText('luis')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0])
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(service.deleteEmployee).toHaveBeenCalledWith(1))
  })

  it('prefills, saves, and updates an employee reassignment', async () => {
    const service = await renderLoaded()
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    expect(screen.getByLabelText('Usuario interno *').value).toBe('4')
    expect(screen.getByRole('button', { name: 'Guardar empleado' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Usuario interno *'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar empleado' }))
    await waitFor(() => expect(service.updateEmployee).toHaveBeenCalledWith(1, { user: 7 }))
    expect(screen.getByRole('button', { name: 'Agregar empleado' })).toBeTruthy()
  })

  it('preserves employee reassignment input and announces a backend user validation error', async () => {
    const service = createService({ updateEmployee: vi.fn().mockRejectedValue({ response: { data: { user: ['Este usuario ya está asignado a otro empleado.'] } } }) })
    await renderLoaded(service)
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    fireEvent.change(screen.getByLabelText('Usuario interno *'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar empleado' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Este usuario ya está asignado a otro empleado.')
    expect(screen.getByLabelText('Usuario interno *').value).toBe('7')
    await waitFor(() => expect(document.activeElement).toBe(alert))
  })

  it('traps focus, closes with Escape, restores the invoker, and makes the background inert', async () => {
    await renderLoaded()
    const deleteButton = screen.getAllByRole('button', { name: 'Eliminar' })[0]
    fireEvent.click(deleteButton)
    const dialog = screen.getByRole('alertdialog')
    const cancelButton = within(dialog).getByRole('button', { name: 'Cancelar' })
    const confirmButton = within(dialog).getByRole('button', { name: 'Eliminar' })

    expect(document.activeElement).toBe(cancelButton)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-title')
    expect(dialog.getAttribute('aria-describedby')).toBe('confirm-description')
    expect(deleteButton.closest('[inert]')).toBeTruthy()

    confirmButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(cancelButton)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmButton)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(document.activeElement).toBe(deleteButton)
    expect(deleteButton.closest('[inert]')).toBeNull()
  })

  it('keeps focus in the confirmation modal while deletion is in flight', async () => {
    let resolveDelete
    const pendingDelete = new Promise((resolve) => { resolveDelete = resolve })
    const service = await renderLoaded(createService({ deleteEmployee: vi.fn().mockReturnValue(pendingDelete) }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0])
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Eliminando…' }).disabled).toBe(true)
    expect(dialog.getAttribute('aria-busy')).toBe('true')
    expect(dialog.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(document.activeElement).toBe(dialog)
    resolveDelete()
    await waitFor(() => expect(service.deleteEmployee).toHaveBeenCalledWith(1))
  })

  it('creates a shift with an explicit local timezone offset', async () => {
    const service = await renderLoaded()
    fireEvent.change(screen.getByLabelText('Empleado *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Inicio *'), { target: { value: '2026-10-29T09:00' } })
    fireEvent.change(screen.getByLabelText('Fin *'), { target: { value: '2026-10-29T17:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }))
    await waitFor(() => expect(service.createShift).toHaveBeenCalledWith(expect.objectContaining({ employee: 1 })))
    const payload = service.createShift.mock.calls[0][0]
    expect(payload.starts_at).toMatch(/^2026-10-29T09:00:00[+-]\d{2}:\d{2}$/)
    expect(payload.ends_at).toMatch(/^2026-10-29T17:00:00[+-]\d{2}:\d{2}$/)
  })

  it('edits and deletes shifts', async () => {
    const service = await renderLoaded()
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1])
    expect(screen.getByRole('button', { name: 'Guardar turno' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar turno' }))
    await waitFor(() => expect(service.updateShift).toHaveBeenCalledWith(8, expect.objectContaining({ employee: 1 })))
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[1])
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[2])
    await waitFor(() => expect(service.deleteShift).toHaveBeenCalledWith(8))
  })

  it('restores the shift delete trigger after cancellation and Escape', async () => {
    await renderLoaded()
    const deleteButton = within(screen.getByRole('table')).getByRole('button', { name: 'Eliminar' })

    fireEvent.click(deleteButton)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(document.activeElement).toBe(deleteButton))

    fireEvent.click(deleteButton)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(document.activeElement).toBe(deleteButton)
  })

  it('moves focus to the shifts heading after successfully deleting a shift', async () => {
    const service = await renderLoaded()
    const deleteButton = within(screen.getByRole('table')).getByRole('button', { name: 'Eliminar' })

    fireEvent.click(deleteButton)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(service.deleteShift).toHaveBeenCalledWith(8))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Cronología' }))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('preserves a shift form and announces backend overlap errors', async () => {
    const service = createService({ createShift: vi.fn().mockRejectedValue({ response: { data: { non_field_errors: ['Este turno se superpone con otro existente.'] } } }) })
    await renderLoaded(service)
    fireEvent.change(screen.getByLabelText('Empleado *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Inicio *'), { target: { value: '2026-10-29T09:00' } })
    fireEvent.change(screen.getByLabelText('Fin *'), { target: { value: '2026-10-29T17:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Este turno se superpone con otro existente.')
    expect(screen.getByLabelText('Inicio *').value).toBe('2026-10-29T09:00')
    await waitFor(() => expect(document.activeElement).toBe(alert))
  })

  it('focuses and summarizes client-side validation errors accessibly', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar empleado' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Seleccioná un usuario.')
    expect(document.activeElement).toBe(alert)
  })

  it('renders loading, empty, and network failure states', async () => {
    let resolveDirectory
    const pending = new Promise((resolve) => { resolveDirectory = resolve })
    const service = createService({ getUserDirectory: vi.fn().mockReturnValue(pending), getEmployees: vi.fn().mockResolvedValue([]), getShifts: vi.fn().mockResolvedValue([]) })
    render(<OperationsPage operationsService={service} />)
    expect(screen.getByRole('status').textContent).toContain('Cargando')
    resolveDirectory([])
    await screen.findByText('Todavía no hay empleados registrados.')
    expect(screen.getByText('Todavía no hay turnos programados.')).toBeTruthy()

    render(<OperationsPage operationsService={createService({ getEmployees: vi.fn().mockRejectedValue(new Error('network')) })} />)
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos completar la operación.')
  })

  it('uses safe messages when the API denies or expires access', async () => {
    render(<OperationsPage operationsService={createService({ getEmployees: vi.fn().mockRejectedValue({ response: { status: 401 } }) })} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Tu sesión venció.')

    render(<OperationsPage operationsService={createService({ getEmployees: vi.fn().mockRejectedValue({ response: { status: 403 } }) })} />)
    expect((await screen.findByText(/No tenés permisos/)).textContent).toContain('No tenés permisos para realizar esta operación.')
  })

  it('formats local datetime input values with an explicit offset', () => {
    expect(toOffsetDateTime('2026-10-28T09:30')).toMatch(/^2026-10-28T09:30:00[+-]\d{2}:\d{2}$/)
    expect(toOffsetDateTime('')).toBe('')
    expect(toLocalDateTime('')).toBe('')
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(60)
    expect(toOffsetDateTime('2026-10-28T09:30')).toContain('-01:00')
  })
})
