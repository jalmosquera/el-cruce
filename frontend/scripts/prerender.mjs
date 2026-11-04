import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const DEFAULT_PUBLIC_SITE_URL = 'https://elcruce.example'

const PAGES = {
  home: {
    path: '/',
    title: 'El Cruce',
    description: 'Información pública de El Cruce.',
    fallback: `<main><h1>El Cruce</h1><p>Información pública de El Cruce.</p><p><a href="/carta">Consultar la carta</a></p></main>`,
  },
}

const MENU_PAGES = {
  es: {
    title: 'La carta | El Cruce',
    description: 'Consultá la carta publicada de El Cruce, con platos, precios, alérgenos declarados y disponibilidad.',
    fallback: `<main><h1>La carta de El Cruce</h1><p>Consultá la carta publicada, con platos, precios, alérgenos declarados y disponibilidad.</p><p>La aplicación carga el contenido actualizado de la carta.</p></main>`,
    ogLocale: 'es_ES',
  },
  en: {
    title: 'Menu | El Cruce',
    description: 'View El Cruce’s published menu, including dishes, prices, declared allergens, and current availability.',
    fallback: `<main><h1>El Cruce menu</h1><p>View the published menu, including dishes, prices, declared allergens, and current availability.</p><p>The application loads the current menu content.</p></main>`,
    ogLocale: 'en_GB',
  },
  fr: {
    title: 'La carte | El Cruce',
    description: 'Consultez la carte publiée d’El Cruce, avec les plats, les prix, les allergènes déclarés et la disponibilité actuelle.',
    fallback: `<main><h1>La carte d’El Cruce</h1><p>Consultez la carte publiée, avec les plats, les prix, les allergènes déclarés et la disponibilité actuelle.</p><p>L’application charge le contenu actuel de la carte.</p></main>`,
    ogLocale: 'fr_FR',
  },
  de: {
    title: 'Speisekarte | El Cruce',
    description: 'Sehen Sie die veröffentlichte Speisekarte von El Cruce mit Gerichten, Preisen, angegebenen Allergenen und aktueller Verfügbarkeit.',
    fallback: `<main><h1>Die Speisekarte von El Cruce</h1><p>Sehen Sie die veröffentlichte Speisekarte mit Gerichten, Preisen, angegebenen Allergenen und aktueller Verfügbarkeit.</p><p>Die Anwendung lädt den aktuellen Inhalt der Speisekarte.</p></main>`,
    ogLocale: 'de_DE',
  },
  it: {
    title: 'Menu | El Cruce',
    description: 'Consulta il menu pubblicato di El Cruce, con piatti, prezzi, allergeni dichiarati e disponibilità attuale.',
    fallback: `<main><h1>Il menu di El Cruce</h1><p>Consulta il menu pubblicato, con piatti, prezzi, allergeni dichiarati e disponibilità attuale.</p><p>L’applicazione carica il contenuto attuale del menu.</p></main>`,
    ogLocale: 'it_IT',
  },
}

export const MENU_LANGUAGES = Object.keys(MENU_PAGES)

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function resolveSiteUrl(value = process.env.PUBLIC_SITE_URL) {
  const rawUrl = value || DEFAULT_PUBLIC_SITE_URL
  let parsedUrl

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error('PUBLIC_SITE_URL must be an absolute HTTPS origin.')
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('PUBLIC_SITE_URL must use HTTPS.')
  }

  if (parsedUrl.username || parsedUrl.password || parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) {
    throw new Error('PUBLIC_SITE_URL must be an HTTPS origin without credentials, a path, a query, or a fragment.')
  }

  return parsedUrl.href.replace(/\/$/, '')
}

export function absoluteUrl(siteUrl, pathname) {
  return new URL(pathname, `${siteUrl}/`).href
}

export function pageMetadata(pageName, siteUrl) {
  const page = PAGES[pageName]

  if (!page) {
    throw new Error(`Unknown prerender page: ${pageName}`)
  }

  const canonicalUrl = absoluteUrl(siteUrl, page.path)

  return {
    ...page,
    canonicalUrl,
    language: 'es',
    ogLocale: 'es_ES',
  }
}

