import { useEffect, useRef, useState } from 'react'
import * as roomsApi from './roomsApi.js'
import { useModalDialog } from './useModalDialog.js'
import { useRooms } from './useRooms.js'

const EMPTY_FORM = {
  code: '',
  name: '',
  capacity: '1',
  status: 'operational',
}

const FIELD_ORDER = ['code', 'name', 'capacity', 'status']

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operativa' },
  { value: 'maintenance', label: 'En mantenimiento' },
  { value: 'out_of_service', label: 'Fuera de servicio' },
]

const STATUS_PRESENTATION = {
  operational: {
    label: 'Operativa',
    className: 'border-stone-300 bg-stone-100 text-stone-900',
  },
  maintenance: {
    label: 'En mantenimiento',
    className: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  out_of_service: {
    label: 'Fuera de servicio',
    className: 'border-red-300 bg-red-50 text-red-900',
  },
}

const FIELD_CLASS =
  'mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-stone-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/40'

function statusPresentation(status) {
  return STATUS_PRESENTATION[status] ?? {
    label: status,
    className: 'border-stone-300 bg-stone-100 text-stone-800',
  }
}

function FieldError({ id, message }) {
  if (!message) {
    return null
  }

  return (
    <p className="mt-1 text-sm text-red-700" id={id}>
      {message}
    </p>
  )
}

export function RoomsPage({ roomsService = roomsApi }) {
  const {
    rooms,
    isLoading,
    loadError,
    isSaving,
    isDeleting,
    fieldErrors,
    actionError,
    feedback,
    reload,
    createRoom,
    updateRoom,
    deleteRoom,
    resetErrors,
    setFieldErrors,
    clearFieldError,
  } = useRooms(roomsService)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [roomToDelete, setRoomToDelete] = useState(null)
  const [validationAttempt, setValidationAttempt] = useState(0)

  const pageHeadingRef = useRef(null)
  const codeInputRef = useRef(null)
  const nameInputRef = useRef(null)
  const capacityInputRef = useRef(null)
  const statusInputRef = useRef(null)
  const cancelDeleteRef = useRef(null)
  const returnFocusRef = useRef(null)
  const deleteTriggerRef = useRef(null)
  const focusAfterDialogRef = useRef(null)
  const handledValidationAttemptRef = useRef(0)

  const isBusy = isSaving || isDeleting
  const fieldErrorFields = FIELD_ORDER.filter((field) => Boolean(fieldErrors[field]))

  const deleteDialogRef = useModalDialog({
    isOpen: Boolean(roomToDelete),
    isLocked: isDeleting,
    onClose: cancelDelete,
    initialFocusRef: cancelDeleteRef,
  })

  useEffect(() => {
    if (!isFormOpen) {
      return
    }

    const target = editingRoom ? nameInputRef.current : codeInputRef.current
    target?.focus()
  }, [editingRoom, isFormOpen])

  useEffect(() => {
    if (validationAttempt === 0 || handledValidationAttemptRef.current === validationAttempt) {
      return
    }

    handledValidationAttemptRef.current = validationAttempt

    const fieldRefs = [
      ['code', codeInputRef],
      ['name', nameInputRef],
      ['capacity', capacityInputRef],
      ['status', statusInputRef],
    ]

    for (const [field, ref] of fieldRefs) {
      if (fieldErrors[field] && ref.current && !ref.current.disabled) {
        ref.current.focus()
        return
      }
    }
  }, [fieldErrors, validationAttempt])

  useEffect(() => {
    if (roomToDelete) {
      return
    }

    const focusTarget = focusAfterDialogRef.current

    if (!focusTarget) {
      return
    }

    focusAfterDialogRef.current = null
    focusTarget.focus()
  }, [roomToDelete])

  useEffect(() => {
    if (!roomToDelete || !isDeleting) {
      return
    }

    deleteDialogRef.current?.focus()
  }, [deleteDialogRef, isDeleting, roomToDelete])

  function openCreateForm(event) {
    returnFocusRef.current = event.currentTarget
    setEditingRoom(null)
    setForm(EMPTY_FORM)
    setIsFormOpen(true)
    resetErrors()
  }

  function openEditForm(event, room) {
    returnFocusRef.current = event.currentTarget
    setEditingRoom(room)
    setForm({
      code: room.code,
      name: room.name,
      capacity: String(room.capacity),
      status: room.status,
    })
    setIsFormOpen(true)
    resetErrors()
  }

  function closeForm() {
    setIsFormOpen(false)
    setEditingRoom(null)
    resetErrors()
    returnFocusRef.current?.focus()
  }

  function handleFormChange(event) {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
    clearFieldError(name)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (isSaving) {
      return
    }

    const values = {
      name: form.name.trim(),
      capacity: Number(form.capacity),
      status: form.status,
    }

    if (!editingRoom) {
      values.code = form.code.trim()
    }

    const validationErrors = {}

    if (!editingRoom && !values.code) {
      validationErrors.code = 'Ingresá el código de la habitación.'
    }

    if (!values.name) {
      validationErrors.name = 'Ingresá el nombre de la habitación.'
    }

    if (!Number.isInteger(values.capacity) || values.capacity < 1) {
      validationErrors.capacity = 'La capacidad debe ser un número entero mayor a cero.'
    }

    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      setValidationAttempt((attempt) => attempt + 1)
      return
    }

    const savedRoom = editingRoom
      ? await updateRoom(editingRoom.id, values)
      : await createRoom(values)

    if (savedRoom) {
      closeForm()
    } else {
      setValidationAttempt((attempt) => attempt + 1)
    }
  }

  function openDeleteConfirmation(event, room) {
    deleteTriggerRef.current = event.currentTarget
    setRoomToDelete(room)
  }

  function cancelDelete() {
    if (isDeleting) {
      return
    }

    focusAfterDialogRef.current = deleteTriggerRef.current
    setRoomToDelete(null)
  }

  async function confirmDelete() {
    if (!roomToDelete || isDeleting) {
      return
    }

    const room = roomToDelete
    const wasDeleted = await deleteRoom(room)
    focusAfterDialogRef.current = wasDeleted ? pageHeadingRef.current : deleteTriggerRef.current
    setRoomToDelete(null)
  }

  const codeDescribedBy = [
    editingRoom ? 'room-code-hint' : null,
    fieldErrors.code ? 'room-code-error' : null,
  ].filter(Boolean).join(' ') || undefined

  return (
    <section aria-labelledby="rooms-title">
      <div inert={roomToDelete ? true : undefined}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="display-font text-3xl focus:outline-none" id="rooms-title" ref={pageHeadingRef} tabIndex={-1}>
              Habitaciones
            </h1>
            <p className="mt-3 max-w-xl text-stone-700">
              Gestioná las habitaciones, su capacidad y su estado operativo.
            </p>
          </div>
          <button
            className="min-h-11 rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={openCreateForm}
            type="button"
          >
            Nueva habitación
          </button>
        </div>

        {loadError ? (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900" role="alert">
            <p>{loadError}</p>
            <button
              className="mt-3 min-h-11 rounded-md border border-red-400 px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-700"
              onClick={reload}
              type="button"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {actionError ? (
          <p className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900" role="alert">
            {actionError}
          </p>
        ) : null}

        {feedback ? (
          <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950" role="status">
            {feedback}
          </p>
        ) : null}

        {isFormOpen ? (
          <section
            aria-labelledby="room-form-title"
            className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-6"
          >
            <h2 className="display-font text-2xl" id="room-form-title">
              {editingRoom ? `Editar habitación ${editingRoom.code}` : 'Nueva habitación'}
            </h2>

            {fieldErrorFields.length > 0 ? (
              <div
                aria-labelledby="room-form-error-summary-title"
                className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900"
                role="alert"
              >
                <h3 className="text-sm font-semibold" id="room-form-error-summary-title">
                  Revisá los datos del formulario.
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {fieldErrorFields.map((field) => (
                    <li key={field}>{fieldErrors[field]}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <form className="mt-4 grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-stone-800" htmlFor="room-code">
                  Código
                </label>
                <input
                  aria-describedby={codeDescribedBy}
                  aria-invalid={Boolean(fieldErrors.code)}
                  className={`${FIELD_CLASS} ${fieldErrors.code ? 'border-red-500' : ''} ${editingRoom ? 'bg-stone-200 text-stone-600' : ''}`}
                  disabled={Boolean(editingRoom)}
                  id="room-code"
                  maxLength={32}
                  name="code"
                  onChange={handleFormChange}
                  ref={codeInputRef}
                  required
                  type="text"
                  value={form.code}
                />
                {editingRoom ? (
                  <p className="mt-1 text-sm text-stone-600" id="room-code-hint">
                    El código no se puede modificar después de crear la habitación.
                  </p>
                ) : null}
                <FieldError id="room-code-error" message={fieldErrors.code} />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-800" htmlFor="room-name">
                  Nombre
                </label>
                <input
                  aria-describedby={fieldErrors.name ? 'room-name-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`${FIELD_CLASS} ${fieldErrors.name ? 'border-red-500' : ''}`}
                  id="room-name"
                  maxLength={120}
                  name="name"
                  onChange={handleFormChange}
                  ref={nameInputRef}
                  required
                  type="text"
                  value={form.name}
                />
                <FieldError id="room-name-error" message={fieldErrors.name} />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-800" htmlFor="room-capacity">
                  Capacidad
                </label>
                <input
                  aria-describedby={fieldErrors.capacity ? 'room-capacity-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.capacity)}
                  className={`${FIELD_CLASS} ${fieldErrors.capacity ? 'border-red-500' : ''}`}
                  id="room-capacity"
                  min={1}
                  name="capacity"
                  onChange={handleFormChange}
                  ref={capacityInputRef}
                  required
                  step={1}
                  type="number"
                  value={form.capacity}
                />
                <FieldError id="room-capacity-error" message={fieldErrors.capacity} />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-800" htmlFor="room-status">
                  Estado
                </label>
                <select
                  aria-describedby={fieldErrors.status ? 'room-status-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.status)}
                  className={`${FIELD_CLASS} ${fieldErrors.status ? 'border-red-500' : ''}`}
                  id="room-status"
                  name="status"
                  onChange={handleFormChange}
                  ref={statusInputRef}
                  value={form.status}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError id="room-status-error" message={fieldErrors.status} />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                <button
                  className="min-h-11 rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? 'Guardando…' : editingRoom ? 'Guardar cambios' : 'Crear habitación'}
                </button>
                <button
                  className="min-h-11 rounded-md border border-stone-400 px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  onClick={closeForm}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {isLoading ? (
          <div className="mt-6 space-y-3 rounded-2xl border border-stone-200 bg-white p-4" role="status">
            <p className="text-stone-700">Cargando habitaciones…</p>
            <div aria-hidden="true" className="h-4 w-2/3 animate-pulse rounded bg-stone-200" />
            <div aria-hidden="true" className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
          </div>
        ) : null}

        {!isLoading && !loadError && rooms.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-stone-700">
            <p>Todavía no hay habitaciones registradas. Creá la primera con «Nueva habitación».</p>
          </div>
        ) : null}

        {!isLoading && rooms.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <div
              aria-label="Habitaciones registradas"
              className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-inset"
              role="region"
              tabIndex={0}
            >
              <table className="w-full min-w-[36rem] text-left">
                <caption className="sr-only">Habitaciones registradas</caption>
                <thead>
                  <tr className="border-b border-stone-200 text-xs tracking-[0.12em] text-stone-600 uppercase">
                    <th className="px-3 py-3 text-left font-semibold" scope="col">Código</th>
                    <th className="px-3 py-3 text-left font-semibold" scope="col">Nombre</th>
                    <th className="px-3 py-3 text-left font-semibold" scope="col">Capacidad</th>
                    <th className="px-3 py-3 text-left font-semibold" scope="col">Estado</th>
                    <th className="px-3 py-3 text-right font-semibold" scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => {
                    const status = statusPresentation(room.status)

                    return (
                      <tr className="border-b border-stone-200 last:border-0" key={room.id}>
                        <td className="px-3 py-3">
                          <span className="font-semibold text-stone-900">{room.code}</span>
                        </td>
                        <td className="px-3 py-3 text-stone-900">{room.name}</td>
                        <td className="px-3 py-3 text-stone-900">{room.capacity}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              aria-label={`Editar habitación ${room.code}`}
                              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm font-semibold hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isBusy}
                              onClick={(event) => openEditForm(event, room)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button
                              aria-label={`Eliminar habitación ${room.code}`}
                              className="min-h-11 rounded-md border border-red-300 px-3 text-sm font-semibold text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isBusy}
                              onClick={(event) => openDeleteConfirmation(event, room)}
                              type="button"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {roomToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4">
          <section
            aria-busy={isDeleting ? 'true' : undefined}
            aria-describedby="delete-room-description"
            aria-labelledby="delete-room-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-red-300 bg-red-50 p-4 shadow-xl focus:outline-none sm:p-6"
            ref={deleteDialogRef}
            role="alertdialog"
            tabIndex={-1}
          >
            <h2 className="display-font text-2xl text-red-950" id="delete-room-title">
              Eliminar habitación {roomToDelete.code}
            </h2>
            <p className="mt-2 text-red-900" id="delete-room-description">
              La habitación <strong>{roomToDelete.code}</strong> se eliminará de forma permanente. Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                className="min-h-11 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDeleting}
                onClick={confirmDelete}
                type="button"
              >
                {isDeleting ? 'Eliminando…' : `Sí, eliminar ${roomToDelete.code}`}
              </button>
              <button
                className="min-h-11 rounded-md border border-stone-400 bg-white px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDeleting}
                onClick={cancelDelete}
                ref={cancelDeleteRef}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
