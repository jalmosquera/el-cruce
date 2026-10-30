import { apiClient } from '../../lib/apiClient.js'

const RESERVATIONS_PATH = '/reservations/'

export async function listReservations() {
  const response = await apiClient.get(RESERVATIONS_PATH)
  return response.data
}

export async function createReservation(payload) {
  const response = await apiClient.post(RESERVATIONS_PATH, payload)
  return response.data
}

export async function updateReservation(id, payload) {
  const response = await apiClient.patch(`${RESERVATIONS_PATH}${id}/`, payload)
  return response.data
}

export async function getAvailability({ checkIn, checkOut, room }) {
  const response = await apiClient.get(`${RESERVATIONS_PATH}availability/`, {
    params: { check_in: checkIn, check_out: checkOut, ...(room ? { room } : {}) },
  })
  return response.data
}
