import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { iconFile, iconSrc } from './icon-src.ts'

describe('iconSrc', () => {
  const dir = mkdtempSync(join(tmpdir(), 'icon-src-'))

  it('versions the file name by the first 8 hex of its content sha256', () => {
    writeFileSync(join(dir, 'a.png'), 'abc')
    expect(iconSrc('a.png', dir)).toBe('a.png?v=ba7816bf')
  })

  it('gives the same URL for the same bytes and a different one when the bytes change', () => {
    writeFileSync(join(dir, 'a.png'), 'abc')
    writeFileSync(join(dir, 'b.png'), 'abc')
    const before = iconSrc('a.png', dir)
    expect(iconSrc('b.png', dir).split('?')[1]).toBe(before.split('?')[1])
    writeFileSync(join(dir, 'a.png'), 'abd')
    expect(iconSrc('a.png', dir)).not.toBe(before)
  })

  it('recovers the file name from a versioned URL', () => {
    expect(iconFile('a.png?v=ba7816bf')).toBe('a.png')
  })
})
