import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicMenuPage } from './PublicMenuPage.jsx'
import { MenuPayloadError, MENU_LANGUAGES, fetchPublicMenu } from './menuApi.js'

vi.mock('./menuApi.js', async (importOriginal) => {
  const actual = await importOriginal()

  return { ...actual, fetchPublicMenu: vi.fn() }
})

const CURRENCY_FORMATTERS = Object.fromEntries(MENU_LANGUAGES.map(({ code, locale }) => [
  code,
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }),
]))

function currencyPattern(code, amount) {
  return new RegExp(CURRENCY_FORMATTERS[code].format(amount).replace(/\s/g, '\\s'))
}

const LOCALIZED_CATEGORY_NAMES = {
  es: 'Entrantes',
  en: 'Starters',
  fr: 'Entrées',
  de: 'Vorspeisen',
  it: 'Antipasti',
}

const LOCALIZED_DISH_NAMES = {
  es: 'Tortilla española',
  en: 'Spanish omelette',
  fr: 'Omelette espagnole',
  de: 'Spanisches Omelett',
  it: 'Frittata spagnola',
}

function menuForLanguage(language) {
  const isSpanish = language === 'es'

  return {
    language,
    categories: [
      {
        id: 1,
        name: LOCALIZED_CATEGORY_NAMES[language],
        spanish_name: 'Entrantes',
        translation_available: !isSpanish,
        dishes: [
          {
            id: 10,
            visible_number: 7,
            name: LOCALIZED_DISH_NAMES[language],
            spanish_name: 'Tortilla española',
            description: 'With potatoes and egg.',
            spanish_description: 'Con patatas y huevo.',
            translation_available: !isSpanish,
            price: '12.30',
            allergens: ['eggs'],
            is_available: true,
          },
        ],
      },
    ],
  }
}

const SPANISH_MENU = {
  language: 'es',
  categories: [
    {
      id: 1,
      name: 'Entrantes',
      spanish_name: 'Entrantes',
      translation_available: false,
      dishes: [
        {
          id: 10,
          visible_number: 7,
          name: 'Tortilla española',
          spanish_name: 'Tortilla española',
          description: 'Con patatas y huevo.',
          spanish_description: 'Con patatas y huevo.',
          translation_available: false,
          price: '8.50',
          allergens: ['eggs', 'milk'],
          is_available: true,
        },
        {
          id: 11,
          visible_number: 8,
          name: 'Croquetas',
          spanish_name: 'Croquetas',
          description: '',
          spanish_description: '',
          translation_available: false,
          price: '6.00',
          allergens: [],
          is_available: false,
        },
      ],
    },
  ],
}

const ENGLISH_MENU = {
  language: 'en',
  categories: [
    {
      id: 1,
      name: 'Starters',
      spanish_name: 'Entrantes',
      translation_available: true,
      dishes: [
        {
          id: 10,
          visible_number: 7,
          name: 'Spanish omelette',
          spanish_name: 'Tortilla española',
          description: 'With potatoes and egg.',
          spanish_description: 'Con patatas y huevo.',
          translation_available: true,
          price: '8.50',
          allergens: ['eggs'],
          is_available: true,
        },
      ],
    },
  ],
}

const UNTRANSLATED_MENU = {
  language: 'fr',
  categories: [
    {
      id: 1,
      name: 'Entrantes',
      spanish_name: 'Entrantes',
      translation_available: false,
      dishes: [
        {
          id: 10,
          visible_number: 7,
          name: 'Tortilla española',
          spanish_name: 'Tortilla española',
          description: 'Con patatas y huevo.',
          spanish_description: 'Con patatas y huevo.',
          translation_available: false,
          price: '8.50',
          allergens: ['eggs'],
          is_available: true,
        },
      ],
    },
  ],
}

