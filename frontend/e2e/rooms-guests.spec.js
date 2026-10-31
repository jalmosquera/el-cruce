import { expect, test } from '@playwright/test'
import { signIn } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

test('manager creates, updates, and deletes a room', async ({ page }) => {
  await page.getByRole('link', { name: 'Habitaciones' }).click()
  await page.getByRole('button', { name: 'Nueva habitación' }).click()
  await page.getByLabel('Código').fill('E2E-201')
  await page.getByLabel('Nombre').fill('Habitación creada por E2E')
  await page.getByLabel('Capacidad').fill('3')
  await page.getByRole('button', { name: 'Crear habitación' }).click()
  await expect(page.getByText('Habitación E2E-201 creada.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'E2E-201', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Editar habitación E2E-201' }).click()
  await page.getByLabel('Nombre').fill('Habitación E2E actualizada')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Habitación E2E-201 actualizada.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Habitación E2E actualizada' })).toBeVisible()

  await page.getByRole('button', { name: 'Eliminar habitación E2E-201' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Sí, eliminar E2E-201' }).click()
  await expect(page.getByText('Habitación E2E-201 eliminada.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'E2E-201', exact: true })).toHaveCount(0)
})

test('guest details mask document data and return keyboard focus after Escape', async ({ page }) => {
  await page.getByRole('link', { name: 'Huéspedes' }).click()
  const detailsButton = page.getByRole('button', { name: 'Ver detalles de Andrea Prueba' })
  await detailsButton.focus()
  await detailsButton.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Andrea Prueba' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('•••• 678Z')
  await expect(dialog).not.toContainText('12345678Z')
  await expect(dialog.getByRole('button', { name: 'Cerrar', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(detailsButton).toBeFocused()
})
