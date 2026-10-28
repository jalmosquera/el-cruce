import { describe, expect, it, afterEach } from 'vitest'
import { apiClient, clearAccessToken, setAccessToken } from './apiClient.js'

describe('apiClient', () => {
  afterEach(() => {
    clearAccessToken()
  })

  it('uses credentials, Django CSRF settings, and an in-memory bearer token', async () => {
    setAccessToken('short-lived-access-token')
    const response = await apiClient.get('/example/', {
      adapter: (config) => Promise.resolve({ config, data: {}, headers: {}, status: 200, statusText: 'OK' }),
    })

    expect(apiClient.defaults.withCredentials).toBe(true)
    expect(apiClient.defaults.withXSRFToken).toBe(true)
    expect(apiClient.defaults.xsrfCookieName).toBe('csrftoken')
    expect(apiClient.defaults.xsrfHeaderName).toBe('X-CSRFToken')
    expect(response.config.headers.Authorization).toBe('Bearer short-lived-access-token')
  })

  it('does not send an authorization header after the in-memory token is cleared', async () => {
    setAccessToken('short-lived-access-token')
    clearAccessToken()
    const response = await apiClient.get('/example/', {
      adapter: (config) => Promise.resolve({ config, data: {}, headers: {}, status: 200, statusText: 'OK' }),
    })

    expect(response.config.headers.Authorization).toBeUndefined()
  })
})
