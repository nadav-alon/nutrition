import type { nutrition } from 'data-platform'

/** What a Food is made of when it is added: its name, where it is eaten or bought, the label of one Serving, and that Serving's Nutrition. */
export interface FoodFields {
  name: string
  place?: string
  servingLabel?: string
  perServing: nutrition.Nutrition
  /** Whether the Nutrition is a guess rather than read off a label or source. */
  estimated: boolean
}

/** Changes to a Food: what is given replaces what was there, and `null` clears the place or serving label. */
export interface FoodChanges {
  name?: string
  place?: string | null
  servingLabel?: string | null
  perServing?: nutrition.Nutrition
  estimated?: boolean
}

/** A live Food as the Household sees it. */
export interface SavedFood extends FoodFields {
  id: nutrition.FoodId
}

/**
 * The Household's Foods. A Food is soft-deleted rather than removed; a soft-deleted Food is never
 * listed, and the Log Entries that point at it keep their snapshot.
 */
export interface Foods {
  /**
   * Calls `listener` with every live Food, ordered by name, and again after each change. The first
   * call is the current list, so an empty list means the Household has no Foods. Returns how to stop.
   */
  watch(listener: (foods: readonly SavedFood[]) => void): () => void
  /** Saves a new Food and returns its id. */
  add(fields: FoodFields): Promise<nutrition.FoodId>
  /** Applies `changes` to a Food. Rejects when there is no such live Food. */
  edit(id: nutrition.FoodId, changes: FoodChanges): Promise<void>
  /** Soft-deletes a Food. Log Entries that point at it are untouched. Rejects when there is no such live Food. */
  softDelete(id: nutrition.FoodId): Promise<void>
}

/** The order `Foods.watch` lists in. */
export function byName(a: SavedFood, b: SavedFood): number {
  return a.name.localeCompare(b.name)
}
