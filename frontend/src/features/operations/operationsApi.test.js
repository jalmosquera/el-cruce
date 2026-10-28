import { describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../lib/apiClient.js'
import * as operationsApi from './operationsApi.js'

describe('operations API', () => {
  it('uses the approved directory, employee, and shift endpoints with approved payloads', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] })
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { id: 1 } })
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: { id: 2 } })
    const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({})

    await operationsApi.getUserDirectory()
    await operationsApi.getEmployees()
    await operationsApi.createEmployee({ user: 3 })
    await operationsApi.updateEmployee(1, { user: 7 })
    await operationsApi.deleteEmployee(4)
    await operationsApi.getShifts()
    await operationsApi.createShift({ employee: 1, starts_at: '2026-10-28T10:00:00+01:00', ends_at: '2026-10-28T11:00:00+01:00' })
    await operationsApi.updateShift(2, { employee: 1 })
    await operationsApi.deleteShift(2)

    expect(get).toHaveBeenNthCalledWith(1, '/identity/users/')
    expect(get).toHaveBeenNthCalledWith(2, '/employees/')
    expect(post).toHaveBeenNthCalledWith(1, '/employees/', { user: 3 })
    expect(patch).toHaveBeenNthCalledWith(1, '/employees/1/', { user: 7 })
    expect(remove).toHaveBeenNthCalledWith(1, '/employees/4/')
    expect(get).toHaveBeenNthCalledWith(3, '/shifts/')
    expect(post).toHaveBeenNthCalledWith(2, '/shifts/', expect.objectContaining({ employee: 1 }))
    expect(patch).toHaveBeenNthCalledWith(2, '/shifts/2/', { employee: 1 })
    expect(remove).toHaveBeenNthCalledWith(2, '/shifts/2/')
  })
})
