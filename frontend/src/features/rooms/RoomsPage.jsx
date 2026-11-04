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
    className: 'border-cruce-success/30 bg-cruce-success-soft text-cruce-success',
  },
  maintenance: {
    label: 'En mantenimiento',
    className: 'border-cruce-amber/60 bg-cruce-amber/20 text-cruce-amber-dark',
  },
  out_of_service: {
    label: 'Fuera de servicio',
    className: 'border-cruce-danger/35 bg-cruce-danger-soft text-cruce-danger',
  },
}

const FIELD_CLASS =
  'mt-2 min-h-11 w-full rounded-md border border-cruce-line bg-cruce-paper px-3 text-cruce-ink shadow-xs outline-none placeholder:text-cruce-muted focus:border-cruce-focus focus:ring-2 focus:ring-cruce-focus disabled:cursor-not-allowed'

function statusPresentation(status) {
  return STATUS_PRESENTATION[status] ?? {
    label: status,
    className: 'border-cruce-line bg-cruce-ivory text-cruce-ink',
  }
}

function FieldError({ id, message }) {
  if (!message) {
    return null
  }

  return (
    <p className="mt-1 text-sm text-cruce-danger" id={id}>
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
        <div className="max-w-6xl border-b border-cruce-line pb-6 sm:flex sm:items-end sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">Alojamiento</p>
            <h1 className="display-font mt-2 text-3xl text-cruce-ink focus:outline-none sm:text-4xl" id="rooms-title" ref={pageHeadingRef} tabIndex={-1}>
              Habitaciones
            </h1>
            <p className="mt-3 max-w-xl leading-7 text-cruce-muted">
              Gestioná las habitaciones, su capacidad y su estado operativo.
            </p>
          </div>
          <button
            className="mt-5 min-h-11 w-full rounded-md bg-cruce-ink px-4 py-2 text-sm font-semibold text-cruce-ivory shadow-sm hover:bg-cruce-panel focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-ivory disabled:cursor-not-allowed disabled:opacity-60 sm:mt-0 sm:w-auto"
            disabled={isBusy}
            onClick={openCreateForm}
            type="button"
          >
            Nueva habitación
          </button>
        </div>

        {loadError ? (
          <div className="mt-6 max-w-6xl rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert">
            <p>{loadError}</p>
            <button
              className="mt-3 min-h-11 rounded-md border border-cruce-danger px-4 py-2 text-sm font-semibold hover:bg-cruce-paper/50 focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-danger-soft"
              onClick={reload}
              type="button"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {actionError ? (
          <p className="mt-6 max-w-6xl rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert">
            {actionError}
          </p>
        ) : null}

        {feedback ? (
          <p className="mt-6 max-w-6xl rounded-md border border-cruce-success/30 bg-cruce-success-soft p-4 text-cruce-success" role="status">
            {feedback}
          </p>
        ) : null}

        {isFormOpen ? (
          <section
            aria-labelledby="room-form-title"
            className="mt-6 max-w-6xl rounded-xl border border-cruce-line bg-cruce-paper p-4 shadow-sm sm:p-6"
          >
            <h2 className="display-font text-2xl text-cruce-ink" id="room-form-title">
              {editingRoom ? `Editar habitación ${editingRoom.code}` : 'Nueva habitación'}
            </h2>

            {fieldErrorFields.length > 0 ? (
              <div
                aria-labelledby="room-form-error-summary-title"
                className="mt-4 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger"
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
                <label className="block text-sm font-semibold text-cruce-ink" htmlFor="room-code">
                  Código
                </label>
                <input
                  aria-describedby={codeDescribedBy}
                  aria-invalid={Boolean(fieldErrors.code)}
                  className={`${FIELD_CLASS} ${fieldErrors.code ? 'border-cruce-danger' : ''} ${editingRoom ? 'bg-cruce-ivory text-cruce-muted' : ''}`}
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
                  <p className="mt-1 text-sm text-cruce-muted" id="room-code-hint">
                    El código no se puede modificar después de crear la habitación.
                  </p>
                ) : null}
                <FieldError id="room-code-error" message={fieldErrors.code} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-cruce-ink" htmlFor="room-name">
                  Nombre
                </label>
                <input
                  aria-describedby={fieldErrors.name ? 'room-name-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`${FIELD_CLASS} ${fieldErrors.name ? 'border-cruce-danger' : ''}`}
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
                <label className="block text-sm font-semibold text-cruce-ink" htmlFor="room-capacity">
                  Capacidad
                </label>
                <input
                  aria-describedby={fieldErrors.capacity ? 'room-capacity-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.capacity)}
                  className={`${FIELD_CLASS} ${fieldErrors.capacity ? 'border-cruce-danger' : ''}`}
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
                <label className="block text-sm font-semibold text-cruce-ink" htmlFor="room-status">
                  Estado
                </label>
                <select
                  aria-describedby={fieldErrors.status ? 'room-status-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.status)}
                  className={`${FIELD_CLASS} ${fieldErrors.status ? 'border-cruce-danger' : ''}`}
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
                  className="min-h-11 rounded-md bg-cruce-amber px-4 py-2 text-sm font-semibold text-cruce-ink hover:bg-cruce-amber/80 focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-paper disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? 'Guardando…' : editingRoom ? 'Guardar cambios' : 'Crear habitación'}
                </button>
                <button
                  className="min-h-11 rounded-md border border-cruce-line bg-cruce-paper px-4 py-2 text-sm font-semibold text-cruce-ink hover:bg-cruce-ivory focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-paper disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="mt-6 max-w-6xl space-y-3 rounded-xl border border-cruce-line bg-cruce-paper p-4 shadow-sm" role="status">
            <p className="text-cruce-muted">Cargando habitaciones…</p>
            <div aria-hidden="true" className="h-4 w-2/3 animate-pulse rounded bg-cruce-line" />
            <div aria-hidden="true" className="h-4 w-1/2 animate-pulse rounded bg-cruce-line" />
          </div>
        ) : null}

        {!isLoading && !loadError && rooms.length === 0 ? (
          <div className="mt-6 max-w-6xl rounded-xl border border-dashed border-cruce-line bg-cruce-paper p-6 text-cruce-muted shadow-sm">
            <p>Todavía no hay habitaciones registradas. Creá la primera con «Nueva habitación».</p>
          </div>
        ) : null}

        {!isLoading && rooms.length > 0 ? (
          <div className="mt-6 max-w-6xl overflow-hidden rounded-xl border border-cruce-line bg-cruce-paper shadow-sm">
            <div
              aria-label="Habitaciones registradas"
              className="overflow-x-auto overscroll-x-contain focus:outline-none focus-visible:ring-2 focus-visible:ring-cruce-focus focus-visible:ring-inset"
              role="region"
              tabIndex={0}
            >
              <table className="w-full min-w-[42rem] text-left">
                <caption className="sr-only">Habitaciones registradas</caption>
                <thead>
                  <tr className="border-b border-cruce-line bg-cruce-ivory text-xs tracking-[0.12em] text-cruce-muted uppercase">
                    <th className="px-4 py-3.5 text-left font-semibold" scope="col">Código</th>
                    <th className="px-4 py-3.5 text-left font-semibold" scope="col">Nombre</th>
                    <th className="px-4 py-3.5 text-left font-semibold" scope="col">Capacidad</th>
                    <th className="px-4 py-3.5 text-left font-semibold" scope="col">Estado</th>
                    <th className="px-4 py-3.5 text-right font-semibold" scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => {
                    const status = statusPresentation(room.status)

                    return (
                      <tr className="border-b border-cruce-line/80 last:border-0 hover:bg-cruce-ivory/70" key={room.id}>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-cruce-ink">{room.code}</span>
                        </td>
                        <td className="px-4 py-4 text-cruce-ink">{room.name}</td>
                        <td className="px-4 py-4 text-cruce-ink">{room.capacity}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-nowrap justify-end gap-2">
                            <button
                              aria-label={`Editar habitación ${room.code}`}
                              className="min-h-11 rounded-md border border-cruce-line bg-cruce-paper px-3 text-sm font-semibold text-cruce-ink hover:bg-cruce-ivory focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isBusy}
                              onClick={(event) => openEditForm(event, room)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button
                              aria-label={`Eliminar habitación ${room.code}`}
                              className="min-h-11 rounded-md border border-cruce-danger/55 bg-cruce-paper px-3 text-sm font-semibold text-cruce-danger hover:bg-cruce-danger-soft focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-cruce-ink/80 p-4 sm:items-center sm:p-6">
          <section
            aria-busy={isDeleting ? 'true' : undefined}
            aria-describedby="delete-room-description"
            aria-labelledby="delete-room-title"
            aria-modal="true"
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-cruce-danger/45 bg-cruce-paper p-4 text-cruce-ink shadow-2xl focus:outline-none sm:max-h-[calc(100dvh-3rem)] sm:p-6"
            ref={deleteDialogRef}
            role="alertdialog"
            tabIndex={-1}
          >
            <p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">Acción permanente</p>
            <h2 className="display-font mt-2 text-2xl text-cruce-ink" id="delete-room-title">
              Eliminar habitación {roomToDelete.code}
            </h2>
            <p className="mt-3 leading-7 text-cruce-muted" id="delete-room-description">
              La habitación <strong>{roomToDelete.code}</strong> se eliminará de forma permanente. Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                className="min-h-11 rounded-md bg-cruce-danger px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-cruce-danger/85 focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-paper disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDeleting}
                onClick={confirmDelete}
                type="button"
              >
                {isDeleting ? 'Eliminando…' : `Sí, eliminar ${roomToDelete.code}`}
              </button>
              <button
                className="min-h-11 rounded-md border border-cruce-line bg-cruce-paper px-4 py-2 text-sm font-semibold text-cruce-ink hover:bg-cruce-ivory focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-paper disabled:cursor-not-allowed disabled:opacity-60"
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
