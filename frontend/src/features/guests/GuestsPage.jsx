import { useEffect, useMemo, useRef, useState } from 'react'
import { useModalDialog } from '../rooms/useModalDialog.js'
import * as guestsApi from './guestsApi.js'
import { useGuests } from './useGuests.js'
import { filterGuests, maskDocumentNumber } from './guestsUtils.js'

const EMPTY_FORM = { display_name: '', email: '', phone: '', document_type: '', document_number: '', internal_notes: '' }
const FIELD_ORDER = ['display_name', 'email', 'phone', 'document_type', 'document_number', 'internal_notes']
const DOCUMENT_TYPES = [
  { value: '', label: 'Sin documento' },
  { value: 'dni', label: 'DNI' },
  { value: 'nie', label: 'NIE' },
  { value: 'passport', label: 'Pasaporte' },
  { value: 'other', label: 'Otro' },
]
const FIELD_CLASS = 'mt-2 min-h-11 w-full rounded-md border border-cruce-line bg-cruce-paper px-3 text-cruce-ink shadow-xs outline-none placeholder:text-cruce-muted focus:border-cruce-focus focus:ring-2 focus:ring-cruce-focus disabled:cursor-not-allowed'

function FieldError({ id, message }) {
  return message ? <p className="mt-1 text-sm text-cruce-danger" id={id}>{message}</p> : null
}

function DetailDialog({ guest, onClose }) {
  const closeRef = useRef(null)
  const dialogRef = useModalDialog({ isOpen: Boolean(guest), onClose, initialFocusRef: closeRef })
  if (!guest) return null
  const documentType = DOCUMENT_TYPES.find((type) => type.value === guest.document_type)?.label || guest.document_type
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-cruce-ink/80 p-4 sm:items-center sm:p-6">
      <section aria-labelledby="guest-details-title" aria-modal="true" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-cruce-line bg-cruce-paper p-4 text-cruce-ink shadow-2xl focus:outline-none sm:max-h-[calc(100dvh-3rem)] sm:p-6" ref={dialogRef} role="dialog" tabIndex={-1}>
        <p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">Ficha operativa</p>
        <h2 className="display-font mt-2 text-2xl" id="guest-details-title">{guest.display_name}</h2>
        <dl className="mt-5 divide-y divide-cruce-line rounded-md border border-cruce-line">
          <DetailRow label="Correo electrónico" value={guest.email || 'No registrado'} />
          <DetailRow label="Teléfono" value={guest.phone || 'No registrado'} />
          <DetailRow label="Documento" value={guest.document_number ? `${documentType}: ${maskDocumentNumber(guest.document_number)}` : 'No registrado'} />
          <DetailRow label="Notas internas" value={guest.internal_notes || 'Sin notas'} />
        </dl>
        <button className="mt-5 min-h-11 rounded-md border border-cruce-line px-4 py-2 text-sm font-semibold hover:bg-cruce-ivory focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-paper" onClick={onClose} ref={closeRef} type="button">Cerrar</button>
      </section>
    </div>
  )
}

function DetailRow({ label, value }) {
  return <div className="p-3"><dt className="text-xs font-semibold tracking-[0.1em] text-cruce-muted uppercase">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-cruce-ink">{value}</dd></div>
}

