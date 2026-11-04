import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as defaultOperationsService from './operationsApi.js'
import { toLocalDateTime, toOffsetDateTime } from './operationsUtils.js'
import { useConfirmationDialog } from './useConfirmationDialog.js'

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function emptyShiftForm() {
  return { employee: '', startsAt: '', endsAt: '' }
}

function safeErrorMessage(error) {
  if (error?.response?.status === 401) return 'Tu sesión venció. Iniciá sesión nuevamente.'
  if (error?.response?.status === 403) return 'No tenés permisos para realizar esta operación.'
  return 'No pudimos completar la operación. Intentá nuevamente.'
}

function getValidationErrors(error) {
  const data = error?.response?.data
  return data && typeof data === 'object' ? data : {}
}

function ErrorSummary({ errors, formRef }) {
  const entries = Object.entries(errors)
  if (!entries.length) return null

  return (
    <div className="rounded-md border border-destructive/35 bg-destructive-soft p-3 text-destructive" role="alert" tabIndex="-1" ref={formRef}>
      <p className="font-semibold">Revisá los datos del formulario:</p>
      <ul className="mt-1 list-disc pl-5">
        {entries.flatMap(([field, messages]) => (Array.isArray(messages) ? messages : [messages]).map((message) => (
          <li key={`${field}-${message}`}>{field === 'non_field_errors' ? message : `${field}: ${message}`}</li>
        )))}
      </ul>
    </div>
  )
}

