import { apiClient } from '../../lib/apiClient.js'

export async function getUserDirectory() {
  const response = await apiClient.get('/identity/users/')
  return response.data
}

export async function getEmployees() {
  const response = await apiClient.get('/employees/')
  return response.data
}

export async function createEmployee(payload) {
  const response = await apiClient.post('/employees/', payload)
  return response.data
}

export async function updateEmployee(employeeId, payload) {
  const response = await apiClient.patch(`/employees/${employeeId}/`, payload)
  return response.data
}

export async function deleteEmployee(employeeId) {
  await apiClient.delete(`/employees/${employeeId}/`)
}

export async function getShifts() {
  const response = await apiClient.get('/shifts/')
  return response.data
}

export async function createShift(payload) {
  const response = await apiClient.post('/shifts/', payload)
  return response.data
}

export async function updateShift(shiftId, payload) {
  const response = await apiClient.patch(`/shifts/${shiftId}/`, payload)
  return response.data
}

export async function deleteShift(shiftId) {
  await apiClient.delete(`/shifts/${shiftId}/`)
}
