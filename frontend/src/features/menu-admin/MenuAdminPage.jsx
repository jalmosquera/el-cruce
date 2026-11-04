import { createPortal } from 'react-dom'
import { cloneElement, useEffect, useRef, useState } from 'react'
import { useModalDialog } from '../rooms/useModalDialog.js'
import { useMenuAdmin } from './useMenuAdmin.js'

const LANGUAGES = [{ code: 'es', label: 'Español' }, { code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }, { code: 'de', label: 'Deutsch' }, { code: 'it', label: 'Italiano' }]
const TRANSLATION_LANGUAGES = LANGUAGES.filter((language) => language.code !== 'es')
const FIELD_CLASS = 'mt-1 min-h-11 w-full rounded-md border border-cruce-line bg-cruce-paper px-3 text-cruce-ink outline-none focus:border-cruce-focus focus:ring-2 focus:ring-cruce-focus disabled:cursor-not-allowed disabled:bg-cruce-ivory'

function ErrorMessage({ id, message }) {
  return message ? <p className="mt-1 text-sm text-cruce-danger" id={id} role="alert">{message}</p> : null
}

function Toggle({ checked, label, name, onChange }) {
  return <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input checked={checked} className="size-5 accent-cruce-ink" name={name} onChange={onChange} type="checkbox" />{label}</label>
}

function Modal({ children, isLocked, isOpen, onClose, title }) {
  const closeRef = useRef(null)
  const dialogRef = useModalDialog({ isOpen, isLocked, onClose, initialFocusRef: closeRef })

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-cruce-ink/80 p-4 sm:items-center">
      <section aria-busy={isLocked ? 'true' : undefined} aria-labelledby="menu-dialog-title" aria-modal="true" className="my-auto w-full max-w-2xl rounded-xl bg-cruce-paper p-5 shadow-2xl" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="flex items-start justify-between gap-4"><h2 className="display-font text-2xl" id="menu-dialog-title">{title}</h2><button className="min-h-11 rounded-md border border-cruce-line px-3 font-semibold focus:outline-none focus:ring-2 focus:ring-cruce-focus" disabled={isLocked} onClick={onClose} ref={closeRef} type="button">Cerrar</button></div>
        {children}
      </section>
    </div>,
    document.body,
  )
}

function CategoryForm({ item, onCancel, onSave, saving }) {
  const [form, setForm] = useState(item ? { spanish_name: item.spanish_name, is_published: item.is_published } : { spanish_name: '', is_published: false })
  const [errors, setErrors] = useState({})

  async function submit(event) {
    event.preventDefault()
    const result = await onSave({ ...form, spanish_name: form.spanish_name.trim() }, ['spanish_name', 'is_published'])
    setErrors(result.errors)
    if (result.saved) onCancel()
  }

  return <form className="mt-5 grid gap-4" noValidate onSubmit={submit}><div><label className="font-semibold" htmlFor="category-spanish-name">Nombre en español</label><input aria-describedby={errors.spanish_name ? 'category-spanish-name-error' : undefined} aria-invalid={Boolean(errors.spanish_name)} className={FIELD_CLASS} id="category-spanish-name" maxLength="120" onChange={(event) => setForm({ ...form, spanish_name: event.target.value })} required value={form.spanish_name} /><ErrorMessage id="category-spanish-name-error" message={errors.spanish_name} /></div><Toggle checked={form.is_published} label="Publicada" onChange={(event) => setForm({ ...form, is_published: event.target.checked })} /><FormActions onCancel={onCancel} saving={saving} submitLabel="Guardar" /></form>
}

