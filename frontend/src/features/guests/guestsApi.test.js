import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../lib/apiClient.js'
import { createGuest, listGuests, removeGuest, updateGuest } from './guestsApi.js'

const originalAdapter = apiClient.defaults.adapter

function captureRequest(responseData = {}, status = 200) {
  const adapter = vi.fn((config) => Promise.resolve({ config, data: responseData, headers: {}, status, statusText: status === 204 ? 'No Content' : 'OK' }))
  apiClient.defaults.adapter = adapter
  return adapter
}

afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('guestsApi', () => {
  it('uses the approved guest CRUD endpoints and payloads', async () => {
    const payload = { display_name: 'Ana López', email: '', phone: '', document_type: '', document_number: '', internal_notes: '' }
    let adapter = captureRequest([])
    await expect(listGuests()).resolves.toEqual([])
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ method: 'get', url: '/guests/' }))

    adapter = captureRequest({ id: 4, ...payload })
    await expect(createGuest(payload)).resolves.toEqual({ id: 4, ...payload })
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ method: 'post', url: '/guests/', data: JSON.stringify(payload) }))

    adapter = captureRequest({ id: 4, ...payload, phone: '+34600123456' })
    await updateGuest(4, { phone: '+34600123456' })
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ method: 'patch', url: '/guests/4/', data: JSON.stringify({ phone: '+34600123456' }) }))

    adapter = captureRequest('', 204)
    await expect(removeGuest(4)).resolves.toBe('')
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ method: 'delete', url: '/guests/4/' }))
  })
})
