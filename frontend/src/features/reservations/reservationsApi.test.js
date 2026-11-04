import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../lib/apiClient.js'
import { createReservation, getAvailability, listReservations, updateReservation } from './reservationsApi.js'

const originalAdapter = apiClient.defaults.adapter

function captureRequest(data = {}) {
  const adapter = vi.fn((config) => Promise.resolve({ config, data, headers: {}, status: 200, statusText: 'OK' }))
  apiClient.defaults.adapter = adapter
  return adapter
}

afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('reservationsApi', () => {
  it('uses the approved reservation collection and detail contracts', async () => {
    const payload = { room: 1, guest: 2, check_in: '2026-11-10', check_out: '2026-11-12', guest_count: 2, internal_notes: '' }
    const adapter = captureRequest(payload)
    await listReservations()
    await createReservation(payload)
    await updateReservation(4, { status: 'cancelled' })
    expect(adapter.mock.calls.map(([config]) => ({ method: config.method, url: config.url }))).toEqual([
      { method: 'get', url: '/reservations/' },
      { method: 'post', url: '/reservations/' },
      { method: 'patch', url: '/reservations/4/' },
    ])
    expect(adapter.mock.calls[1][0].data).toBe(JSON.stringify(payload))
  })

  it('queries availability with ISO date parameters and optional room id', async () => {
    const adapter = captureRequest({ rooms: [] })
    await getAvailability({ checkIn: '2026-11-10', checkOut: '2026-11-12', room: 3 })
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      method: 'get', url: '/reservations/availability/', params: { check_in: '2026-11-10', check_out: '2026-11-12', room: 3 },
    }))
  })
})
