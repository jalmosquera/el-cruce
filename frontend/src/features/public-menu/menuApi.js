import { apiClient } from '../../lib/apiClient.js'

export const MENU_LANGUAGES = [
  { code: 'es', label: 'Español', locale: 'es-ES' },
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'fr', label: 'Français', locale: 'fr-FR' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'it', label: 'Italiano', locale: 'it-IT' },
]

export const DEFAULT_MENU_LANGUAGE = 'es'

const SUPPORTED_LANGUAGE_CODES = MENU_LANGUAGES.map((language) => language.code)
const DECIMAL_PRICE_PATTERN = /^\d+(\.\d{1,2})?$/

// The public contract is validated at the shape level. Intentional permissiveness:
// descriptions may be empty, allergen codes are not re-checked against a catalog,
// prices may use leading zeros, and translation_available is not cross-checked
// against the returned names. The UI must never infer a missing price or name.

export class MenuPayloadError extends Error {
  constructor(message) {
    super(message)
    this.name = 'MenuPayloadError'
  }
}

function fail(path, expectation) {
  throw new MenuPayloadError(`Invalid public menu payload at "${path}": expected ${expectation}.`)
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expectRecord(value, path) {
  if (!isRecord(value)) {
    fail(path, 'an object')
  }

  return value
}

function expectArray(value, path) {
  if (!Array.isArray(value)) {
    fail(path, 'an array')
  }

  return value
}

function expectString(value, path) {
  if (typeof value !== 'string') {
    fail(path, 'a string')
  }

  return value
}

function expectNonBlankString(value, path) {
  expectString(value, path)

  if (value.trim() === '') {
    fail(path, 'a non-blank string')
  }

  return value
}

function expectBoolean(value, path) {
  if (typeof value !== 'boolean') {
    fail(path, 'a boolean')
  }

  return value
}

function expectPositiveInteger(value, path) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(path, 'a positive integer')
  }

  return value
}

function expectPrice(value, path) {
  expectString(value, path)

  if (!DECIMAL_PRICE_PATTERN.test(value)) {
    fail(path, 'a decimal string with up to two decimals')
  }

  return value
}

function expectAllergens(value, path) {
  expectArray(value, path)
  value.forEach((allergen, index) => expectString(allergen, `${path}[${index}]`))

  return value
}

function validateDish(dish, path) {
  expectRecord(dish, path)
  expectPositiveInteger(dish.id, `${path}.id`)
  expectPositiveInteger(dish.visible_number, `${path}.visible_number`)
  expectNonBlankString(dish.name, `${path}.name`)
  expectNonBlankString(dish.spanish_name, `${path}.spanish_name`)
  expectString(dish.description, `${path}.description`)
  expectString(dish.spanish_description, `${path}.spanish_description`)
  expectBoolean(dish.translation_available, `${path}.translation_available`)
  expectPrice(dish.price, `${path}.price`)
  expectAllergens(dish.allergens, `${path}.allergens`)
  expectBoolean(dish.is_available, `${path}.is_available`)
}

function validateCategory(category, path) {
  expectRecord(category, path)
  expectPositiveInteger(category.id, `${path}.id`)
  expectNonBlankString(category.name, `${path}.name`)
  expectNonBlankString(category.spanish_name, `${path}.spanish_name`)
  expectBoolean(category.translation_available, `${path}.translation_available`)

  const dishes = expectArray(category.dishes, `${path}.dishes`)
  dishes.forEach((dish, index) => validateDish(dish, `${path}.dishes[${index}]`))
}

function validateMenuPayload(payload) {
  expectRecord(payload, 'payload')

  const language = expectString(payload.language, 'language')

  if (!SUPPORTED_LANGUAGE_CODES.includes(language)) {
    fail('language', `one of ${SUPPORTED_LANGUAGE_CODES.join(', ')}`)
  }

  const categories = expectArray(payload.categories, 'categories')
  categories.forEach((category, index) => validateCategory(category, `categories[${index}]`))

  return payload
}

export async function fetchPublicMenu(language, { signal } = {}) {
  const response = await apiClient.get('/menu/public/', {
    params: { language },
    signal,
  })

  return validateMenuPayload(response.data)
}
