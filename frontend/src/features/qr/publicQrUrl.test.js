import { describe, expect, it } from 'vitest'
import { publicQrUrl } from './publicQrUrl.js'

describe('publicQrUrl', () => {
  it('uses only an approved configured HTTPS origin and otherwise retains the stable relative path', () => {
    expect(publicQrUrl('stable-id', 'https://elcruce.test')).toBe('https://elcruce.test/q/stable-id/')
    expect(publicQrUrl('stable-id', 'https://elcruce.test/not-allowed')).toBe('/q/stable-id/')
    expect(publicQrUrl('stable-id', 'http://elcruce.test')).toBe('/q/stable-id/')
  })
})
