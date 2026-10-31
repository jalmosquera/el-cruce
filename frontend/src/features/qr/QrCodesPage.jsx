import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as qrCodesApi from './qrCodesApi.js'
import { publicQrUrl } from './publicQrUrl.js'
import { useQrCodes } from './useQrCodes.js'
import { useModalDialog } from '../rooms/useModalDialog.js'

const EMPTY_FORM = { name: '', target_path: '/carta', is_active: true }
const FIELD_ORDER = ['name', 'target_path', 'is_active']
const FIELD_CLASS = 'mt-2 min-h-11 w-full rounded-md border border-cruce-line bg-cruce-paper px-3 text-cruce-ink shadow-xs outline-none focus:border-cruce-focus focus:ring-2 focus:ring-cruce-focus disabled:cursor-not-allowed disabled:bg-cruce-ivory'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function QrCodesPage({ qrCodesService = qrCodesApi, siteUrl }) {
  const { qrCodes, isLoading, loadError, isSaving, fieldErrors, actionError, feedback, reload, save, resetErrors, setFieldErrors, clearFieldError } = useQrCodes(qrCodesService)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [preview, setPreview] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState('')
  const nameRef = useRef(null)
  const targetPathRef = useRef(null)
  const isActiveRef = useRef(null)
  const triggerRef = useRef(null)
  const previewCloseRef = useRef(null)
  const previewTriggerRef = useRef(null)

  const previewDialogRef = useModalDialog({
    isOpen: Boolean(preview),
    onClose: closePreview,
    initialFocusRef: previewCloseRef,
  })

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  useEffect(() => { if (editing) nameRef.current?.focus() }, [editing])
  useEffect(() => {
    const refs = { name: nameRef, target_path: targetPathRef, is_active: isActiveRef }
    const firstInvalidField = FIELD_ORDER.find((field) => fieldErrors[field])
    refs[firstInvalidField]?.current?.focus()
  }, [fieldErrors])
  useEffect(() => {
    if (!preview) {
      const focusTarget = previewTriggerRef.current
      if (focusTarget) {
        previewTriggerRef.current = null
        focusTarget.focus()
      }
      return undefined
    }

    const dashboardShell = document.querySelector('[data-dashboard-shell]')
    if (!dashboardShell) return undefined

    const wasInert = dashboardShell.hasAttribute('inert')
    dashboardShell.setAttribute('inert', '')

    return () => {
      if (!wasInert) dashboardShell.removeAttribute('inert')
    }
  }, [preview])

  function openForm(event, record = null) {
    triggerRef.current = event.currentTarget
    setEditing(record || {})
    setForm(record ? { name: record.name, target_path: record.target_path, is_active: record.is_active } : EMPTY_FORM)
    resetErrors()
  }
  function closeForm() { setEditing(null); resetErrors(); triggerRef.current?.focus() }
  function change(event) {
    const { name, value, checked, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    clearFieldError(name)
  }
  async function submit(event) {
    event.preventDefault()
    const values = { ...form, name: form.name.trim() }
    if (!values.name) {
      setFieldErrors({ name: 'Ingresá un nombre para el código QR.' })
      return
    }
    if (await save(editing.id ? editing : null, values)) closeForm()
  }
  async function openPreview(event, record) {
    previewTriggerRef.current = event.currentTarget
    setPreview(record); setPreviewError(''); setIsPreviewLoading(true)
    setPreviewUrl('')
    try { setPreviewUrl(URL.createObjectURL(await qrCodesService.fetchQrCodeFile(record.id, 'svg'))) }
    catch { setPreviewError('No pudimos cargar la vista previa del código QR.') }
    finally { setIsPreviewLoading(false) }
  }
  function closePreview() { setPreviewUrl(''); setPreview(null) }
  async function download(record, format) {
    try { triggerDownload(await qrCodesService.fetchQrCodeFile(record.id, format), `qr-code-${record.identifier}.${format}`) }
    catch { setPreviewError('No pudimos descargar el código QR. Intentá nuevamente.') }
  }
  async function copyUrl(record) {
    const url = publicQrUrl(record.identifier, siteUrl)
    try { await navigator.clipboard.writeText(url); setCopyFeedback('URL pública copiada.') }
    catch { setCopyFeedback('No pudimos copiar la URL. Copiala manualmente.') }
  }
  const formIsEdit = Boolean(editing?.id)
  const stableUrl = preview ? publicQrUrl(preview.identifier, siteUrl) : ''
  const fieldErrorFields = FIELD_ORDER.filter((field) => fieldErrors[field])

  return <section aria-labelledby="qr-codes-title">
    <div className="max-w-6xl border-b border-cruce-line pb-6 sm:flex sm:items-end sm:justify-between sm:gap-6">
      <div><p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">Administración</p><h1 className="display-font mt-2 text-3xl sm:text-4xl" id="qr-codes-title">Códigos QR</h1><p className="mt-3 max-w-2xl leading-7 text-cruce-muted">Creá enlaces QR estables para contenidos públicos autorizados.</p></div>
      <button className="mt-5 min-h-11 w-full rounded-md bg-cruce-ink px-4 py-2 text-sm font-semibold text-cruce-ivory sm:mt-0 sm:w-auto" onClick={(event) => openForm(event)} type="button">Nuevo código QR</button>
    </div>
    {loadError && <div className="mt-6 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert">{loadError}<button className="ml-3 underline" onClick={reload} type="button">Reintentar</button></div>}
    {actionError && <p className="mt-6 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert">{actionError}</p>}
    {feedback && <p className="mt-6 rounded-md border border-cruce-success/30 bg-cruce-success-soft p-4 text-cruce-success" role="status">{feedback}</p>}
    {copyFeedback && <p className="mt-4 text-sm text-cruce-success" role="status">{copyFeedback}</p>}
    {editing && <section aria-labelledby="qr-form-title" className="mt-6 max-w-3xl rounded-xl border border-cruce-line bg-cruce-paper p-4 shadow-sm sm:p-6"><h2 className="display-font text-2xl" id="qr-form-title">{formIsEdit ? `Editar ${editing.name}` : 'Nuevo código QR'}</h2>{formIsEdit && <p className="mt-2 text-sm text-cruce-muted">El identificador público es permanente y no se puede modificar.</p>}{fieldErrorFields.length > 0 && <div aria-labelledby="qr-form-error-summary-title" className="mt-4 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert"><h3 className="text-sm font-semibold" id="qr-form-error-summary-title">Revisá los datos del formulario.</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{fieldErrorFields.map((field) => <li key={field}>{fieldErrors[field]}</li>)}</ul></div>}<form className="mt-4 grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}><div><label className="text-sm font-semibold" htmlFor="qr-name">Nombre</label><input aria-describedby={fieldErrors.name ? 'qr-name-error' : undefined} aria-invalid={Boolean(fieldErrors.name)} className={`${FIELD_CLASS} ${fieldErrors.name ? 'border-cruce-danger' : ''}`} id="qr-name" maxLength="120" name="name" onChange={change} ref={nameRef} required value={form.name}/>{fieldErrors.name && <p className="mt-1 text-sm text-cruce-danger" id="qr-name-error">{fieldErrors.name}</p>}</div><div><label className="text-sm font-semibold" htmlFor="qr-target">Destino</label><select aria-describedby={fieldErrors.target_path ? 'qr-target-error' : undefined} aria-invalid={Boolean(fieldErrors.target_path)} className={`${FIELD_CLASS} ${fieldErrors.target_path ? 'border-cruce-danger' : ''}`} id="qr-target" name="target_path" onChange={change} ref={targetPathRef} value={form.target_path}><option value="/carta">Carta</option></select>{fieldErrors.target_path && <p className="mt-1 text-sm text-cruce-danger" id="qr-target-error">{fieldErrors.target_path}</p>}</div><label className="flex min-h-11 items-center gap-3 text-sm font-semibold sm:col-span-2"><input aria-describedby={fieldErrors.is_active ? 'qr-is-active-error' : undefined} aria-invalid={Boolean(fieldErrors.is_active)} checked={form.is_active} className={`size-5 accent-cruce-ink ${fieldErrors.is_active ? 'outline outline-2 outline-cruce-danger' : ''}`} id="qr-is-active" name="is_active" onChange={change} ref={isActiveRef} type="checkbox"/>Código QR activo</label>{fieldErrors.is_active && <p className="-mt-3 text-sm text-cruce-danger sm:col-span-2" id="qr-is-active-error">{fieldErrors.is_active}</p>}<div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row"><button className="min-h-11 rounded-md bg-cruce-amber px-4 py-2 text-sm font-semibold" disabled={isSaving} type="submit">{isSaving ? 'Guardando…' : formIsEdit ? 'Guardar cambios' : 'Crear código QR'}</button><button className="min-h-11 rounded-md border border-cruce-line px-4 py-2 text-sm font-semibold" disabled={isSaving} onClick={closeForm} type="button">Cancelar</button></div></form></section>}
    {isLoading && <p className="mt-6" role="status">Cargando códigos QR…</p>}
    {!isLoading && !loadError && qrCodes.length === 0 && <p className="mt-6 rounded-xl border border-dashed border-cruce-line bg-cruce-paper p-6 text-cruce-muted">Todavía no hay códigos QR registrados.</p>}
    {!isLoading && qrCodes.length > 0 && <div className="mt-6 overflow-hidden rounded-xl border border-cruce-line bg-cruce-paper shadow-sm"><div aria-label="Códigos QR registrados" className="overflow-x-auto" role="region" tabIndex="0"><table className="w-full min-w-[44rem] text-left"><caption className="sr-only">Códigos QR registrados</caption><thead><tr className="border-b border-cruce-line bg-cruce-ivory text-xs uppercase"><th className="px-4 py-3" scope="col">Nombre</th><th className="px-4 py-3" scope="col">Estado</th><th className="px-4 py-3" scope="col">URL pública</th><th className="px-4 py-3 text-right" scope="col">Acciones</th></tr></thead><tbody>{qrCodes.map((record) => <tr className="border-b border-cruce-line/80 last:border-0" key={record.id}><td className="px-4 py-4 font-semibold">{record.name}</td><td className="px-4 py-4">{record.is_active ? 'Activo' : 'Inactivo'}</td><td className="px-4 py-4 text-sm"><code>{publicQrUrl(record.identifier, siteUrl)}</code></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button aria-label={`Copiar URL de ${record.name}`} className="min-h-11 rounded-md border border-cruce-line px-3 text-sm font-semibold" onClick={() => copyUrl(record)} type="button">Copiar</button><button aria-label={`Vista previa de ${record.name}`} className="min-h-11 rounded-md border border-cruce-line px-3 text-sm font-semibold" onClick={(event) => openPreview(event, record)} type="button">Vista previa</button><button aria-label={`Editar código QR ${record.name}`} className="min-h-11 rounded-md border border-cruce-line px-3 text-sm font-semibold" onClick={(event) => openForm(event, record)} type="button">Editar</button></div></td></tr>)}</tbody></table></div></div>}
    {preview && createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-cruce-ink/80 p-4"><section aria-labelledby="qr-preview-title" aria-modal="true" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-cruce-paper p-5 shadow-2xl" ref={previewDialogRef} role="dialog" tabIndex="-1"><h2 className="display-font text-2xl" id="qr-preview-title">Vista previa: {preview.name}</h2><p className="mt-2 break-all text-sm text-cruce-muted">{stableUrl}</p>{isPreviewLoading && <p className="mt-4" role="status">Cargando vista previa…</p>}{previewError && <p className="mt-4 text-cruce-danger" role="alert">{previewError}</p>}{previewUrl && <img alt={`Código QR para ${preview.name}`} className="mx-auto mt-4 aspect-square w-full max-w-xs bg-white" src={previewUrl}/>}<div className="mt-5 flex flex-col gap-2 sm:flex-row"><button className="min-h-11 rounded-md bg-cruce-amber px-4 py-2 text-sm font-semibold" onClick={() => download(preview, 'svg')} type="button">Descargar SVG</button><button className="min-h-11 rounded-md border border-cruce-line px-4 py-2 text-sm font-semibold" onClick={() => download(preview, 'png')} type="button">Descargar PNG</button><button className="min-h-11 rounded-md border border-cruce-line px-4 py-2 text-sm font-semibold" onClick={closePreview} ref={previewCloseRef} type="button">Cerrar</button></div></section></div>, document.body)}
  </section>
}