export function GuestsPage({ guestsService = guestsApi }) {
  const { guests, isLoading, loadError, isSaving, isDeleting, fieldErrors, actionError, feedback, reload, createGuest, updateGuest, deleteGuest, resetErrors, setFieldErrors, clearFieldError } = useGuests(guestsService)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState(null)
  const [detailGuest, setDetailGuest] = useState(null)
  const [guestToDelete, setGuestToDelete] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const [documentFilter, setDocumentFilter] = useState('all')
  const [validationAttempt, setValidationAttempt] = useState(0)
  const pageHeadingRef = useRef(null)
  const displayNameRef = useRef(null)
  const deleteCancelRef = useRef(null)
  const deleteTriggerRef = useRef(null)
  const detailTriggerRef = useRef(null)
  const returnFocusRef = useRef(null)
  const focusAfterDialogRef = useRef(null)
  const handledValidationAttemptRef = useRef(0)
  const isBusy = isSaving || isDeleting
  const visibleGuests = useMemo(() => filterGuests(guests, query, documentFilter), [documentFilter, guests, query])
  const fieldErrorFields = FIELD_ORDER.filter((field) => fieldErrors[field])

  const deleteDialogRef = useModalDialog({ isOpen: Boolean(guestToDelete), isLocked: isDeleting, onClose: cancelDelete, initialFocusRef: deleteCancelRef })

  useEffect(() => {
    if (isFormOpen) displayNameRef.current?.focus()
  }, [isFormOpen])

  useEffect(() => {
    if (!validationAttempt || handledValidationAttemptRef.current === validationAttempt) return
    handledValidationAttemptRef.current = validationAttempt
    const refs = { display_name: displayNameRef }
    for (const field of FIELD_ORDER) {
      if (fieldErrors[field] && refs[field]?.current) { refs[field].current.focus(); return }
    }
  }, [fieldErrors, validationAttempt])

  useEffect(() => {
    if (guestToDelete || detailGuest) return
    const focusTarget = focusAfterDialogRef.current
    if (focusTarget) { focusAfterDialogRef.current = null; focusTarget.focus() }
  }, [detailGuest, guestToDelete])

  useEffect(() => {
    if (guestToDelete && isDeleting) deleteDialogRef.current?.focus()
  }, [deleteDialogRef, guestToDelete, isDeleting])

  function openCreateForm(event) {
    returnFocusRef.current = event.currentTarget
    setEditingGuest(null); setForm(EMPTY_FORM); setIsFormOpen(true); resetErrors()
  }

  function openEditForm(event, guest) {
    returnFocusRef.current = event.currentTarget
    setEditingGuest(guest)
    setForm(FIELD_ORDER.reduce((values, field) => ({ ...values, [field]: guest[field] || '' }), {}))
    setIsFormOpen(true); resetErrors()
  }

  function closeForm() {
    setIsFormOpen(false); setEditingGuest(null); resetErrors(); returnFocusRef.current?.focus()
  }

  function handleFormChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    clearFieldError(name)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSaving) return
    const values = Object.fromEntries(FIELD_ORDER.map((field) => [field, form[field]]))
    const validationErrors = {}
    if (!values.display_name.trim()) validationErrors.display_name = 'Ingresá el nombre del huésped.'
    if (values.document_type && !values.document_number.trim()) validationErrors.document_number = 'Ingresá el número de documento.'
    if (!values.document_type && values.document_number.trim()) validationErrors.document_type = 'Seleccioná el tipo de documento.'
    setFieldErrors(validationErrors)
    if (Object.keys(validationErrors).length) { setValidationAttempt((attempt) => attempt + 1); return }
    const savedGuest = editingGuest ? await updateGuest(editingGuest.id, values) : await createGuest(values)
    if (savedGuest) closeForm()
    else setValidationAttempt((attempt) => attempt + 1)
  }

  function openDetails(event, guest) { detailTriggerRef.current = event.currentTarget; setDetailGuest(guest) }
  function closeDetails() { focusAfterDialogRef.current = detailTriggerRef.current; setDetailGuest(null) }
  function openDeleteConfirmation(event, guest) { deleteTriggerRef.current = event.currentTarget; setGuestToDelete(guest) }
  function cancelDelete() { if (!isDeleting) { focusAfterDialogRef.current = deleteTriggerRef.current; setGuestToDelete(null) } }
  async function confirmDelete() {
    if (!guestToDelete || isDeleting) return
    const wasDeleted = await deleteGuest(guestToDelete)
    focusAfterDialogRef.current = wasDeleted ? pageHeadingRef.current : deleteTriggerRef.current
    setGuestToDelete(null)
  }

  return (
    <section aria-labelledby="guests-title">
      <div inert={guestToDelete || detailGuest ? true : undefined}>
        <div className="max-w-6xl border-b border-cruce-line pb-6 sm:flex sm:items-end sm:justify-between sm:gap-6">
          <div><p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">Operación</p><h1 className="display-font mt-2 text-3xl text-cruce-ink focus:outline-none sm:text-4xl" id="guests-title" ref={pageHeadingRef} tabIndex={-1}>Huéspedes</h1><p className="mt-3 max-w-xl leading-7 text-cruce-muted">Gestioná datos operativos mínimos de huéspedes.</p></div>
          <button className="mt-5 min-h-11 w-full rounded-md bg-cruce-ink px-4 py-2 text-sm font-semibold text-cruce-ivory shadow-sm hover:bg-cruce-panel focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-ivory disabled:cursor-not-allowed disabled:opacity-60 sm:mt-0 sm:w-auto" disabled={isBusy} onClick={openCreateForm} type="button">Nuevo huésped</button>
        </div>
        {loadError ? <div className="mt-6 max-w-6xl rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert"><p>{loadError}</p><button className="mt-3 min-h-11 rounded-md border border-cruce-danger px-4 py-2 text-sm font-semibold hover:bg-cruce-paper/50 focus:outline-none focus:ring-2 focus:ring-cruce-focus" onClick={reload} type="button">Reintentar</button></div> : null}
        {actionError ? <p className="mt-6 max-w-6xl rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert">{actionError}</p> : null}
        {feedback ? <p className="mt-6 max-w-6xl rounded-md border border-cruce-success/30 bg-cruce-success-soft p-4 text-cruce-success" role="status">{feedback}</p> : null}
        {isFormOpen ? <GuestForm editingGuest={editingGuest} fieldErrors={fieldErrors} fieldErrorFields={fieldErrorFields} form={form} isSaving={isSaving} onCancel={closeForm} onChange={handleFormChange} onSubmit={handleSubmit} displayNameRef={displayNameRef} /> : null}
        {!isLoading && !loadError && guests.length > 0 ? <div className="mt-6 grid max-w-6xl gap-4 rounded-xl border border-cruce-line bg-cruce-paper p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_14rem]"><div><label className="block text-sm font-semibold" htmlFor="guest-search">Buscar huéspedes</label><input className={FIELD_CLASS} id="guest-search" onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, correo o teléfono" type="search" value={query} /></div><div><label className="block text-sm font-semibold" htmlFor="document-filter">Documento</label><select className={FIELD_CLASS} id="document-filter" onChange={(event) => setDocumentFilter(event.target.value)} value={documentFilter}><option value="all">Todos</option><option value="with-document">Con documento</option><option value="without-document">Sin documento</option></select></div></div> : null}
        {isLoading ? <div className="mt-6 max-w-6xl space-y-3 rounded-xl border border-cruce-line bg-cruce-paper p-4 shadow-sm" role="status"><p className="text-cruce-muted">Cargando huéspedes…</p><div aria-hidden="true" className="h-4 w-2/3 animate-pulse rounded bg-cruce-line" /></div> : null}
        {!isLoading && !loadError && guests.length === 0 ? <div className="mt-6 max-w-6xl rounded-xl border border-dashed border-cruce-line bg-cruce-paper p-6 text-cruce-muted shadow-sm">Todavía no hay huéspedes registrados. Creá el primero con «Nuevo huésped».</div> : null}
        {!isLoading && visibleGuests.length === 0 && guests.length > 0 ? <p className="mt-6 max-w-6xl rounded-xl border border-dashed border-cruce-line bg-cruce-paper p-6 text-cruce-muted">No encontramos huéspedes con esos filtros.</p> : null}
        {!isLoading && visibleGuests.length > 0 ? <GuestTable guests={visibleGuests} isBusy={isBusy} onDelete={openDeleteConfirmation} onDetails={openDetails} onEdit={openEditForm} /> : null}
      </div>
      <DetailDialog guest={detailGuest} onClose={closeDetails} />
      {guestToDelete ? <DeleteDialog dialogRef={deleteDialogRef} guest={guestToDelete} isDeleting={isDeleting} onCancel={cancelDelete} onConfirm={confirmDelete} cancelRef={deleteCancelRef} /> : null}
    </section>
  )
}

