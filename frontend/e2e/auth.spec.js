import { expect, test } from '@playwright/test'
import { signIn } from './helpers.js'

test('manager session restores after reload and logout revokes browser access', async ({ page }) => {
  await signIn(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bienvenido, e2e-manager' })).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('employee navigation exposes only employee-appropriate destinations', async ({ page }) => {
  await signIn(page, 'e2e-employee')

  await expect(page.getByRole('link', { name: 'Mi jornada' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Habitaciones' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Reservas' })).toHaveCount(0)
})

test('administrator navigation includes operational destinations and protected routes remain backend-authorized', async ({ page }) => {
  await signIn(page, 'e2e-administrator')

  await expect(page.getByRole('link', { name: 'Administración' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Operaciones' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Habitaciones' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Reservas' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Huéspedes' })).toBeVisible()
  await page.goto('/dashboard/habitaciones')
  await expect(page.getByRole('heading', { name: 'Habitaciones' })).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await signIn(page, 'e2e-employee')
  await page.goto('/dashboard/habitaciones')
  await expect(page.getByRole('heading', { name: 'Habitaciones' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('No tenés permisos para administrar habitaciones.')
})
