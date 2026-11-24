import type { nutrition } from 'data-platform'

import type { LogEntry } from './log-store.ts'

/** A thing offered for logging again: a saved Food, or a Quick Entry's name and Nutrition. */
export type Recent =
  | { readonly kind: 'food'; readonly foodId: nutrition.FoodId; readonly name: string }
  | { readonly kind: 'quick'; readonly name: string }

/**
 * The distinct things to offer for logging again, from `entries` (newest first): the newest
 * occurrence of each, newest first.
 */
export function recents(entries: readonly LogEntry[]): readonly Recent[] {
  const seen = new Set<string>()
  const result: Recent[] = []
  for (const entry of entries) {
    const key =
      entry.source.kind === 'food' ? `food:${entry.source.foodId}` : `quick:${entry.name.trim().toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(
      entry.source.kind === 'food'
        ? { kind: 'food', foodId: entry.source.foodId, name: entry.name }
        : { kind: 'quick', name: entry.name },
    )
  }
  return result
}
