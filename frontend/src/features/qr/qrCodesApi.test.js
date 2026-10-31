import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../lib/apiClient.js'
import { createQrCode, fetchQrCodeFile, listQrCodes, updateQrCode } from './qrCodesApi.js'

const originalAdapter = apiClient.defaults.adapter

function capture(responseData = {}, status = 200) {
  const adapter = vi.fn((config) => Promise.resolve({ config, data: responseData, headers: {}, status, statusText: 'OK' }))
  apiClient.defaults.adapter = adapter
  return adapter
}

afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('qrCodesApi', () => {
  it('uses the approved QR collection and mutable fields', async () => {
    const payload = { name: 'Carta terraza', target_path: '/carta', is_active: true }
    const adapter = capture([payload])
    await expect(listQrCodes()).resolves.toEqual([payload])
    await expect(createQrCode(payload)).resolves.toEqual([payload])
    await expect(updateQrCode(4, payload)).resolves.toEqual([payload])
    expect(adapter.mock.calls.map(([config]) => [config.method, config.url])).toEqual([
      ['get', '/qr-codes/'], ['post', '/qr-codes/'], ['patch', '/qr-codes/4/'],
    ])
    expect(adapter.mock.calls[2][0].data).toBe(JSON.stringify(payload))
  })

  it('fetches authenticated SVG and PNG files as blobs from protected endpoints', async () => {
    const adapter = capture(new Blob(['svg'], { type: 'image/svg+xml' }))
    await expect(fetchQrCodeFile(4, 'svg')).resolves.toBeInstanceOf(Blob)
    await fetchQrCodeFile(4, 'png')
    expect(adapter.mock.calls.map(([config]) => [config.url, config.responseType])).toEqual([
      ['/qr-codes/4/download/svg/', 'blob'], ['/qr-codes/4/download/png/', 'blob'],
    ])
  })
})
