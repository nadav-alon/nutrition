import { describe, expect, it } from 'vitest'
import type { nutrition } from 'data-platform'
import { guessMealType } from './meal-type.ts'

const at = (hours: number, minutes: number) => new Date(2026, 10, 24, hours, minutes)

describe('guessMealType', () => {
  const cases: [string, Date, nutrition.MealType][] = [
    ['midnight is breakfast', at(0, 0), 'breakfast'],
    ['10:59 is breakfast', at(10, 59), 'breakfast'],
    ['11:00 is lunch', at(11, 0), 'lunch'],
    ['15:59 is lunch', at(15, 59), 'lunch'],
    ['16:00 is dinner', at(16, 0), 'dinner'],
    ['21:30 is dinner', at(21, 30), 'dinner'],
    ['21:30:59 is dinner', new Date(2026, 10, 24, 21, 30, 59), 'dinner'],
    ['21:31 is snack', at(21, 31), 'snack'],
    ['23:59 is snack', at(23, 59), 'snack'],
  ]
  it.each(cases)('%s', (_name, time, expected) => {
    expect(guessMealType(time)).toBe(expected)
  })
})
