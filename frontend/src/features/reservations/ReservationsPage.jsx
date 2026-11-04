import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as defaultService from './reservationsApi.js'
import { listRooms } from '../rooms/roomsApi.js'
import { listGuests } from '../guests/guestsApi.js'
import { useModalDialog } from '../rooms/useModalDialog.js'
import { dateInRange, errorMessage, fieldErrors, formatDate, rangeDates, STATUS_DETAILS } from './reservationsUtils.js'

const EMPTY_FORM = { room: '', guest: '', check_in: '', check_out: '', guest_count: '1', internal_notes: '' }
const OCCUPYING_STATUSES = new Set(['pending', 'confirmed', 'checked_in'])
const STATUS_ACTION_LABELS = { cancelled: 'Cancelar' }
const FIELD_CLASS = 'mt-2 min-h-11 w-full rounded-md border border-cruce-line bg-cruce-paper px-3 text-cruce-ink shadow-xs outline-none focus:border-cruce-focus focus:ring-2 focus:ring-cruce-focus disabled:cursor-not-allowed disabled:opacity-60'
const DEFAULT_ROOMS_SERVICE = { listRooms }
const DEFAULT_GUESTS_SERVICE = { listGuests }

function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }) }
function addDays(date, amount) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10) }
function details(status) { return STATUS_DETAILS[status] ?? { label: status, next: [] } }
function badgeClass(status) {
  if (status === 'cancelled' || status === 'no_show') return 'border-cruce-danger/35 bg-cruce-danger-soft text-cruce-danger'
  if (status === 'checked_out') return 'border-cruce-line bg-cruce-ivory text-cruce-muted'
  if (status === 'checked_in') return 'border-cruce-success/30 bg-cruce-success-soft text-cruce-success'
  return 'border-cruce-amber/60 bg-cruce-amber/20 text-cruce-amber-dark'
}

