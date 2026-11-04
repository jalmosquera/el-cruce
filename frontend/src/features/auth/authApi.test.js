import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../lib/apiClient.js'
import { getCurrentUser, login, logout, refresh } from './authApi.js'

const originalAdapter = apiClient.defaults.adapter

function captureRequest(responseData = {}) {
  const adapter = vi.fn((config) => Promise.resolve({
    config,
    data: responseData,
    headers: {},
    status: 200,
    statusText: 'OK',
  }))

  apiClient.defaults.adapter = adapter
  return adapter
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('authApi', () => {
  it('posts login credentials using the configured cookie and CSRF behavior', async () => {
    const adapter = captureRequest({ access: 'access-token' })

    await expect(login({ username: 'ana', password: 'secreta' })).resolves.toEqual({ access: 'access-token' })

    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      data: JSON.stringify({ username: 'ana', password: 'secreta' }),
      method: 'post',
      url: '/auth/login/',
      withCredentials: true,
      withXSRFToken: true,
      xsrfCookieName: 'csrftoken',
      xsrfHeaderName: 'X-CSRFToken',
    }))
  })

  it('uses the approved refresh, current-user, and logout endpoints', async () => {
    const adapter = captureRequest({ id: 7, username: 'ana' })

    await expect(refresh()).resolves.toEqual({ id: 7, username: 'ana' })
    await expect(getCurrentUser()).resolves.toEqual({ id: 7, username: 'ana' })
    await expect(logout()).resolves.toBeUndefined()

    expect(adapter.mock.calls.map(([config]) => ({ method: config.method, url: config.url, data: config.data }))).toEqual([
      { method: 'post', url: '/auth/refresh/', data: undefined },
      { method: 'get', url: '/auth/me/', data: undefined },
      { method: 'post', url: '/auth/logout/', data: undefined },
    ])
    expect(adapter.mock.calls.map(([config]) => ({
      withCredentials: config.withCredentials,
      withXSRFToken: config.withXSRFToken,
      xsrfCookieName: config.xsrfCookieName,
      xsrfHeaderName: config.xsrfHeaderName,
    }))).toEqual(Array(3).fill({
      withCredentials: true,
      withXSRFToken: true,
      xsrfCookieName: 'csrftoken',
      xsrfHeaderName: 'X-CSRFToken',
    }))
  })
})
