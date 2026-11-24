import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { MAX_RECENTS, recents } from './recents.ts'
import { servings } from './servings.ts'
import type { LogEntry } from './log-store.ts'

const { kcal, grams, foodId, logEntryId } = nutrition

const live = new Map([
  [foodId('a'), { name: 'Schnitzel' }],
  [foodId('b'), { name: 'Soup' }],
])

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
    const result = recents([food('Schnitzel (new)', 'a'), food('Soup', 'b'), food('Schnitzel (old)', 'a')], live)
    expect(result.map((r) => r.name)).toEqual(['Schnitzel', 'Soup'])
  })

  it('shows a Food entry under its Food\'s current name, not the entry snapshot', () => {
    expect(recents([food('Old name', 'a')], live)).toEqual([{ kind: 'food', foodId: foodId('a'), name: 'Schnitzel' }])
  })

  it('identifies a Quick Entry by its name, ignoring case and whitespace', () => {
    const result = recents([quick('Cake'), quick('  cake '), quick('Tea'), quick('CAKE')], live)
    expect(result.map((r) => r.name)).toEqual(['Cake', 'Tea'])
    expect(recents([quick('Ice cream'), quick('ice  \tCREAM')], live)).toHaveLength(1)
  })

  it('does not merge a Food entry with a Quick Entry of the same name', () => {
    expect(recents([food('Cake', 'a'), quick('Cake')], live)).toHaveLength(2)
  })

  it('keeps at most 10, the newest', () => {
    const result = recents(Array.from({ length: MAX_RECENTS + 2 }, (_, i) => quick(`Thing ${i}`)), live)
    expect(result).toHaveLength(MAX_RECENTS)
    expect(result[MAX_RECENTS - 1]?.name).toBe(`Thing ${MAX_RECENTS - 1}`)
  })

  it('drops a Food entry whose Food is no longer live, before applying the limit', () => {
    const dead = food('Gone', 'z')
    expect(recents([dead, food('Soup', 'b')], live).map((r) => r.name)).toEqual(['Soup'])
    const many = [dead, ...Array.from({ length: MAX_RECENTS }, (_, i) => quick(`Thing ${i}`))]
    expect(recents(many, live)).toHaveLength(MAX_RECENTS)
  })

  it('gives a Quick Entry the name and per-Serving Nutrition of its newest occurrence', () => {
    const newest: LogEntry = {
      ...quick('Cake'),
      servings: servings(2),
      nutrition: { kcal: kcal(500), proteinG: grams(10), carbsG: grams(60), fatG: grams(20) },
    }
    expect(recents([newest, quick('cake')], live)).toEqual([
      {
        kind: 'quick',
        name: 'Cake',
        perServing: { kcal: 250, proteinG: 5, carbsG: 30, fatG: 10 },
      },
    ])
  })
})
