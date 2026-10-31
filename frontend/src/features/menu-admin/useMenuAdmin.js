import { useCallback, useEffect, useState } from 'react'
import { menuAdminApi } from './menuAdminApi.js'

function firstMessage(value) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

export function fieldErrorsFrom(error, fields) {
  const data = error?.response?.data
  if (!data || typeof data !== 'object') return {}
  return fields.reduce((errors, field) => {
    const message = firstMessage(data[field])
    if (message) errors[field] = message
    return errors
  }, {})
}

function messageFor(error, fallback) {
  if (error?.response?.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.'
  if (error?.response?.status === 403) return 'No tenés permisos para administrar la carta.'
  return firstMessage(error?.response?.data?.non_field_errors) || fallback
}

function sortDishes(dishes) {
  return [...dishes].sort((first, second) => first.visible_number - second.visible_number || first.id - second.id)
}

export function useMenuAdmin(service = menuAdminApi) {
  const [data, setData] = useState({ categories: [], dishes: [], categoryTranslations: [], dishTranslations: [] })
  const [preview, setPreview] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [requestVersion, setRequestVersion] = useState(0)
  const [previewLanguage, setPreviewLanguage] = useState('es')

  const reload = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    setRequestVersion((version) => version + 1)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [categories, dishes, categoryTranslations, dishTranslations, preview] = await Promise.all([
          service.categories.list(), service.dishes.list(), service.categoryTranslations.list(), service.dishTranslations.list(), service.fetchPublicPreview(previewLanguage),
        ])
        if (![categories, dishes, categoryTranslations, dishTranslations].every(Array.isArray)) throw new Error('Invalid menu list payload.')
        if (active) {
          setData({ categories, dishes: sortDishes(dishes), categoryTranslations, dishTranslations })
          setPreview(preview)
        }
      } catch (error) {
        if (active) setLoadError(messageFor(error, 'No pudimos cargar la carta. Intentá nuevamente.'))
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [previewLanguage, requestVersion, service])

  const refreshPreview = useCallback(async () => {
    try {
      setPreview(await service.fetchPublicPreview(previewLanguage))
      return true
    } catch {
      setActionError('El cambio se guardó, pero no pudimos actualizar la vista pública. Intentá recargarla.')
      return false
    }
  }, [previewLanguage, service])

  const save = useCallback(async (collection, item, values, fields) => {
    setIsSaving(true)
    setActionError('')
    setFeedback('')
    try {
      const saved = item ? await service[collection].update(item.id, values) : await service[collection].create(values)
      setData((current) => ({
        ...current,
        [collection]: collection === 'dishes'
          ? sortDishes(item ? current[collection].map((entry) => entry.id === saved.id ? saved : entry) : [...current[collection], saved])
          : item ? current[collection].map((entry) => entry.id === saved.id ? saved : entry) : [...current[collection], saved],
      }))
      // Read the public contract instead of deriving published output from
      // management records. This also captures publication rules on the API.
      await refreshPreview()
      setFeedback('Cambios guardados.')
      return { saved, errors: {} }
    } catch (error) {
      const errors = fieldErrorsFrom(error, fields)
      setActionError(Object.keys(errors).length ? '' : messageFor(error, 'No pudimos guardar los cambios. Intentá nuevamente.'))
      return { saved: null, errors }
    } finally {
      setIsSaving(false)
    }
  }, [refreshPreview, service])

  const remove = useCallback(async (collection, item) => {
    setIsSaving(true)
    setActionError('')
    setFeedback('')
    try {
      await service[collection].remove(item.id)
      setData((current) => ({ ...current, [collection]: current[collection].filter((entry) => entry.id !== item.id) }))
      await refreshPreview()
      setFeedback('Elemento eliminado.')
      return true
    } catch (error) {
      setActionError(messageFor(error, 'No pudimos eliminar el elemento. Intentá nuevamente.'))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [refreshPreview, service])

  return { ...data, preview, previewLanguage, isLoading, loadError, actionError, feedback, isSaving, reload, save, remove, setPreviewLanguage, setActionError }
}