function GuestForm({ editingGuest, fieldErrors, fieldErrorFields, form, isSaving, onCancel, onChange, onSubmit, displayNameRef }) {
  return <section aria-labelledby="guest-form-title" className="mt-6 max-w-6xl rounded-xl border border-cruce-line bg-cruce-paper p-4 shadow-sm sm:p-6"><h2 className="display-font text-2xl" id="guest-form-title">{editingGuest ? `Editar huésped ${editingGuest.display_name}` : 'Nuevo huésped'}</h2>{fieldErrorFields.length ? <div aria-labelledby="guest-form-error-summary-title" className="mt-4 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert"><h3 className="text-sm font-semibold" id="guest-form-error-summary-title">Revisá los datos del formulario.</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{fieldErrorFields.map((field) => <li key={field}>{fieldErrors[field]}</li>)}</ul></div> : null}<form className="mt-4 grid gap-4 sm:grid-cols-2" noValidate onSubmit={onSubmit}><GuestField error={fieldErrors.display_name} id="guest-display-name" label="Nombre" name="display_name" onChange={onChange} required inputRef={displayNameRef} value={form.display_name} /><GuestField error={fieldErrors.email} id="guest-email" label="Correo electrónico" name="email" onChange={onChange} type="email" value={form.email} /><GuestField error={fieldErrors.phone} id="guest-phone" label="Teléfono" name="phone" onChange={onChange} type="tel" value={form.phone} /><div><label className="block text-sm font-semibold" htmlFor="guest-document-type">Tipo de documento</label><select aria-describedby={fieldErrors.document_type ? 'guest-document-type-error' : undefined} aria-invalid={Boolean(fieldErrors.document_type)} className={`${FIELD_CLASS} ${fieldErrors.document_type ? 'border-cruce-danger' : ''}`} id="guest-document-type" name="document_type" onChange={onChange} value={form.document_type}>{DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><FieldError id="guest-document-type-error" message={fieldErrors.document_type} /></div><GuestField error={fieldErrors.document_number} id="guest-document-number" label="Número de documento" name="document_number" onChange={onChange} value={form.document_number} /><div className="sm:col-span-2"><label className="block text-sm font-semibold" htmlFor="guest-internal-notes">Notas internas</label><textarea aria-describedby={fieldErrors.internal_notes ? 'guest-internal-notes-error' : undefined} aria-invalid={Boolean(fieldErrors.internal_notes)} className={`${FIELD_CLASS} min-h-28 py-2 ${fieldErrors.internal_notes ? 'border-cruce-danger' : ''}`} id="guest-internal-notes" maxLength={2000} name="internal_notes" onChange={onChange} value={form.internal_notes} /><FieldError id="guest-internal-notes-error" message={fieldErrors.internal_notes} /></div><div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row"><button className="min-h-11 rounded-md bg-cruce-amber px-4 py-2 text-sm font-semibold text-cruce-ink hover:bg-cruce-amber/80 focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-paper disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? 'Guardando…' : editingGuest ? 'Guardar cambios' : 'Crear huésped'}</button><button className="min-h-11 rounded-md border border-cruce-line px-4 py-2 text-sm font-semibold hover:bg-cruce-ivory focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-paper disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={onCancel} type="button">Cancelar</button></div></form></section>
}

