import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../lib/apiClient.js'
import { createRoom, listRooms, removeRoom, updateRoom } from './roomsApi.js'

const originalAdapter = apiClient.defaults.adapter

function captureRequest(responseData = {}, status = 200) {
  const adapter = vi.fn((config) => Promise.resolve({
    config,
    data: responseData,
    headers: {},
    status,
    statusText: status === 204 ? 'No Content' : 'OK',
  }))

  apiClient.defaults.adapter = adapter
  return adapter
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('roomsApi', () => {
  it('lists rooms using the approved collection endpoint', async () => {
    const rooms = [{ id: 1, code: '101', name: 'Doble', capacity: 2, status: 'operational' }]
    const adapter = captureRequest(rooms)

    await expect(listRooms()).resolves.toEqual(rooms)

    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      method: 'get',
      url: '/rooms/',
    }))
  })

  it('creates a room with the approved payload and returns the response data', async () => {
    const created = { id: 2, code: '102', name: 'Suite', capacity: 3, status: 'operational' }
    const payload = { code: '102', name: 'Suite', capacity: 3, status: 'operational' }
    const adapter = captureRequest(created)

    await expect(createRoom(payload)).resolves.toEqual(created)

    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      data: JSON.stringify(payload),
      method: 'post',
      url: '/rooms/',
    }))
  })

  it('partially updates a room by id and returns the response data', async () => {
    const updated = { id: 2, code: '102', name: 'Suite reformada', capacity: 4, status: 'maintenance' }
    const payload = { name: 'Suite reformada', capacity: 4, status: 'maintenance' }
    const adapter = captureRequest(updated)

    await expect(updateRoom(2, payload)).resolves.toEqual(updated)

    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      data: JSON.stringify(payload),
      method: 'patch',
      url: '/rooms/2/',
    }))
  })

  it('deletes a room with a 204 response and returns its empty body', async () => {
    const adapter = captureRequest('', 204)

    await expect(removeRoom(2)).resolves.toBe('')

    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      method: 'delete',
      url: '/rooms/2/',
    }))
  })
})