export function menuMetadata(language, siteUrl) {
  const page = MENU_PAGES[language]

  if (!page) {
    throw new Error(`Unknown menu language: ${language}`)
  }

  const path = `/carta/${language}`
  const canonicalUrl = absoluteUrl(siteUrl, path)

  return {
    ...page,
    path,
    language,
    canonicalUrl,
    alternates: [
      ...MENU_LANGUAGES.map((code) => ({
        language: code,
        url: absoluteUrl(siteUrl, `/carta/${code}`),
      })),
      { language: 'x-default', url: absoluteUrl(siteUrl, '/carta/es') },
    ],
  }
}

export function renderHead(metadata) {
  const { alternates = [], canonicalUrl, description, language, ogLocale = 'es_ES', title } = metadata
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  const escapedCanonicalUrl = escapeHtml(canonicalUrl)
  const alternateLinks = alternates.map((alternate) => (
    `<link rel="alternate" hreflang="${alternate.language}" href="${escapeHtml(alternate.url)}" />`
  )).join('\n    ')
  return `<meta name="description" content="${escapedDescription}" />
    <meta name="language" content="${language}" />
    <link rel="canonical" href="${escapedCanonicalUrl}" />
    ${alternateLinks}
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapedCanonicalUrl}" />
    <meta property="og:locale" content="${ogLocale}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <title>${escapedTitle}</title>`
}

export function renderPage(template, metadata) {
  const head = renderHead(metadata)
  const documentWithLanguage = template.replace(/<html\b[^>]*>/i, `<html lang="${metadata.language}">`)
  const withoutDefaultMetadata = documentWithLanguage
    .replace(/\s*<meta\s+name=["']description["'][^>]*>/i, '')
    .replace(/\s*<title>[^<]*<\/title>/i, '')

  if (!withoutDefaultMetadata.includes('<div id="root"></div>')) {
    throw new Error('The Vite output does not contain the expected empty #root element.')
  }

  return withoutDefaultMetadata
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${metadata.fallback}</div>`)
}

export function renderDashboardShell(template) {
  const documentWithLanguage = template.replace(/<html\b[^>]*>/i, '<html lang="es">')
  const withoutDefaultMetadata = documentWithLanguage
    .replace(/\s*<meta\s+name=["']description["'][^>]*>/i, '')
    .replace(/\s*<title>[^<]*<\/title>/i, '')

  if (!withoutDefaultMetadata.includes('<div id="root"></div>')) {
    throw new Error('The Vite output does not contain the expected empty #root element.')
  }

  return withoutDefaultMetadata
    .replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n    <title>Dashboard | El Cruce</title>\n  </head>')
    .replace('<div id="root"></div>', '<div id="root"><main><h1>Panel interno de El Cruce</h1><p>Iniciá sesión para acceder al panel.</p></main></div>')
}

export function renderSitemap(siteUrl) {
  const urls = [
    absoluteUrl(siteUrl, '/'),
    ...MENU_LANGUAGES.map((language) => absoluteUrl(siteUrl, `/carta/${language}`)),
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}
</urlset>
`
}

export function renderRobots(siteUrl) {
  return `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /api/
Disallow: /q/

Sitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}
`
}

export async function generatePrerenderedFiles({ outDir = 'dist', publicSiteUrl } = {}) {
  const siteUrl = resolveSiteUrl(publicSiteUrl)
  const templatePath = path.join(outDir, 'index.html')
  const template = await readFile(templatePath, 'utf8')
  const home = pageMetadata('home', siteUrl)
  const menuPages = MENU_LANGUAGES.map((language) => menuMetadata(language, siteUrl))
  const menuCompatibility = {
    ...menuMetadata('es', siteUrl),
    path: '/carta',
  }

  await Promise.all([
    ...MENU_LANGUAGES.map((language) => mkdir(path.join(outDir, 'carta', language), { recursive: true })),
    mkdir(path.join(outDir, 'dashboard'), { recursive: true }),
  ])
  await Promise.all([
    writeFile(templatePath, renderPage(template, home), 'utf8'),
    writeFile(path.join(outDir, 'carta', 'index.html'), renderPage(template, menuCompatibility), 'utf8'),
    ...menuPages.map((menu) => writeFile(path.join(outDir, 'carta', menu.language, 'index.html'), renderPage(template, menu), 'utf8')),
    writeFile(path.join(outDir, 'dashboard', 'index.html'), renderDashboardShell(template), 'utf8'),
    writeFile(path.join(outDir, 'sitemap.xml'), renderSitemap(siteUrl), 'utf8'),
    writeFile(path.join(outDir, 'robots.txt'), renderRobots(siteUrl), 'utf8'),
  ])
}