function LocationProbe() {
  const location = useLocation()

  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function HistoryControls() {
  const navigate = useNavigate()

  return (
    <div>
      <button onClick={() => navigate(-1)} type="button">Atrás</button>
      <button onClick={() => navigate(1)} type="button">Adelante</button>
    </div>
  )
}

function LocalizedMenuRoute() {
  const { language } = useParams()

  return <PublicMenuPage pathLanguage={language} />
}

function renderPage(initialEntry = '/carta') {
  const initialEntries = Array.isArray(initialEntry) ? initialEntry : [initialEntry]

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/carta"
          element={(
            <>
              <PublicMenuPage />
              <LocationProbe />
              <HistoryControls />
            </>
          )}
        />
        <Route
          path="/carta/:language"
          element={(
            <>
              <LocalizedMenuRoute />
              <LocationProbe />
              <HistoryControls />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  fetchPublicMenu.mockReset()
})

describe('PublicMenuPage', () => {
  it('renders the Spanish menu with semantic headings, dish numbers, allergens and availability', async () => {
    fetchPublicMenu.mockResolvedValue(SPANISH_MENU)

    renderPage()

    expect(screen.getByRole('heading', { name: 'La carta de El Cruce.', level: 1 })).toBeTruthy()

    const category = await screen.findByRole('region', { name: 'Entrantes' })

    expect(within(category).getByText('7')).toBeTruthy()
    expect(within(category).getByRole('heading', { name: 'Tortilla española', level: 3 })).toBeTruthy()
    expect(within(category).getByText('Con patatas y huevo.')).toBeTruthy()
    expect(within(category).getByText(currencyPattern('es', 8.5))).toBeTruthy()
    expect(within(category).getByText('Huevos')).toBeTruthy()
    expect(within(category).getByText('Leche')).toBeTruthy()
    expect(within(category).getByText('Disponible')).toBeTruthy()
    expect(within(category).getByText('No disponible')).toBeTruthy()
    expect(within(category).getByText('Sin alérgenos declarados')).toBeTruthy()
    expect(screen.queryByText('Sin traducción disponible')).toBeNull()
    expect(screen.queryByText(/^Original:/)).toBeNull()
  })

  it('shows the translated content with the original Spanish name beneath it', async () => {
    fetchPublicMenu.mockResolvedValue(ENGLISH_MENU)

    renderPage('/carta?language=en')

    const category = await screen.findByRole('region', { name: 'Starters' })

    expect(within(category).getByText('Original: Entrantes')).toBeTruthy()

    const dishHeading = within(category).getByRole('heading', { name: 'Spanish omelette', level: 3 })

    expect(dishHeading.getAttribute('lang')).toBe('en')
    expect(within(category).getByText('Original: Tortilla española').getAttribute('lang')).toBe('es')
    expect(within(category).getByText('With potatoes and egg.')).toBeTruthy()
    expect(within(category).getByText(currencyPattern('en', 8.5))).toBeTruthy()
    expect(screen.queryByText('Sin traducción disponible')).toBeNull()
  })

  it('renders the Spanish name after the translated name in DOM order', async () => {
    fetchPublicMenu.mockResolvedValue(ENGLISH_MENU)

    renderPage('/carta?language=en')

    const category = await screen.findByRole('region', { name: 'Starters' })
    const translatedHeading = within(category).getByRole('heading', { name: 'Spanish omelette', level: 3 })
    const originalName = within(category).getByText('Original: Tortilla española')

    expect(
      translatedHeading.compareDocumentPosition(originalName) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('labels missing translations instead of presenting the Spanish fallback as a translation', async () => {
    fetchPublicMenu.mockResolvedValue(UNTRANSLATED_MENU)

    renderPage('/carta?language=fr')

    const category = await screen.findByRole('region', { name: 'Entrantes' })

    expect(within(category).getByRole('heading', { name: 'Tortilla española', level: 3 })).toBeTruthy()
    expect(within(category).getAllByText('Sin traducción disponible')).toHaveLength(2)
    expect(screen.queryByText(/^Original:/)).toBeNull()
  })

  it('announces the selected localized language after switching the menu language', async () => {
    fetchPublicMenu.mockImplementation((language) => Promise.resolve(
      language === 'en' ? ENGLISH_MENU : SPANISH_MENU,
    ))

    renderPage()

    await screen.findByRole('heading', { name: 'Tortilla española', level: 3 })

    const spanishLink = screen.getByRole('link', { name: 'Español' })

    expect(spanishLink.getAttribute('aria-current')).toBe('true')

    fireEvent.click(screen.getByRole('link', { name: 'English' }))

    expect(await screen.findByRole('heading', { name: 'Spanish omelette', level: 3 })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/carta/en')
    expect(screen.getByRole('link', { name: 'English' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('link', { name: 'Español' }).getAttribute('aria-current')).toBeNull()
    expect(fetchPublicMenu).toHaveBeenLastCalledWith('en', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(screen.getByRole('status').textContent).toBe('Carta cargada en English')
  })

  it('restores the menu and language through browser history navigation', async () => {
    fetchPublicMenu.mockImplementation((language) => Promise.resolve(
      language === 'en' ? ENGLISH_MENU : SPANISH_MENU,
    ))

    renderPage()

    await screen.findByRole('heading', { name: 'Tortilla española', level: 3 })

    fireEvent.click(screen.getByRole('link', { name: 'English' }))

    expect(await screen.findByRole('heading', { name: 'Spanish omelette', level: 3 })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/carta/en')

    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))

    expect(await screen.findByRole('heading', { name: 'Tortilla española', level: 3 })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/carta')

    fireEvent.click(screen.getByRole('button', { name: 'Adelante' }))

    expect(await screen.findByRole('heading', { name: 'Spanish omelette', level: 3 })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/carta/en')
  })

  it.each(MENU_LANGUAGES)('renders the $code menu with a localized price and language attributes', async ({ code }) => {
    fetchPublicMenu.mockResolvedValue(menuForLanguage(code))

    renderPage(`/carta?language=${code}`)

    const dishHeading = await screen.findByRole('heading', { name: LOCALIZED_DISH_NAMES[code], level: 3 })

    expect(dishHeading.getAttribute('lang')).toBe(code)
    expect(screen.getByText(currencyPattern(code, 12.3))).toBeTruthy()

    if (code === 'es') {
      expect(screen.queryByText(/^Original:/)).toBeNull()
    } else {
      expect(screen.getByText('Original: Tortilla española').getAttribute('lang')).toBe('es')
    }
  })

  it('uses the language from a localized path over a conflicting legacy query parameter', async () => {
    fetchPublicMenu.mockResolvedValue(ENGLISH_MENU)

    renderPage('/carta/en?language=fr')

    expect(await screen.findByRole('heading', { name: 'Spanish omelette', level: 3 })).toBeTruthy()
    expect(fetchPublicMenu).toHaveBeenLastCalledWith('en', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(screen.getByTestId('location').textContent).toBe('/carta/en?language=fr')
  })

  it('keeps legacy query URLs compatible with their requested API language', async () => {
    fetchPublicMenu.mockResolvedValue(ENGLISH_MENU)

    renderPage('/carta?language=en')

    expect(await screen.findByRole('heading', { name: 'Spanish omelette', level: 3 })).toBeTruthy()
    expect(fetchPublicMenu).toHaveBeenLastCalledWith('en', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('announces a loading state while the menu is requested', () => {
    fetchPublicMenu.mockReturnValue(new Promise(() => {}))

    renderPage()

    const status = screen.getByRole('status')

    expect(status.textContent).toBe('Cargando la carta…')
    expect(status.parentElement.getAttribute('aria-live')).toBe('polite')
  })

  it('announces the selected language after a successful initial load inside the live region', async () => {
    fetchPublicMenu.mockResolvedValue(SPANISH_MENU)

    renderPage()

    await screen.findByRole('region', { name: 'Entrantes' })

    const status = screen.getByRole('status')

    expect(status.textContent).toBe('Carta cargada en Español')
    expect(status.classList.contains('sr-only')).toBe(true)
    expect(status.parentElement.getAttribute('aria-live')).toBe('polite')
  })

  it('announces the empty state inside the live region', async () => {
    fetchPublicMenu.mockResolvedValue({ language: 'es', categories: [] })

    renderPage()

    expect(await screen.findByText('La carta todavía no tiene platos publicados.')).toBeTruthy()

    const status = screen.getByRole('status')

    expect(status.textContent).toBe('No hay platos publicados en Español')
    expect(status.classList.contains('sr-only')).toBe(true)
    expect(status.parentElement.getAttribute('aria-live')).toBe('polite')
  })

  it('shows an empty state for a published category without dishes', async () => {
    fetchPublicMenu.mockResolvedValue({
      language: 'es',
      categories: [{
        id: 9,
        name: 'Postres',
        spanish_name: 'Postres',
        translation_available: false,
        dishes: [],
      }],
    })

    renderPage()

    expect(await screen.findByText('No hay platos publicados en esta categoría.')).toBeTruthy()
    expect(screen.getByText('0 platos')).toBeTruthy()
  })

  it('distinguishes network errors and retries the request', async () => {
    fetchPublicMenu
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(SPANISH_MENU)

    renderPage()

    const alert = await screen.findByRole('alert')

    expect(within(alert).getByText('No pudimos conectarnos.')).toBeTruthy()
    expect(within(alert).getByText(/Revisá tu conexión/)).toBeTruthy()

    fireEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { name: 'Tortilla española', level: 3 })).toBeTruthy()
    expect(fetchPublicMenu).toHaveBeenCalledTimes(2)
    expect(fetchPublicMenu).toHaveBeenLastCalledWith('es', expect.any(Object))
  })

  it('shows server error copy when the service responds with an error', async () => {
    fetchPublicMenu.mockRejectedValue(Object.assign(new Error('Server error'), { response: { status: 500 } }))

    renderPage()

    const alert = await screen.findByRole('alert')

    expect(within(alert).getByText('No pudimos cargar la carta.')).toBeTruthy()
    expect(within(alert).getByText(/respondió con un error o con datos inesperados/)).toBeTruthy()
  })

  it('shows contract error copy when the API layer rejects an invalid payload', async () => {
    fetchPublicMenu.mockRejectedValue(new MenuPayloadError('Invalid public menu payload at "categories".'))

    renderPage()

    const alert = await screen.findByRole('alert')

    expect(within(alert).getByText('No pudimos cargar la carta.')).toBeTruthy()
    expect(within(alert).getByText(/respondió con un error o con datos inesperados/)).toBeTruthy()
  })

  it('falls back to Spanish when the backend rejects the requested language with 400', async () => {
    fetchPublicMenu
      .mockRejectedValueOnce(Object.assign(new Error('Bad Request'), { response: { status: 400 } }))
      .mockResolvedValueOnce(SPANISH_MENU)

    renderPage('/carta?language=fr')

    expect(await screen.findByText('El idioma solicitado no está disponible. Mostramos la carta en español.')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Tortilla española', level: 3 })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Español' }).getAttribute('aria-current')).toBe('true')
    expect(fetchPublicMenu.mock.calls.map(([language]) => language)).toEqual(['fr', 'es'])

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/carta?language=es')
    })
  })

  it('keeps an error state when the Spanish fallback also fails', async () => {
    fetchPublicMenu.mockRejectedValue(Object.assign(new Error('Bad Request'), { response: { status: 400 } }))

    renderPage('/carta?language=fr')

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(fetchPublicMenu.mock.calls.map(([language]) => language)).toEqual(['fr', 'es'])
    expect(screen.getByTestId('location').textContent).toBe('/carta?language=fr')
  })

  it('replaces the fallback history entry when normalizing the URL to Spanish', async () => {
    fetchPublicMenu.mockImplementation((language) => {
      if (language === 'fr') {
        return Promise.reject(Object.assign(new Error('Bad Request'), { response: { status: 400 } }))
      }

      return Promise.resolve(menuForLanguage(language))
    })

    renderPage(['/carta?language=de', '/carta?language=fr'])

    expect(await screen.findByText('El idioma solicitado no está disponible. Mostramos la carta en español.')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/carta?language=es')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/carta?language=de')
    })
  })

  it('sets the document title for /carta and restores it on unmount', () => {
    fetchPublicMenu.mockReturnValue(new Promise(() => {}))
    document.title = 'Título anterior'

    const { unmount } = renderPage()

    expect(document.title).toBe('La carta | El Cruce')

    unmount()

    expect(document.title).toBe('Título anterior')
  })
})
