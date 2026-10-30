import { apiClient } from '../../lib/apiClient.js'

const GUESTS_PATH = '/guests/'

function guestPath(id) {
  return `${GUESTS_PATH}${id}/`
}

export async function listGuests() {
  const response = await apiClient.get(GUESTS_PATH)
  return response.data
}

export async function createGuest(payload) {
  const response = await apiClient.post(GUESTS_PATH, payload)
  return response.data
}

export async function updateGuest(id, payload) {
  const response = await apiClient.patch(guestPath(id), payload)
  return response.data
}

export async function removeGuest(id) {
  const response = await apiClient.delete(guestPath(id))
  return response.data
}