export function ReservationsPage({ reservationsService = defaultService, roomsService = DEFAULT_ROOMS_SERVICE, guestsService = DEFAULT_GUESTS_SERVICE }) {
  const [reservations, setReservations] = useState([])
  const [rooms, setRooms] = useState([])
  const [guests, setGuests] = useState([])
  const [range, setRange] = useState(() => { const checkIn = today(); return { checkIn, checkOut: addDays(checkIn, 30) } })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availableRoomIds, setAvailableRoomIds] = useState(null)
  const [errors, setErrors] = useState({})
  const [actionError, setActionError] = useState(null)
  const [feedback, setFeedback] = useState('')
  const formCloseRef = useRef(null)
  const formTriggerRef = useRef(null)
  const focusAfterFormCloseRef = useRef(null)
  const formDialogRef = useModalDialog({ isOpen: isFormOpen, isLocked: isSaving, onClose: closeForm, initialFocusRef: formCloseRef })

  const load = useCallback(async () => {
    setIsLoading(true); setLoadError('')
    try {
      const [reservationData, roomData, guestData] = await Promise.all([reservationsService.listReservations(), roomsService.listRooms(), guestsService.listGuests()])
      if (!Array.isArray(reservationData) || !Array.isArray(roomData) || !Array.isArray(guestData)) throw new Error('Invalid collection response')
      setReservations(reservationData); setRooms(roomData); setGuests(guestData)
    } catch (error) { setLoadError(errorMessage(error, 'No pudimos cargar las reservas. Intentá nuevamente.')) } finally { setIsLoading(false) }
  }, [guestsService, reservationsService, roomsService])

  useEffect(() => { void Promise.resolve().then(load) }, [load])
  useEffect(() => {
    if (!isFormOpen && focusAfterFormCloseRef.current) {
      focusAfterFormCloseRef.current.focus()
      focusAfterFormCloseRef.current = null
    }
  }, [isFormOpen])
  useEffect(() => {
    if (isFormOpen && isSaving) formDialogRef.current?.focus()
  }, [formDialogRef, isFormOpen, isSaving])
  useEffect(() => {
    if (!isFormOpen) return undefined

    const dashboardShell = document.querySelector('[data-dashboard-shell]')

    if (!dashboardShell) return undefined

    const wasInert = dashboardShell.hasAttribute('inert')
    dashboardShell.setAttribute('inert', '')

    return () => {
      if (!wasInert) dashboardShell.removeAttribute('inert')
    }
  }, [isFormOpen])

  const days = useMemo(() => range.checkIn && range.checkOut && range.checkOut > range.checkIn ? rangeDates(range.checkIn, range.checkOut) : [], [range])
  const roomById = useMemo(() => Object.fromEntries(rooms.map((room) => [room.id, room])), [rooms])
  const guestById = useMemo(() => Object.fromEntries(guests.map((guest) => [guest.id, guest])), [guests])
  const visibleReservations = useMemo(() => reservations.filter((reservation) => reservation.check_in < range.checkOut && reservation.check_out > range.checkIn), [range, reservations])

  function openCreate(event) {
    formTriggerRef.current = event.currentTarget
    setEditing(null); setForm({ ...EMPTY_FORM, check_in: range.checkIn, check_out: range.checkOut }); setErrors({}); setActionError(null); setAvailableRoomIds(null); setIsFormOpen(true)
  }
  function openEdit(event, reservation) {
    formTriggerRef.current = event.currentTarget
    setEditing(reservation); setForm({ room: String(reservation.room), guest: String(reservation.guest), check_in: reservation.check_in, check_out: reservation.check_out, guest_count: String(reservation.guest_count), internal_notes: reservation.internal_notes || '' }); setErrors({}); setActionError(null); setAvailableRoomIds(null); setIsFormOpen(true)
  }
  function closeForm() {
    if (isSaving) return
    focusAfterFormCloseRef.current = formTriggerRef.current
    setIsFormOpen(false)
  }
  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => { const next = { ...current }; delete next[name]; return next })
    if (name === 'room' || name === 'check_in' || name === 'check_out') setAvailableRoomIds(null)
  }
  function reportActionError(error, fallback, context) {
    setActionError({ context, message: errorMessage(error, fallback) })
  }

  async function checkAvailability() {
    const validation = {}
    if (!form.check_in) validation.check_in = 'Indicá la fecha de entrada.'
    if (!form.check_out) validation.check_out = 'Indicá la fecha de salida.'
    if (form.check_in && form.check_out && form.check_out <= form.check_in) validation.check_out = 'La salida debe ser posterior a la entrada.'
    if (Object.keys(validation).length) { setErrors(validation); return }
    setCheckingAvailability(true); setActionError(null)
    try {
      const availability = await reservationsService.getAvailability({ checkIn: form.check_in, checkOut: form.check_out })
      setAvailableRoomIds(new Set(availability.rooms.map((room) => room.id)))
      setFeedback('Disponibilidad consultada. La validación final se realiza al guardar.')
    } catch (error) { setErrors(fieldErrors(error)); reportActionError(error, 'No pudimos consultar la disponibilidad.', 'No se pudo consultar la disponibilidad.') } finally { setCheckingAvailability(false) }
  }

  async function submit(event) {
    event.preventDefault()
    if (isSaving) return
    const validation = {}
    if (!form.room) validation.room = 'Seleccioná una habitación.'
    if (!form.guest) validation.guest = 'Seleccioná un huésped.'
    if (!form.check_in) validation.check_in = 'Indicá la fecha de entrada.'
    if (!form.check_out || form.check_out <= form.check_in) validation.check_out = 'La salida debe ser posterior a la entrada.'
    if (!Number.isInteger(Number(form.guest_count)) || Number(form.guest_count) < 1) validation.guest_count = 'Indicá al menos un huésped.'
    if (Object.keys(validation).length) { setErrors(validation); return }
    const payload = { room: Number(form.room), guest: Number(form.guest), check_in: form.check_in, check_out: form.check_out, guest_count: Number(form.guest_count), internal_notes: form.internal_notes }
    setIsSaving(true); setErrors({}); setActionError(null); setFeedback('')
    try {
      const saved = editing ? await reservationsService.updateReservation(editing.id, payload) : await reservationsService.createReservation(payload)
      setReservations((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved])
      setFeedback(editing ? 'Reserva actualizada.' : 'Reserva creada.')
      focusAfterFormCloseRef.current = formTriggerRef.current
      setIsFormOpen(false)
    } catch (error) { setErrors(fieldErrors(error)); reportActionError(error, 'No pudimos guardar la reserva. Revisá los datos e intentá nuevamente.', 'No se pudo guardar la reserva.') } finally { setIsSaving(false) }
  }

  async function transition(reservation, status) {
    setActionError(null); setFeedback('')
    try {
      const updated = await reservationsService.updateReservation(reservation.id, { status })
      setReservations((current) => current.map((item) => item.id === updated.id ? updated : item))
      setFeedback(`Reserva ${details(status).label.toLowerCase()}.`)
    } catch (error) {
      reportActionError(error, 'No pudimos actualizar el estado de la reserva.', 'No se pudo actualizar el estado de la reserva.')
    }
  }

  return (
    <section aria-labelledby="reservations-title">
      <div>
        <div className="max-w-6xl border-b border-cruce-line pb-6 sm:flex sm:items-end sm:justify-between sm:gap-6"><div><p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">Alojamiento</p><h1 className="display-font mt-2 text-3xl text-cruce-ink sm:text-4xl" id="reservations-title">Reservas</h1><p className="mt-3 max-w-xl leading-7 text-cruce-muted">Consultá la ocupación y gestioná las estancias internas.</p></div><button className="mt-5 min-h-11 w-full rounded-md bg-cruce-ink px-4 py-2 text-sm font-semibold text-cruce-ivory focus:outline-none focus:ring-2 focus:ring-cruce-focus sm:mt-0 sm:w-auto" disabled={isLoading} onClick={openCreate} type="button">Nueva reserva</button></div>
        {loadError ? <div className="mt-6 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert"><p>{loadError}</p><button className="mt-3 min-h-11 rounded-md border border-cruce-danger px-4 py-2 font-semibold" onClick={load} type="button">Reintentar</button></div> : null}
        {actionError ? <div className="mt-6 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert"><p className="font-semibold">{actionError.context}</p><p>{actionError.message}</p></div> : null}
        {feedback ? <p className="mt-6 rounded-md border border-cruce-success/30 bg-cruce-success-soft p-4 text-cruce-success" role="status">{feedback}</p> : null}
        {!isLoading && !loadError ? <><RangeFilter range={range} setRange={setRange} /><OccupancyGrid days={days} reservations={visibleReservations} rooms={rooms} onEdit={openEdit} /></> : null}
        {isLoading ? <div className="mt-6 rounded-xl border border-cruce-line bg-cruce-paper p-5" role="status">Cargando reservas, habitaciones y huéspedes…</div> : null}
        {!isLoading && !loadError && reservations.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-cruce-line bg-cruce-paper p-6 text-cruce-muted">Todavía no hay reservas registradas.</p> : null}
        {!isLoading && !loadError && visibleReservations.length > 0 ? <ReservationList guestById={guestById} onEdit={openEdit} onTransition={transition} reservations={visibleReservations} roomById={roomById} /> : null}
      </div>
      {isFormOpen ? createPortal(<ReservationDialog availableRoomIds={availableRoomIds} checkingAvailability={checkingAvailability} closeRef={formCloseRef} dialogRef={formDialogRef} editing={editing} errors={errors} form={form} guests={guests} isSaving={isSaving} onChange={handleChange} onCheckAvailability={checkAvailability} onClose={closeForm} onSubmit={submit} rooms={rooms} />, document.body) : null}
    </section>
  )
}

