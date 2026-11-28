import { nutrition as platformNutrition } from 'data-platform'

import type { LogEntry } from './log-store.ts'
import { rescaleNutrition } from './rescale.ts'
import { servings } from './servings.ts'

/** A thing offered for logging again: a saved Food, or a Quick Entry's name, per-Serving Nutrition and Estimated flag. */
export type Recent =
  | { readonly kind: 'food'; readonly foodId: platformNutrition.FoodId; readonly name: string }
  | { readonly kind: 'quick'; readonly name: string; readonly perServing: platformNutrition.Nutrition; readonly estimated?: true }

export const MAX_RECENTS = 10

const quickEntryKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * The distinct things to offer for logging again, from `entries` (newest first): the newest
 * occurrence of each, newest first, at most `MAX_RECENTS`. A Food entry whose Food is not in
 * `liveFoods` is dropped; the rest carry the live Food's current name. A Quick Entry, identified by
 * its name ignoring case and whitespace, carries the name, per-Serving Nutrition and Estimated flag of its newest
 * occurrence.
 */
export function recents(
  entries: readonly LogEntry[],
  liveFoods: ReadonlyMap<platformNutrition.FoodId, Pick<platformNutrition.Food, 'name'>>,
): readonly Recent[] {
  const seenFoods = new Set<platformNutrition.FoodId>()
  const seenQuickEntries = new Set<string>()
  const result: Recent[] = []
  for (const entry of entries) {
    if (result.length === MAX_RECENTS) break
    const { source } = entry
    if (source.kind === 'food') {
      const food = liveFoods.get(source.foodId)
      if (!food || seenFoods.has(source.foodId)) continue
      seenFoods.add(source.foodId)
      result.push({ kind: 'food', foodId: source.foodId, name: food.name })
    } else {
      const key = quickEntryKey(entry.name)
      if (seenQuickEntries.has(key)) continue
      seenQuickEntries.add(key)
      result.push({
        kind: 'quick',
        name: entry.name,
        perServing: rescaleNutrition(entry.nutrition, entry.servings, servings(1)),
        ...(entry.estimated && { estimated: true as const }),
      })
    }
  }
  return result
}
