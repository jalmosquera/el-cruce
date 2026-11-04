import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { generatePrerenderedFiles, MENU_LANGUAGES, menuMetadata, pageMetadata, renderDashboardShell, renderPage, renderRobots, renderSitemap, resolveSiteUrl } from './prerender.mjs'

const SITE_URL = 'https://public.example'
const TEMPLATE = '<!doctype html><html lang="es"><head><meta name="description" content="old" /><title>Old title</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>'
const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe('prerender metadata', () => {
  it('uses a safe local default and accepts only HTTPS origins', () => {
    assert.equal(resolveSiteUrl(''), 'https://elcruce.example')
    assert.equal(resolveSiteUrl('https://public.example/'), SITE_URL)
    assert.throws(() => resolveSiteUrl('not a URL'), /absolute HTTPS origin/)
    assert.throws(() => resolveSiteUrl('http://public.example'), /must use HTTPS/)
    assert.throws(() => resolveSiteUrl('ftp://public.example'), /must use HTTPS/)
    assert.throws(() => resolveSiteUrl('https://user:password@public.example'), /without credentials/)
    assert.throws(() => resolveSiteUrl('https://public.example/app'), /without credentials, a path/)
    assert.throws(() => resolveSiteUrl('https://public.example?source=test'), /without credentials, a path/)
    assert.throws(() => resolveSiteUrl('https://public.example#section'), /without credentials, a path/)
  })

  it('generates genuine localized menu artifacts with self canonicals and complete alternates', () => {
    for (const language of MENU_LANGUAGES) {
      const menu = menuMetadata(language, SITE_URL)
      const page = renderPage(TEMPLATE, menu)

      assert.match(page, new RegExp(`<html lang="${language}">`))
      assert.match(page, new RegExp(`rel="canonical" href="https:\/\/public\\.example\/carta\/${language}"`))
      assert.match(page, new RegExp(`<title>${menu.title}<\/title>`))
      assert.match(page, /src="\/assets\/app\.js"/)
      assert.doesNotMatch(page, /\?language=/)
      for (const alternateLanguage of MENU_LANGUAGES) {
        assert.match(page, new RegExp(`rel="alternate" hreflang="${alternateLanguage}" href="https:\/\/public\\.example\/carta\/${alternateLanguage}"`))
      }
      assert.match(page, /rel="alternate" hreflang="x-default" href="https:\/\/public\.example\/carta\/es"/)
    }
  })

  it('limits sitemap and robots output to public routes and private exclusions', () => {
    const sitemap = renderSitemap(SITE_URL)
    const robots = renderRobots(SITE_URL)

    assert.match(sitemap, /<loc>https:\/\/public\.example\/<\/loc>/)
    for (const language of MENU_LANGUAGES) {
      assert.match(sitemap, new RegExp(`<loc>https:\/\/public\\.example\/carta\/${language}<\/loc>`))
    }
    assert.equal((sitemap.match(/<loc>/g) ?? []).length, MENU_LANGUAGES.length + 1)
    assert.doesNotMatch(sitemap, /dashboard|api|\/q\/|\?language=/)
    for (const path of ['/dashboard/', '/api/', '/q/']) {
      assert.match(robots, new RegExp(`Disallow: ${path.replaceAll('/', '\\/')}`))
    }
  })

  it('generates a non-indexable dashboard static shell without a canonical URL', () => {
    const dashboard = renderDashboardShell(TEMPLATE)

    assert.match(dashboard, /<meta name="robots" content="noindex, nofollow" \/>/)
    assert.match(dashboard, /<main><h1>Panel interno de El Cruce<\/h1>/)
    assert.doesNotMatch(dashboard, /rel="canonical"/)
  })

  it('writes the dashboard noindex artifact with the public static files', async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), 'elcruce-prerender-'))
    temporaryDirectories.push(outDir)
    await writeFile(path.join(outDir, 'index.html'), TEMPLATE, 'utf8')

    await generatePrerenderedFiles({ outDir, publicSiteUrl: SITE_URL })

    const [dashboard, compatibilityMenu, localizedMenu, sitemap] = await Promise.all([
      readFile(path.join(outDir, 'dashboard', 'index.html'), 'utf8'),
      readFile(path.join(outDir, 'carta', 'index.html'), 'utf8'),
      readFile(path.join(outDir, 'carta', 'fr', 'index.html'), 'utf8'),
      readFile(path.join(outDir, 'sitemap.xml'), 'utf8'),
    ])
    assert.match(dashboard, /<meta name="robots" content="noindex, nofollow" \/>/)
    assert.doesNotMatch(dashboard, /rel="canonical"/)
    assert.match(compatibilityMenu, /rel="canonical" href="https:\/\/public\.example\/carta\/es"/)
    assert.match(localizedMenu, /<html lang="fr">/)
    assert.match(localizedMenu, /rel="canonical" href="https:\/\/public\.example\/carta\/fr"/)
    assert.doesNotMatch(sitemap, /dashboard|\?language=/)
  })
})
