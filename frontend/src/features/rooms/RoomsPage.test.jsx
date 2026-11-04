import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoomsPage } from './RoomsPage.jsx'

const ROOM = {
  id: 1,
  code: '101',
  name: 'Doble',
  capacity: 2,
  status: 'operational',
}

const SECOND_ROOM = {
  id: 2,
  code: '102',
  name: 'Suite',
  capacity: 4,
  status: 'maintenance',
}

const LOAD_ERROR_MESSAGE = 'No pudimos cargar las habitaciones. Intentá nuevamente.'
const SAVE_ERROR_MESSAGE = 'No pudimos guardar la habitación. Revisá los datos e intentá nuevamente.'
const DELETE_ERROR_MESSAGE = 'No pudimos eliminar la habitación. Intentá nuevamente.'

function createService(overrides = {}) {
  return {
    listRooms: vi.fn().mockResolvedValue([]),
    createRoom: vi.fn(),
    updateRoom: vi.fn(),
    removeRoom: vi.fn(),
    ...overrides,
  }
}

function renderPage(service) {
  return render(<RoomsPage roomsService={service} />)
}

async function openCreateForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Nueva habitación' }))
  await screen.findByRole('heading', { name: 'Nueva habitación' })
}

function fillRoomForm({ code, name, capacity, status }) {
  if (code !== undefined) {
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: code } })
  }

  if (name !== undefined) {
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: name } })
  }

  if (capacity !== undefined) {
    fireEvent.change(screen.getByLabelText('Capacidad'), { target: { value: capacity } })
  }

  if (status !== undefined) {
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: status } })
  }
}

