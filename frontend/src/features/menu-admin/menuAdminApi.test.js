import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../lib/apiClient.js'
import { menuAdminApi } from './menuAdminApi.js'

const originalAdapter = apiClient.defaults.adapter

function captureRequest(data = {}) {
  const adapter = vi.fn((config) => Promise.resolve({ config, data, headers: {}, status: 200, statusText: 'OK' }))
  apiClient.defaults.adapter = adapter
  return adapter
}

afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('menuAdminApi', () => {
  it.each([
    ['categories', '/menu/categories/'],
    ['dishes', '/menu/dishes/'],
    ['categoryTranslations', '/menu/category-translations/'],
    ['dishTranslations', '/menu/dish-translations/'],
  ])('uses the approved %s endpoint for CRUD', async (collection, path) => {
    const adapter = captureRequest({ id: 1 })
    await menuAdminApi[collection].list()
    await menuAdminApi[collection].create({ name: 'Source' })
    await menuAdminApi[collection].update(1, { name: 'Changed' })
    await menuAdminApi[collection].remove(1)

    expect(adapter.mock.calls.map(([config]) => ({ method: config.method, url: config.url }))).toEqual([
      { method: 'get', url: path }, { method: 'post', url: path }, { method: 'patch', url: `${path}1/` }, { method: 'delete', url: `${path}1/` },
    ])
  })
})
