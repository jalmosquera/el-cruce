export const STATUS_DETAILS = {
  pending: { label: 'Pendiente', next: ['confirmed', 'cancelled'] },
  confirmed: { label: 'Confirmada', next: ['checked_in', 'cancelled', 'no_show'] },
  checked_in: { label: 'En estancia', next: ['checked_out'] },
  checked_out: { label: 'Finalizada', next: [] },
  cancelled: { label: 'Cancelada', next: [] },
  no_show: { label: 'No se presentó', next: [] },
}

export function dateInRange(date, checkIn, checkOut) {
  return date >= checkIn && date < checkOut
}

export function rangeDates(start, end) {
  const dates = []
  const cursor = new Date(`${start}T12:00:00Z`)
  const last = new Date(`${end}T12:00:00Z`)
  while (cursor < last) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

export function errorMessage(error, fallback) {
  const status = error?.response?.status
  if (status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.'
  if (status === 403) return 'No tenés permisos para administrar reservas.'
  const data = error?.response?.data
  const detail = data?.detail
  if (typeof detail === 'string') return detail
  const statusError = data?.status
  if (Array.isArray(statusError) && typeof statusError[0] === 'string') return statusError[0]
  const nonField = data?.non_field_errors
  if (Array.isArray(nonField) && typeof nonField[0] === 'string') return nonField[0]
  return fallback
}

export function fieldErrors(error) {
  const data = error?.response?.data
  if (!data || typeof data !== 'object') return {}
  return ['room', 'guest', 'check_in', 'check_out', 'guest_count', 'status', 'internal_notes'].reduce((errors, field) => {
    const value = data[field]
    if (Array.isArray(value) && typeof value[0] === 'string') errors[field] = value[0]
    return errors
  }, {})
}