describe('RoomsPage', () => {
  it('renders the room list in a semantic table inside a keyboard-reachable scroll region', async () => {
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([
        ROOM,
        SECOND_ROOM,
        { id: 3, code: '103', name: 'Individual', capacity: 1, status: 'out_of_service' },
      ]),
    })
    renderPage(service)

    expect(await screen.findByRole('heading', { name: 'Habitaciones' })).toBeTruthy()

    const table = screen.getByRole('table', { name: 'Habitaciones registradas' })
    expect(within(table).getByText('101')).toBeTruthy()
    expect(within(table).getByText('Suite')).toBeTruthy()
    expect(within(table).getByText('Operativa')).toBeTruthy()
    expect(within(table).getByText('En mantenimiento')).toBeTruthy()
    expect(within(table).getByText('Fuera de servicio')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Editar habitación 101' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Eliminar habitación 101' })).toBeTruthy()

    const scrollRegion = screen.getByRole('region', { name: 'Habitaciones registradas' })
    expect(scrollRegion.getAttribute('tabindex')).toBe('0')
    scrollRegion.focus()
    expect(document.activeElement).toBe(scrollRegion)
  })

  it('announces a loading state while rooms are requested', async () => {
    let resolveList
    const service = createService({
      listRooms: vi.fn(() => new Promise((resolve) => {
        resolveList = resolve
      })),
    })
    renderPage(service)

    expect(screen.getByRole('status').textContent).toContain('Cargando habitaciones…')

    await act(async () => {
      resolveList([])
    })

    await waitFor(() => {
      expect(screen.queryByText('Cargando habitaciones…')).toBeNull()
    })
  })

  it('shows an empty state when no rooms exist', async () => {
    renderPage(createService())

    expect(await screen.findByText(/Todavía no hay habitaciones registradas/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows a load error instead of the empty state when the list payload is iterable but not an array', async () => {
    renderPage(createService({ listRooms: vi.fn().mockResolvedValue(new Set([ROOM])) }))

    expect((await screen.findByRole('alert')).textContent).toContain(LOAD_ERROR_MESSAGE)
    expect(screen.queryByText(/Todavía no hay habitaciones registradas/)).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('creates a room and announces the result', async () => {
    const created = { id: 9, code: '201', name: 'Doble superior', capacity: 2, status: 'maintenance' }
    const service = createService({
      createRoom: vi.fn().mockResolvedValue(created),
    })
    renderPage(service)

    await screen.findByText(/Todavía no hay habitaciones registradas/)
    await openCreateForm()
    fillRoomForm({ code: '201', name: 'Doble superior', capacity: '2', status: 'maintenance' })
    fireEvent.click(screen.getByRole('button', { name: 'Crear habitación' }))

    expect(await screen.findByText('Habitación 201 creada.')).toBeTruthy()
    expect(service.createRoom).toHaveBeenCalledWith({
      code: '201',
      name: 'Doble superior',
      capacity: 2,
      status: 'maintenance',
    })
    expect(screen.queryByRole('heading', { name: 'Nueva habitación' })).toBeNull()
    expect(within(screen.getByRole('table')).getByText('201')).toBeTruthy()
  })

  it('moves focus into the form and focuses the first editable field', async () => {
    const service = createService({ listRooms: vi.fn().mockResolvedValue([ROOM]) })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva habitación' }))

    expect(document.activeElement).toBe(screen.getByLabelText('Código'))

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('heading', { name: 'Nueva habitación' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Editar habitación 101' }))

    expect(document.activeElement).toBe(screen.getByLabelText('Nombre'))
  })

  it('maps DRF field errors to an error summary, focuses the first invalid field and keeps non-field messages visible', async () => {
    const service = createService({
      createRoom: vi.fn().mockRejectedValue({
        response: {
          status: 400,
          data: {
            capacity: ['Capacity must be greater than zero.'],
            name: 'This field may not be blank.',
            status: ['Invalid status.'],
            non_field_errors: ['Revisá los datos ingresados.'],
          },
        },
      }),
    })
    renderPage(service)

    await screen.findByText(/Todavía no hay habitaciones registradas/)
    await openCreateForm()
    fillRoomForm({ code: '201', name: 'Doble', capacity: '2' })
    fireEvent.click(screen.getByRole('button', { name: 'Crear habitación' }))

    const summary = await screen.findByRole('alert', { name: 'Revisá los datos del formulario.' })
    expect(within(summary).getByText('Capacity must be greater than zero.')).toBeTruthy()
    expect(within(summary).getByText('This field may not be blank.')).toBeTruthy()
    expect(screen.getAllByRole('alert').some(
      (alert) => alert.textContent.includes('Revisá los datos ingresados.'),
    )).toBe(true)
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre'))
    expect(screen.getByLabelText('Capacidad').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Nombre').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Nombre').getAttribute('aria-describedby')).toBe('room-name-error')
    expect(screen.getByLabelText('Capacidad').getAttribute('aria-describedby')).toBe('room-capacity-error')
    expect(screen.getByLabelText('Estado').getAttribute('aria-describedby')).toBe('room-status-error')
    expect(document.getElementById('room-name-error')?.textContent).toBe('This field may not be blank.')
    expect(document.getElementById('room-capacity-error')?.textContent).toBe('Capacity must be greater than zero.')
    expect(document.getElementById('room-status-error')?.textContent).toBe('Invalid status.')
    expect(screen.getByRole('heading', { name: 'Nueva habitación' })).toBeTruthy()
    expect(screen.queryByText('Habitación 201 creada.')).toBeNull()
  })

  it('validates required fields before submitting to the API, shows a summary and focuses the first invalid field', async () => {
    const service = createService()
    renderPage(service)

    await screen.findByText(/Todavía no hay habitaciones registradas/)
    await openCreateForm()
    fillRoomForm({ capacity: '0' })

    const submitButton = screen.getByRole('button', { name: 'Crear habitación' })
    submitButton.focus()
    expect(document.activeElement).toBe(submitButton)

    fireEvent.click(submitButton)

    const summary = screen.getByRole('alert', { name: 'Revisá los datos del formulario.' })
    expect(within(summary).getByText('Ingresá el código de la habitación.')).toBeTruthy()
    expect(within(summary).getByText('Ingresá el nombre de la habitación.')).toBeTruthy()
    expect(within(summary).getByText('La capacidad debe ser un número entero mayor a cero.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('Código'))
    expect(service.createRoom).not.toHaveBeenCalled()
  })

  it('updates an existing room without sending the immutable code', async () => {
    const updated = { id: 1, code: '101', name: 'Doble renovada', capacity: 3, status: 'maintenance' }
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
      updateRoom: vi.fn().mockResolvedValue(updated),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Editar habitación 101' }))

    expect(screen.getByLabelText('Código').disabled).toBe(true)
    fillRoomForm({ name: 'Doble renovada', capacity: '3', status: 'maintenance' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Habitación 101 actualizada.')).toBeTruthy()
    expect(service.updateRoom).toHaveBeenCalledWith(1, {
      name: 'Doble renovada',
      capacity: 3,
      status: 'maintenance',
    })
    expect(within(screen.getByRole('table')).getByText('Doble renovada')).toBeTruthy()
  })

  it('associates the immutable-code hint with the disabled code field', async () => {
    const service = createService({ listRooms: vi.fn().mockResolvedValue([ROOM]) })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Editar habitación 101' }))

    const codeInput = screen.getByLabelText('Código')
    const hint = screen.getByText('El código no se puede modificar después de crear la habitación.')

    expect(codeInput.disabled).toBe(true)
    expect(codeInput.getAttribute('aria-describedby')).toBe('room-code-hint')
    expect(hint.getAttribute('id')).toBe('room-code-hint')
  })

  it('clears a field server error as soon as the user edits that field', async () => {
    const service = createService({
      createRoom: vi.fn().mockRejectedValue({
        response: {
          status: 400,
          data: { name: ['This field may not be blank.'] },
        },
      }),
    })
    renderPage(service)

    await screen.findByText(/Todavía no hay habitaciones registradas/)
    await openCreateForm()
    fillRoomForm({ code: '201', name: 'Doble', capacity: '2' })
    fireEvent.click(screen.getByRole('button', { name: 'Crear habitación' }))

    expect(await screen.findByRole('alert', { name: 'Revisá los datos del formulario.' })).toBeTruthy()
    const nameInput = screen.getByLabelText('Nombre')
    expect(nameInput.getAttribute('aria-invalid')).toBe('true')

    fireEvent.change(nameInput, { target: { value: 'Doble superior' } })

    expect(screen.queryByRole('alert', { name: 'Revisá los datos del formulario.' })).toBeNull()
    expect(nameInput.getAttribute('aria-invalid')).toBe('false')
  })

  it('keeps the edit form open and focuses the field when an update returns field errors', async () => {
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
      updateRoom: vi.fn().mockRejectedValue({
        response: {
          status: 400,
          data: {
            capacity: ['Capacity cannot be lower than the guest count of an occupying reservation.'],
          },
        },
      }),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Editar habitación 101' }))
    fillRoomForm({ capacity: '1' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const summary = await screen.findByRole('alert', { name: 'Revisá los datos del formulario.' })
    expect(within(summary).getByText(
      'Capacity cannot be lower than the guest count of an occupying reservation.',
    )).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Editar habitación 101' })).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByLabelText('Capacidad').getAttribute('aria-invalid')).toBe('true')
      expect(document.activeElement).toBe(screen.getByLabelText('Capacidad'))
    })
  })

  it('closes the delete confirmation with Escape without deleting and restores focus to the trigger', async () => {
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar habitación 101' }))
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(service.removeRoom).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Eliminar habitación 101' }))
  })

  it('exposes modal semantics and traps keyboard focus inside the delete dialog', async () => {
    const service = createService({ listRooms: vi.fn().mockResolvedValue([ROOM]) })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar habitación 101' }))

    const dialog = screen.getByRole('alertdialog')
    const confirmButton = screen.getByRole('button', { name: 'Sí, eliminar 101' })
    const cancelButton = screen.getByRole('button', { name: 'Cancelar' })
    const backgroundWrapper = screen.getByRole('heading', { name: 'Habitaciones' }).closest('[inert]')

    expect(backgroundWrapper).not.toBeNull()
    expect(backgroundWrapper.hasAttribute('inert')).toBe(true)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(cancelButton)

    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(confirmButton)

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(cancelButton)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Habitaciones' }).closest('[inert]')).toBeNull()
  })

  it('confirms deletion, names the room code and can be cancelled', async () => {
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar habitación 101' }))

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Eliminar habitación 101' })).toBeTruthy()
    expect(screen.getByText('101', { selector: 'strong' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(service.removeRoom).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Eliminar habitación 101' }))
  })

  it('deletes a room after confirmation and announces the result', async () => {
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
      removeRoom: vi.fn().mockResolvedValue(undefined),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar habitación 101' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar 101' }))

    expect(await screen.findByText('Habitación 101 eliminada.')).toBeTruthy()
    expect(service.removeRoom).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText(/Todavía no hay habitaciones registradas/)).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Habitaciones' }))
  })

  it('disables creation, edit and delete actions while a mutation is in flight', async () => {
    let resolveCreate
    const createRoom = vi.fn(() => new Promise((resolve) => {
      resolveCreate = resolve
    }))
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
      createRoom,
    })
    renderPage(service)

    await screen.findByRole('table')
    await openCreateForm()
    fillRoomForm({ code: '201', name: 'Doble superior', capacity: '2' })
    fireEvent.click(screen.getByRole('button', { name: 'Crear habitación' }))

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByRole('button', { name: 'Nueva habitación' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Editar habitación 101' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Eliminar habitación 101' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Guardando…' }).disabled).toBe(true)

    await act(async () => {
      resolveCreate({ id: 9, code: '201', name: 'Doble superior', capacity: 2, status: 'operational' })
    })

    expect(await screen.findByText('Habitación 201 creada.')).toBeTruthy()
  })

  it('keeps the delete dialog open and locks its actions while a deletion is running', async () => {
    let resolveDelete
    const removeRoom = vi.fn(() => new Promise((resolve) => {
      resolveDelete = resolve
    }))
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
      removeRoom,
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar habitación 101' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar 101' }))

    await waitFor(() => {
      expect(removeRoom).toHaveBeenCalledWith(1)
    })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.getAttribute('tabindex')).toBe('-1')
    expect(dialog.getAttribute('aria-busy')).toBe('true')
    await waitFor(() => {
      expect(document.activeElement).toBe(dialog)
    })
    expect(screen.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Eliminando…' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Nueva habitación' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Editar habitación 101' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Eliminar habitación 101' }).disabled).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('alertdialog')).toBeTruthy()

    await act(async () => {
      resolveDelete(undefined)
    })

    expect(await screen.findByText('Habitación 101 eliminada.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Habitaciones' }))
  })

  it('explains a 409 room_in_use conflict without removing the room', async () => {
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
      removeRoom: vi.fn().mockRejectedValue({
        response: {
          status: 409,
          data: { detail: 'This room cannot be deleted because a reservation references it.' },
        },
      }),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar habitación 101' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar 101' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Esta habitación está referenciada por reservas y no se puede eliminar.',
    )
    expect(within(screen.getByRole('table')).getByText('101')).toBeTruthy()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('reports a forbidden action with a safe permission message', async () => {
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
      removeRoom: vi.fn().mockRejectedValue({ response: { status: 403 } }),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar habitación 101' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar 101' }))

    expect((await screen.findByRole('alert')).textContent).toContain('No tenés permisos para administrar habitaciones.')
  })

  it('reports an expired session with a safe authentication message', async () => {
    const service = createService({
      listRooms: vi.fn().mockRejectedValue({ response: { status: 401 } }),
    })
    renderPage(service)

    expect((await screen.findByRole('alert')).textContent).toContain('Tu sesión expiró. Volvé a iniciar sesión.')
  })

  it('reports a network failure while creating without losing the form', async () => {
    const service = createService({
      createRoom: vi.fn().mockRejectedValue(new Error('Network Error')),
    })
    renderPage(service)

    await screen.findByText(/Todavía no hay habitaciones registradas/)
    await openCreateForm()
    fillRoomForm({ code: '201', name: 'Doble superior', capacity: '2' })
    fireEvent.click(screen.getByRole('button', { name: 'Crear habitación' }))

    expect((await screen.findByRole('alert')).textContent).toContain(SAVE_ERROR_MESSAGE)
    expect(screen.getByRole('heading', { name: 'Nueva habitación' })).toBeTruthy()
    expect(screen.getByLabelText('Código').value).toBe('201')
  })

  it('reports a network failure while updating without removing the room', async () => {
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
      updateRoom: vi.fn().mockRejectedValue(new Error('Network Error')),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Editar habitación 101' }))
    fillRoomForm({ name: 'Doble renovada' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect((await screen.findByRole('alert')).textContent).toContain(SAVE_ERROR_MESSAGE)
    expect(screen.getByRole('heading', { name: 'Editar habitación 101' })).toBeTruthy()
    expect(within(screen.getByRole('table')).getByText('Doble')).toBeTruthy()
  })

  it('reports a network failure while deleting without removing the room', async () => {
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM]),
      removeRoom: vi.fn().mockRejectedValue(new Error('Network Error')),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar habitación 101' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar 101' }))

    expect((await screen.findByRole('alert')).textContent).toContain(DELETE_ERROR_MESSAGE)
    expect(within(screen.getByRole('table')).getByText('101')).toBeTruthy()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Eliminar habitación 101' }))
  })

  it('updates one room while keeping the other rooms in the list', async () => {
    const updated = { id: 1, code: '101', name: 'Doble renovada', capacity: 3, status: 'maintenance' }
    const service = createService({
      listRooms: vi.fn().mockResolvedValue([ROOM, SECOND_ROOM]),
      updateRoom: vi.fn().mockResolvedValue(updated),
    })
    renderPage(service)

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Editar habitación 101' }))
    fillRoomForm({ name: 'Doble renovada', capacity: '3', status: 'maintenance' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Habitación 101 actualizada.')).toBeTruthy()

    const table = screen.getByRole('table')
    expect(within(table).getByText('Doble renovada')).toBeTruthy()
    expect(within(table).getByText('Suite')).toBeTruthy()
    expect(within(table).getByText('102')).toBeTruthy()
  })

  it('shows a load error and retries the request', async () => {
    const listRooms = vi.fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce([])
    const service = createService({ listRooms })
    renderPage(service)

    expect((await screen.findByRole('alert')).textContent).toContain(LOAD_ERROR_MESSAGE)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText(/Todavía no hay habitaciones registradas/)).toBeTruthy()
    expect(listRooms).toHaveBeenCalledTimes(2)
  })
})
