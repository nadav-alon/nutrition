import { describe, expect, it } from 'vitest'
import { isUrl, url } from './url.ts'

describe('Url', () => {
  it('accepts an absolute URL and a path on this origin', () => {
    expect(isUrl('https://example.com/a')).toBe(true)
    expect(isUrl('/home-catalogue/')).toBe(true)
  })

  it('refuses an empty or padded value', () => {
    expect(isUrl('')).toBe(false)
    expect(isUrl(' /a')).toBe(false)
  })

  it('refuses a value that cannot parse', () => {
    expect(isUrl('http://')).toBe(false)
  })

  it('names the offending value when the constructor throws', () => {
    expect(() => url('')).toThrow('Not a Url: ""')
  })
})
