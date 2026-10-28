import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Footer } from '../public-landing/sections/Footer.jsx'
import { Header } from '../public-landing/sections/Header.jsx'
import { DEFAULT_MENU_LANGUAGE, MenuPayloadError, MENU_LANGUAGES, fetchPublicMenu } from './menuApi.js'

const ALLERGEN_LABELS = {
  celery: 'Apio',
  cereals_with_gluten: 'Cereales con gluten',
  crustaceans: 'Crustáceos',
  eggs: 'Huevos',
  fish: 'Pescado',
  lupin: 'Altramuces',
  milk: 'Leche',
  molluscs: 'Moluscos',
  mustard: 'Mostaza',
  nuts: 'Frutos secos',
  peanuts: 'Cacahuetes',
  sesame: 'Sésamo',
  soybeans: 'Soja',
  sulphur_dioxide_and_sulphites: 'Sulfitos',
}

const DOCUMENT_TITLE = 'La carta · El Cruce'

const ERROR_COPY = {
  network: {
    title: 'No pudimos conectarnos.',
    detail: 'Revisá tu conexión e intentá nuevamente. Si el problema continúa, consultá en el restaurante.',
  },
  server: {
    title: 'No pudimos cargar la carta.',
    detail: 'El servicio de la carta respondió con un error o con datos inesperados. Intentá nuevamente en unos minutos o consultá en el restaurante.',
  },
}

function classifyError(error) {
  if (error instanceof MenuPayloadError) {
    return 'server'
  }

  return error?.response ? 'server' : 'network'
}

function getLocale(language) {
  return MENU_LANGUAGES.find((option) => option.code === language)?.locale ?? 'es-ES'
}

