import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, clearAccessToken, setAccessToken } from '../../lib/apiClient.js'
import { MenuPayloadError, fetchPublicMenu } from './menuApi.js'

const originalAdapter = apiClient.defaults.adapter

function validPayload() {
  return {
    language: 'en',
    categories: [
      {
        id: 1,
        name: 'Starters',
        spanish_name: 'Entrantes',
        translation_available: true,
        dishes: [
          {
            id: 10,
            visible_number: 7,
            name: 'Spanish omelette',
            spanish_name: 'Tortilla española',
            description: 'With potatoes and egg.',
            spanish_description: 'Con patatas y huevo.',
            translation_available: true,
            price: '8.50',
            allergens: ['eggs'],
            is_available: true,
          },
        ],
      },
    ],
  }
}

function captureRequest(responseData = validPayload()) {
  const adapter = vi.fn((config) => Promise.resolve({
    config,
    data: responseData,
    headers: {},
    status: 200,
    statusText: 'OK',
  }))

  apiClient.defaults.adapter = adapter
  return adapter
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  clearAccessToken()
})

describe('fetchPublicMenu', () => {
  it('requests the public menu even when the shared client holds an access token', async () => {
    // apiClient is shared with the authenticated dashboard and may attach the
    // in-memory bearer token for same-origin requests. The public endpoint must
    // keep working with that header present.
    setAccessToken('menu-test-token')
    const adapter = captureRequest()

    await expect(fetchPublicMenu('en')).resolves.toEqual(validPayload())

    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      method: 'get',
      url: '/menu/public/',
      params: { language: 'en' },
    }))
  })

  it('forwards the abort signal to the shared client', async () => {
    const adapter = captureRequest()
    const controller = new AbortController()

    await fetchPublicMenu('fr', { signal: controller.signal })

    expect(adapter.mock.calls[0][0].signal).toBe(controller.signal)
  })

  it('propagates transport errors without altering them', async () => {
    const transportError = Object.assign(new Error('Bad Request'), { response: { status: 400 } })

    apiClient.defaults.adapter = vi.fn(() => Promise.reject(transportError))

    await expect(fetchPublicMenu('xx')).rejects.toBe(transportError)
  })
})

describe('public menu payload validation', () => {
  const invalidPayloads = [
    ['payload is not an object', () => []],
    ['language is missing', () => ({ ...validPayload(), language: undefined })],
    ['language is unsupported', () => ({ ...validPayload(), language: 'pt' })],
    ['categories is not an array', () => ({ ...validPayload(), categories: {} })],
    ['category is not an object', () => ({ ...validPayload(), categories: [null] })],
    ['category id is not an integer', () => mutateCategory((category) => { category.id = '1' })],
    ['category id is zero', () => mutateCategory((category) => { category.id = 0 })],
    ['category id is negative', () => mutateCategory((category) => { category.id = -1 })],
    ['category name is not a string', () => mutateCategory((category) => { category.name = 3 })],
    ['category name is blank', () => mutateCategory((category) => { category.name = '   ' })],
    ['category spanish name is not a string', () => mutateCategory((category) => { category.spanish_name = null })],
    ['category spanish name is blank', () => mutateCategory((category) => { category.spanish_name = '' })],
    ['category translation flag is not boolean', () => mutateCategory((category) => { category.translation_available = 'yes' })],
    ['category dishes is not an array', () => mutateCategory((category) => { category.dishes = null })],
    ['dish is not an object', () => {
      const payload = validPayload()
      payload.categories[0].dishes[0] = null
      return payload
    }],
    ['dish id is not an integer', () => mutateDish((dish) => { dish.id = 1.5 })],
    ['dish id is zero', () => mutateDish((dish) => { dish.id = 0 })],
    ['visible number is not an integer', () => mutateDish((dish) => { dish.visible_number = 7.5 })],
    ['visible number is negative', () => mutateDish((dish) => { dish.visible_number = -7 })],
    ['dish name is not a string', () => mutateDish((dish) => { dish.name = false })],
    ['dish name is blank', () => mutateDish((dish) => { dish.name = ' ' })],
    ['dish spanish name is not a string', () => mutateDish((dish) => { dish.spanish_name = [] })],
    ['dish spanish name is blank', () => mutateDish((dish) => { dish.spanish_name = '' })],
    ['dish description is not a string', () => mutateDish((dish) => { dish.description = null })],
    ['dish spanish description is not a string', () => mutateDish((dish) => { dish.spanish_description = 0 })],
    ['dish translation flag is not boolean', () => mutateDish((dish) => { dish.translation_available = 1 })],
    ['price is not a string', () => mutateDish((dish) => { dish.price = 8.5 })],
    ['price is blank', () => mutateDish((dish) => { dish.price = ' ' })],
    ['price is not numeric', () => mutateDish((dish) => { dish.price = 'ocho' })],
    ['price is a consultation label', () => mutateDish((dish) => { dish.price = 'consultar' })],
    ['price has more than two decimals', () => mutateDish((dish) => { dish.price = '12.345' })],
    ['price uses a comma', () => mutateDish((dish) => { dish.price = '1,50' })],
    ['price has no integer part', () => mutateDish((dish) => { dish.price = '.50' })],
    ['price has no decimal part', () => mutateDish((dish) => { dish.price = '8.' })],
    ['price is negative', () => mutateDish((dish) => { dish.price = '-1' })],
    ['price has a leading sign', () => mutateDish((dish) => { dish.price = '+8' })],
    ['price has surrounding whitespace', () => mutateDish((dish) => { dish.price = ' 8.50 ' })],
    ['allergens is not an array', () => mutateDish((dish) => { dish.allergens = 'eggs' })],
    ['allergen is not a string', () => mutateDish((dish) => { dish.allergens = [1] })],
    ['availability flag is not boolean', () => mutateDish((dish) => { dish.is_available = null })],
  ]

  function mutateCategory(mutate) {
    const payload = validPayload()
    mutate(payload.categories[0])
    return payload
  }

  function mutateDish(mutate) {
    const payload = validPayload()
    mutate(payload.categories[0].dishes[0])
    return payload
  }

  it.each(invalidPayloads)('rejects a payload when %s', async (_description, buildPayload) => {
    captureRequest(buildPayload())

    await expect(fetchPublicMenu('en')).rejects.toBeInstanceOf(MenuPayloadError)
  })

  it.each(['0', '8', '8.5', '8.50', '0008.50'])('accepts the decimal price %s', async (price) => {
    const payload = mutateDish((dish) => { dish.price = price })
    captureRequest(payload)

    await expect(fetchPublicMenu('en')).resolves.toEqual(payload)
  })

  it('accepts blank descriptions because they are optional in the public contract', async () => {
    const payload = mutateDish((dish) => {
      dish.description = ''
      dish.spanish_description = ''
    })
    captureRequest(payload)

    await expect(fetchPublicMenu('en')).resolves.toEqual(payload)
  })

  it('accepts an empty published menu', async () => {
    captureRequest({ language: 'es', categories: [] })

    await expect(fetchPublicMenu('es')).resolves.toEqual({ language: 'es', categories: [] })
  })
})