function DishForm({ categories, item, onCancel, onSave, saving }) {
  const [form, setForm] = useState(item ? { ...item, price: String(item.price) } : { category: '', visible_number: '', spanish_name: '', spanish_description: '', price: '', is_published: false, is_available: true })
  const [errors, setErrors] = useState({})
  function update(event) { const { name, value, checked, type } = event.target; setForm({ ...form, [name]: type === 'checkbox' ? checked : value }) }
  async function submit(event) {
    event.preventDefault()
    const values = { category: Number(form.category), spanish_name: form.spanish_name.trim(), spanish_description: form.spanish_description.trim(), price: form.price, allergens: form.allergens ?? [], is_published: form.is_published, is_available: form.is_available }
    if (!item) values.visible_number = Number(form.visible_number)
    const result = await onSave(values, ['category', 'visible_number', 'spanish_name', 'spanish_description', 'price', 'allergens', 'is_published', 'is_available'])
    setErrors(result.errors)
    if (result.saved) onCancel()
  }
  return <form className="mt-5 grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}><Field error={errors.category} id="dish-category" label="Categoría"><select className={FIELD_CLASS} id="dish-category" name="category" onChange={update} required value={form.category}><option value="">Seleccioná una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.spanish_name}</option>)}</select></Field><Field error={errors.visible_number} id="dish-visible-number" label="Número visible"><input aria-describedby={item ? 'dish-visible-number-hint' : undefined} className={FIELD_CLASS} disabled={Boolean(item)} id="dish-visible-number" min="1" name="visible_number" onChange={update} required type="number" value={form.visible_number} />{item ? <p className="mt-1 text-sm text-cruce-muted" id="dish-visible-number-hint">El número visible no se puede modificar después de crear el plato.</p> : null}</Field><Field error={errors.spanish_name} id="dish-spanish-name" label="Nombre en español"><input className={FIELD_CLASS} id="dish-spanish-name" name="spanish_name" onChange={update} required value={form.spanish_name} /></Field><Field error={errors.price} id="dish-price" label="Precio (€)"><input className={FIELD_CLASS} id="dish-price" min="0" name="price" onChange={update} required step="0.01" type="number" value={form.price} /></Field><div className="sm:col-span-2"><Field error={errors.spanish_description} id="dish-spanish-description" label="Descripción en español"><textarea className={`${FIELD_CLASS} min-h-24 py-2`} id="dish-spanish-description" name="spanish_description" onChange={update} value={form.spanish_description} /></Field></div><Toggle checked={form.is_published} label="Publicado" name="is_published" onChange={update} /><Toggle checked={form.is_available} label="Disponible" name="is_available" onChange={update} /><div className="sm:col-span-2"><FormActions onCancel={onCancel} saving={saving} submitLabel="Guardar" /></div></form>
}