function GuestField({ error, id, inputRef, label, name, onChange, required, type = 'text', value }) {
  const errorId = `${id}-error`
  return <div><label className="block text-sm font-semibold" htmlFor={id}>{label}</label><input aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} className={`${FIELD_CLASS} ${error ? 'border-cruce-danger' : ''}`} id={id} maxLength={name === 'display_name' ? 150 : name === 'phone' ? 32 : name === 'document_number' ? 32 : 254} name={name} onChange={onChange} ref={inputRef} required={required} type={type} value={value} /><FieldError id={errorId} message={error} /></div>
}

function GuestTable({ guests, isBusy, onDelete, onDetails, onEdit }) {
  return <div className="mt-6 max-w-6xl overflow-hidden rounded-xl border border-cruce-line bg-cruce-paper shadow-sm"><div aria-label="Huéspedes registrados" className="overflow-x-auto overscroll-x-contain focus:outline-none focus-visible:ring-2 focus-visible:ring-cruce-focus focus-visible:ring-inset" role="region" tabIndex={0}><table className="w-full min-w-[44rem] text-left"><caption className="sr-only">Huéspedes registrados</caption><thead><tr className="border-b border-cruce-line bg-cruce-ivory text-xs tracking-[0.12em] text-cruce-muted uppercase"><th className="px-4 py-3.5" scope="col">Nombre</th><th className="px-4 py-3.5" scope="col">Correo electrónico</th><th className="px-4 py-3.5" scope="col">Teléfono</th><th className="px-4 py-3.5 text-right" scope="col">Acciones</th></tr></thead><tbody>{guests.map((guest) => <tr className="border-b border-cruce-line/80 last:border-0 hover:bg-cruce-ivory/70" key={guest.id}><td className="px-4 py-4 font-semibold text-cruce-ink">{guest.display_name}</td><td className="px-4 py-4 text-cruce-ink">{guest.email || '—'}</td><td className="px-4 py-4 text-cruce-ink">{guest.phone || '—'}</td><td className="px-4 py-4"><div className="flex flex-nowrap justify-end gap-2"><button aria-label={`Ver detalles de ${guest.display_name}`} className="min-h-11 rounded-md border border-cruce-line px-3 text-sm font-semibold hover:bg-cruce-ivory focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2" disabled={isBusy} onClick={(event) => onDetails(event, guest)} type="button">Ver</button><button aria-label={`Editar huésped ${guest.display_name}`} className="min-h-11 rounded-md border border-cruce-line px-3 text-sm font-semibold hover:bg-cruce-ivory focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2" disabled={isBusy} onClick={(event) => onEdit(event, guest)} type="button">Editar</button><button aria-label={`Eliminar huésped ${guest.display_name}`} className="min-h-11 rounded-md border border-cruce-danger/55 px-3 text-sm font-semibold text-cruce-danger hover:bg-cruce-danger-soft focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2" disabled={isBusy} onClick={(event) => onDelete(event, guest)} type="button">Eliminar</button></div></td></tr>)}</tbody></table></div></div>
}