function ConfirmDialog({ itemName, isDeleting, onCancel, onConfirm, triggerElement }) {
  const dialogRef = useRef(null)
  const cancelButtonRef = useRef(null)
  const confirmButtonRef = useRef(null)
  useConfirmationDialog({ dialogRef, initialFocusRef: cancelButtonRef, isDeleting, isOpen: true, onClose: onCancel, triggerElement })

  return createPortal(
    <div aria-busy={isDeleting} aria-describedby="confirm-description" aria-labelledby="confirm-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4" ref={dialogRef} role="alertdialog" tabIndex="-1">
      <div className="w-full max-w-md rounded-lg bg-primary p-6 text-primary-foreground shadow-xl">
        <h2 className="display-font text-2xl" id="confirm-title">Confirmar eliminación</h2>
        <p className="mt-3 text-muted-foreground" id="confirm-description">Vas a eliminar {itemName}. Esta acción no se puede deshacer.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button className="min-h-11 rounded-md border border-border px-4 font-semibold focus:outline-none focus:ring-2 focus:ring-focus" disabled={isDeleting} onClick={onCancel} ref={cancelButtonRef} type="button">Cancelar</button>
          <button className="min-h-11 rounded-md bg-destructive px-4 font-semibold text-destructive-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-focus" disabled={isDeleting} onClick={onConfirm} ref={confirmButtonRef} type="button">{isDeleting ? 'Eliminando…' : 'Eliminar'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SectionStatus({ error, isLoading, isEmpty, emptyMessage }) {
  if (isLoading) return <p role="status">Cargando…</p>
  if (error) return <p className="text-destructive" role="alert">{error}</p>
  if (isEmpty) return <p className="text-muted-foreground">{emptyMessage}</p>
  return null
}

export function OperationsPage({ operationsService = defaultOperationsService }) {
  const [directory, setDirectory] = useState([])
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [employeeUserId, setEmployeeUserId] = useState('')
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)
  const [employeeErrors, setEmployeeErrors] = useState({})
  const [shiftForm, setShiftForm] = useState(emptyShiftForm)
  const [editingShiftId, setEditingShiftId] = useState(null)
  const [shiftErrors, setShiftErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const employeeErrorRef = useRef(null)
  const shiftErrorRef = useRef(null)
  const shiftsHeadingRef = useRef(null)
  const pendingFocusRef = useRef(null)

  const loadOperations = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const [userDirectory, employeeList, shiftList] = await Promise.all([
        operationsService.getUserDirectory(), operationsService.getEmployees(), operationsService.getShifts(),
      ])
      setDirectory(userDirectory)
      setEmployees(employeeList)
      setShifts(shiftList)
    } catch (error) {
      setLoadError(safeErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [operationsService])

  useEffect(() => { void Promise.resolve().then(loadOperations) }, [loadOperations]) // Initial server-state synchronization.
  useEffect(() => { if (Object.keys(employeeErrors).length) employeeErrorRef.current?.focus() }, [employeeErrors])
  useEffect(() => { if (Object.keys(shiftErrors).length) shiftErrorRef.current?.focus() }, [shiftErrors])
  useEffect(() => {
    if (confirmation || !pendingFocusRef.current) return
    pendingFocusRef.current.focus()
    pendingFocusRef.current = null
  }, [confirmation])

  const employeeById = Object.fromEntries(employees.map((employee) => [String(employee.id), employee]))
  const userById = Object.fromEntries(directory.map((user) => [String(user.id), user]))
  const sortedShifts = [...shifts].sort((first, second) => new Date(first.starts_at) - new Date(second.starts_at))

  async function handleEmployeeSubmit(event) {
    event.preventDefault()
    setEmployeeErrors({})
    setSubmitError('')
    if (!employeeUserId) {
      setEmployeeErrors({ user: ['Seleccioná un usuario.'] })
      return
    }
    try {
      const employee = editingEmployeeId
        ? await operationsService.updateEmployee(editingEmployeeId, { user: Number(employeeUserId) })
        : await operationsService.createEmployee({ user: Number(employeeUserId) })
      setEmployees((current) => editingEmployeeId ? current.map((item) => item.id === employee.id ? employee : item) : [...current, employee])
      setEmployeeUserId('')
      setEditingEmployeeId(null)
    } catch (error) {
      const errors = getValidationErrors(error)
      if (Object.keys(errors).length) setEmployeeErrors(errors)
      else setSubmitError(safeErrorMessage(error))
    }
  }

  async function handleShiftSubmit(event) {
    event.preventDefault()
    setShiftErrors({})
    setSubmitError('')
    const errors = {}
    if (!shiftForm.employee) errors.employee = ['Seleccioná un empleado.']
    if (!shiftForm.startsAt) errors.starts_at = ['Indicá el inicio.']
    if (!shiftForm.endsAt) errors.ends_at = ['Indicá el fin.']
    if (Object.keys(errors).length) {
      setShiftErrors(errors)
      return
    }
    const payload = {
      employee: Number(shiftForm.employee),
      starts_at: toOffsetDateTime(shiftForm.startsAt),
      ends_at: toOffsetDateTime(shiftForm.endsAt),
    }
    try {
      const shift = editingShiftId
        ? await operationsService.updateShift(editingShiftId, payload)
        : await operationsService.createShift(payload)
      setShifts((current) => editingShiftId ? current.map((item) => item.id === shift.id ? shift : item) : [...current, shift])
      setShiftForm(emptyShiftForm())
      setEditingShiftId(null)
    } catch (error) {
      const errors = getValidationErrors(error)
      if (Object.keys(errors).length) setShiftErrors(errors)
      else setSubmitError(safeErrorMessage(error))
    }
  }

  async function handleConfirmedDelete() {
    if (!confirmation) return
    setIsDeleting(true)
    try {
      if (confirmation.type === 'employee') {
        await operationsService.deleteEmployee(confirmation.id)
        setEmployees((current) => current.filter((employee) => employee.id !== confirmation.id))
      } else {
        await operationsService.deleteShift(confirmation.id)
        setShifts((current) => current.filter((shift) => shift.id !== confirmation.id))
        pendingFocusRef.current = confirmation.successFocusElement
      }
      setConfirmation(null)
    } catch (error) {
      setConfirmation(null)
      setSubmitError(safeErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  function startEditingEmployee(employee) {
    setEditingEmployeeId(employee.id)
    setEmployeeUserId(String(employee.user))
    setEmployeeErrors({})
  }

  function startEditing(shift) {
    setEditingShiftId(shift.id)
    setShiftForm({ employee: String(shift.employee), startsAt: toLocalDateTime(shift.starts_at), endsAt: toLocalDateTime(shift.ends_at) })
    setShiftErrors({})
  }

  return (
    <section className="max-w-6xl">
      <div className="mb-6"><h1 className="display-font text-3xl">Operaciones</h1><p className="mt-2 text-muted-foreground">Gestioná las asignaciones internas sin mostrar perfiles personales.</p></div>
      {submitError ? <p className="mb-4 rounded-md border border-destructive/35 bg-destructive-soft p-3 text-destructive" role="alert">{submitError}</p> : null}
      <SectionStatus error={loadError} isLoading={isLoading} />
      {!isLoading && !loadError ? <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-lg border border-border bg-cruce-paper p-5 shadow-sm">
          <h2 className="display-font text-2xl">Empleados</h2>
          <form className="mt-4 space-y-3" onSubmit={handleEmployeeSubmit} noValidate>
            <label className="block font-medium" htmlFor="employee-user">Usuario interno <span aria-hidden="true">*</span></label>
            <select className="min-h-11 w-full rounded-md border border-border bg-cruce-paper px-3 focus:outline-none focus:ring-2 focus:ring-focus" id="employee-user" onChange={(event) => setEmployeeUserId(event.target.value)} value={employeeUserId} aria-describedby={employeeErrors.user ? 'employee-user-error' : undefined}>
              <option value="">Seleccioná un usuario</option>
              {directory.map((user) => <option key={user.id} value={user.id}>{user.username} — {user.role}</option>)}
            </select>
            {employeeErrors.user ? <p className="text-sm text-destructive" id="employee-user-error">{employeeErrors.user.join(' ')}</p> : null}
            <ErrorSummary errors={employeeErrors} formRef={employeeErrorRef} />
            <div className="flex flex-wrap gap-3"><button className="min-h-11 rounded-md bg-cruce-ink px-4 font-semibold text-primary hover:bg-surface focus:outline-none focus:ring-2 focus:ring-focus" type="submit">{editingEmployeeId ? 'Guardar empleado' : 'Agregar empleado'}</button>{editingEmployeeId ? <button className="min-h-11 rounded-md border border-border px-4 font-semibold focus:outline-none focus:ring-2 focus:ring-focus" onClick={() => { setEditingEmployeeId(null); setEmployeeUserId(''); setEmployeeErrors({}) }} type="button">Cancelar edición</button> : null}</div>
          </form>
          <div className="mt-6">
            <h3 className="font-semibold">Equipo registrado</h3>
            <SectionStatus isEmpty={!employees.length} emptyMessage="Todavía no hay empleados registrados." />
            {employees.length ? <ul className="mt-3 divide-y divide-border">{employees.map((employee) => {
              const user = userById[String(employee.user)]
              return <li className="flex items-center justify-between gap-3 py-3" key={employee.id}><span><span className="font-medium">{user?.username ?? `Usuario #${employee.user}`}</span>{user ? <span className="ml-2 text-sm text-muted-foreground">{user.role}</span> : null}</span><span className="flex gap-1"><button className="min-h-11 rounded-md px-3 text-sm font-semibold text-cruce-ink hover:bg-primary focus:outline-none focus:ring-2 focus:ring-focus" onClick={() => startEditingEmployee(employee)} type="button">Editar</button><button className="min-h-11 rounded-md px-3 text-sm font-semibold text-destructive hover:bg-destructive-soft focus:outline-none focus:ring-2 focus:ring-focus" onClick={(event) => setConfirmation({ type: 'employee', id: employee.id, name: user?.username ?? `el empleado #${employee.id}`, triggerElement: event.currentTarget })} type="button">Eliminar</button></span></li>
            })}</ul> : null}
          </div>
        </article>
        <article className="rounded-lg border border-border bg-cruce-paper p-5 shadow-sm">
          <h2 className="display-font text-2xl">Turnos</h2>
          <form className="mt-4 grid gap-3" onSubmit={handleShiftSubmit} noValidate>
            <label className="block font-medium" htmlFor="shift-employee">Empleado <span aria-hidden="true">*</span></label>
            <select aria-invalid={Boolean(shiftErrors.employee)} aria-describedby={shiftErrors.employee ? 'shift-employee-error' : undefined} className="min-h-11 rounded-md border border-border bg-cruce-paper px-3 focus:outline-none focus:ring-2 focus:ring-focus" id="shift-employee" onChange={(event) => setShiftForm((current) => ({ ...current, employee: event.target.value }))} value={shiftForm.employee}><option value="">Seleccioná un empleado</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{userById[String(employee.user)]?.username ?? `Empleado #${employee.id}`}</option>)}</select>
            {shiftErrors.employee ? <p className="text-sm text-destructive" id="shift-employee-error">{shiftErrors.employee.join(' ')}</p> : null}
            <label className="block font-medium" htmlFor="shift-start">Inicio <span aria-hidden="true">*</span></label>
            <input aria-invalid={Boolean(shiftErrors.starts_at)} aria-describedby={shiftErrors.starts_at ? 'shift-start-error' : undefined} className="min-h-11 rounded-md border border-border bg-cruce-paper px-3 focus:outline-none focus:ring-2 focus:ring-focus" id="shift-start" type="datetime-local" value={shiftForm.startsAt} onChange={(event) => setShiftForm((current) => ({ ...current, startsAt: event.target.value }))} />
            {shiftErrors.starts_at ? <p className="text-sm text-destructive" id="shift-start-error">{shiftErrors.starts_at.join(' ')}</p> : null}
            <label className="block font-medium" htmlFor="shift-end">Fin <span aria-hidden="true">*</span></label>
            <input aria-invalid={Boolean(shiftErrors.ends_at)} aria-describedby={shiftErrors.ends_at ? 'shift-end-error' : undefined} className="min-h-11 rounded-md border border-border bg-cruce-paper px-3 focus:outline-none focus:ring-2 focus:ring-focus" id="shift-end" type="datetime-local" value={shiftForm.endsAt} onChange={(event) => setShiftForm((current) => ({ ...current, endsAt: event.target.value }))} />
            {shiftErrors.ends_at ? <p className="text-sm text-destructive" id="shift-end-error">{shiftErrors.ends_at.join(' ')}</p> : null}
            <ErrorSummary errors={shiftErrors} formRef={shiftErrorRef} />
            <div className="flex flex-wrap gap-3"><button className="min-h-11 rounded-md bg-cruce-ink px-4 font-semibold text-primary hover:bg-surface focus:outline-none focus:ring-2 focus:ring-focus" type="submit">{editingShiftId ? 'Guardar turno' : 'Crear turno'}</button>{editingShiftId ? <button className="min-h-11 rounded-md border border-border px-4 font-semibold focus:outline-none focus:ring-2 focus:ring-focus" onClick={() => { setEditingShiftId(null); setShiftForm(emptyShiftForm()); setShiftErrors({}) }} type="button">Cancelar edición</button> : null}</div>
          </form>
          <div className="mt-6"><h3 className="font-semibold" ref={shiftsHeadingRef} tabIndex="-1">Cronología</h3><SectionStatus isEmpty={!shifts.length} emptyMessage="Todavía no hay turnos programados." />
            {shifts.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Turnos ordenados cronológicamente</caption><thead><tr className="border-b border-border"><th className="p-2">Empleado</th><th className="p-2">Inicio</th><th className="p-2">Fin</th><th className="p-2"><span className="sr-only">Acciones</span></th></tr></thead><tbody>{sortedShifts.map((shift) => { const employee = employeeById[String(shift.employee)]; const user = employee && userById[String(employee.user)]; return <tr className="border-b border-border" key={shift.id}><td className="p-2">{user?.username ?? `Empleado #${shift.employee}`}</td><td className="p-2">{DATE_TIME_FORMATTER.format(new Date(shift.starts_at))}</td><td className="p-2">{DATE_TIME_FORMATTER.format(new Date(shift.ends_at))}</td><td className="p-2 whitespace-nowrap"><button className="min-h-11 px-2 font-semibold text-cruce-ink hover:underline focus:outline-none focus:ring-2 focus:ring-focus" onClick={() => startEditing(shift)} type="button">Editar</button><button className="min-h-11 px-2 font-semibold text-destructive hover:underline focus:outline-none focus:ring-2 focus:ring-focus" onClick={(event) => setConfirmation({ type: 'shift', id: shift.id, name: 'este turno', triggerElement: event.currentTarget, successFocusElement: shiftsHeadingRef.current })} type="button">Eliminar</button></td></tr> })}</tbody></table></div> : null}
          </div>
        </article>
      </div> : null}
      {confirmation ? <ConfirmDialog itemName={confirmation.name} isDeleting={isDeleting} onCancel={() => setConfirmation(null)} onConfirm={handleConfirmedDelete} triggerElement={confirmation.triggerElement} /> : null}
    </section>
  )
}