function Field({ children, error, id, label }) {
  const [control, ...additionalContent] = Array.isArray(children) ? children : [children]
  const describedBy = [control.props['aria-describedby'], error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return <div><label className="font-semibold" htmlFor={id}>{label}</label>{cloneElement(control, { 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })}{additionalContent}<ErrorMessage id={`${id}-error`} message={error} /></div>
}

function TranslationForm({ item, onCancel, onSave, saving, target }) {
  const [form, setForm] = useState(item ? { ...item } : { language: 'en', name: '', description: '', is_manually_reviewed: false })
  const [errors, setErrors] = useState({})
  async function submit(event) {
    event.preventDefault()
    const values = { language: form.language, name: form.name.trim(), is_manually_reviewed: form.is_manually_reviewed, [target.key]: target.id }
    if (target.key === 'dish') values.description = form.description.trim()
    const result = await onSave(values, ['language', 'name', 'description', 'is_manually_reviewed', target.key])
    setErrors(result.errors)
    if (result.saved) onCancel()
  }
  return <form className="mt-5 grid gap-4" noValidate onSubmit={submit}><p className="rounded-md bg-cruce-ivory p-3 text-sm text-cruce-muted">Fuente en español: <strong>{target.name}</strong></p><div><label className="font-semibold" htmlFor="translation-language">Idioma</label><select aria-describedby={errors.language ? 'translation-language-error' : undefined} aria-invalid={Boolean(errors.language)} className={FIELD_CLASS} disabled={Boolean(item)} id="translation-language" onChange={(event) => setForm({ ...form, language: event.target.value })} value={form.language}>{TRANSLATION_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select><ErrorMessage id="translation-language-error" message={errors.language} /></div><div><label className="font-semibold" htmlFor="translation-name">Nombre traducido</label><input aria-describedby={errors.name ? 'translation-name-error' : undefined} aria-invalid={Boolean(errors.name)} className={FIELD_CLASS} id="translation-name" onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /><ErrorMessage id="translation-name-error" message={errors.name} /></div>{target.key === 'dish' ? <div><label className="font-semibold" htmlFor="translation-description">Descripción traducida</label><textarea aria-describedby={errors.description ? 'translation-description-error' : undefined} aria-invalid={Boolean(errors.description)} className={`${FIELD_CLASS} min-h-24 py-2`} id="translation-description" onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} /><ErrorMessage id="translation-description-error" message={errors.description} /></div> : null}<Toggle checked={form.is_manually_reviewed} label="Revisada manualmente" onChange={(event) => setForm({ ...form, is_manually_reviewed: event.target.checked })} /><FormActions onCancel={onCancel} saving={saving} submitLabel="Guardar traducción" /></form>
}

function FormActions({ onCancel, saving, submitLabel }) { return <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-md bg-cruce-amber px-4 font-semibold disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Guardando…' : submitLabel}</button><button className="min-h-11 rounded-md border border-cruce-line px-4 font-semibold" disabled={saving} onClick={onCancel} type="button">Cancelar</button></div> }

function Preview({ language, onLanguageChange, preview }) {
  return <aside aria-labelledby="menu-preview-title" className="rounded-xl border border-cruce-line bg-cruce-paper p-5"><h2 className="display-font text-2xl" id="menu-preview-title">Vista pública</h2><p className="mt-2 text-sm text-cruce-muted">Sólo muestra el resultado publicado de la API pública.</p><label className="mt-4 block text-sm font-semibold" htmlFor="preview-language">Idioma de vista previa</label><select className={FIELD_CLASS} id="preview-language" onChange={(event) => onLanguageChange(event.target.value)} value={language}>{LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select>{!preview ? <p className="mt-4 text-sm" role="status">Cargando vista previa…</p> : preview.categories.length === 0 ? <p className="mt-4 text-sm text-cruce-muted">No hay platos publicados.</p> : <div className="mt-4 space-y-5">{preview.categories.map((category) => <section key={category.id}><h3 className="font-semibold">{category.name}</h3><ul className="mt-2 space-y-2">{category.dishes.map((dish) => <li className="flex justify-between gap-3 text-sm" key={dish.id}><span><strong>{dish.visible_number}.</strong> {dish.name}{!dish.is_available ? ' — No disponible' : ''}</span><span>{dish.price} €</span></li>)}</ul></section>)}</div>}</aside>
}

export function MenuAdminPage({ menuService }) {
  const state = useMenuAdmin(menuService)
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const triggerRef = useRef(null)
  const restoreFocusRef = useRef(null)
  const modalOpen = Boolean(editor || deleting)

  useEffect(() => {
    if (!modalOpen && restoreFocusRef.current) { restoreFocusRef.current.focus(); restoreFocusRef.current = null }
  }, [modalOpen])
  useEffect(() => {
    if (!modalOpen) return undefined
    const dashboardShell = document.querySelector('[data-dashboard-shell]')
    if (!dashboardShell) return undefined
    const wasInert = dashboardShell.hasAttribute('inert')
    dashboardShell.setAttribute('inert', '')
    return () => { if (!wasInert) dashboardShell.removeAttribute('inert') }
  }, [modalOpen])

  function openEditor(event, collection, item, target) { triggerRef.current = event.currentTarget; setEditor({ collection, item, target }) }
  function closeEditor() { restoreFocusRef.current = triggerRef.current; setEditor(null) }
  function openDelete(event, collection, item) { triggerRef.current = event.currentTarget; setDeleting({ collection, item }) }
  function closeDelete() { if (!state.isSaving) { restoreFocusRef.current = triggerRef.current; setDeleting(null) } }
  async function save(values, fields) { return state.save(editor.collection, editor.item, values, fields) }
  async function confirmDelete() { if (await state.remove(deleting.collection, deleting.item)) closeDelete() }

  return <section aria-labelledby="menu-admin-title"><div className="max-w-7xl border-b border-cruce-line pb-6 sm:flex sm:items-end sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.18em] text-cruce-terracotta uppercase">Restaurante</p><h1 className="display-font mt-2 text-3xl sm:text-4xl" id="menu-admin-title">Carta</h1><p className="mt-3 max-w-2xl leading-7 text-cruce-muted">Administrá el contenido fuente en español, su publicación y las traducciones revisadas.</p></div><button className="mt-5 min-h-11 rounded-md bg-cruce-ink px-4 font-semibold text-cruce-ivory sm:mt-0" disabled={state.isSaving} onClick={(event) => openEditor(event, 'dishes', null)} type="button">Nuevo plato</button></div>{state.loadError ? <div className="mt-6" role="alert">{state.loadError}</div> : null}{state.actionError ? <p className="mt-4 rounded-md border border-cruce-danger/35 bg-cruce-danger-soft p-4 text-cruce-danger" role="alert">{state.actionError}</p> : null}{state.feedback ? <p className="mt-4 rounded-md border border-cruce-success/30 bg-cruce-success-soft p-4 text-cruce-success" role="status">{state.feedback}</p> : null}{state.isLoading ? <p className="mt-6" role="status">Cargando carta…</p> : <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="space-y-6"><section className="rounded-xl border border-cruce-line bg-cruce-paper p-4 sm:p-6"><div className="flex items-center justify-between gap-4"><h2 className="display-font text-2xl">Categorías</h2><button className="min-h-11 rounded-md border border-cruce-line px-3 font-semibold" onClick={(event) => openEditor(event, 'categories', null)} type="button">Nueva categoría</button></div><ul className="mt-4 divide-y divide-cruce-line">{state.categories.map((category) => <li className="py-3" key={category.id}><div className="flex flex-wrap items-center justify-between gap-2"><span>{category.spanish_name}{!category.is_published ? ' — no publicada' : ''}</span><Actions item={category} onDelete={openDelete} onEdit={openEditor} translationTarget={{ key: 'category', id: category.id, name: category.spanish_name }} /></div><TranslationList collection="categoryTranslations" onDelete={openDelete} onEdit={openEditor} target={{ key: 'category', id: category.id, name: category.spanish_name }} translations={state.categoryTranslations.filter((translation) => translation.category === category.id)} /></li>)}</ul></section><section className="rounded-xl border border-cruce-line bg-cruce-paper p-4 sm:p-6"><h2 className="display-font text-2xl">Platos</h2><table aria-label="Platos de la carta, ordenados por número visible" className="mt-4 w-full text-left"><thead><tr><th>Número</th><th>Plato</th><th>Acciones</th></tr></thead><tbody>{state.dishes.map((dish) => <tr key={dish.id}><td>{dish.visible_number}</td><td>{dish.spanish_name}<TranslationList collection="dishTranslations" onDelete={openDelete} onEdit={openEditor} target={{ key: 'dish', id: dish.id, name: dish.spanish_name }} translations={state.dishTranslations.filter((translation) => translation.dish === dish.id)} /></td><td><Actions item={dish} onDelete={openDelete} onEdit={openEditor} translationTarget={{ key: 'dish', id: dish.id, name: dish.spanish_name }} /></td></tr>)}</tbody></table></section></div><Preview language={state.previewLanguage} onLanguageChange={state.setPreviewLanguage} preview={state.preview} /></div>}{editor ? <Modal isLocked={state.isSaving} isOpen onClose={closeEditor} title={editor.collection === 'categories' ? (editor.item ? 'Editar categoría' : 'Nueva categoría') : editor.collection === 'dishes' ? (editor.item ? 'Editar plato' : 'Nuevo plato') : (editor.item ? 'Editar traducción' : 'Nueva traducción')}>{editor.collection === 'categories' ? <CategoryForm item={editor.item} onCancel={closeEditor} onSave={save} saving={state.isSaving} /> : editor.collection === 'dishes' ? <DishForm categories={state.categories} item={editor.item} onCancel={closeEditor} onSave={save} saving={state.isSaving} /> : <TranslationForm item={editor.item} onCancel={closeEditor} onSave={save} saving={state.isSaving} target={editor.target} />}</Modal> : null}{deleting ? <Modal isLocked={state.isSaving} isOpen onClose={closeDelete} title="Eliminar elemento"><p className="mt-5">Esta acción no se puede deshacer.</p><div className="mt-5 flex gap-2"><button className="min-h-11 rounded-md bg-cruce-danger px-4 font-semibold text-white" disabled={state.isSaving} onClick={confirmDelete} type="button">Eliminar</button><button className="min-h-11 rounded-md border border-cruce-line px-4 font-semibold" disabled={state.isSaving} onClick={closeDelete} type="button">Cancelar</button></div></Modal> : null}</section>
}

function Actions({ item, onDelete, onEdit, translationTarget }) {
  return <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-md border border-cruce-line px-3 text-sm font-semibold" onClick={(event) => onEdit(event, translationTarget.key === 'category' ? 'categories' : 'dishes', item)} type="button">Editar</button><button className="min-h-11 rounded-md border border-cruce-line px-3 text-sm font-semibold" onClick={(event) => onEdit(event, translationTarget.key === 'category' ? 'categoryTranslations' : 'dishTranslations', null, translationTarget)} type="button">Traducciones</button><button className="min-h-11 rounded-md border border-cruce-danger px-3 text-sm font-semibold text-cruce-danger" onClick={(event) => onDelete(event, translationTarget.key === 'category' ? 'categories' : 'dishes', item)} type="button">Eliminar</button></div>
}

function TranslationList({ collection, onDelete, onEdit, target, translations }) {
  if (!translations.length) return <p className="mt-2 text-xs text-cruce-muted">Sin traducciones.</p>
  return <ul className="mt-2 space-y-1 text-xs text-cruce-muted">{translations.map((translation) => <li className="flex flex-wrap items-center gap-2" key={translation.id}><span>{translation.language.toUpperCase()}: {translation.name}{translation.is_manually_reviewed ? ' · revisada' : ' · pendiente de revisión'}</span><button className="underline" onClick={(event) => onEdit(event, collection, translation, target)} type="button">Editar traducción</button><button className="underline" onClick={(event) => onDelete(event, collection, translation)} type="button">Eliminar traducción</button></li>)}</ul>
}
