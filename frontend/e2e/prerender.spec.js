import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const dist = (path) => fileURLToPath(new URL(`../dist/${path}`, import.meta.url))

test('built public localized routes have static indexable HTML and dashboard remains noindex', async () => {
  const [englishMenu, dashboard, sitemap] = await Promise.all([
    readFile(dist('carta/en/index.html'), 'utf8'),
    readFile(dist('dashboard/index.html'), 'utf8'),
    readFile(dist('sitemap.xml'), 'utf8'),
  ])

  expect(englishMenu).toContain('<html lang="en">')
  expect(englishMenu).toContain('rel="canonical"')
  expect(englishMenu).toContain('hreflang="es"')
  expect(dashboard).toContain('noindex, nofollow')
  expect(sitemap).toContain('/carta/en')
})
