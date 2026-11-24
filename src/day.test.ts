import { describe, expect, it } from 'vitest'
import { day, dayEnd, dayOf, dayStart, isDay, nextDay, previousDay } from './day.ts'

process.env.TZ = 'America/New_York'

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
    expect(dayOf(new Date(2026, 5, 15, 23, 59, 59, 999))).toBe('2026-06-15')
  })
})

describe('Day range', () => {
  it('runs from local midnight to the next local midnight', () => {
    expect(dayStart(day('2026-06-15'))).toEqual(new Date(2026, 5, 15))
    expect(dayEnd(day('2026-06-15'))).toEqual(new Date(2026, 5, 16))
  })

  it('includes an instant exactly at midnight in the Day it starts, not the one it ends', () => {
    const midnight = new Date(2026, 5, 16)
    expect(dayStart(day('2026-06-16')).getTime()).toBe(midnight.getTime())
    expect(dayEnd(day('2026-06-15')).getTime()).toBe(midnight.getTime())
  })

  it('is 23 hours long on the spring-forward day and 25 on the fall-back day', () => {
    const hours = (d: string) =>
      (dayEnd(day(d)).getTime() - dayStart(day(d)).getTime()) / 3_600_000
    expect(hours('2026-03-08')).toBe(23)
    expect(hours('2026-11-01')).toBe(25)
    expect(hours('2026-06-15')).toBe(24)
  })

  it('ends a year on the first of the next', () => {
    expect(dayEnd(day('2026-12-31'))).toEqual(new Date(2027, 0, 1))
  })
})

describe('Day stepping', () => {
  const now = new Date(2026, 5, 15, 12)

  it('steps back across month and year ends', () => {
    expect(previousDay(day('2026-03-01'))).toBe('2026-02-28')
    expect(previousDay(day('2026-01-01'))).toBe('2025-12-31')
  })

  it('steps back and forward over a DST-change day without skipping or repeating one', () => {
    expect(previousDay(day('2026-03-09'))).toBe('2026-03-08')
    expect(previousDay(day('2026-03-08'))).toBe('2026-03-07')
    expect(nextDay(day('2026-03-07'), now)).toBe('2026-03-08')
    expect(nextDay(day('2026-03-08'), now)).toBe('2026-03-09')
    expect(previousDay(day('2026-11-02'))).toBe('2026-11-01')
    expect(nextDay(day('2026-11-01'), new Date(2027, 0, 1))).toBe('2026-11-02')
  })

  it('stops at today when stepping forward', () => {
    expect(nextDay(day('2026-06-14'), now)).toBe('2026-06-15')
    expect(nextDay(day('2026-06-15'), now)).toBe('2026-06-15')
  })

  it('treats the instant exactly at midnight as the new today', () => {
    const midnight = new Date(2026, 5, 16)
    expect(nextDay(day('2026-06-15'), midnight)).toBe('2026-06-16')
  })
})
