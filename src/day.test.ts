import { describe, expect, it } from 'vitest'
import { day, dayOf, isDay } from './day.ts'

describe('Day', () => {
  it('accepts a real calendar date and refuses anything else', () => {
    expect(isDay('2026-03-08')).toBe(true)
    expect(isDay('2026-02-30')).toBe(false)
    expect(isDay('2026-3-8')).toBe(false)
    expect(isDay('')).toBe(false)
  })

  it('names the offending value when the constructor throws', () => {
    expect(() => day('nope')).toThrow('Not a Day: "nope"')
  })

  it('gives the Day an instant falls in, by local time', () => {
    expect(dayOf(new Date(2026, 5, 15, 13, 30))).toBe('2026-06-15')
    expect(dayOf(new Date(2026, 5, 15, 23, 59, 59, 999))).toBe('2026-06-15')
  })

  it('puts an instant exactly at midnight in the Day it starts', () => {
    expect(dayOf(new Date(2026, 5, 16, 0, 0, 0, 0))).toBe('2026-06-16')
    expect(dayOf(new Date(2026, 5, 16, 0, 0, 0, 0) satisfies Date)).not.toBe('2026-06-15')
  })
})
