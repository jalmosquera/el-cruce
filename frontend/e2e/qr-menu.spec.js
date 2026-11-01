import { expect, test } from '@playwright/test'
import { signIn } from './helpers.js'

const QR_NAME = 'Código QR TEST-02'
const CATEGORY_NAME = 'Categoría TEST-02'
const DISH_NAME = 'Plato TEST-02'
const ENGLISH_DISH_NAME = 'TEST-02 dish'

async function downloadContent(download) {
  const stream = await download.createReadStream()
  const chunks = []

  for await (const chunk of stream) chunks.push(chunk)

  return Buffer.concat(chunks)
}

test('manager creates, persists, previews, copies, and downloads a permanent QR code', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await signIn(page)
  await page.getByRole('link', { name: 'Códigos QR' }).click()
  await expect(page.getByRole('heading', { name: 'Códigos QR' })).toBeVisible()

  await page.getByRole('button', { name: 'Nuevo código QR' }).click()
  await page.getByRole('button', { name: 'Crear código QR' }).click()
  await expect(page.getByRole('alert')).toContainText('Ingresá un nombre para el código QR.')

  await page.getByLabel('Nombre').fill(QR_NAME)
  const target = page.getByLabel('Destino')
  await expect(target).toHaveValue('/carta')
  await expect(target.getByRole('option')).toHaveCount(1)
  await page.getByRole('button', { name: 'Crear código QR' }).click()
  await expect(page.getByRole('status')).toContainText(`Código QR «${QR_NAME}» creado.`)

  await page.reload()
  const qrRow = page.getByRole('row', { name: new RegExp(QR_NAME) })
  await expect(qrRow).toBeVisible()
  const publicUrl = qrRow.locator('code')
  await expect(publicUrl).toHaveText(/^https:\/\/elcruce\.test\/q\/[a-z0-9]+\/$/)

  await qrRow.getByRole('button', { name: `Copiar URL de ${QR_NAME}` }).click()
  await expect(page.getByRole('status')).toContainText('URL pública copiada.')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(await publicUrl.textContent())

  await qrRow.getByRole('button', { name: `Vista previa de ${QR_NAME}` }).click()
  const preview = page.getByRole('dialog', { name: `Vista previa: ${QR_NAME}` })
  await expect(preview.getByRole('img', { name: `Código QR para ${QR_NAME}` })).toBeVisible()

  const svgDownloadPromise = page.waitForEvent('download')
  await preview.getByRole('button', { name: 'Descargar SVG' }).click()
  const svgDownload = await svgDownloadPromise
  expect(svgDownload.suggestedFilename()).toMatch(/^qr-code-[a-z0-9]+\.svg$/)
  expect((await downloadContent(svgDownload)).toString()).toContain('<svg')

  const pngDownloadPromise = page.waitForEvent('download')
  await preview.getByRole('button', { name: 'Descargar PNG' }).click()
  const pngDownload = await pngDownloadPromise
  expect(pngDownload.suggestedFilename()).toMatch(/^qr-code-[a-z0-9]+\.png$/)
  expect((await downloadContent(pngDownload)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
})

test('manager creates and persists published menu content with a manually reviewed English translation', async ({ page }) => {
  await signIn(page)
  await page.getByRole('link', { name: 'Carta' }).click()
  await expect(page.getByRole('heading', { name: 'Carta' })).toBeVisible()

  await page.getByRole('button', { name: 'Nueva categoría' }).click()
  const categoryDialog = page.getByRole('dialog', { name: 'Nueva categoría' })
  await categoryDialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(categoryDialog.getByRole('alert')).toContainText('Este campo no puede estar en blanco.')
  await categoryDialog.getByLabel('Nombre en español').fill(CATEGORY_NAME)
  await categoryDialog.getByLabel('Publicada').check()
  await categoryDialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Cambios guardados.')

  await page.getByRole('button', { name: 'Nuevo plato' }).click()
  const dishDialog = page.getByRole('dialog', { name: 'Nuevo plato' })
  await dishDialog.getByLabel('Categoría').selectOption({ label: CATEGORY_NAME })
  await dishDialog.getByLabel('Número visible').fill('970')
  await dishDialog.getByLabel('Nombre en español').fill(DISH_NAME)
  await dishDialog.getByLabel('Descripción en español').fill('Descripción creada por TEST-02.')
  await dishDialog.getByLabel('Precio (€)').fill('12.50')
  await dishDialog.getByLabel('Publicado').check()
  await dishDialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Cambios guardados.')

  const dishRow = page.getByRole('row', { name: new RegExp(DISH_NAME) })
  await dishRow.getByRole('button', { name: 'Traducciones' }).click()
  const translationDialog = page.getByRole('dialog', { name: 'Nueva traducción' })
  await translationDialog.getByLabel('Idioma').selectOption('en')
  await translationDialog.getByLabel('Nombre traducido').fill(ENGLISH_DISH_NAME)
  await translationDialog.getByLabel('Descripción traducida').fill('Translation created by TEST-02.')
  await translationDialog.getByLabel('Revisada manualmente').check()
  await translationDialog.getByRole('button', { name: 'Guardar traducción' }).click()
  await expect(page.getByRole('status')).toContainText('Cambios guardados.')

  await page.reload()
  await expect(page.getByRole('heading', { name: CATEGORY_NAME, exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(DISH_NAME) })).toBeVisible()
  await expect(page.getByText(`EN: ${ENGLISH_DISH_NAME} · revisada`)).toBeVisible()

  await page.goto('/carta/en')
  await expect(page.getByRole('heading', { name: ENGLISH_DISH_NAME })).toBeVisible()
  await expect(page.getByText(`Original: ${DISH_NAME}`)).toBeVisible()
})

test('employee direct QR and menu routes expose backend authorization failures', async ({ page }) => {
  await signIn(page, 'e2e-employee')

  const qrForbidden = page.waitForResponse((response) => (
    response.url().includes('/api/qr-codes/') && response.request().method() === 'GET'
  ))
  await page.goto('/dashboard/codigos-qr')
  expect((await qrForbidden).status()).toBe(403)
  await expect(page.getByRole('alert')).toContainText('No tenés permisos para administrar códigos QR.')

  const menuForbidden = page.waitForResponse((response) => (
    response.url().includes('/api/menu/categories/') && response.request().method() === 'GET'
  ))
  await page.goto('/dashboard/carta')
  expect((await menuForbidden).status()).toBe(403)
  await expect(page.getByRole('alert')).toContainText('No tenés permisos para administrar la carta.')
})