function RangeFilter({ range, setRange }) { return <form className="mt-6 grid max-w-6xl gap-4 rounded-xl border border-cruce-line bg-cruce-paper p-4 shadow-sm sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}><div><label className="block text-sm font-semibold" htmlFor="occupancy-start">Desde</label><input className={FIELD_CLASS} id="occupancy-start" onChange={(event) => setRange((current) => ({ ...current, checkIn: event.target.value }))} type="date" value={range.checkIn} /></div><div><label className="block text-sm font-semibold" htmlFor="occupancy-end">Hasta (salida exclusiva)</label><input className={FIELD_CLASS} id="occupancy-end" onChange={(event) => setRange((current) => ({ ...current, checkOut: event.target.value }))} type="date" value={range.checkOut} /></div></form> }

function OccupancyGrid({ days, rooms, reservations, onEdit }) {
  if (!days.length) return <p className="mt-6 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert">Elegí un rango de fechas válido.</p>
  if (!rooms.length) return <p className="mt-6 rounded-xl border border-dashed border-cruce-line bg-cruce-paper p-6 text-cruce-muted">No hay habitaciones para mostrar.</p>
  return <div className="mt-6 overflow-hidden rounded-xl border border-cruce-line bg-cruce-paper shadow-sm"><div aria-label="Ocupación por habitación y fecha" className="overflow-x-auto" role="region" tabIndex={0}><table className="w-full min-w-[48rem] text-left"><caption className="sr-only">Ocupación por habitación y fecha. El día de salida no ocupa una noche.</caption><thead><tr className="border-b border-cruce-line bg-cruce-ivory text-xs text-cruce-muted uppercase"><th className="sticky left-0 bg-cruce-ivory px-4 py-3" scope="col">Habitación</th>{days.map((day) => <th className="px-3 py-3 text-center" key={day} scope="col"><time dateTime={day}>{formatDate(day)}</time></th>)}</tr></thead><tbody>{rooms.map((room) => <tr className="border-b border-cruce-line last:border-0" key={room.id}><th className="sticky left-0 bg-cruce-paper px-4 py-3 font-semibold" scope="row">{room.code}<span className="block text-xs font-normal text-cruce-muted">{room.name}</span></th>{days.map((day) => { const reservation = reservations.find((item) => item.room === room.id && dateInRange(day, item.check_in, item.check_out) && OCCUPYING_STATUSES.has(item.status)); return <td className="p-1 text-center" key={day}>{reservation ? <button aria-label={`Editar reserva de ${room.code}, ${day}`} className="min-h-11 w-full rounded border border-cruce-amber/60 bg-cruce-amber/20 px-1 text-xs font-semibold text-cruce-ink focus:outline-none focus:ring-2 focus:ring-cruce-focus" onClick={(event) => onEdit(event, reservation)} type="button">{details(reservation.status).label}</button> : <span aria-label={`${room.code} libre el ${day}`} className="block min-h-11 rounded bg-cruce-ivory" />}</td> })}</tr>)}</tbody></table></div></div>
}

function ReservationDialog({ availableRoomIds, checkingAvailability, closeRef, dialogRef, editing, errors, form, guests, isSaving, onChange, onCheckAvailability, onClose, onSubmit, rooms }) {
  const fields = Object.keys(errors)
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-cruce-ink/80 p-4 sm:items-center"><section aria-busy={isSaving ? 'true' : undefined} aria-labelledby="reservation-form-title" aria-modal="true" className="my-auto w-full max-w-2xl rounded-xl bg-cruce-paper p-5 shadow-2xl" ref={dialogRef} role="dialog" tabIndex={-1}><div className="flex justify-between gap-4"><h2 className="display-font text-2xl" id="reservation-form-title">{editing ? 'Editar reserva' : 'Nueva reserva'}</h2><button className="min-h-11 px-3 font-semibold" disabled={isSaving} onClick={onClose} ref={closeRef} type="button">Cerrar</button></div>{fields.length ? <div aria-label="Revisá los datos del formulario." className="mt-4 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-3 text-cruce-danger" role="alert"><p className="font-semibold">Revisá los datos del formulario.</p><ul className="list-disc pl-5">{fields.map((field) => <li key={field}>{errors[field]}</li>)}</ul></div> : null}<form className="mt-4 grid gap-4 sm:grid-cols-2" noValidate onSubmit={onSubmit}><SelectField error={errors.room} id="reservation-room" label="Habitación" name="room" onChange={onChange} value={form.room}><option value="">Seleccioná una habitación</option>{rooms.map((room) => <option disabled={availableRoomIds && !availableRoomIds.has(room.id) && String(room.id) !== form.room} key={room.id} value={room.id}>{room.code} — {room.name} ({room.capacity}){availableRoomIds && !availableRoomIds.has(room.id) && String(room.id) !== form.room ? ' — no disponible' : ''}</option>)}</SelectField><SelectField error={errors.guest} id="reservation-guest" label="Huésped" name="guest" onChange={onChange} value={form.guest}><option value="">Seleccioná un huésped</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.display_name}</option>)}</SelectField><InputField error={errors.check_in} id="reservation-check-in" label="Entrada" name="check_in" onChange={onChange} type="date" value={form.check_in} /><InputField error={errors.check_out} id="reservation-check-out" label="Salida" name="check_out" onChange={onChange} type="date" value={form.check_out} /><InputField error={errors.guest_count} id="reservation-guest-count" label="Cantidad de huéspedes" min="1" name="guest_count" onChange={onChange} type="number" value={form.guest_count} /><div className="sm:col-span-2"><label className="block text-sm font-semibold" htmlFor="reservation-notes">Notas internas</label><textarea className={FIELD_CLASS} id="reservation-notes" name="internal_notes" onChange={onChange} rows="3" value={form.internal_notes} /></div><div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row"><button className="min-h-11 rounded-md border border-cruce-line px-4 py-2 text-sm font-semibold" disabled={checkingAvailability || isSaving} onClick={onCheckAvailability} type="button">{checkingAvailability ? 'Consultando…' : 'Consultar disponibilidad'}</button><button className="min-h-11 rounded-md bg-cruce-amber px-4 py-2 text-sm font-semibold" disabled={isSaving} type="submit">{isSaving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear reserva'}</button><button className="min-h-11 rounded-md border border-cruce-line px-4 py-2 text-sm font-semibold" disabled={isSaving} onClick={onClose} type="button">Cancelar</button></div></form></section></div>
}

function InputField({ error, id, label, ...props }) { return <div><label className="block text-sm font-semibold" htmlFor={id}>{label}</label><input aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} className={`${FIELD_CLASS} ${error ? 'border-cruce-danger' : ''}`} id={id} {...props} />{error ? <p className="mt-1 text-sm text-cruce-danger" id={`${id}-error`}>{error}</p> : null}</div> }
function SelectField({ children, error, id, label, ...props }) { return <div><label className="block text-sm font-semibold" htmlFor={id}>{label}</label><select aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} className={`${FIELD_CLASS} ${error ? 'border-cruce-danger' : ''}`} id={id} {...props}>{children}</select>{error ? <p className="mt-1 text-sm text-cruce-danger" id={`${id}-error`}>{error}</p> : null}</div> }
function ReservationList({ guestById, onEdit, onTransition, reservations, roomById }) { return <div className="mt-6 overflow-hidden rounded-xl border border-cruce-line bg-cruce-paper shadow-sm"><div className="overflow-x-auto" role="region" tabIndex={0}><table className="w-full min-w-[48rem] text-left"><caption className="sr-only">Reservas del rango seleccionado</caption><thead><tr className="border-b border-cruce-line bg-cruce-ivory text-xs text-cruce-muted uppercase"><th className="p-4" scope="col">Habitación</th><th className="p-4" scope="col">Huésped</th><th className="p-4" scope="col">Estancia</th><th className="p-4" scope="col">Estado</th><th className="p-4" scope="col">Acciones</th></tr></thead><tbody>{reservations.map((reservation) => <tr className="border-b border-cruce-line last:border-0" key={reservation.id}><td className="p-4 font-semibold">{roomById[reservation.room]?.code ?? `Habitación #${reservation.room}`}</td><td className="p-4">{guestById[reservation.guest]?.display_name ?? 'Huésped no disponible'}</td><td className="p-4"><time dateTime={reservation.check_in}>{reservation.check_in}</time> — <time dateTime={reservation.check_out}>{reservation.check_out}</time><span className="block text-xs text-cruce-muted">{reservation.guest_count} huésped{reservation.guest_count === 1 ? '' : 'es'}</span></td><td className="p-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(reservation.status)}`}>{details(reservation.status).label}</span></td><td className="p-4"><div className="flex flex-wrap gap-2"><button aria-label={`Editar reserva ${reservation.id}`} className="min-h-11 rounded-md border border-cruce-line px-3 text-sm font-semibold" onClick={(event) => onEdit(event, reservation)} type="button">Editar</button>{details(reservation.status).next.map((status) => <button className="min-h-11 rounded-md border border-cruce-line px-3 text-sm font-semibold" key={status} onClick={() => onTransition(reservation, status)} type="button">{STATUS_ACTION_LABELS[status] ?? details(status).label}</button>)}</div></td></tr>)}</tbody></table></div></div> }
