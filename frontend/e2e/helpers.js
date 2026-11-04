import { expect } from '@playwright/test'

export const E2E_PASSWORD = 'e2e-only-password'

export async function signIn(page, username = 'e2e-manager') {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: `Bienvenido, ${username}` })).toBeVisible()
}

export function futureDate(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
