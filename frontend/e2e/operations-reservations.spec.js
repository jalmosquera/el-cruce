import { expect, test } from '@playwright/test'
import { futureDate, signIn } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

test('operations validates incomplete shift assignments', async ({ page }) => {
  await page.getByRole('link', { name: 'Operaciones' }).click()
  await page.getByRole('button', { name: 'Crear turno' }).click()
  await expect(page.getByRole('alert')).toContainText('Seleccioná un empleado.')
  await expect(page.getByRole('alert')).toContainText('Indicá el inicio.')
})

test('reservations check availability, create a stay, and cancel it', async ({ page }) => {
  const checkIn = futureDate(5)
  const checkOut = futureDate(7)

  await page.getByRole('link', { name: 'Reservas' }).click()
  await expect(page.getByRole('region', { name: 'Ocupación por habitación y fecha' })).toBeVisible()
  await page.getByRole('button', { name: 'Nueva reserva' }).click()
  const creationDialog = page.getByRole('dialog', { name: 'Nueva reserva' })
  await creationDialog.getByLabel('Habitación', { exact: true }).selectOption({ label: '101 — Habitación e2e doble (2)' })
  await creationDialog.getByLabel('Huésped', { exact: true }).selectOption({ label: 'Andrea Prueba' })
  await creationDialog.getByLabel('Entrada').fill(checkIn)
  await creationDialog.getByLabel('Salida').fill(checkOut)
  await creationDialog.getByRole('button', { name: 'Consultar disponibilidad' }).click()
  await expect(page.getByRole('status')).toContainText('Disponibilidad consultada')
  await creationDialog.getByRole('button', { name: 'Crear reserva' }).click()
  await expect(page.getByText('Reserva creada.')).toBeVisible()

  await page.getByRole('button', { name: 'Nueva reserva' }).click()
  const conflictDialog = page.getByRole('dialog', { name: 'Nueva reserva' })
  await conflictDialog.getByLabel('Entrada').fill(checkIn)
  await conflictDialog.getByLabel('Salida').fill(checkOut)
  await conflictDialog.getByRole('button', { name: 'Consultar disponibilidad' }).click()
  await expect(conflictDialog.getByRole('option', { name: /101.*no disponible/ })).toBeDisabled()
  await conflictDialog.getByRole('button', { name: 'Cerrar', exact: true }).click()

  await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click()
  await expect(page.getByText('Reserva cancelada.')).toBeVisible()
})