function DeleteDialog({ cancelRef, dialogRef, guest, isDeleting, onCancel, onConfirm }) {
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-cruce-ink/80 p-4 sm:items-center sm:p-6"><section aria-busy={isDeleting ? 'true' : undefined} aria-describedby="delete-guest-description" aria-labelledby="delete-guest-title" aria-modal="true" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-cruce-danger/45 bg-cruce-paper p-4 text-cruce-ink shadow-2xl focus:outline-none sm:p-6" ref={dialogRef} role="alertdialog" tabIndex={-1}><p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">Acción permanente</p><h2 className="display-font mt-2 text-2xl" id="delete-guest-title">Eliminar huésped {guest.display_name}</h2><p className="mt-3 leading-7 text-cruce-muted" id="delete-guest-description">El huésped <strong>{guest.display_name}</strong> se eliminará de forma permanente. Esta acción no se puede deshacer.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><button className="min-h-11 rounded-md bg-cruce-danger px-4 py-2 text-sm font-semibold text-white hover:bg-cruce-terracotta focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2 focus:ring-offset-cruce-paper disabled:cursor-not-allowed disabled:opacity-60" disabled={isDeleting} onClick={onConfirm} type="button">{isDeleting ? 'Eliminando…' : `Sí, eliminar ${guest.display_name}`}</button><button className="min-h-11 rounded-md border border-cruce-line px-4 py-2 text-sm font-semibold hover:bg-cruce-ivory focus:outline-none focus:ring-2 focus:ring-cruce-focus focus:ring-offset-2" disabled={isDeleting} onClick={onCancel} ref={cancelRef} type="button">Cancelar</button></div></section></div>
}
