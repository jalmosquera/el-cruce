import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MenuAdminPage } from './MenuAdminPage.jsx'

const CATEGORY = { id: 1, spanish_name: 'Entrantes', is_published: true }
const DISH = { id: 2, category: 1, visible_number: 10, spanish_name: 'Tortilla española', spanish_description: 'Con patatas.', price: '8.50', allergens: ['eggs'], is_published: true, is_available: true }
const PUBLIC_PREVIEW = { language: 'es', categories: [{ id: 1, name: 'Entrantes', spanish_name: 'Entrantes', dishes: [{ id: 2, visible_number: 10, name: 'Tortilla española', price: '8.50', is_available: true }] }] }

function resource(items = []) {
  return { list: vi.fn().mockResolvedValue(items), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
}

function createService(overrides = {}) {
  return {
    categories: resource([CATEGORY]), dishes: resource([DISH]), categoryTranslations: resource([]), dishTranslations: resource([]), fetchPublicPreview: vi.fn().mockResolvedValue(PUBLIC_PREVIEW), ...overrides,
  }
}

async function renderPage(service = createService()) {
  render(<MenuAdminPage menuService={service} />)
  await screen.findByRole('heading', { name: 'Carta' })
  await screen.findByRole('table', { name: 'Platos de la carta, ordenados por número visible' })
  return service
}

describe('MenuAdminPage', () => {
  it('renders dishes by their stable visible number and the public API preview without inventing content', async () => {
    const service = createService({ dishes: resource([{ ...DISH, id: 3, visible_number: 20, spanish_name: 'Flan' }, DISH]) })
    await renderPage(service)

    const table = screen.getByRole('table', { name: 'Platos de la carta, ordenados por número visible' })
    expect(within(table).getAllByRole('row')[1].textContent).toContain('10')
    expect(within(table).getAllByRole('row')[2].textContent).toContain('20')
    const preview = screen.getByRole('complementary', { name: 'Vista pública' })
    expect(within(preview).getByText('Tortilla española')).toBeTruthy()
    expect(service.fetchPublicPreview).toHaveBeenCalledOnce()
  })

  it('does not send visible_number while editing a dish and explains its immutability', async () => {
    const service = await renderPage()
    service.dishes.update.mockResolvedValue({ ...DISH, spanish_name: 'Tortilla renovada' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1])

    const number = screen.getByLabelText('Número visible')
    expect(number.disabled).toBe(true)
    expect(number.getAttribute('aria-describedby')).toBe('dish-visible-number-hint')
    expect(screen.getByText('El número visible no se puede modificar después de crear el plato.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nombre en español'), { target: { value: 'Tortilla renovada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(service.dishes.update).toHaveBeenCalledWith(2, expect.not.objectContaining({ visible_number: expect.anything() })))
  })

  it('creates a translation with its target, language and manual review flag', async () => {
    const service = createService({ dishTranslations: resource([]) })
    service.dishTranslations.create.mockResolvedValue({ id: 4, dish: 2, language: 'en', name: 'Spanish omelette', description: '', is_manually_reviewed: true })
    await renderPage(service)
    fireEvent.click(screen.getAllByRole('button', { name: 'Traducciones' })[1])
    fireEvent.change(screen.getByLabelText('Idioma'), { target: { value: 'en' } })
    fireEvent.change(screen.getByLabelText('Nombre traducido'), { target: { value: 'Spanish omelette' } })
    fireEvent.click(screen.getByLabelText('Revisada manualmente'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar traducción' }))

    await waitFor(() => expect(service.dishTranslations.create).toHaveBeenCalledWith({ dish: 2, language: 'en', name: 'Spanish omelette', description: '', is_manually_reviewed: true }))
    expect(await screen.findByText('Cambios guardados.')).toBeTruthy()
  })

  it('preserves DRF validation errors and keeps the dish form open', async () => {
    const service = createService()
    service.dishes.create.mockRejectedValue({ response: { status: 400, data: { visible_number: ['This number is already in use.'] } } })
    await renderPage(service)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo plato' }))
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Número visible'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Nombre en español'), { target: { value: 'Otro plato' } })
    fireEvent.change(screen.getByLabelText('Precio (€)'), { target: { value: '4.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('This number is already in use.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Nuevo plato' })).toBeTruthy()
  })

  it('uses accessible modal semantics, places focus in the dialog and closes with Escape', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva categoría' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refreshes the real public preview after deleting a published dish', async () => {
    const emptyPreview = { language: 'es', categories: [] }
    const service = createService({ fetchPublicPreview: vi.fn().mockResolvedValueOnce(PUBLIC_PREVIEW).mockResolvedValueOnce(emptyPreview) })
    await renderPage(service)

    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[1])
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Eliminar' })[0])

    expect(await screen.findByText('No hay platos publicados.')).toBeTruthy()
    expect(service.dishes.remove).toHaveBeenCalledWith(2)
    expect(service.fetchPublicPreview).toHaveBeenCalledTimes(2)
    expect(service.fetchPublicPreview).toHaveBeenLastCalledWith('es')
  })

  it('keeps the deletion result and reports when the public preview cannot refresh', async () => {
    const service = createService({ fetchPublicPreview: vi.fn().mockResolvedValueOnce(PUBLIC_PREVIEW).mockRejectedValueOnce(new Error('offline')) })
    await renderPage(service)

    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[1])
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Eliminar' })[0])

    expect((await screen.findByRole('alert')).textContent).toContain('El cambio se guardó, pero no pudimos actualizar la vista pública.')
    expect(screen.queryByText('Tortilla española')).toBeTruthy()
    expect(screen.queryByRole('cell', { name: 'Tortilla española' })).toBeNull()
  })

  it('associates and announces a dish translation description validation error', async () => {
    const service = createService()
    service.dishTranslations.create.mockRejectedValue({ response: { status: 400, data: { description: ['La descripción es obligatoria.'] } } })
    await renderPage(service)

    fireEvent.click(screen.getAllByRole('button', { name: 'Traducciones' })[1])
    fireEvent.change(screen.getByLabelText('Nombre traducido'), { target: { value: 'Spanish omelette' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar traducción' }))

    const description = screen.getByLabelText('Descripción traducida')
    expect((await screen.findByRole('alert')).textContent).toContain('La descripción es obligatoria.')
    expect(description.getAttribute('aria-invalid')).toBe('true')
    expect(description.getAttribute('aria-describedby')).toBe('translation-description-error')
  })

  it('saves a category translation and reads the selected non-Spanish public output', async () => {
    const englishPreview = { ...PUBLIC_PREVIEW, language: 'en', categories: [{ ...PUBLIC_PREVIEW.categories[0], name: 'Starters', dishes: [{ ...PUBLIC_PREVIEW.categories[0].dishes[0], name: 'Spanish omelette' }] }] }
    const service = createService({ fetchPublicPreview: vi.fn().mockResolvedValueOnce(PUBLIC_PREVIEW).mockResolvedValueOnce(PUBLIC_PREVIEW).mockResolvedValueOnce(englishPreview) })
    service.categoryTranslations.create.mockResolvedValue({ id: 8, category: 1, language: 'en', name: 'Starters', is_manually_reviewed: true })
    await renderPage(service)

    fireEvent.click(screen.getAllByRole('button', { name: 'Traducciones' })[0])
    fireEvent.change(screen.getByLabelText('Nombre traducido'), { target: { value: 'Starters' } })
    fireEvent.click(screen.getByLabelText('Revisada manualmente'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar traducción' }))
    await waitFor(() => expect(service.categoryTranslations.create).toHaveBeenCalledWith({ category: 1, language: 'en', name: 'Starters', is_manually_reviewed: true }))

    fireEvent.change(screen.getByLabelText('Idioma de vista previa'), { target: { value: 'en' } })
    expect(await screen.findByText('Spanish omelette')).toBeTruthy()
    expect(service.fetchPublicPreview).toHaveBeenLastCalledWith('en')
  })
})