function formatPrice(price, language) {
  return new Intl.NumberFormat(getLocale(language), {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(price))
}

function allergenLabel(allergen) {
  return ALLERGEN_LABELS[allergen] ?? allergen.replace(/_/g, ' ')
}

function localizedContent(item, language) {
  if (language === DEFAULT_MENU_LANGUAGE) {
    return {
      name: item.spanish_name,
      nameLanguage: DEFAULT_MENU_LANGUAGE,
      description: item.spanish_description ?? '',
      descriptionLanguage: DEFAULT_MENU_LANGUAGE,
      isTranslated: false,
      isMissingTranslation: false,
    }
  }

  if (item.translation_available) {
    return {
      name: item.name,
      nameLanguage: language,
      description: item.description ?? '',
      descriptionLanguage: language,
      isTranslated: true,
      isMissingTranslation: false,
    }
  }

  return {
    name: item.spanish_name,
    nameLanguage: DEFAULT_MENU_LANGUAGE,
    description: item.spanish_description ?? '',
    descriptionLanguage: DEFAULT_MENU_LANGUAGE,
    isTranslated: false,
    isMissingTranslation: true,
  }
}

function LanguageSelector({ currentLanguage }) {
  return (
    <nav aria-label="Idioma de la carta" className="mt-8">
      <ul className="flex flex-wrap gap-2">
        {MENU_LANGUAGES.map((option) => {
          const isCurrent = option.code === currentLanguage

          return (
            <li key={option.code}>
              <Link
                aria-current={isCurrent ? 'true' : undefined}
                className={`inline-flex min-h-11 items-center border px-4 text-xs font-bold uppercase tracking-[0.14em] transition focus:outline-2 focus:outline-offset-4 focus:outline-[#f4eddd] ${
                  isCurrent
                    ? 'border-[#e1bd78] bg-[#e1bd78] text-[#201d18]'
                    : 'border-[#f4eddd]/30 text-[#f4eddd] hover:border-[#e1bd78] hover:text-[#e1bd78]'
                }`}
                lang={option.code}
                to={`/carta?language=${option.code}`}
              >
                {option.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function DishItem({ dish, language }) {
  const content = localizedContent(dish, language)

  return (
    <li className="grid gap-4 py-7 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-6">
      <span className="display-font text-2xl leading-none text-[#e1bd78]">
        <span className="sr-only">Plato número </span>
        <span>{dish.visible_number}</span>
      </span>
      <div className="min-w-0">
        <h3 className="display-font text-2xl leading-tight tracking-[-0.02em] sm:text-3xl" lang={content.nameLanguage}>
          {content.name}
        </h3>
        {content.isTranslated && (
          <p className="mt-1 text-sm italic text-[#cfc6b5]" lang="es">
            Original: {dish.spanish_name}
          </p>
        )}
        {content.isMissingTranslation && (
          <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#e1bd78]">
            Sin traducción disponible
          </p>
        )}
        {content.description && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d4cbb9]" lang={content.descriptionLanguage}>
            {content.description}
          </p>
        )}
        <dl className="mt-4 grid gap-2 text-xs leading-5 text-[#cfc6b5]">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold uppercase tracking-[0.12em] text-[#d6b477]">Alérgenos</dt>
            <dd>
              {dish.allergens.length > 0 ? (
                <ul className="flex flex-wrap gap-x-2">
                  {dish.allergens.map((allergen) => (
                    <li key={allergen}>{allergenLabel(allergen)}</li>
                  ))}
                </ul>
              ) : (
                'Sin alérgenos declarados'
              )}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold uppercase tracking-[0.12em] text-[#d6b477]">Disponibilidad</dt>
            <dd>{dish.is_available ? 'Disponible' : 'No disponible'}</dd>
          </div>
        </dl>
      </div>
      <p className="text-sm font-semibold tabular-nums text-[#f4eddd] sm:pt-1 sm:text-right sm:text-base">
        <span className="sr-only">Precio: </span>
        <span>{formatPrice(dish.price, language)}</span>
      </p>
    </li>
  )
}

function MenuCategory({ category, language }) {
  const content = localizedContent(category, language)
  const dishCount = category.dishes.length

  return (
    <section aria-labelledby={`menu-category-${category.id}`} className="scroll-mt-8">
      <header className="flex flex-col gap-3 border-b border-[#d6b477]/40 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="display-font text-4xl leading-none tracking-[-0.04em] sm:text-5xl"
            id={`menu-category-${category.id}`}
            lang={content.nameLanguage}
          >
            {content.name}
          </h2>
          {content.isTranslated && (
            <p className="mt-2 text-sm italic text-[#cfc6b5]" lang="es">
              Original: {category.spanish_name}
            </p>
          )}
          {content.isMissingTranslation && (
            <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#e1bd78]">
              Sin traducción disponible
            </p>
          )}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d6b477]">
          {dishCount === 1 ? '1 plato' : `${dishCount} platos`}
        </p>
      </header>
      {dishCount === 0 ? (
        <p className="py-6 text-sm text-[#cfc6b5]">No hay platos publicados en esta categoría.</p>
      ) : (
        <ul className="divide-y divide-[#f4eddd]/15">
          {category.dishes.map((dish) => (
            <DishItem dish={dish} key={dish.id} language={language} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function PublicMenuPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedLanguage = (searchParams.get('language') || DEFAULT_MENU_LANGUAGE).trim().toLowerCase()
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState(null)
  const loadedRequestKeyRef = useRef(null)

  useEffect(() => {
    // The public menu has no per-route meta framework. Setting the title here
    // gives /carta its own document title and restores the previous one on unmount.
    const previousTitle = document.title

    document.title = DOCUMENT_TITLE

    return () => {
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    const requestKey = `${requestedLanguage}:${reloadKey}`

    // After a 400 fallback we rewrite the URL to ?language=es with replace history.
    // The Spanish payload is already loaded under this key, so skip the duplicate request.
    if (loadedRequestKeyRef.current === requestKey) {
      return undefined
    }

    const controller = new AbortController()
    let isActive = true

    async function loadMenu() {
      try {
        const menu = await fetchPublicMenu(requestedLanguage, { signal: controller.signal })

        if (isActive) {
          loadedRequestKeyRef.current = requestKey
          setResult({ requestedLanguage, reloadKey, status: 'success', menu, usedFallback: false })
        }
      } catch (error) {
        if (!isActive) {
          return
        }

        if (error?.response?.status === 400 && requestedLanguage !== DEFAULT_MENU_LANGUAGE) {
          try {
            const menu = await fetchPublicMenu(DEFAULT_MENU_LANGUAGE, { signal: controller.signal })

            if (isActive) {
              loadedRequestKeyRef.current = `${DEFAULT_MENU_LANGUAGE}:${reloadKey}`
              setResult({
                requestedLanguage: DEFAULT_MENU_LANGUAGE,
                reloadKey,
                status: 'success',
                menu,
                usedFallback: true,
              })
              setSearchParams({ language: DEFAULT_MENU_LANGUAGE }, { replace: true })
            }
          } catch (fallbackError) {
            if (isActive) {
              setResult({
                requestedLanguage,
                reloadKey,
                status: 'error',
                errorKind: classifyError(fallbackError),
              })
            }
          }

          return
        }

        setResult({ requestedLanguage, reloadKey, status: 'error', errorKind: classifyError(error) })
      }
    }

    loadMenu()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [requestedLanguage, reloadKey, setSearchParams])

  const state = result?.requestedLanguage === requestedLanguage && result.reloadKey === reloadKey
    ? result
    : { status: 'loading' }
  const currentLanguage = state.status === 'success' ? state.menu.language : requestedLanguage
  const categories = state.status === 'success' ? state.menu.categories : []
  const announcement = state.status === 'success'
    ? (categories.length === 0 ? 'No hay platos publicados' : 'Carta cargada')
    : null

  function retry() {
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="landing-grain min-h-screen overflow-x-clip bg-[#131313] text-[#f4eddd]">
      <a
        className="absolute left-4 top-4 z-50 -translate-y-20 border border-[#d6b477] bg-[#131313] px-4 py-3 text-sm font-semibold text-[#f4eddd] transition focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-[#f4eddd]"
        href="#contenido"
      >
        Saltar al contenido
      </a>
      <Header />
      <main
        aria-busy={state.status === 'loading'}
        className="mx-auto w-full max-w-6xl px-5 pb-20 pt-28 sm:px-8 sm:pt-32 lg:px-12 lg:pb-28"
        id="contenido"
      >
        <header className="border-b border-[#f4eddd]/20 pb-10">
          <p className="eyebrow-rule text-xs font-bold uppercase tracking-[0.22em] text-[#e1bd78]">Carta</p>
          <h1 className="display-font mt-6 max-w-3xl text-5xl leading-[0.92] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            La carta de El Cruce.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#cfc6b5]">
            Platos publicados con sus precios, alérgenos declarados y disponibilidad actualizada.
          </p>
        </header>

        <LanguageSelector currentLanguage={currentLanguage} />

        {state.status === 'success' && state.usedFallback && (
          <p className="mt-6 border border-[#d6b477]/45 bg-[#1e2920] px-4 py-3 text-sm leading-6 text-[#eee6d5]" role="status">
            El idioma solicitado no está disponible. Mostramos la carta en español.
          </p>
        )}

        <div className="mt-10" aria-live="polite">
          {state.status === 'loading' && (
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#d6b477]" role="status">
              Cargando la carta…
            </p>
          )}
          {announcement && (
            <p className="sr-only" role="status">{announcement}</p>
          )}
        </div>

        {state.status === 'error' && (
          <div className="border border-[#b24932]/60 bg-[#2a1d19] p-6 sm:p-8" role="alert">
            <p className="display-font text-2xl">{ERROR_COPY[state.errorKind].title}</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#d4cbb9]">
              {ERROR_COPY[state.errorKind].detail}
            </p>
            <button
              className="mt-5 inline-flex min-h-11 items-center border border-[#e1bd78] px-5 text-xs font-bold uppercase tracking-[0.16em] text-[#e1bd78] transition hover:bg-[#e1bd78] hover:text-[#201d18] focus:outline-2 focus:outline-offset-4 focus:outline-[#f4eddd]"
              onClick={retry}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {state.status === 'success' && (
          categories.length === 0 ? (
            <p className="border border-[#f4eddd]/20 px-5 py-8 text-sm leading-6 text-[#cfc6b5]">
              La carta todavía no tiene platos publicados.
            </p>
          ) : (
            <div className="grid gap-14">
              {categories.map((category) => (
                <MenuCategory category={category} key={category.id} language={currentLanguage} />
              ))}
            </div>
          )
        )}
      </main>
      <Footer />
    </div>
  )
}
