import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { recents } from './recents.ts'
import { servings } from './servings.ts'
import type { LogEntry } from './log-store.ts'

const { kcal, grams, foodId, logEntryId } = nutrition

let next = 0
function entry(name: string, source: LogEntry['source']): LogEntry {
  return {
    id: logEntryId(`e${next++}`),
    name,
    source,
    nutrition: { kcal: kcal(100), proteinG: grams(1), carbsG: grams(2), fatG: grams(3) },
    servings: servings(1),
    mealType: 'lunch',
    eatenAt: new Date('2026-11-24T12:00:00Z'),
  }
}
const food = (name: string, id: string) => entry(name, { kind: 'food', foodId: foodId(id) })
const quick = (name: string) => entry(name, { kind: 'quick' })

describe('recents', () => {
  it('identifies a Food entry by its Food, keeping the newest occurrence, newest first', () => {
    const result = recents([food('Schnitzel (new)', 'a'), food('Soup', 'b'), food('Schnitzel (old)', 'a')])
    expect(result.map((r) => r.name)).toEqual(['Schnitzel (new)', 'Soup'])
  })

  it('identifies a Quick Entry by its name, ignoring case and surrounding whitespace', () => {
    const result = recents([quick('Cake'), quick('  cake '), quick('Tea'), quick('CAKE')])
    expect(result.map((r) => r.name)).toEqual(['Cake', 'Tea'])
  })

  it('does not merge a Food entry with a Quick Entry of the same name', () => {
    expect(recents([food('Cake', 'a'), quick('Cake')])).toHaveLength(2)
  })
})
