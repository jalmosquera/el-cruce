export function toOffsetDateTime(localDateTime) {
  if (!localDateTime) return ''

  const date = new Date(localDateTime)
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(offset)
  const hours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0')
  const minutes = String(absoluteOffset % 60).padStart(2, '0')
  return `${localDateTime}:00${sign}${hours}:${minutes}`
}

export function toLocalDateTime(isoDateTime) {
  if (!isoDateTime) return ''
  const date = new Date(isoDateTime)
  const offset = -date.getTimezoneOffset()
  const local = new Date(date.getTime() + offset * 60_000)
  return local.toISOString().slice(0, 16)
}
