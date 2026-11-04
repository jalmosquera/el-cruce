import { apiClient } from '../../lib/apiClient.js'
import { fetchPublicMenu } from '../public-menu/menuApi.js'

const CATEGORIES_PATH = '/menu/categories/'
const DISHES_PATH = '/menu/dishes/'
const CATEGORY_TRANSLATIONS_PATH = '/menu/category-translations/'
const DISH_TRANSLATIONS_PATH = '/menu/dish-translations/'

function resourcePath(path, id) {
  return `${path}${id}/`
}

function createResourceApi(path) {
  return {
    async list() {
      const response = await apiClient.get(path)
      return response.data
    },
    async create(payload) {
      const response = await apiClient.post(path, payload)
      return response.data
    },
    async update(id, payload) {
      const response = await apiClient.patch(resourcePath(path, id), payload)
      return response.data
    },
    async remove(id) {
      const response = await apiClient.delete(resourcePath(path, id))
      return response.data
    },
  }
}

export const menuAdminApi = {
  categories: createResourceApi(CATEGORIES_PATH),
  dishes: createResourceApi(DISHES_PATH),
  categoryTranslations: createResourceApi(CATEGORY_TRANSLATIONS_PATH),
  dishTranslations: createResourceApi(DISH_TRANSLATIONS_PATH),
  fetchPublicPreview(language = 'es') {
    return fetchPublicMenu(language)
  },
}
