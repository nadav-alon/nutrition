import { describe, expect, it } from 'vitest'
import { parseUxArgs } from './ux-args.ts'

describe('parseUxArgs', () => {
  it('defaults to owner-with-items', () => {
    expect(parseUxArgs([])).toBe('owner-with-items')
  })

  it('reads --scenario <name>', () => {
    expect(parseUxArgs(['--scenario', 'new-member'])).toBe('new-member')
  })

  it('reads --scenario=<name>', () => {
    expect(parseUxArgs(['--scenario=new-member'])).toBe('new-member')
  })

  it('refuses an unknown scenario', () => {
    expect(() => parseUxArgs(['--scenario', 'nope'])).toThrow(/Unknown scenario "nope"/)
  })

  it('refuses a missing name or stray arguments with the usage', () => {
    expect(() => parseUxArgs(['--scenario'])).toThrow(/Usage/)
    expect(() => parseUxArgs(['new-member'])).toThrow(/Usage/)
    expect(() => parseUxArgs(['--scenario', 'new-member', 'x'])).toThrow(/Usage/)
  })
})
