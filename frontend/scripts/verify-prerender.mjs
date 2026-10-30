import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { MENU_LANGUAGES, menuMetadata, pageMetadata, resolveSiteUrl } from './prerender.mjs'

const outDir = path.resolve(process.cwd(), 'dist')
const siteUrl = resolveSiteUrl(process.env.PUBLIC_SITE_URL)

async function readOutput(...segments) {
  return readFile(path.join(outDir, ...segments), 'utf8')
}

function requireIncludes(output, expected, fileName) {
  assert.ok(output.includes(expected), `${fileName} must include: ${expected}`)
}

function requireExcludes(output, pattern, fileName) {
  assert.doesNotMatch(output, pattern, `${fileName} must not include: ${pattern}`)
}

const [home, compatibilityMenu, dashboard, sitemap, robots, ...localizedMenus] = await Promise.all([
  readOutput('index.html'),
  readOutput('carta', 'index.html'),
  readOutput('dashboard', 'index.html'),
  readOutput('sitemap.xml'),
  readOutput('robots.txt'),
  ...MENU_LANGUAGES.map((language) => readOutput('carta', language, 'index.html')),
])

for (const [fileName, output, metadata] of [
  ['index.html', home, pageMetadata('home', siteUrl)],
]) {
  requireIncludes(output, `<title>${metadata.title}</title>`, fileName)
  requireIncludes(output, `<link rel="canonical" href="${metadata.canonicalUrl}" />`, fileName)
  requireIncludes(output, '<meta property="og:type" content="website" />', fileName)
  requireIncludes(output, '<meta name="twitter:card" content="summary" />', fileName)
  requireIncludes(output, '<main>', fileName)
}

requireIncludes(sitemap, `<loc>${siteUrl}/</loc>`, 'sitemap.xml')
requireIncludes(compatibilityMenu, `<link rel="canonical" href="${siteUrl}/carta/es" />`, 'carta/index.html')
for (const [index, language] of MENU_LANGUAGES.entries()) {
  const metadata = menuMetadata(language, siteUrl)
  const fileName = `carta/${language}/index.html`
  const menu = localizedMenus[index]

  requireIncludes(menu, `<html lang="${language}">`, fileName)
  requireIncludes(menu, `<title>${metadata.title}</title>`, fileName)
  requireIncludes(menu, `<link rel="canonical" href="${metadata.canonicalUrl}" />`, fileName)
  for (const alternate of metadata.alternates) {
    requireIncludes(menu, `<link rel="alternate" hreflang="${alternate.language}" href="${alternate.url}" />`, fileName)
  }
  requireIncludes(sitemap, `<loc>${metadata.canonicalUrl}</loc>`, 'sitemap.xml')
  requireExcludes(menu, /\?language=/, fileName)
}
requireExcludes(sitemap, /dashboard|\?language=/, 'sitemap.xml')
requireIncludes(dashboard, '<meta name="robots" content="noindex, nofollow" />', 'dashboard/index.html')
requireExcludes(dashboard, /rel="canonical"/, 'dashboard/index.html')
for (const disallowedPath of ['/dashboard/', '/api/', '/q/']) {
  requireIncludes(robots, `Disallow: ${disallowedPath}`, 'robots.txt')
}

console.log('Prerendered public files are valid.')
