export function maskDocumentNumber(value) {
  if (!value) return 'No registrado'
  return `•••• ${value.slice(-4)}`
}

export function filterGuests(guests, query, documentFilter) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  return guests.filter((guest) => {
    const matchesSearch = !normalizedQuery || [guest.display_name, guest.email, guest.phone]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery))
    const hasDocument = Boolean(guest.document_number)
    return matchesSearch && (documentFilter === 'all' || (documentFilter === 'with-document' ? hasDocument : !hasDocument))
  })
}
