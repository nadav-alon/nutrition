import { nutrition as platformNutrition } from 'data-platform'

import type { LogEntry } from './log-store.ts'

/** A thing offered for logging again: a saved Food, or a Quick Entry's name and per-Serving Nutrition. */
export type Recent =
  | { readonly kind: 'food'; readonly foodId: platformNutrition.FoodId; readonly name: string }
  | { readonly kind: 'quick'; readonly name: string; readonly perServing: platformNutrition.Nutrition }

export const MAX_RECENTS = 10

const { grams, kcal } = platformNutrition

/**
 * The distinct things to offer for logging again, from `entries` (newest first): the newest
 * occurrence of each, newest first, at most `MAX_RECENTS`. A Food entry whose Food is not in
 * `liveFoods` is dropped. A Quick Entry carries the name and per-Serving Nutrition of its newest
 * occurrence.
 */
export function recents(
  entries: readonly LogEntry[],
  liveFoods: ReadonlySet<platformNutrition.FoodId>,
): readonly Recent[] {
  const seen = new Set<string>()
  const result: Recent[] = []
  for (const entry of entries) {
    if (result.length === MAX_RECENTS) break
    const { source } = entry
    if (source.kind === 'food' && !liveFoods.has(source.foodId)) continue
    const key = source.kind === 'food' ? `food:${source.foodId}` : `quick:${entry.name.trim().toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    if (source.kind === 'food') {
      result.push({ kind: 'food', foodId: source.foodId, name: entry.name })
    } else {
      const perServing = (value: number) => value / entry.servings
      result.push({
        kind: 'quick',
        name: entry.name,
        perServing: {
          kcal: kcal(perServing(entry.nutrition.kcal)),
          proteinG: grams(perServing(entry.nutrition.proteinG)),
          carbsG: grams(perServing(entry.nutrition.carbsG)),
          fatG: grams(perServing(entry.nutrition.fatG)),
        },
      })
    }
  }
  return result
}
