import { useCallback, useEffect, useState } from 'react'
import * as qrCodesApi from './qrCodesApi.js'

const FIELDS = ['name', 'target_path', 'is_active']

function firstMessage(value) {
  return Array.isArray(value) ? value[0] : value
}

function messageFor(error, fallback) {
  if (error?.response?.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.'
  if (error?.response?.status === 403) return 'No tenés permisos para administrar códigos QR.'
  return firstMessage(error?.response?.data?.non_field_errors) || fallback
}

export function useQrCodes(qrCodesService = qrCodesApi) {
  const [qrCodes, setQrCodes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [actionError, setActionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    setReloadKey((value) => value + 1)
  }, [])
  const clearFieldError = useCallback((field) => setFieldErrors((current) => {
    if (!current[field]) return current
    const next = { ...current }
    delete next[field]
    return next
  }), [])
  const resetErrors = useCallback(() => {
    setFieldErrors({})
    setActionError('')
  }, [])

  useEffect(() => {
    let current = true
    qrCodesService.listQrCodes()
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('QR code list response is not an array.')
        if (current) setQrCodes(data)
      })
      .catch((error) => current && setLoadError(messageFor(error, 'No pudimos cargar los códigos QR. Intentá nuevamente.')))
      .finally(() => current && setIsLoading(false))
    return () => { current = false }
  }, [qrCodesService, reloadKey])

  const save = useCallback(async (record, values) => {
    setIsSaving(true)
    resetErrors()
    setFeedback('')
    try {
      const saved = record
        ? await qrCodesService.updateQrCode(record.id, values)
        : await qrCodesService.createQrCode(values)
      setQrCodes((current) => record
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved])
      setFeedback(record ? `Código QR «${saved.name}» actualizado.` : `Código QR «${saved.name}» creado.`)
      return saved
    } catch (error) {
      const data = error?.response?.data
      const errors = FIELDS.reduce((result, field) => {
        const message = firstMessage(data?.[field])
        if (typeof message === 'string') result[field] = message
        return result
      }, {})
      setFieldErrors(errors)
      if (Object.keys(errors).length === 0 || firstMessage(data?.non_field_errors)) {
        setActionError(messageFor(error, 'No pudimos guardar el código QR. Intentá nuevamente.'))
      }
      return null
    } finally {
      setIsSaving(false)
    }
  }, [qrCodesService, resetErrors])

  return { qrCodes, isLoading, loadError, isSaving, fieldErrors, actionError, feedback, reload, save, resetErrors, setFieldErrors, clearFieldError }
}
