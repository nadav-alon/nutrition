import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { iconFile, iconPath, iconSrc, isIconSrc } from './icon-src.ts'

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
    const src = iconSrc('a.png', dir)
    expect(isIconSrc(src)).toBe(true)
    expect(iconFile(src)).toBe('a.png')
    expect(iconPath(src, dir)).toBe(join(dir, 'a.png'))
  })

  it('tells a versioned URL from a bare file name', () => {
    expect(isIconSrc('a.png')).toBe(false)
    expect(isIconSrc('a.png?v=ba7816bf')).toBe(true)
  })
})
