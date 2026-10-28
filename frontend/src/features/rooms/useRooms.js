import { useCallback, useEffect, useState } from 'react'
import * as roomsApi from './roomsApi.js'

export const ROOM_IN_USE_MESSAGE =
  'Esta habitación está referenciada por reservas y no se puede eliminar.'

const LOAD_ERROR = 'No pudimos cargar las habitaciones. Intentá nuevamente.'
const SAVE_ERROR = 'No pudimos guardar la habitación. Revisá los datos e intentá nuevamente.'
const DELETE_ERROR = 'No pudimos eliminar la habitación. Intentá nuevamente.'

const FIELD_NAMES = ['code', 'name', 'capacity', 'status']

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

  if (status === 401) {
    return 'Tu sesión expiró. Volvé a iniciar sesión.'
  }

  if (status === 403) {
    return 'No tenés permisos para administrar habitaciones.'
  }

  if (status === 409) {
    return ROOM_IN_USE_MESSAGE
  }

  const nonFieldError = firstMessage(error?.response?.data?.non_field_errors)
  return nonFieldError || fallback
}

function sortByCode(rooms) {
  return [...rooms].sort((first, second) => first.code.localeCompare(second.code))
}

export function useRooms(roomsService = roomsApi) {
  const [rooms, setRooms] = useState([])
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

    async function loadRooms() {
      try {
        const data = await roomsService.listRooms()

        if (!Array.isArray(data)) {
          throw new Error('Rooms list response is not an array.')
        }

        if (isCurrentRequest) {
          setRooms(sortByCode(data))
        }
      } catch (error) {
        if (isCurrentRequest) {
          setLoadError(getErrorMessage(error, LOAD_ERROR))
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoading(false)
        }
      }
    }

    loadRooms()

    return () => {
      isCurrentRequest = false
    }
  }, [requestVersion, roomsService])

  const resetErrors = useCallback(() => {
    setFieldErrors({})
    setActionError('')
  }, [])

  const clearFieldError = useCallback((field) => {
    setFieldErrors((currentFieldErrors) => {
      if (!currentFieldErrors[field]) {
        return currentFieldErrors
      }

      const nextFieldErrors = { ...currentFieldErrors }
      delete nextFieldErrors[field]
      return nextFieldErrors
    })
  }, [])

  const applyMutationError = useCallback((error, fallback) => {
    const data = error?.response?.data
    const nextFieldErrors = normalizeFieldErrors(data)
    const hasFieldErrors = Object.keys(nextFieldErrors).length > 0
    const hasNonFieldError = Boolean(firstMessage(data?.non_field_errors))
    const isFieldOnlyValidation =
      error?.response?.status === 400 && hasFieldErrors && !hasNonFieldError

    setFieldErrors(nextFieldErrors)
    setActionError(isFieldOnlyValidation ? '' : getErrorMessage(error, fallback))
  }, [])

  const createRoom = useCallback(
    async (values) => {
      setIsSaving(true)
      setFieldErrors({})
      setActionError('')
      setFeedback('')

      try {
        const createdRoom = await roomsService.createRoom(values)
        setRooms((currentRooms) => sortByCode([...currentRooms, createdRoom]))
        setFeedback(`Habitación ${createdRoom.code} creada.`)
        return createdRoom
      } catch (error) {
        applyMutationError(error, SAVE_ERROR)
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [applyMutationError, roomsService],
  )

  const updateRoom = useCallback(
    async (id, values) => {
      setIsSaving(true)
      setFieldErrors({})
      setActionError('')
      setFeedback('')

      try {
        const updatedRoom = await roomsService.updateRoom(id, values)
        setRooms((currentRooms) =>
          sortByCode(currentRooms.map((room) => (room.id === updatedRoom.id ? updatedRoom : room))),
        )
        setFeedback(`Habitación ${updatedRoom.code} actualizada.`)
        return updatedRoom
      } catch (error) {
        applyMutationError(error, SAVE_ERROR)
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [applyMutationError, roomsService],
  )

  const deleteRoom = useCallback(
    async (room) => {
      setIsDeleting(true)
      setFieldErrors({})
      setActionError('')
      setFeedback('')

      try {
        await roomsService.removeRoom(room.id)
        setRooms((currentRooms) => currentRooms.filter((item) => item.id !== room.id))
        setFeedback(`Habitación ${room.code} eliminada.`)
        return true
      } catch (error) {
        applyMutationError(error, DELETE_ERROR)
        return false
      } finally {
        setIsDeleting(false)
      }
    },
    [applyMutationError, roomsService],
  )

  return {
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
  }
}
