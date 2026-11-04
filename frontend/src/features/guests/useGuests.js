import { useCallback, useEffect, useState } from 'react'
import * as guestsApi from './guestsApi.js'

export const GUEST_IN_USE_MESSAGE = 'Este huésped está asociado a reservas y no se puede eliminar.'

const LOAD_ERROR = 'No pudimos cargar los huéspedes. Intentá nuevamente.'
const SAVE_ERROR = 'No pudimos guardar el huésped. Revisá los datos e intentá nuevamente.'
const DELETE_ERROR = 'No pudimos eliminar el huésped. Intentá nuevamente.'
const FIELD_NAMES = ['display_name', 'email', 'phone', 'document_type', 'document_number', 'internal_notes']

function firstMessage(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : ''
  }

  return typeof value === 'string' ? value : ''
}

function normalizeFieldErrors(data) {
  if (!data || typeof data !== 'object') {
    return {}
  }

  return FIELD_NAMES.reduce((errors, field) => {
    const message = firstMessage(data[field])
    if (message) {
      errors[field] = message
    }
    return errors
  }, {})
}

function getErrorMessage(error, fallback) {
  const status = error?.response?.status
  if (status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.'
  if (status === 403) return 'No tenés permisos para administrar huéspedes.'
  if (status === 409) return GUEST_IN_USE_MESSAGE
  return firstMessage(error?.response?.data?.non_field_errors) || fallback
}

function sortByName(guests) {
  return [...guests].sort((first, second) => first.display_name.localeCompare(second.display_name, 'es'))
}

export function useGuests(guestsService = guestsApi) {
  const [guests, setGuests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [actionError, setActionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  const reload = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    setRequestVersion((version) => version + 1)
  }, [])

  useEffect(() => {
    let isCurrentRequest = true
    async function loadGuests() {
      try {
        const data = await guestsService.listGuests()
        if (!Array.isArray(data)) throw new Error('Guests list response is not an array.')
        if (isCurrentRequest) setGuests(sortByName(data))
      } catch (error) {
        if (isCurrentRequest) setLoadError(getErrorMessage(error, LOAD_ERROR))
      } finally {
        if (isCurrentRequest) setIsLoading(false)
      }
    }
    loadGuests()
    return () => { isCurrentRequest = false }
  }, [guestsService, requestVersion])

  const resetErrors = useCallback(() => {
    setFieldErrors({})
    setActionError('')
  }, [])

  const clearFieldError = useCallback((field) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }, [])

  const applyMutationError = useCallback((error, fallback) => {
    const data = error?.response?.data
    const nextFieldErrors = normalizeFieldErrors(data)
    const hasNonFieldError = Boolean(firstMessage(data?.non_field_errors))
    setFieldErrors(nextFieldErrors)
    setActionError(error?.response?.status === 400 && Object.keys(nextFieldErrors).length && !hasNonFieldError ? '' : getErrorMessage(error, fallback))
  }, [])

  const createGuest = useCallback(async (values) => {
    setIsSaving(true); resetErrors(); setFeedback('')
    try {
      const createdGuest = await guestsService.createGuest(values)
      setGuests((current) => sortByName([...current, createdGuest]))
      setFeedback(`Huésped ${createdGuest.display_name} creado.`)
      return createdGuest
    } catch (error) {
      applyMutationError(error, SAVE_ERROR)
      return null
    } finally { setIsSaving(false) }
  }, [applyMutationError, guestsService, resetErrors])

  const updateGuest = useCallback(async (id, values) => {
    setIsSaving(true); resetErrors(); setFeedback('')
    try {
      const updatedGuest = await guestsService.updateGuest(id, values)
      setGuests((current) => sortByName(current.map((guest) => guest.id === updatedGuest.id ? updatedGuest : guest)))
      setFeedback(`Huésped ${updatedGuest.display_name} actualizado.`)
      return updatedGuest
    } catch (error) {
      applyMutationError(error, SAVE_ERROR)
      return null
    } finally { setIsSaving(false) }
  }, [applyMutationError, guestsService, resetErrors])

  const deleteGuest = useCallback(async (guest) => {
    setIsDeleting(true); resetErrors(); setFeedback('')
    try {
      await guestsService.removeGuest(guest.id)
      setGuests((current) => current.filter((item) => item.id !== guest.id))
      setFeedback(`Huésped ${guest.display_name} eliminado.`)
      return true
    } catch (error) {
      applyMutationError(error, DELETE_ERROR)
      return false
    } finally { setIsDeleting(false) }
  }, [applyMutationError, guestsService, resetErrors])

  return { guests, isLoading, loadError, isSaving, isDeleting, fieldErrors, actionError, feedback, reload, createGuest, updateGuest, deleteGuest, resetErrors, setFieldErrors, clearFieldError }
}
