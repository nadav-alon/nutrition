import { describe, expect, it } from 'vitest'
import { themeRole } from './theme-role.ts'

describe('themeRole', () => {
  it('reads a role as a hex colour', () => {
    expect(themeRole('primary')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('throws naming a role theme.css lacks', () => {
    expect(() => themeRole('no-such-role')).toThrow('theme.css has no --md-sys-color-no-such-role')
  })
})
