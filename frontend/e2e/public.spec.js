import { expect, test } from '@playwright/test'

test('localized public menu shows persisted English content and Spanish source', async ({ page }) => {
  await page.goto('/carta/en')
  await expect(page.getByRole('heading', { name: 'La carta de El Cruce.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Test starters' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Test omelette' })).toBeVisible()
  await expect(page.getByText('Original: Tortilla de prueba')).toBeVisible()
})

test('localized public menu shows persisted French content and Spanish source', async ({ page }) => {
  await page.goto('/carta/fr')
  await expect(page.getByRole('heading', { name: 'Entrées de test' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Omelette de test' })).toBeVisible()
  await expect(page.getByText('Original: Tortilla de prueba')).toBeVisible()
})

test('mobile public navigation opens and closes using accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const navigationToggle = page.getByRole('button', { name: 'Abrir navegación' })
  await navigationToggle.click()
  await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar navegación' })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('link', { name: 'Carta' }).last().click()
  await expect(page).toHaveURL(/\/carta/)
})

test('tablet dashboard navigation remains usable with keyboard-only skip navigation', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('e2e-manager')
  await page.getByLabel('Contraseña').fill('e2e-only-password')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Bienvenido, e2e-manager' })).toBeVisible()
  await page.evaluate(() => document.activeElement?.blur())

  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Ir al contenido principal' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#dashboard-content$/)

  await page.getByRole('link', { name: 'Habitaciones' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Habitaciones' })).toBeVisible()
})
