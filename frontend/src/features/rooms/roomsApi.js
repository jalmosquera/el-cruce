import { apiClient } from '../../lib/apiClient.js'

const ROOMS_PATH = '/rooms/'

function roomPath(id) {
  return `${ROOMS_PATH}${id}/`
}

export async function listRooms() {
  const response = await apiClient.get(ROOMS_PATH)
  return response.data
}

export async function createRoom(payload) {
  const response = await apiClient.post(ROOMS_PATH, payload)
  return response.data
}

export async function updateRoom(id, payload) {
  const response = await apiClient.patch(roomPath(id), payload)
  return response.data
}

export async function removeRoom(id) {
  const response = await apiClient.delete(roomPath(id))
  return response.data
}
